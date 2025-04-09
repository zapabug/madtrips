import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { nip19 } from 'nostr-tools';
import { BRAND_COLORS } from '../constants/brandColors';
import { getRandomLoadingMessage, getLoadingMessageSequence } from '../constants/loadingMessages';
import { useCache } from '../hooks/useCache';
import NDK, { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';

// Safety utility function to prevent array length errors
const safeArrayLimit = <T>(arr: T[] | undefined | null, maxLength = 10000): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  // Ensure maxLength is a positive integer
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  if (arr.length > safeMaxLength) {
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

  // Single subscription reference for better management
  const activeSubscriptionRef = useRef<NDKSubscription | null>(null);
  
  // Add a cleanup effect for subscription
  useEffect(() => {
    // Return cleanup function
    return () => {
      // Clean up subscription
      if (activeSubscriptionRef.current) {
        try {
          activeSubscriptionRef.current.stop();
          activeSubscriptionRef.current = null;
        } catch (e) {
          // Error handling moved to NostrContext.tsx
        }
      }
      
      // Clear any other resources
      fetchInProgress.current = false;
    };
  }, []);

  // Client-side detection effect - only runs once
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update relay count from context
  useEffect(() => {
    setRelayCount(contextRelayCount);
  }, [contextRelayCount]);

  // Effective npubs to include in the graph (including center npub)
  const effectiveNpubs = useMemo(() => 
    [...new Set([...npubs, ...(centerNpub ? [centerNpub] : [])])],
    [npubs, centerNpub]
  );

  // New function to fetch contacts for a single node
  const fetchNodeContacts = useCallback(async (pubkey: string, maxContacts = 50): Promise<string[]> => {
    if (!ndk) return [];
    
    try {
      // Fetch the most recent contact list (kind 3)
      const filter = {
        kinds: [3],
        authors: [pubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      
      if (events.size === 0) {
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
      return [];
    }
  }, [ndk]);
  
  // Function to fetch profile data for nodes
  const fetchProfiles = useCallback(async (nodes: GraphNode[]): Promise<GraphNode[]> => {
    if (!ndk || nodes.length === 0) return nodes;
    
    const updatedNodes = [...nodes];
    
    // Process in smaller batches for better performance
    const batchSize = 20;
    for (let i = 0; i < updatedNodes.length; i += batchSize) {
      const batch = updatedNodes.slice(i, i + batchSize);
      
      // Process each node in the batch
      await Promise.all(batch.map(async (node) => {
        try {
          // Only fetch if we have an npub
          if (!node.npub) return;
          
          // Get profile data
          const profile = await getUserProfile(node.npub);
          
          if (profile) {
            // Update node with profile data
            node.name = profile.displayName || profile.name || shortenNpub(node.npub);
            node.picture = profile.picture || '';
            // Store extra metadata on the node object if needed
            (node as any).metadata = {
              about: profile.about,
              displayName: profile.displayName,
              name: profile.name
            };
          }
        } catch (error) {
          // Silently fail for individual profile fetches
        }
      }));
    }
    
    return updatedNodes;
  }, [ndk, getUserProfile, shortenNpub]);

  // Function to fetch graph data
  const fetchGraphData = useCallback(async (): Promise<GraphData | null> => {
    if (fetchInProgress.current) return null;
    
    fetchInProgress.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we have cached data first - use more aggressively
      const cacheKey = cache.createGraphCacheKey(effectiveNpubs, showSecondDegree);
      const cachedGraph = cache.getCachedGraph(cacheKey);
      
      if (cachedGraph) {
        console.log('Using cached graph data:', cachedGraph.nodes.length, 'nodes');
        // Use cached data immediately to prevent waiting
        setIsLoading(false);
        return cachedGraph;
      }

      // Clean up any existing subscriptions before creating new ones
      if (activeSubscriptionRef.current) {
        try {
          activeSubscriptionRef.current.stop();
          activeSubscriptionRef.current = null;
        } catch (e) {
          // Ignore errors during cleanup
        }
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
      
      // Cache the result with a longer TTL
      cache.setCachedGraph(cacheKey, result);
      
      return result;
    } catch (error) {
      setError('Failed to load social graph');
      return null;
    } finally {
      fetchInProgress.current = false;
      setIsLoading(false);
    }
  }, [cache, effectiveNpubs, showSecondDegree, shortenNpub, fetchProfiles]);

  // Load second-degree connections
  const loadSecondDegreeConnections = useCallback(async (
    initialGraph: GraphData,
    nodePubkeys: Map<string, string>
  ): Promise<void> => {
    if (!ndk || nodePubkeys.size === 0) return;
    
    // Track new nodes and links
    const secondDegreeNodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const loadedSecondDegreeNpubs: string[] = [];
    
    // Create a map of known pubkeys to avoid duplicates
    const knownPubkeys = new Set<string>();
    initialGraph.nodes.forEach(node => {
      if (node.pubkey) knownPubkeys.add(node.pubkey);
    });
    
    // Process each node to fetch its contacts
    for (const [npub, pubkey] of nodePubkeys.entries()) {
      if (!pubkey) continue;
      
      // Fetch contacts for this pubkey
      const contacts = await fetchNodeContacts(pubkey, maxConnections);
      
      // Skip if no contacts found
      if (contacts.length === 0) continue;
      
      // Process each contact
      for (const contactPubkey of contacts) {
        if (knownPubkeys.has(contactPubkey)) {
          // This is a connection between known nodes - just add a link
          const targetNode = initialGraph.nodes.find(n => n.pubkey === contactPubkey);
          if (targetNode) {
            const sourceNodeId = `node-${npub}`;
            const targetNodeId = targetNode.id;
            
            // Check if this link already exists
            const linkExists = links.some(link => 
              (link.source === sourceNodeId && link.target === targetNodeId) ||
              (link.source === targetNodeId && link.target === sourceNodeId)
            );
            
            if (!linkExists) {
              links.push({
                source: sourceNodeId,
                target: targetNodeId,
                value: 1,
                color: BRAND_COLORS.lightSand + '99',
                type: 'follows'
              });
            }
          }
        } else if (secondDegreeNodes.length < maxSecondDegreeNodes) {
          // This is a new node - add it as a second-degree connection
          try {
            // Convert pubkey to npub
            const contactNpub = nip19.npubEncode(contactPubkey);
            
            // Add as second-degree npub for external use
            if (!loadedSecondDegreeNpubs.includes(contactNpub)) {
              loadedSecondDegreeNpubs.push(contactNpub);
            }
            
            // Create a new graph node
            const newNode: GraphNode = {
              id: `node-${contactNpub}`,
              name: shortenNpub(contactNpub),
              npub: contactNpub,
              pubkey: contactPubkey,
              val: 3, // Smaller nodes for second-degree
              isCoreNode: false
            };
            
            // Add the node
            secondDegreeNodes.push(newNode);
            knownPubkeys.add(contactPubkey);
            
            // Add a link to the node
            links.push({
              source: `node-${npub}`,
              target: newNode.id,
              value: 1,
              color: BRAND_COLORS.lightSand + '99',
              type: 'follows'
            });
          } catch (e) {
            // Skip this contact
          }
        }
      }
    }
    
    // Update second-degree npubs for external use
    setSecondDegreeNpubs(loadedSecondDegreeNpubs);
    
    // If we found any new nodes or links, update the graph
    if (secondDegreeNodes.length > 0 || links.length > 0) {
      // Create a new graph with the additional nodes and links
      const updatedGraph = {
        nodes: safeMergeArrays(initialGraph.nodes, secondDegreeNodes, 5000),
        links: safeMergeArrays(initialGraph.links, links, 10000),
        lastUpdated: Date.now()
      };
      
      // Update the graph
      graphDataRef.current = updatedGraph;
      setGraph(updatedGraph);
      
      // Fetch profiles for second-degree nodes after a delay
      // This helps improve the initial graph load time
      setTimeout(async () => {
        const updatedNodes = await fetchProfiles(secondDegreeNodes);
        
        if (updatedNodes.length > 0 && graphDataRef.current) {
          // Replace the nodes in the graph with the updated profiles
          const currentNodes = safeArrayLimit(graphDataRef.current.nodes, 5000);
          const filteredNodes = currentNodes.filter(n => !secondDegreeNodes.some(nn => nn.id === n.id));
          
          const updatedGraph = {
            nodes: safeMergeArrays(filteredNodes, updatedNodes, 5000),
            links: safeArrayLimit(graphDataRef.current.links, 10000),
            lastUpdated: Date.now()
          };
          
          graphDataRef.current = updatedGraph;
          setGraph(updatedGraph);
        }
      }, 2000);
    }
  }, [fetchNodeContacts, maxConnections, maxSecondDegreeNodes, ndk, shortenNpub, fetchProfiles]);

  // Refresh the graph
  const refreshGraph = useCallback(async (): Promise<void> => {
    // Clean up any active subscriptions
    if (activeSubscriptionRef.current) {
      try {
        activeSubscriptionRef.current.stop();
        activeSubscriptionRef.current = null;
      } catch (e) {
        // Silent error during cleanup
      }
    }
    
    // Skip if NDK not ready
    if (!ndkReady) {
      setError('Nostr connection not ready');
      return;
    }
    
    // Skip if no NDK
    if (!ndk) {
      setError('NDK not initialized');
      return;
    }
    
    // Show loading state
    setIsLoading(true);
    
    // Show loading message updates
    const loadingInterval = setInterval(() => {
      setLoadingMessage(getRandomLoadingMessage('GRAPH'));
    }, 3000);
    
    try {
      // First, try to fetch initial graph data (nodes, links) with timeout
      const fetchPromise = fetchGraphData();
      const initialGraphData = await Promise.race([
        fetchPromise,
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Graph data fetch timeout')), 15000);
        })
      ]);
      
      if (!initialGraphData) {
        clearInterval(loadingInterval);
        return;
      }
      
      // Set initial data and update ref
      setGraph(initialGraphData);
      graphDataRef.current = initialGraphData;
      
      // Only fetch pubkeys for nodes that don't already have them
      const nodePubkeys = new Map<string, string>();
      const nodesToProcess = initialGraphData.nodes.filter(node => !node.pubkey);
      
      // Start a batch of profile lookups by npub
      for (const node of nodesToProcess) {
        if (!node.npub) continue;
        
        try {
          // Convert npub to pubkey if needed
          const pubkey = ndk.getUser({ npub: node.npub }).pubkey;
          node.pubkey = pubkey;
          nodePubkeys.set(node.npub, pubkey);
        } catch (e) {
          // Skip this node
        }
      }
      
      // Update the graph with pubkeys
      setGraph({...initialGraphData});
      
      // If we should load second-degree connections (follows of follows)
      if (showSecondDegree && initialGraphData.nodes.length > 0) {
        await loadSecondDegreeConnections(initialGraphData, nodePubkeys);
      }
    } catch (error) {
      setError('Failed to load graph data');
    } finally {
      clearInterval(loadingInterval);
      setIsLoading(false);
    }
  }, [ndkReady, ndk, fetchGraphData, showSecondDegree, loadSecondDegreeConnections]);

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
      // Error handling moved to NostrContext.tsx
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
      // Error handling moved to NostrContext.tsx
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