import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { CORE_NPUBS } from '../constants/nostr';
import CacheService from '../lib/services/CacheService';
import { NDKSubscription, NDKUser } from '@nostr-dev-kit/ndk';

// Safety utility for limiting arrays
const safeArrayLimit = <T>(arr: T[] | undefined | null, maxLength = 10000): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  if (arr.length > safeMaxLength) {
    console.warn(`Array exceeded safety limit (${arr.length}), truncating to ${safeMaxLength}`);
    return arr.slice(0, safeMaxLength);
  }
  return [...arr];
};

interface UseNostrGraphOptions {
  coreNpubs?: string[];
  followsLimit?: number;
  followersLimit?: number;
  showMutuals?: boolean;
}

interface UseNostrGraphResult {
  graphData: GraphData | null;
  npubsInGraph: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  relayCount: number;
}

/**
 * Hook for fetching and managing Nostr social graph data
 * Fetches followers and follows for a list of core npubs
 */
export function useNostrGraph({
  coreNpubs = CORE_NPUBS,
  followsLimit = 10,
  followersLimit = 10,
  showMutuals = true,
}: UseNostrGraphOptions = {}): UseNostrGraphResult {
  const { ndk, getUserProfile, ndkReady, getConnectedRelays } = useNostr();
  // Use the CacheService directly since it's exported as a singleton
  
  // State for graph data and loading status
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [npubsInGraph, setNpubsInGraph] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relayCount, setRelayCount] = useState(0);

  // Refs to track internal state
  const fetchInProgress = useRef<boolean>(false);
  const activeSubscriptions = useRef<Map<string, NDKSubscription>>(new Map());

  // Create a cache key for this specific graph configuration
  const cacheKey = useMemo(() => {
    return `graph:${coreNpubs.sort().join(',')}_${showMutuals ? '2deg' : '1deg'}`;
  }, [coreNpubs, showMutuals]);

  // Update relay count
  useEffect(() => {
    const updateRelayCount = () => {
      if (getConnectedRelays) {
        const relays = getConnectedRelays();
        setRelayCount(relays.length);
      }
    };

    updateRelayCount();
    const interval = setInterval(updateRelayCount, 10000);
    
    return () => clearInterval(interval);
  }, [getConnectedRelays]);

  // Clean up subscriptions on unmount
  useEffect(() => {
    return () => {
      // Capture the current value of activeSubscriptions.current
      const subscriptionsToCleanup = activeSubscriptions.current;
      
      if (subscriptionsToCleanup.size > 0) {
        console.log(`Cleaning up ${subscriptionsToCleanup.size} graph subscriptions`);
        subscriptionsToCleanup.forEach((sub) => {
          try {
            sub.stop();
          } catch (e) {
            console.error(`Error stopping subscription:`, e);
          }
        });
        activeSubscriptions.current.clear();
      }
    };
  }, []);

  // Function to fetch profile data for a node
  const fetchNodeProfile = useCallback(async (node: GraphNode): Promise<GraphNode> => {
    if (!node.pubkey || !node.npub) return node;
    
    try {
      // Check cache first
      const cachedProfile = CacheService.profileCache.get(node.npub);
      if (cachedProfile) {
        return {
          ...node,
          name: cachedProfile.displayName || cachedProfile.name || node.name,
          picture: cachedProfile.picture || ''
        };
      }
      
      // Only fetch from network if not in cache
      const profile = await getUserProfile(node.pubkey);
      if (profile) {
        // Cache the profile for future use
        if (node.npub) {
          CacheService.profileCache.set(node.npub, profile);
        }
        
        return {
          ...node,
          name: profile.displayName || profile.name || node.name,
          picture: profile.picture || ''
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch profile for ${node.pubkey}:`, error);
    }
    
    return node;
  }, [getUserProfile]);

  // Debounce function to prevent excessive graph updates
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Debounced version of set graph data to prevent excessive rendering
  const debouncedSetGraphData = useCallback(
    debounce((data: GraphData) => {
      setGraphData(data);
      setNpubsInGraph(data.nodes.filter(n => n.npub).map(n => n.npub!));
      setLoading(false);
    }, 300),
    []
  );

  // Function to fetch follows and followers for all core npubs
  const fetchGraphData = useCallback(async (): Promise<void> => {
    if (fetchInProgress.current || !ndkReady || !ndk) return;
    
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first - use a more reliable mechanism
      const cachedGraph = CacheService.graphCache.get(cacheKey);
      if (cachedGraph && cachedGraph.nodes.length > 0) {
        console.log('Using cached graph data:', cachedGraph.nodes.length, 'nodes');
        debouncedSetGraphData(cachedGraph);
        fetchInProgress.current = false;
        return;
      }

      // Initialize nodes with core npubs
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const pubkeyToNodeId = new Map<string, string>();
      const npubSet = new Set<string>(coreNpubs);
      const mutualSet = new Set<string>();
      
      // Fetch profile data for core npubs and create nodes
      console.log('Fetching profiles for', coreNpubs.length, 'core npubs');
      
      // Process core npubs in batches for better performance
      const BATCH_SIZE = 5;
      for (let i = 0; i < coreNpubs.length; i += BATCH_SIZE) {
        const batch = coreNpubs.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (npub) => {
          if (!npub) return null;
          
          try {
            let pubkey = '';
            
            // Get user from NDK
            if (ndk) {
              const user = ndk.getUser({ npub });
              pubkey = user.pubkey;
            }
            
            if (!pubkey) return null;
            
            const nodeId = `node-${npub}`;
            pubkeyToNodeId.set(pubkey, nodeId);
            
            // Create node with minimal info
            const node: GraphNode = {
              id: nodeId,
              pubkey,
              npub,
              name: '',
              val: 5,
              isCoreNode: true
            };
            
            // Fetch profile data
            return await fetchNodeProfile(node);
          } catch (error) {
            console.error(`Error processing core npub ${npub}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(node => {
          if (node) {
            nodes.push(node);
          }
        });
      }

      // For each core npub, fetch follows and followers in batches
      console.log('Fetching follows and followers for core npubs');
      for (let i = 0; i < coreNpubs.length; i += BATCH_SIZE) {
        const batch = coreNpubs.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (coreNpub) => {
          if (!coreNpub) return null;
          
          try {
            const coreUser = ndk?.getUser({ npub: coreNpub });
            if (!coreUser) return null;
            
            // Fetch followers (users who follow this core npub)
            const followersFilter = { kinds: [3], "#p": [coreUser.pubkey] };
            const followersEvents = await ndk.fetchEvents(followersFilter);
            const followers: NDKUser[] = [];
            
            // Limit to specified number
            let count = 0;
            for (const event of followersEvents) {
              if (count >= followersLimit) break;
              if (event.pubkey) {
                followers.push(ndk.getUser({ pubkey: event.pubkey }));
                count++;
              }
            }
            
            // Fetch follows (users this core npub follows)
            const follows = await coreUser.follows();
            const followsArray = Array.from(follows).slice(0, followsLimit);
            
            const coreNodeId = pubkeyToNodeId.get(coreUser.pubkey);
            if (!coreNodeId) return null;
            
            return { coreNodeId, coreUser, followers, followsArray };
          } catch (error) {
            console.error(`Error fetching connections for ${coreNpub}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
          if (!result) continue;
          const { coreNodeId, coreUser, followers, followsArray } = result;
          
          // Process follows
          for (const followUser of followsArray) {
            const followNpub = followUser.npub;
            const followPubkey = followUser.pubkey;
            
            // Skip if we already have this user
            if (pubkeyToNodeId.has(followPubkey)) {
              // Just add the link
              const targetNodeId = pubkeyToNodeId.get(followPubkey);
              links.push({
                source: coreNodeId,
                target: targetNodeId!,
                type: 'follows',
                value: 1
              });
              continue;
            }
            
            // Add to npub set
            npubSet.add(followNpub);
            
            // Create node ID and add to map
            const nodeId = `node-${followNpub}`;
            pubkeyToNodeId.set(followPubkey, nodeId);
            
            // Create node with minimal info
            const node: GraphNode = {
              id: nodeId,
              pubkey: followPubkey,
              npub: followNpub,
              name: '',
              val: 3,
              isCoreNode: false
            };
            
            // Fetch profile data
            const nodeWithProfile = await fetchNodeProfile(node);
            nodes.push(nodeWithProfile);
            
            // Add link
            links.push({
              source: coreNodeId,
              target: nodeId,
              type: 'follows',
              value: 1
            });
          }
          
          // Process followers
          for (const followerUser of followers) {
            const followerPubkey = followerUser.pubkey;
            const followerNpub = followerUser.npub;
            
            // Check for mutual follow - if the core user follows this follower
            const isMutual = followsArray.some(follow => follow.pubkey === followerPubkey);
            if (isMutual) {
              mutualSet.add(followerPubkey);
            }
            
            // Skip if we already have this user
            if (pubkeyToNodeId.has(followerPubkey)) {
              // Just add the link if not already added by follows
              if (!isMutual) {
                const sourceNodeId = pubkeyToNodeId.get(followerPubkey);
                links.push({
                  source: sourceNodeId!,
                  target: coreNodeId,
                  type: 'follows',
                  value: 1
                });
              }
              continue;
            }
            
            // Add to npub set
            npubSet.add(followerNpub);
            
            // Create node ID and add to map
            const nodeId = `node-${followerNpub}`;
            pubkeyToNodeId.set(followerPubkey, nodeId);
            
            // Create node with minimal info
            const node: GraphNode = {
              id: nodeId,
              pubkey: followerPubkey,
              npub: followerNpub,
              name: '',
              val: 3,
              isCoreNode: false
            };
            
            // Fetch profile data
            const nodeWithProfile = await fetchNodeProfile(node);
            nodes.push(nodeWithProfile);
            
            // Add link
            links.push({
              source: nodeId,
              target: coreNodeId,
              type: 'follows',
              value: 1
            });
          }
        }
      }
      
      // Update mutual links
      if (showMutuals) {
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          if (typeof link.source === 'string' && typeof link.target === 'string') {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            
            if (sourceNode && targetNode && 
                mutualSet.has(sourceNode.pubkey) && 
                mutualSet.has(targetNode.pubkey)) {
              link.type = 'mutual';
              link.value = 2;
            }
          }
        }
      }
      
      // Create final graph data
      const graphData: GraphData = {
        nodes: safeArrayLimit(nodes, 500),
        links: safeArrayLimit(links, 1000),
        lastUpdated: Date.now()
      };
      
      // Update state
      debouncedSetGraphData(graphData);
      
      // Cache the graph data
      CacheService.graphCache.set(cacheKey, graphData);
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setError('Failed to fetch graph data');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [ndk, ndkReady, coreNpubs, followsLimit, followersLimit, showMutuals, fetchNodeProfile, cacheKey]);

  // Initial data fetch
  useEffect(() => {
    if (ndkReady && !graphData) {
      fetchGraphData();
    }
  }, [ndkReady, graphData, fetchGraphData]);

  // Function to manually refresh the data
  const refresh = useCallback(async () => {
    // Clear the cache for this graph
    CacheService.graphCache.clear();
    
    // Fetch fresh data
    await fetchGraphData();
  }, [fetchGraphData]);

  return {
    graphData,
    npubsInGraph: npubsInGraph,
    loading,
    error,
    refresh,
    relayCount
  };
}

export default useNostrGraph; 