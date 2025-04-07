import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { CORE_NPUBS } from '../constants/nostr';
import useCache from './useCache';
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
  const cache = useCache();

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
    return cache.createGraphCacheKey(coreNpubs, showMutuals);
  }, [coreNpubs, showMutuals, cache]);

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
    if (!node.pubkey) return node;
    
    try {
      const profile = await getUserProfile(node.pubkey);
      if (profile) {
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

  // Function to fetch follows and followers for all core npubs
  const fetchGraphData = useCallback(async (): Promise<void> => {
    if (fetchInProgress.current || !ndkReady || !ndk) return;
    
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cachedGraph = cache.getCachedGraph(cacheKey);
      if (cachedGraph) {
        setGraphData(cachedGraph);
        setNpubsInGraph(cachedGraph.nodes.filter(n => n.npub).map(n => n.npub!));
        setLoading(false);
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
      for (const npub of coreNpubs) {
        if (!npub) continue;
        
        try {
          let pubkey = '';
          
          // Get user from NDK
          if (ndk) {
            const user = ndk.getUser({ npub });
            pubkey = user.pubkey;
          }
          
          if (!pubkey) continue;
          
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
          const nodeWithProfile = await fetchNodeProfile(node);
          nodes.push(nodeWithProfile);
        } catch (error) {
          console.error(`Error processing core npub ${npub}:`, error);
        }
      }
      
      // For each core npub, fetch follows and followers
      for (const coreNpub of coreNpubs) {
        if (!coreNpub) continue;
        
        try {
          const coreUser = ndk?.getUser({ npub: coreNpub });
          if (!coreUser) continue;
          
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
          if (!coreNodeId) continue;
          
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
            const followerNpub = followerUser.npub;
            const followerPubkey = followerUser.pubkey;
            
            // Check for mutual follow
            const isMutual = Array.from(follows).some(f => f.pubkey === followerPubkey);
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
        } catch (error) {
          console.error(`Error processing connections for ${coreNpub}:`, error);
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
      setGraphData(graphData);
      setNpubsInGraph(Array.from(npubSet));
      
      // Cache the graph data
      cache.setCachedGraph(cacheKey, graphData);
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setError('Failed to fetch graph data');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [ndk, ndkReady, coreNpubs, followsLimit, followersLimit, showMutuals, fetchNodeProfile, cache, cacheKey]);

  // Initial data fetch
  useEffect(() => {
    if (ndkReady && !graphData) {
      fetchGraphData();
    }
  }, [ndkReady, graphData, fetchGraphData]);

  // Function to manually refresh the data
  const refresh = useCallback(async () => {
    // Clear the cache for this graph
    cache.clearCache('graph');
    
    // Fetch fresh data
    await fetchGraphData();
  }, [cache, fetchGraphData]);

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