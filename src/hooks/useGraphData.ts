"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { useNostr } from '../lib/contexts/NostrContext';
import RelayService from '../lib/services/RelayService';
import CacheService from '../lib/services/CacheService';
import { GraphData, GraphLink, GraphNode } from '../types/graph-types';
import { hexToNpub, npubToHex, shortenNpub } from '../utils/profileUtils';

export interface UseGraphDataOptions {
  skipCache?: boolean;
  showSecondDegree?: boolean;
  maxCoreNodes?: number;
  maxSecondDegreeNodes?: number;
  retryAttempts?: number;
  filterInactive?: boolean;
  retryInterval?: number;
  layoutAlgorithm?: 'force' | 'circular' | 'radial';
}

export interface UseGraphDataProps {
  npubs: string[];
  centerNpub?: string;
  options?: UseGraphDataOptions;
}

export interface UseGraphDataResult {
  graphData: GraphData | null;
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => void;
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  followUser: (fromPubkey: string, toPubkey: string) => Promise<boolean>;
  refreshLayout: () => void;
}

// Default cache key to use
const DEFAULT_GRAPH_CACHE_KEY = 'social-graph';

/**
 * Custom hook for fetching and processing social graph data from Nostr
 * Optimized for live data only - no default images or placeholders
 */
export function useGraphData({
  npubs,
  centerNpub,
  options = {}
}: UseGraphDataProps): UseGraphDataResult {
  const {
    skipCache = false,
    showSecondDegree = false,
    maxCoreNodes = 25,
    maxSecondDegreeNodes = 50,
    retryAttempts = 2,
    filterInactive = true,
    retryInterval = 2000,
    layoutAlgorithm = 'force'
  } = options;
  
  const { ndkReady, getUserProfile } = useNostr();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Use refs to track fetch state
  const fetchInProgress = useRef<boolean>(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Cleanup function for aborting requests and clearing timers
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  /**
   * Convert hex pubkeys to npub format if needed
   */
  const normalizeNpubs = useCallback((pubkeyList: string[]): string[] => {
    return pubkeyList.map(pk => {
      if (!pk) return '';
      return pk.startsWith('npub1') ? pk : hexToNpub(pk);
    }).filter(Boolean);
  }, []);
  
  /**
   * Fetch contact list (following) for a user
   */
  const fetchContactList = useCallback(async (pubkey: string): Promise<string[]> => {
    const ndk = RelayService.getInstance?.() ? RelayService.getInstance().getNDK() : null;
    if (!ndk) return [];
    
    try {
      // Create filter for contact list (kind 3)
      const filter: NDKFilter = {
        kinds: [3], // Contact list
        authors: [pubkey],
        limit: 1    // Only need the most recent
      };
      
      // Fetch events
      const events = await ndk.fetchEvents([filter], { 
        closeOnEose: true
      });
      
      // If no events found, return empty array
      if (events.size === 0) return [];
      
      // Get the first (most recent) event
      const event = Array.from(events)[0];
      if (!event) return [];
      
      // Extract 'p' tags which represent contacts
      // Use any type for NDKEvent's tags to avoid TypeScript errors
      const eventTags = (event.tags as any[]) || [];
      return eventTags
        .filter((tag: string[]) => tag[0] === 'p')
        .map((tag: string[]) => tag[1])
        .filter(Boolean);
    } catch (error) {
      console.error(`Error fetching contacts for ${pubkey}:`, error);
      return [];
    }
  }, []);
  
  /**
   * Fetch profile information for a node
   * Only add picture if it actually exists in the profile
   */
  const fetchNodeProfile = useCallback(async (node: GraphNode): Promise<GraphNode> => {
    try {
      // Attempt to get the profile
      const profile = await getUserProfile(node.npub || node.pubkey);
      
      if (profile) {
        // Start with basic profile info
        const updatedNode = {
          ...node,
          name: profile.displayName || profile.name || shortenNpub(node.npub || ''),
          nip05: profile.nip05
        };
        
        // Only add picture if it exists in the profile
        if (profile.picture) {
          updatedNode.picture = profile.picture;
        }
        
        return updatedNode;
      }
    } catch (error) {
      console.warn(`Error fetching profile for node ${node.id}:`, error);
    }
    
    // Return original node if profile fetch fails
    return node;
  }, [getUserProfile]);
  
  /**
   * Process contacts for first and second-degree connections
   */
  const processContacts = useCallback(async (
    coreNodes: GraphNode[],
    secondDegreeEnabled: boolean
  ): Promise<GraphData> => {
    // Initialize graph data
    const nodes: GraphNode[] = [...coreNodes];
    const links: GraphLink[] = [];
    const nodeLookup = new Map<string, GraphNode>();
    const processedPubkeys = new Set<string>();
    
    // Create lookup map for faster access
    coreNodes.forEach(node => {
      nodeLookup.set(node.pubkey, node);
      processedPubkeys.add(node.pubkey);
    });
    
    // Process connections for core nodes
    for (const node of coreNodes) {
      try {
        // Fetch contacts for this node
        const contacts = await fetchContactList(node.pubkey);
        
        // Process each contact
        for (const contactPubkey of contacts) {
          // Skip if same as current node
          if (contactPubkey === node.pubkey) continue;
          
          // Check if contact is already a core node
          let targetNode = nodeLookup.get(contactPubkey);
          
          // If contact is new and second degree connections are enabled
          if (!targetNode && secondDegreeEnabled) {
            // Don't exceed max second degree nodes
            if (nodes.length - coreNodes.length >= maxSecondDegreeNodes) {
              continue;
            }
            
            // Create new node for this contact (without picture, will be fetched later)
            const npub = hexToNpub(contactPubkey);
            targetNode = {
              id: contactPubkey,
              pubkey: contactPubkey,
              npub,
              name: shortenNpub(npub),
              isSecondDegree: true,
              val: 2 // Make second degree nodes smaller
            };
            
            // Add to nodes and lookup
            nodes.push(targetNode);
            nodeLookup.set(contactPubkey, targetNode);
            processedPubkeys.add(contactPubkey);
          }
          
          // If we have a target node, create the link
          if (targetNode) {
            const linkId = `${node.id}->${targetNode.id}`;
            // Check for mutual connection
            const reverseLink = links.find(l => 
              l.source === targetNode!.id && l.target === node.id
            );
            
            if (reverseLink) {
              // Update existing link to mutual type
              reverseLink.type = 'mutual';
              reverseLink.value = 2; // Make mutual links stronger
            } else {
              // Create new link
              links.push({
                id: linkId,
                source: node.id,
                target: targetNode.id,
                type: 'follows',
                value: 1
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing contacts for ${node.pubkey}:`, error);
      }
    }
    
    // Load profiles for second-degree nodes (in background)
    if (secondDegreeEnabled) {
      const secondDegreeNodes = nodes.filter(n => n.isSecondDegree);
      
      // Process in batches to avoid hammering relays
      const processBatch = async (batch: GraphNode[]) => {
        const updatedNodes: GraphNode[] = [];
        
        for (const node of batch) {
          try {
            const updatedNode = await fetchNodeProfile(node);
            updatedNodes.push(updatedNode);
          } catch (e) {
            // Just add original node if profile fetch fails
            updatedNodes.push(node);
          }
        }
        
        return updatedNodes;
      };
      
      // Process in batches of 5
      const batchSize = 5;
      for (let i = 0; i < secondDegreeNodes.length; i += batchSize) {
        const batch = secondDegreeNodes.slice(i, i + batchSize);
        const updatedBatch = await processBatch(batch);
        
        // Update nodes with profiles
        updatedBatch.forEach(updatedNode => {
          const index = nodes.findIndex(n => n.id === updatedNode.id);
          if (index !== -1) {
            nodes[index] = updatedNode;
          }
        });
      }
    }
    
    return {
      nodes,
      links,
      lastUpdated: Date.now()
    };
  }, [fetchContactList, fetchNodeProfile, maxSecondDegreeNodes]);
  
  /**
   * Main function to load graph data
   */
  const loadGraphData = useCallback(async (forceRefresh = false) => {
    // Skip if already loading or network not ready
    if (fetchInProgress.current) {
      console.log('Graph data fetch already in progress, skipping...');
      return;
    }
    
    // Check if NDK is ready
    if (!ndkReady) {
      console.log('NDK not ready, waiting...');
      if (retryCount < retryAttempts) {
        // Schedule retry with increasing delay
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Clear any existing timer
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        
        const backoffTime = retryInterval * Math.min(Math.pow(1.5, newRetryCount), 5);
        console.log(`Retrying graph load in ${backoffTime}ms (attempt ${newRetryCount}/${retryAttempts})`);
        
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          loadGraphData(forceRefresh);
        }, backoffTime);
        
        return;
      } else {
        setError('Nostr connection not available after multiple attempts');
        return;
      }
    }
    
    // Reset retry count
    if (retryCount > 0) {
      setRetryCount(0);
    }
    
    // Get normalized list of npubs
    const normalizedNpubs = normalizeNpubs(npubs).slice(0, maxCoreNodes);
    
    if (normalizedNpubs.length === 0) {
      setError('No valid npubs provided');
      return;
    }
    
    // Check cache first unless skipCache is true
    if (!skipCache && !forceRefresh) {
      // Create cache key based on npubs and settings
      const cacheKey = `${DEFAULT_GRAPH_CACHE_KEY}:${normalizedNpubs.sort().join(',')}:${showSecondDegree}`;
      const cachedData = CacheService.graphCache?.get(cacheKey);
      
      if (cachedData) {
        console.log('Using cached graph data');
        setGraphData(cachedData);
        setLoading(false);
        return;
      }
    }
    
    // Start loading
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      // Create core nodes from npubs (without pictures, will be fetched later)
      const coreNodes: GraphNode[] = [];
      
      for (const npub of normalizedNpubs) {
        try {
          // Convert npub to hex if needed
          const pubkey = npub.startsWith('npub1') ? npubToHex(npub) : npub;
          
          // Create base node without picture
          const node: GraphNode = {
            id: pubkey,
            pubkey,
            npub: npub.startsWith('npub1') ? npub : hexToNpub(pubkey),
            name: shortenNpub(npub),
            isCoreNode: true,
            val: 4 // Make core nodes larger
          };
          
          coreNodes.push(node);
        } catch (error) {
          console.warn(`Error creating node for npub ${npub}:`, error);
        }
      }
      
      // Load profiles for core nodes
      const coreNodesWithProfiles: GraphNode[] = [];
      
      for (const node of coreNodes) {
        if (signal.aborted) break;
        
        try {
          const nodeWithProfile = await fetchNodeProfile(node);
          coreNodesWithProfiles.push(nodeWithProfile);
        } catch (error) {
          // Use original node if profile fetch fails
          coreNodesWithProfiles.push(node);
        }
      }
      
      // Process graph data - core nodes + connections
      const graphData = await processContacts(coreNodesWithProfiles, showSecondDegree);
      
      // Save to cache
      if (graphData.nodes.length > 0) {
        const cacheKey = `${DEFAULT_GRAPH_CACHE_KEY}:${normalizedNpubs.sort().join(',')}:${showSecondDegree}`;
        CacheService.graphCache?.set(cacheKey, graphData);
      }
      
      // Update state with graph data
      if (!signal.aborted) {
        setGraphData(graphData);
        setLoading(false);
        setError(null);
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('Error loading graph data:', error);
        setError(`Failed to load graph data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [
    fetchNodeProfile,
    normalizeNpubs,
    npubs,
    ndkReady,
    maxCoreNodes,
    processContacts,
    showSecondDegree,
    skipCache,
    retryCount,
    retryAttempts,
    retryInterval
  ]);
  
  // Initial load effect
  useEffect(() => {
    loadGraphData();
    
    return () => {
      cleanup();
    };
  }, [loadGraphData, cleanup]);
  
  // Handle following a user
  const followUser = useCallback(async (fromPubkey: string, toPubkey: string): Promise<boolean> => {
    const ndk = RelayService.getInstance?.() ? RelayService.getInstance().getNDK() : null;
    if (!ndk) {
      setError('NDK not initialized');
      return false;
    }
    
    try {
      // Get current contact list
      const filter: NDKFilter = {
        kinds: [3], // Contact list event
        authors: [fromPubkey],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      const oldEvent = Array.from(events)[0];
      
      // Create new event tags, preserving existing contacts
      // Use any type for NDKEvent's tags to avoid TypeScript errors
      const tags = (oldEvent?.tags as any[]) || [];
      
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
      
      // Refresh graph data
      loadGraphData(true);
      
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      setError(`Failed to follow user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [loadGraphData]);
  
  // Refresh the graph layout without refetching data
  const refreshLayout = useCallback(() => {
    if (graphData) {
      // Create a new object to trigger a re-render
      setGraphData({
        ...graphData,
        lastUpdated: Date.now()
      });
    }
  }, [graphData]);
  
  // Public refetch function
  const refetch = useCallback((forceRefresh = true) => {
    loadGraphData(forceRefresh);
  }, [loadGraphData]);
  
  return {
    graphData,
    loading,
    error,
    refetch,
    selectedNode,
    setSelectedNode,
    followUser,
    refreshLayout
  };
} 