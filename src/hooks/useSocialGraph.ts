import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { nip19 } from 'nostr-tools';
import { DEFAULT_PROFILE_IMAGE } from '../utils/profileUtils';
import { BRAND_COLORS } from '../constants/brandColors';
import { getRandomLoadingMessage, getLoadingMessageSequence } from '../constants/loadingMessages';
import useCache from './useCache';
import { MCPNostrOptions, validateNostrData, fetchProfilesWithWoT } from '../../mcp/nostr-integration';
import RelayService from '../lib/services/RelayService';
import NDK, { NDKEvent, NDKFilter, NDKUser, NDKSubscription } from '@nostr-dev-kit/ndk';

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
  continuousLoading?: boolean;
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
  continuousLoading = false,
  maxSecondDegreeNodes = 50,
}: UseSocialGraphProps): UseSocialGraphResult => {
  const { getUserProfile, shortenNpub, ndkReady } = useNostr();
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
  const [profilesLoaded, setProfilesLoaded] = useState(0);
  const [secondDegreeNpubs, setSecondDegreeNpubs] = useState<string[]>([]);
  const [hasRealData, setHasRealData] = useState(false);

  // Refs to track internal state across renders
  const fetchInProgress = useRef<boolean>(false);
  const continuousUpdateActive = useRef<boolean>(false);
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
        activeSubscriptions.current.forEach((sub, id) => {
          try {
            sub.stop();
            console.log(`Stopped subscription: ${id}`);
          } catch (e) {
            console.error(`Error stopping subscription ${id}:`, e);
          }
        });
        activeSubscriptions.current.clear();
      }
      
      // Clear any other resources
      fetchInProgress.current = false;
      continuousUpdateActive.current = false;
    };
  }, []);

  // Function to register a subscription for later cleanup
  const registerSubscription = useCallback((id: string, subscription: NDKSubscription) => {
    activeSubscriptions.current.set(id, subscription);
  }, []);
  
  // Function to unregister a subscription
  const unregisterSubscription = useCallback((id: string) => {
    if (activeSubscriptions.current.has(id)) {
      const sub = activeSubscriptions.current.get(id);
      if (sub) {
        try {
          sub.stop();
        } catch (e) {
          console.error(`Error stopping subscription ${id}:`, e);
        }
      }
      activeSubscriptions.current.delete(id);
    }
  }, []);

  // Effective npubs to include in the graph (including center npub)
  const effectiveNpubs = [...new Set([...npubs, ...(centerNpub ? [centerNpub] : [])])];

  // New options for MCP integration
  const mcpOptions: MCPNostrOptions = useMemo(() => ({
    enforceRealData: true, // Always enforce real data
    useWebOfTrust: showSecondDegree,
    maxSecondDegreeNodes,
    coreNpubs: effectiveNpubs,
  }), [effectiveNpubs, showSecondDegree, maxSecondDegreeNodes]);

  // Set initial state on client-side only
  useEffect(() => {
    setIsClient(true);
    setLoadingMessage(getRandomLoadingMessage('GRAPH'));

    // Use RelayService for relay status updates
    const updateRelayCount = () => {
      const relays = RelayService.getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    // Initial update
    updateRelayCount();
    
    // Subscribe to relay status updates
    const unsubscribe = RelayService.onStatusUpdate((relays) => {
      setRelayCount(relays.length);
      
      // If we get new relay connections while loading, try to refresh
      if (loading && relays.length > 0 && fetchInProgress.current === false) {
        refreshGraph();
      }
    });
    
    return () => {
      unsubscribe(); // Clean up the subscription
    };
  }, [loading]);

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

  // Remove the failsafe graph function as we don't want mock data
  const createFailsafeGraph = useCallback((): GraphData | null => {
    console.warn('Real data unavailable - returning null instead of fallback graph');
    // Return null instead of creating a mock graph
    return null;
  }, []);

  // Function to fetch profiles for nodes
  const fetchProfiles = useCallback(async (nodes: GraphNode[]): Promise<GraphNode[]> => {
    if (!ndkReady || !nodes || !Array.isArray(nodes)) return [];
    
    // Apply safety limit to incoming nodes
    const safeNodes = safeArrayLimit(nodes, 500);
    if (safeNodes.length === 0) return [];
    
    // Reset profile loaded counter
    setProfilesLoaded(0);
    
    // Create a new result array with the same length
    const result = safeNodes.map(node => ({...node}));
    let loadedCount = 0;
    
    // Process nodes in smaller batches
    const batchSize = 5;
    for (let i = 0; i < safeNodes.length; i += batchSize) {
      const batch = safeNodes.slice(i, Math.min(i + batchSize, safeNodes.length));
      
      // Process nodes that need profile data
      await Promise.all(batch.map(async (node) => {
        const nodeIndex = safeNodes.findIndex(n => n.id === node.id);
        if (nodeIndex === -1) return;
        
        if (!node.name || node.name === shortenNpub(node.npub || '')) {
          try {
            // Check cache first
            const npubKey = node.npub || '';
            const cachedProfile = cache.getCachedProfile(npubKey);
            
            if (cachedProfile) {
              // Use cached profile
              result[nodeIndex] = {
                ...node,
                name: cachedProfile.displayName || cachedProfile.name || shortenNpub(node.npub || ''),
                picture: cachedProfile.picture || DEFAULT_PROFILE_IMAGE
              };
              
              loadedCount++;
              setProfilesLoaded(loadedCount);
              return;
            }
            
            // Fetch from Nostr if not in cache
            if (getUserProfile && node.npub) {
              const profile = await getUserProfile(node.npub);
              if (profile) {
                // Use fetched profile
                result[nodeIndex] = {
                  ...node,
                  name: profile.displayName || profile.name || shortenNpub(node.npub || ''),
                  picture: profile.picture || DEFAULT_PROFILE_IMAGE
                };
                
                // Cache the profile
                cache.setCachedProfile(node.npub, profile);
                loadedCount++;
                setProfilesLoaded(loadedCount);
              }
            }
          } catch (e) {
            console.warn(`Error fetching profile for ${node.npub || 'unknown node'}:`, e);
          }
        }
      }));
    }
    
    // Filter out any undefined entries and return
    return result.filter(Boolean);
  }, [getUserProfile, shortenNpub, cache, ndkReady]);

  // New function to fetch contacts for a single node
  const fetchNodeContacts = useCallback(async (pubkey: string, maxContacts = 50): Promise<string[]> => {
    const ndk = RelayService.getNDK();
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
      
      const event = Array.from(events)[0];
      if (!event || !event.tags) return [];
      
      // Extract p tags (contacts)
      const contactTags = event.tags.filter(tag => tag[0] === 'p');
      const contacts = contactTags.map(tag => tag[1]);
      
      // Limit to maxContacts
      const limitedContacts = contacts.slice(0, maxContacts);
      
      return limitedContacts;
    } catch (error) {
      console.error(`Error fetching contacts for ${pubkey.substring(0, 8)}:`, error);
      return [];
    }
  }, []);

  // Expand a single node to show its connections
  const expandNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!graphDataRef.current || !nodeId) return;
    
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
          links: safeMergeArrays(graphDataRef.current.links, newLinks, 10000)
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
              links: safeArrayLimit(graphDataRef.current!.links, 10000)
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
  }, [shortenNpub, fetchNodeContacts, fetchProfiles]);

  // Function to connect more relays
  const connectMoreRelays = useCallback(async () => {
    setIsConnecting(true);
    
    try {
      // Use RelayService to reconnect instead of direct reconnect
      const success = await RelayService.reconnect();
      
      if (success) {
        console.log('Successfully reconnected to relays');
      } else {
        console.warn('Failed to reconnect to relays');
      }
    } catch (error) {
      console.error('Error connecting more relays:', error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Refresh the graph
  const refreshGraph = useCallback(async (): Promise<void> => {
    cleanupSubscriptions();
    
    // Clear cache for this graph
    const cacheKey = cache.createGraphCacheKey(effectiveNpubs, showSecondDegree);
    cache.setCachedGraph(cacheKey, null);
    
    // Fetch fresh data
    const graphData = await fetchGraphData();
    
    if (graphData) {
      graphDataRef.current = graphData;
      setGraph(graphData);
    }
  }, [cleanupSubscriptions, cache, effectiveNpubs, showSecondDegree, fetchGraphData]);

  // Function to start continuous graph updates
  const startContinuousUpdates = useCallback(() => {
    if (continuousUpdateActive.current || !graphDataRef.current) return;
    
    continuousUpdateActive.current = true;
    
    // Set up an interval to update node profiles periodically
    const intervalId = setInterval(async () => {
      if (!graphDataRef.current || !ndkReady) return;
      
      try {
        // Copy current graph with safety limits and validate structure
        const currentNodes = safeArrayLimit(graphDataRef.current.nodes, 5000).filter(node => 
          node && node.id && (typeof node.id === 'string')
        );
        
        const currentLinks = safeArrayLimit(graphDataRef.current.links, 10000).filter(link => 
          link && 
          typeof link.source === 'string' && 
          typeof link.target === 'string'
        );

        const currentGraph = { 
          nodes: currentNodes,
          links: currentLinks,
          lastUpdated: graphDataRef.current.lastUpdated
        };
        
        // Update profiles for nodes that need it
        const updatedNodes = await fetchProfiles(currentGraph.nodes);
        
        // Validate updated nodes
        const validUpdatedNodes = updatedNodes.filter(node => 
          node && node.id && (typeof node.id === 'string')
        );
        
        // Only update if we have valid changes
        if (validUpdatedNodes.length > 0 && 
            JSON.stringify(validUpdatedNodes) !== JSON.stringify(currentGraph.nodes)) {
          
          const updatedGraph = {
            ...currentGraph,
            nodes: validUpdatedNodes,
            lastUpdated: Date.now()
          };
          
          setGraph(updatedGraph);
          graphDataRef.current = {...updatedGraph};
          
          // Update cache
          cache.setCachedGraph(effectiveNpubs, showSecondDegree, updatedGraph);
        }
      } catch (error) {
        console.error('Error during continuous update:', error);
        // Stop continuous updates if we encounter multiple errors
        continuousUpdateActive.current = false;
        clearInterval(intervalId);
      }
    }, 30000); // Every 30 seconds
    
    // Clean up function
    return () => {
      clearInterval(intervalId);
      continuousUpdateActive.current = false;
    };
  }, [ndkReady, fetchProfiles, cache, effectiveNpubs, showSecondDegree]);

  // Initial graph load on component mount (once we're on the client)
  useEffect(() => {
    if (isClient && !graph) {
      refreshGraph();
    }
  }, [isClient, graph, refreshGraph]);

  // Check if a user follows another user
  const isUserFollowing = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    const ndkInstance = RelayService.getNDK();
    if (!ndkInstance) {
      throw new Error('NDK not initialized');
    }
    
    try {
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndkInstance.fetchEvents([filter], { closeOnEose: true });
      const event = Array.from(events)[0];
      
      if (!event) return false;
      
      // Check if toPubkey is in the p tags
      return event.tags.some(tag => tag[0] === 'p' && tag[1] === toPubkey);
    } catch (error) {
      console.error('Error checking following status:', error);
      return false;
    }
  }, []);

  // Follow a user
  const followUser = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    const ndkInstance = RelayService.getNDK();
    if (!ndkInstance) {
      throw new Error('NDK not initialized');
    }
    
    try {
      // Get current contact list
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndkInstance.fetchEvents([filter], { closeOnEose: true });
      const oldEvent = Array.from(events)[0];
      
      // Create new event tags, preserving existing contacts
      const tags = oldEvent ? [...oldEvent.tags] : [];
      
      // Check if already following
      const alreadyFollowing = tags.some(tag => tag[0] === 'p' && tag[1] === toPubkey);
      if (alreadyFollowing) return true;
      
      // Add the new contact
      tags.push(['p', toPubkey]);
      
      // Create and publish new contact list
      const newEvent = new NDKEvent(ndkInstance);
      newEvent.kind = 3;
      newEvent.tags = tags;
      
      await newEvent.publish();
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      return false;
    }
  }, []);

  // Unfollow a user
  const unfollowUser = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    const ndkInstance = RelayService.getNDK();
    if (!ndkInstance) {
      throw new Error('NDK not initialized');
    }
    
    try {
      // Get current contact list
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndkInstance.fetchEvents([filter], { closeOnEose: true });
      const oldEvent = Array.from(events)[0];
      
      if (!oldEvent) return false;
      
      // Remove the contact from tags
      const tags = oldEvent.tags.filter(tag => !(tag[0] === 'p' && tag[1] === toPubkey));
      
      // Create and publish new contact list
      const newEvent = new NDKEvent(ndkInstance);
      newEvent.kind = 3;
      newEvent.tags = tags;
      
      await newEvent.publish();
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }
  }, []);

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