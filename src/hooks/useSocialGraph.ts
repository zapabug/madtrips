import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { nip19 } from 'nostr-tools';
import { BRAND_COLORS } from '../constants/brandColors';
import { getRandomLoadingMessage, getLoadingMessageSequence } from '../constants/loadingMessages';
import useCache from './useCache';
import NDK, { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';

// Safety utility function to prevent array length errors
const safeArrayLimit = <T>(arr: T[] | undefined | null, maxLength = 10000): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  // Ensure maxLength is a positive integer
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  if (arr.length > safeMaxLength) {
    console.warn(`Array exceeded safety limit (${arr.length}), truncating to ${safeMaxLength}`);
    return arr.slice(0, safeMaxLength);
  }
  return [...arr]; // Return a new array to avoid reference issues
};

// Safe array merge utility to prevent length errors
const safeMergeArrays = <T>(arrayA: T[] | undefined | null, arrayB: T[] | undefined | null, maxLength = 10000): T[] => {
  // Ensure arrays are valid
  const a = safeArrayLimit(arrayA, maxLength);
  const b = safeArrayLimit(arrayB, maxLength);
  
  // Ensure maxLength is a positive integer
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  
  // Check if merged length would exceed limit
  const totalLength = a.length + b.length;
  if (totalLength > safeMaxLength) {
    console.warn(`Merged array would exceed safety limit (${totalLength}), truncating`);
    
    // Prioritize existing elements (a) over new elements (b)
    const availableSpace = Math.max(0, safeMaxLength - a.length);
    return [...a, ...b.slice(0, availableSpace)];
  }
  
  // Return a new array with merged elements
  return [...a, ...b];
};

interface UseSocialGraphProps {
  npubs: string[];
  centerNpub?: string;
  maxConnections?: number;
  showSecondDegree?: boolean;
  maxSecondDegreeNodes?: number;
}

interface UseSocialGraphResult {
  graph: GraphData | null;
  loading: boolean;
  error: string | null;
  isClient: boolean;
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  loadingMessage: string;
  relayCount: number;
  isConnecting: boolean;
  refresh: () => Promise<void>;
  connectMoreRelays: () => Promise<void>;
  expandNode?: (nodeId: string) => Promise<void>;
  secondDegreeNpubs: string[];
  followUser: (fromPubkey: string, toPubkey: string) => Promise<boolean>;
  unfollowUser: (fromPubkey: string, toPubkey: string) => Promise<boolean>;
  isUserFollowing: (fromPubkey: string, toPubkey: string) => Promise<boolean>;
}

export const useSocialGraph = ({
  npubs,
  centerNpub,
  maxConnections = 25,
  showSecondDegree = false,
  maxSecondDegreeNodes = 50,
}: UseSocialGraphProps): UseSocialGraphResult => {
  const { getUserProfile, shortenNpub, ndkReady, ndk, relayCount: contextRelayCount, reconnect } = useNostr();
  const cache = useCache();

  // State for graph data and UI
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [secondDegreeNpubs, setSecondDegreeNpubs] = useState<string[]>([]);

  // Refs to track internal state across renders
  const fetchInProgress = useRef<boolean>(false);
  const graphDataRef = useRef<GraphData | null>(null);

  // Track active subscriptions for cleanup
  const activeSubscriptions = useRef<Map<string, NDKSubscription>>(new Map());
  
  // Add a cleanup effect for all subscriptions
  useEffect(() => {
    // Return cleanup function
    return () => {
      // Clean up all active subscriptions
      if (activeSubscriptions.current.size > 0) {
        console.log(`Cleaning up ${activeSubscriptions.current.size} graph subscriptions`);
        activeSubscriptions.current.forEach((sub) => {
          try {
            sub.stop();
          } catch (e) {
            console.error(`Error stopping subscription:`, e);
          }
        });
        activeSubscriptions.current.clear();
      }
      
      // Clear any other resources
      fetchInProgress.current = false;
    };
  }, []);

  // Effective npubs to include in the graph (including center npub)
  const effectiveNpubs = useMemo(() => 
    [...new Set([...npubs, ...(centerNpub ? [centerNpub] : [])])],
    [npubs, centerNpub]
  );

  // Function to fetch profiles for nodes
  const fetchProfiles = useCallback(async (nodes: GraphNode[]): Promise<GraphNode[]> => {
    if (!ndkReady) return nodes;
    
    const updatedNodes = [...nodes];
    
    for (const node of updatedNodes) {
      if (!node.pubkey) continue;
      
      try {
        const profile = await getUserProfile(node.pubkey);
        if (profile) {
          node.name = profile.displayName || profile.name || node.name;
          node.picture = profile.picture || '';
        }
      } catch (error) {
        console.warn(`Failed to fetch profile for ${node.pubkey}:`, error);
      }
    }
    
    return updatedNodes;
  }, [getUserProfile, ndkReady]);

  // Function to fetch graph data
  const fetchGraphData = useCallback(async (): Promise<GraphData | null> => {
    if (fetchInProgress.current) return null;
    
    fetchInProgress.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we have cached data first
      const cacheKey = cache.createGraphCacheKey(effectiveNpubs, showSecondDegree);
      const cachedGraph = cache.getCachedGraph(cacheKey);
      
      if (cachedGraph) {
        console.log('Using cached graph data');
        return cachedGraph;
      }

      // Fetch real-time data from relays
      const expandedNpubs = [...effectiveNpubs];
      
      // Create a basic graph with just the core npubs
      const nodes: GraphNode[] = expandedNpubs.map(npub => ({
        id: `node-${npub}`,
        name: shortenNpub(npub),
        npub,
        pubkey: '',
        val: 5,
        isCoreNode: true
      }));
      
      // Fetch profiles for all nodes
      const nodesWithProfiles = await fetchProfiles(nodes);
      
      const result: GraphData = {
        nodes: nodesWithProfiles,
        links: [],
        lastUpdated: Date.now()
      };
      
      // Cache the result
      cache.setCachedGraph(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setError('Failed to load social graph');
      return null;
    } finally {
      fetchInProgress.current = false;
      setIsLoading(false);
    }
  }, [cache, effectiveNpubs, showSecondDegree, shortenNpub, fetchProfiles]);

  // New function to fetch contacts for a single node
  const fetchNodeContacts = useCallback(async (pubkey: string, maxContacts = 50): Promise<string[]> => {
    if (!ndk) return [];
    
    try {
      console.log(`Fetching contacts for ${pubkey.substring(0, 8)}...`);
      
      // Fetch the most recent contact list (kind 3)
      const filter = {
        kinds: [3],
        authors: [pubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      
      if (events.size === 0) {
        console.log(`No contacts found for ${pubkey.substring(0, 8)}...`);
        return [];
      }
      
      const event = Array.from(events)[0] as NDKEvent;
      if (!event || !event.tags) return [];
      
      // Extract p tags (contacts)
      const contactTags = event.tags.filter((tag: string[]) => tag[0] === 'p');
      const contacts = contactTags.map((tag: string[]) => tag[1]);
      
      // Limit to maxContacts
      const limitedContacts = contacts.slice(0, maxContacts);
      
      return limitedContacts;
    } catch (error) {
      console.error(`Error fetching contacts for ${pubkey.substring(0, 8)}:`, error);
      return [];
    }
  }, [ndk]);

  // Refresh the graph
  const refreshGraph = useCallback(async (): Promise<void> => {
    // Clean up any active subscriptions
    activeSubscriptions.current.forEach((sub) => {
      try {
        sub.stop();
      } catch (e) {
        console.error(`Error stopping subscription:`, e);
      }
    });
    activeSubscriptions.current.clear();
    
    // Clear cache for this graph
    const cacheKey = cache.createGraphCacheKey(effectiveNpubs, showSecondDegree);
    cache.setCachedGraph(cacheKey, null as unknown as GraphData);
    
    // Fetch fresh data
    const graphData = await fetchGraphData();
    
    if (graphData) {
      graphDataRef.current = graphData;
      setGraph(graphData);
    }
  }, [cache, effectiveNpubs, showSecondDegree, fetchGraphData]);

  // Set initial state on client-side only
  useEffect(() => {
    setIsClient(true);
    setLoadingMessage(getRandomLoadingMessage('GRAPH'));

    // Use relayCount from context instead of duplicating logic
    setRelayCount(contextRelayCount);
    
    // Update relay count periodically from context
    const intervalId = setInterval(() => {
      setRelayCount(contextRelayCount);
      
      // If we get new relay connections while loading, try to refresh
      if (loading && contextRelayCount > 0 && fetchInProgress.current === false) {
        refreshGraph();
      }
    }, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [loading, contextRelayCount, refreshGraph]);

  // Initialize loading messages
  useEffect(() => {
    if (loading && isClient) {
      // Set up rotation of loading messages
      const interval = setInterval(() => {
        const messages = getLoadingMessageSequence('GRAPH', 5);
        const index = Math.floor(Math.random() * messages.length);
        setLoadingMessage(messages[index]);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [loading, isClient]);

  // Expand a single node to show its connections
  const expandNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!graphDataRef.current || !nodeId || !ndk) return;
    
    const node = graphDataRef.current.nodes.find(n => n.id === nodeId);
    if (!node || !node.pubkey) return;
    
    setIsConnecting(true);
    
    try {
      const contacts = await fetchNodeContacts(node.pubkey, 30);
      if (contacts.length === 0) {
        setIsConnecting(false);
        return;
      }
      
      // Convert hex pubkeys to npubs for consistency
      const contactNpubs = safeArrayLimit(contacts, 100).map(hexPubkey => nip19.npubEncode(hexPubkey));
      
      // Create new nodes for contacts that don't exist
      const existingNodeIds = new Set(graphDataRef.current.nodes.map(n => n.id));
      const newNodes: GraphNode[] = [];
      
      for (const npub of contactNpubs) {
        const nodeId = `node-${npub}`;
        
        if (!existingNodeIds.has(nodeId)) {
          newNodes.push({
            id: nodeId,
            name: shortenNpub(npub),
            npub: npub,
            pubkey: contacts[contactNpubs.indexOf(npub)],
            val: 3, // Smaller nodes for contacts
            isCoreNode: false
          });
        }
      }
      
      // Add new links
      const newLinks: GraphLink[] = [];
      
      contactNpubs.forEach(contactNpub => {
        const sourceId = nodeId;
        const targetId = `node-${contactNpub}`;
        
        // Check if this link already exists
        const linkExists = graphDataRef.current?.links.some(link => 
          (link.source === sourceId && link.target === targetId) ||
          (link.source === targetId && link.target === sourceId)
        );
        
        if (!linkExists) {
          newLinks.push({
            source: sourceId,
            target: targetId,
            value: 1,
            color: BRAND_COLORS.lightSand + '99',
            type: 'follows'
          });
        }
      });
      
      // Update the graph with new nodes and links
      if (newNodes.length > 0 || newLinks.length > 0) {
        // Use safe array merge to prevent length errors
        const updatedGraph = {
          nodes: safeMergeArrays(graphDataRef.current.nodes, newNodes, 5000),
          links: safeMergeArrays(graphDataRef.current.links, newLinks, 10000),
          lastUpdated: Date.now()
        };
        
        graphDataRef.current = updatedGraph;
        setGraph(updatedGraph);
        
        // Fetch profiles for new nodes
        fetchProfiles(newNodes).then(updatedNodes => {
          if (updatedNodes.length > 0) {
            const currentNodes = safeArrayLimit(graphDataRef.current!.nodes, 5000);
            const filteredNodes = currentNodes.filter(n => !newNodes.some(nn => nn.id === n.id));
            
            const updatedGraph = {
              nodes: safeMergeArrays(filteredNodes, updatedNodes, 5000),
              links: safeArrayLimit(graphDataRef.current!.links, 10000),
              lastUpdated: Date.now()
            };
            
            graphDataRef.current = updatedGraph;
            setGraph(updatedGraph);
          }
        });
      }
    } catch (error) {
      console.error('Error expanding node:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [shortenNpub, fetchNodeContacts, fetchProfiles, ndk]);

  // Function to connect more relays - use NostrContext's reconnect
  const connectMoreRelays = useCallback(async () => {
    setIsConnecting(true);
    
    try {
      await reconnect();
    } catch (error) {
      console.error('Error connecting more relays:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [reconnect]);

  // Initial graph load on component mount (once we're on the client)
  useEffect(() => {
    if (isClient && !graph) {
      refreshGraph();
    }
  }, [isClient, graph, refreshGraph]);

  // Check if a user follows another user - use the ndk instance from context
  const isUserFollowing = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    try {
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      const event = Array.from(events)[0] as NDKEvent;
      
      if (!event) return false;
      
      // Check if toPubkey is in the p tags
      return event.tags.some((tag: string[]) => tag[0] === 'p' && tag[1] === toPubkey);
    } catch (error) {
      console.error('Error checking following status:', error);
      return false;
    }
  }, [ndk]);

  // Follow a user - use the ndk instance from context
  const followUser = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    try {
      // Get current contact list
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      const oldEvent = Array.from(events)[0] as NDKEvent;
      
      // Create new event tags, preserving existing contacts
      const tags = oldEvent ? [...oldEvent.tags] : [];
      
      // Check if already following
      const alreadyFollowing = tags.some((tag: string[]) => tag[0] === 'p' && tag[1] === toPubkey);
      if (alreadyFollowing) return true;
      
      // Add the new contact
      tags.push(['p', toPubkey]);
      
      // Create and publish new contact list
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = 3;
      newEvent.tags = tags;
      
      await newEvent.publish();
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      return false;
    }
  }, [ndk]);

  // Unfollow a user - use the ndk instance from context
  const unfollowUser = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    try {
      // Get current contact list
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      const oldEvent = Array.from(events)[0] as NDKEvent;
      
      if (!oldEvent) return false;
      
      // Remove the contact from tags
      const tags = oldEvent.tags.filter((tag: string[]) => !(tag[0] === 'p' && tag[1] === toPubkey));
      
      // Create and publish new contact list
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = 3;
      newEvent.tags = tags;
      
      await newEvent.publish();
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }
  }, [ndk]);

  // Return the graph and utility functions
  return {
    graph,
    loading,
    error,
    isClient,
    selectedNode,
    setSelectedNode,
    loadingMessage,
    relayCount,
    isConnecting,
    refresh: refreshGraph,
    connectMoreRelays,
    expandNode,
    secondDegreeNpubs,
    followUser,
    unfollowUser,
    isUserFollowing
  };
}; 