'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useNostr } from '../../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../../types/graph-types';
import { BRAND_COLORS } from '../../constants/brandColors';
import { DEFAULT_PROFILE_IMAGE } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';
import { CORE_NPUBS } from './utils';
import { getRandomLoadingMessage, getLoadingMessageSequence } from '../../constants/loadingMessages';
import * as d3 from 'd3';

// Dynamically import the ForceGraph2D component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false });

// Cache for graph data with a TTL
const GRAPH_CACHE = {
  data: null as GraphData | null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

// Cache for profile images
const IMAGE_CACHE = new Map<string, HTMLImageElement>();

// Profile cache
const PROFILE_CACHE = new Map<string, any>();
const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface SocialGraphProps {
  // Primary NPUB to center the graph on (optional, defaults to first core NPUB)
  centerNpub?: string;
  // Additional NPUBs to include (optional, defaults to CORE_NPUBS)
  npubs?: string[];
  // Maximum connections to display per node
  maxConnections?: number;
  // Height of the graph container
  height?: number | string;
  // Width of the graph container
  width?: number | string;
  // Custom class names
  className?: string;
  // Include social data directly (optional)
  data?: GraphData;
  // Whether to show second-degree connections (default: false)
  showSecondDegree?: boolean;
}

// Convert graph data to the format expected by ForceGraph2D
const convertGraphData = (data: GraphData) => {
  return {
    nodes: data.nodes.map(node => ({
      ...node,
      val: node.val || (node.isCoreNode ? 25 : 3), // Make core nodes much bigger and follows smaller
      color: node.color || (node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand),
    })),
    links: data.links.map(link => ({
      source: typeof link.source === 'string' ? link.source : link.source?.id || '',
      target: typeof link.target === 'string' ? link.target : link.target?.id || '',
      value: link.value || 1,
      color: link.color || (link.type === 'mutual' 
        ? BRAND_COLORS.bitcoinOrange  // Use bitcoin orange for mutual connections
        : BRAND_COLORS.lightSand + '99'), // Use light sand with transparency for regular connections
    })),
  };
};

// Add this function to properly mark core nodes
const markCoreNodes = (graphData: GraphData, coreNpubs: string[]) => {
  // Create a set of core npubs for faster lookup
  const coreNpubSet = new Set(coreNpubs);
  
  // Mark core nodes using the shared CORE_NPUBS array
  graphData.nodes.forEach(node => {
    if (node.npub && coreNpubSet.has(node.npub)) {
      node.isCoreNode = true;
      node.val = 25; // Make core nodes much bigger
      node.color = BRAND_COLORS.bitcoinOrange; // Use brand color instead of hardcoded
    } else {
      // Non-core nodes should be smaller
      node.val = 3;
    }
  });
  
  return graphData;
};

// Function to preload images for better render performance
const preloadImage = (url: string): Promise<HTMLImageElement> => {
  // Skip invalid URLs
  if (!url || url === DEFAULT_PROFILE_IMAGE || !url.startsWith('http')) {
    return Promise.resolve(new Image());
  }

  // Check if image is already in cache
  if (IMAGE_CACHE.has(url)) {
    return Promise.resolve(IMAGE_CACHE.get(url)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Try to avoid CORS issues
    
    img.onload = () => {
      IMAGE_CACHE.set(url, img);
      resolve(img);
    };
    
    img.onerror = () => {
      console.warn(`Failed to load image: ${url}`);
      // Use default image on error
      const defaultImg = new Image();
      defaultImg.src = DEFAULT_PROFILE_IMAGE;
      IMAGE_CACHE.set(url, defaultImg);
      resolve(defaultImg);
    };
    
    // Set src after adding event handlers
    img.src = url;
    
    // Set a timeout to avoid hanging on image load
    setTimeout(() => {
      if (!img.complete) {
        img.src = DEFAULT_PROFILE_IMAGE;
      }
    }, 5000);
  });
};

// Utility function to clear all caches
export const clearAllGraphCaches = () => {
  // Clear graph data cache
  GRAPH_CACHE.data = null;
  GRAPH_CACHE.timestamp = 0;
  
  // Clear image cache
  IMAGE_CACHE.clear();
  
  // Clear profile cache
  PROFILE_CACHE.clear();
  
  console.log('All graph caches have been cleared');
};

export const SocialGraph: React.FC<SocialGraphProps> = ({
  centerNpub = CORE_NPUBS[0],
  npubs = CORE_NPUBS,
  maxConnections = 25,
  height = 600,
  width = '100%',
  className = '',
  data,
  showSecondDegree = false,
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady, getConnectedRelays } = useNostr();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [processingSecondDegree, setProcessingSecondDegree] = useState(false);
  
  const fetchInProgress = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const forceGraphRef = useRef<any>(null);
  const isNdkReady = !!ndk && ndkReady;
  const graphDataRef = useRef<GraphData | null>(null);
  
  // Use more efficient memo for effective npubs
  const effectiveNpubs = useMemo(() => 
    Array.from(new Set([...npubs, centerNpub])), 
    [npubs, centerNpub]
  );

  // Define forceRefresh with a ref to avoid circular dependencies
  const forceRefreshRef = useRef<() => void>(() => {});
  
  // Define the initial forceRefresh function (will be updated after buildGraph is defined)
  const forceRefresh = useCallback(() => {
    forceRefreshRef.current();
  }, []);

  // Check if we're on the client side to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
    // Set initial loading message only on the client side
    setLoadingMessage(getRandomLoadingMessage('GRAPH'));
  }, []);

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

  // Define simulation parameters for graph animation
  const graphPhysics = useRef({
    charge: -30,
    linkStrength: 0.3,
    linkDistance: 70,
    gravity: 0.1,
    alpha: 0.3,
    alphaDecay: 0.02,
    velocityDecay: 0.4
  });

  // Function to create and initialize the force graph
  const initializeForceGraph = useCallback((data: GraphData) => {
    if (!forceGraphRef.current) return;
    
    const fg = forceGraphRef.current;
    
    // Apply physics settings based on graph size
    const nodeCount = data.nodes.length;
    const physics = graphPhysics.current;
    
    // Adjust physics for larger graphs
    if (nodeCount > 20) {
      physics.charge = -40;
      physics.linkDistance = 100;
      physics.gravity = 0.15;
      physics.alpha = 0.4;
      physics.alphaDecay = 0.015;
      physics.velocityDecay = 0.3;
    } else {
      physics.charge = -30;
      physics.linkDistance = 70;
      physics.gravity = 0.1;
      physics.alpha = 0.3;
      physics.alphaDecay = 0.02;
      physics.velocityDecay = 0.4;
    }
    
    // Apply physics settings to the force graph
    fg.d3Force('charge', d3.forceManyBody().strength(physics.charge))
      .d3Force('link', d3.forceLink(data.links).id((d: any) => d.id).strength(physics.linkStrength).distance(physics.linkDistance))
      .d3Force('center', d3.forceCenter())
      .d3Force('gravity', d3.forceManyBody().strength(physics.gravity))
      .cooldownTicks(100);
      
    // Set alpha parameters for smoother animation
    const simulation = fg.d3Force() as d3.Simulation<any, any>;
    if (simulation) {
      simulation.alpha(physics.alpha);
      simulation.alphaDecay(physics.alphaDecay);
      simulation.velocityDecay(physics.velocityDecay);
    }
    
    // Apply graph data
    fg.graphData(data);
  }, []);

  // Process second-degree connections (followers of followers) with improved performance 
  const processSecondDegreeConnections = useCallback(async (
    firstDegreeConnections: Set<string>,
    coreKeys: string[],
    nodes: GraphNode[],
    links: GraphLink[],
    addedPubkeys: Set<string>
  ): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
    if (!ndk) return { nodes, links };
    
    console.log("Starting to process second-degree connections");
    
    // Track pubkeys we're processing to avoid duplicates
    const processedForFollowers = new Set<string>();
    const secondDegreeConnections = new Set<string>();
    
    // Take a larger subset of first-degree connections to process
    // Increase from 20 to 30 for better network discovery
    const firstDegreeArray = Array.from(firstDegreeConnections);
    const firstDegreeToProcess = firstDegreeArray.slice(0, Math.min(firstDegreeConnections.size, 30));
    
    console.log(`Processing ${firstDegreeToProcess.length} first-degree connections for second-degree discovery`);
    
    // Process in smaller batches to avoid overwhelming the relays
    const batchSize = 5; // Increased from 3 to 5
    for (let i = 0; i < firstDegreeToProcess.length; i += batchSize) {
      const batch = firstDegreeToProcess.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(firstDegreeToProcess.length/batchSize)}`);
      
      // Process all pubkeys in the batch concurrently
      await Promise.all(batch.map(async (pubkey) => {
        // Skip if we've already processed this pubkey
        if (processedForFollowers.has(pubkey)) return;
        processedForFollowers.add(pubkey);
        
        try {
          console.log(`Fetching follows for: ${pubkey.substring(0, 8)}...`);
          // Fetch this user's follows with explicit relay request
          const contactsEvents = await ndk.fetchEvents({
            kinds: [3], // Contact lists
            authors: [pubkey],
            limit: 1
          }, { closeOnEose: true });
          
          if (!contactsEvents || contactsEvents.size === 0) {
            console.log(`No contacts found for: ${pubkey.substring(0, 8)}...`);
            return;
          }
          
          for (const event of contactsEvents) {
            // Extract p tags (following)
            const following = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
              // Ensure valid pubkeys
              .filter(pk => pk && pk.length === 64);
            
            if (following.length === 0) {
              console.log(`Empty contact list for: ${pubkey.substring(0, 8)}...`);
              continue;
            }
            
            console.log(`Found ${following.length} follows for: ${pubkey.substring(0, 8)}...`);
            
            // Increase the connection limit per node to capture more relationships
            const limitedFollowing = following.slice(0, Math.min(following.length, maxConnections * 2));
            
            // Check for mutual connections among first-degree connections
            // This is important for showing the interconnectedness of the community
            for (const otherFirstDegreePubkey of firstDegreeConnections) {
              if (pubkey === otherFirstDegreePubkey) continue;
              
              // Check if this pubkey follows another first-degree connection
              if (limitedFollowing.includes(otherFirstDegreePubkey)) {
                // Check if the relationship is mutual by fetching the other's following list
                const otherContactsEvents = await ndk.fetchEvents({
                  kinds: [3],
                  authors: [otherFirstDegreePubkey],
                  limit: 1
                }, { closeOnEose: true });
                
                for (const otherEvent of otherContactsEvents) {
                  const otherFollowing = otherEvent.tags
                    .filter(tag => tag[0] === 'p')
                    .map(tag => tag[1]);
                  
                  // If mutual, create a special mutual link
                  if (otherFollowing.includes(pubkey)) {
                    // Add mutual link if not already added
                    const linkId = [pubkey, otherFirstDegreePubkey].sort().join('-');
                    if (!links.some(link => 
                      (link.source === pubkey && link.target === otherFirstDegreePubkey) || 
                      (link.source === otherFirstDegreePubkey && link.target === pubkey)
                    )) {
                      links.push({
                        id: linkId,
                        source: pubkey,
                        target: otherFirstDegreePubkey,
                        type: 'mutual',
                        value: 2
                      });
                      console.log(`Added mutual connection between ${pubkey.substring(0, 8)}... and ${otherFirstDegreePubkey.substring(0, 8)}...`);
                    }
                  } else {
                    // Otherwise add a regular follows link if not already present
                    if (!links.some(link => 
                      link.source === pubkey && link.target === otherFirstDegreePubkey
                    )) {
                      links.push({
                        source: pubkey,
                        target: otherFirstDegreePubkey,
                        type: 'follows',
                        value: 1
                      });
                    }
                  }
                }
              }
            }
            
            // Process actual second-degree connections (followers of followers)
            // that aren't already in our graph
            for (const followedPubkey of limitedFollowing) {
              // Skip core pubkeys and already processed first-degree connections
              if (coreKeys.includes(followedPubkey) || firstDegreeConnections.has(followedPubkey)) {
                continue;
              }
              
              // Add to second-degree connections set for later profile fetching
              secondDegreeConnections.add(followedPubkey);
              
              // Create node for this second-degree connection if it doesn't exist yet
              if (!addedPubkeys.has(followedPubkey)) {
                try {
                  const npub = nip19.npubEncode(followedPubkey);
                  nodes.push({
                    id: followedPubkey,
                    pubkey: followedPubkey,
                    npub: npub,
                    name: shortenNpub(npub),
                    picture: DEFAULT_PROFILE_IMAGE,
                    isCoreNode: false,
                  });
                  
                  // Add to set of pubkeys we've added to the graph
                  addedPubkeys.add(followedPubkey);
                  console.log(`Added second-degree node: ${followedPubkey.substring(0, 8)}...`);
                } catch (err) {
                  console.warn(`Error creating node for second-degree connection: ${followedPubkey.substring(0, 8)}...`, err);
                }
              }
              
              // Create link from the first degree pubkey to the followed pubkey
              if (!links.some(link => 
                link.source === pubkey && link.target === followedPubkey
              )) {
                links.push({
                  source: pubkey,
                  target: followedPubkey,
                  type: 'follows',
                });
                console.log(`Added connection from ${pubkey.substring(0, 8)}... to ${followedPubkey.substring(0, 8)}...`);
              }
            }
          }
        } catch (err) {
          console.warn('Error processing followers for pubkey:', pubkey.substring(0, 8), err);
        }
      }));
    }
    
    console.log(`Finished processing second-degree connections. Added ${secondDegreeConnections.size} second-degree nodes`);
    
    return { nodes, links };
  }, [ndk, maxConnections, shortenNpub]);

  // Function to fetch profiles for nodes
  const fetchProfiles = useCallback(async (nodes: GraphNode[]): Promise<GraphNode[]> => {
    if (!ndk) return nodes;
    
    // Batch profile fetching to reduce load
    const batchSize = 5;
    const result = [...nodes];
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      
      // Process nodes that need profile data
      await Promise.all(batch.map(async (node, index) => {
        if (!node.name || node.name === shortenNpub(node.npub || '')) {
          try {
            // Check cache first
            const cacheKey = node.npub || node.pubkey;
            const cachedProfile = PROFILE_CACHE.get(cacheKey);
            const now = Date.now();
            
            if (cachedProfile && (now - cachedProfile.timestamp < PROFILE_CACHE_TTL)) {
              // Use cached profile
              result[i + index] = {
                ...node,
                name: cachedProfile.profile.name || cachedProfile.profile.displayName || shortenNpub(node.npub || ''),
                picture: cachedProfile.profile.picture || DEFAULT_PROFILE_IMAGE
              };
              
              // Preload the image
              if (cachedProfile.profile.picture) {
                preloadImage(cachedProfile.profile.picture).catch(() => {});
              }
            } else {
              // Fetch profile
              const profile = await getUserProfile(node.npub || node.pubkey);
              
              if (profile) {
                // Cache the profile
                PROFILE_CACHE.set(cacheKey, {
                  profile,
                  timestamp: now
                });
                
                // Update the node
                result[i + index] = {
                  ...node,
                  name: profile.name || profile.displayName || shortenNpub(node.npub || ''),
                  picture: profile.picture || DEFAULT_PROFILE_IMAGE
                };
                
                // Preload the image
                if (profile.picture) {
                  preloadImage(profile.picture).catch(() => {});
                }
              }
            }
          } catch (err) {
            console.warn('Error fetching profile for node:', node.npub || node.pubkey, err);
          }
        }
      }));
    }
    
    return result;
  }, [ndk, getUserProfile, shortenNpub]);

  // Process data and build the graph
  const buildGraph = useCallback(async () => {
    if (fetchInProgress.current || !isNdkReady) return;
    fetchInProgress.current = true;
    
    try {
      setIsLoading(true);
      console.log("Building social graph...");
      
      // Ensure we have a connection to relays first
      const connectedRelays = ndk?.pool?.connectedRelays || [];
      if (connectedRelays.length === 0) {
        console.log("No connected relays found, attempting to reconnect...");
        if (reconnect) {
          try {
            await reconnect();
            // Wait a moment for relays to connect
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error("Failed to reconnect to relays:", err);
          }
        }
      }
      
      // Check relay connections after reconnect attempt
      const relays = ndk?.pool?.connectedRelays || [];
      console.log(`Connected to ${relays.length} relays`);
      
      // Try a different approach to check relay connections
      let hasRelays = false;
      
      // Method 1: Check pool connections
      if (relays.length > 0) {
        hasRelays = true;
      }
      
      // Method 2: Try to access the relay pool directly
      try {
        const poolRelays = Array.from(ndk?.pool?.relays?.values() || []);
        console.log(`Pool has ${poolRelays.length} relays, checking connection status...`);
        
        const connectedCount = poolRelays.filter(relay => relay.status === 1).length;
        console.log(`Found ${connectedCount} connected relays in pool`);
        
        if (connectedCount > 0) {
          hasRelays = true;
        }
      } catch (e) {
        console.error("Error checking relay pool:", e);
      }
      
      // Method 3: Try a different NDK method to check relays
      try {
        if (typeof getConnectedRelays === 'function') {
          const connectedRelaysList = getConnectedRelays();
          console.log(`getConnectedRelays returned ${connectedRelaysList.length} relays`);
          if (connectedRelaysList.length > 0) {
            hasRelays = true;
          }
        }
      } catch (e) {
        console.error("Error calling getConnectedRelays:", e);
      }
      
      // If still no relays, consider checking if fetch events still works despite relay status
      if (!hasRelays) {
        console.warn("No connected relays detected. Will attempt to continue anyway.");
        setError("Limited relay connections. Data may be incomplete.");
      }
      
      // Always continue with at least the core nodes instead of stopping with an error
      if (!hasRelays) {
        return {
          nodes: effectiveNpubs.map(npub => {
            try {
              const { data: pubkey } = nip19.decode(npub);
              return {
                id: pubkey as string,
                pubkey: pubkey as string,
                npub: npub,
                name: shortenNpub(npub),
                picture: DEFAULT_PROFILE_IMAGE,
                isCoreNode: true,
              };
            } catch {
              return null;
            }
          }).filter(Boolean) as GraphNode[],
          links: []
        };
      }
      
      // Convert npubs to pubkeys for the core nodes
      const coreKeys: string[] = [];
      const coreNodes: GraphNode[] = [];
      
      // Process core pubkeys
      for (const npub of effectiveNpubs) {
        try {
          // Convert npub to pubkey
          const { data: pubkey } = nip19.decode(npub);
          coreKeys.push(pubkey as string);
          
          // Create node for this core pubkey
          coreNodes.push({
            id: pubkey as string,
            pubkey: pubkey as string,
            npub: npub,
            name: shortenNpub(npub),
            picture: DEFAULT_PROFILE_IMAGE,
            isCoreNode: true,
          });
        } catch (err) {
          console.warn('Invalid npub:', npub, err);
        }
      }
      
      console.log(`Fetching profiles for ${coreNodes.length} core nodes`);
      // Fetch profiles for core nodes
      const coreNodesWithProfiles = await fetchProfiles(coreNodes);
      
      // Process first-degree connections
      const nodes: GraphNode[] = [...coreNodesWithProfiles];
      const links: GraphLink[] = [];
      const addedPubkeys = new Set<string>(coreKeys);
      const firstDegreeConnections = new Set<string>();
      
      // Get followers for each core pubkey
      console.log("Fetching contact lists for core nodes...");
      for (const pubkey of coreKeys) {
        try {
          console.log(`Fetching contacts for core pubkey: ${pubkey.substring(0, 8)}...`);
          const contactsEvents = await ndk.fetchEvents({
            kinds: [3], // Contact lists
            authors: [pubkey],
            limit: 1
          }, { closeOnEose: true });
          
          // Improved error handling for empty or missing contact lists
          if (!contactsEvents || contactsEvents.size === 0) {
            console.warn(`No contact list found for pubkey: ${pubkey.substring(0, 8)}...`);
            continue;
          }
          
          for (const event of contactsEvents) {
            // Extract p tags (following)
            const following = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
              // Filter out invalid pubkeys to prevent errors
              .filter(pubkey => pubkey && pubkey.length === 64);
            
            if (following.length === 0) {
              console.warn(`Empty contact list for pubkey: ${pubkey}`);
              continue;
            }
            
            // Increase the number of connections per node to capture more relationships
            // This is important for showing the full 168 connections the user mentioned
            const limitedFollowing = following.slice(0, Math.min(following.length, maxConnections * 1.5));
            
            // Find mutual connections
            const mutuals = new Set<string>();
            
            // Check for mutual follows among core nodes
            for (const otherPubkey of coreKeys) {
              if (pubkey === otherPubkey) continue;
              
              // Check if this core pubkey follows the other core pubkey
              if (following.includes(otherPubkey)) {
                // Check if the other core pubkey follows this pubkey
                const otherContactsEvents = await ndk.fetchEvents({
                  kinds: [3],
                  authors: [otherPubkey],
                  limit: 1
                }, { closeOnEose: true });
                
                for (const otherEvent of otherContactsEvents) {
                  const otherFollowing = otherEvent.tags
                    .filter(tag => tag[0] === 'p')
                    .map(tag => tag[1]);
                  
                  if (otherFollowing.includes(pubkey)) {
                    mutuals.add(otherPubkey);
                    
                    // Add mutual link if not already added
                    const linkId = [pubkey, otherPubkey].sort().join('-');
                    if (!links.some(link => 
                      (link.source === pubkey && link.target === otherPubkey) || 
                      (link.source === otherPubkey && link.target === pubkey)
                    )) {
                      links.push({
                        id: linkId,
                        source: pubkey,
                        target: otherPubkey,
                        type: 'mutual',
                        value: 2
                      });
                    }
                  }
                }
              }
            }
            
            // Process regular followers
            for (const followedPubkey of limitedFollowing) {
              // Skip core pubkeys (already handled above)
              if (coreKeys.includes(followedPubkey)) {
                continue;
              }
              
              // Add to first-degree connections
              firstDegreeConnections.add(followedPubkey);
              
              // Create node for this pubkey if not already added
              if (!addedPubkeys.has(followedPubkey)) {
                try {
                  const npub = nip19.npubEncode(followedPubkey);
                  nodes.push({
                    id: followedPubkey,
                    pubkey: followedPubkey,
                    npub: npub,
                    name: shortenNpub(npub),
                    picture: DEFAULT_PROFILE_IMAGE,
                    isCoreNode: false,
                  });
                  
                  addedPubkeys.add(followedPubkey);
                } catch (err) {
                  console.warn(`Invalid pubkey: ${followedPubkey}`, err);
                }
              }
              
              // Create link from the core pubkey to the followed pubkey
              links.push({
                source: pubkey,
                target: followedPubkey,
                type: 'follows',
              });
            }
          }
        } catch (err) {
          console.warn('Error fetching contacts for pubkey:', pubkey, err);
        }
      }
      
      // Process second-degree connections to find all 168 expected connections
      console.log(`Processing ${firstDegreeConnections.size} first-degree connections`);
      
      // Only process second-degree connections if enabled
      if (showSecondDegree) {
        // Use a smaller subset of first-degree connections if there are too many
        // to avoid overwhelming the relays and browser
        let firstDegreeForSecondLevel = firstDegreeConnections;
        if (firstDegreeConnections.size > 50) {
          console.log("Limiting first-degree connections for second-degree processing");
          firstDegreeForSecondLevel = new Set(
            Array.from(firstDegreeConnections).slice(0, 50)
          );
        }
        
        const { nodes: updatedNodes, links: updatedLinks } = await processSecondDegreeConnections(
          firstDegreeForSecondLevel,
          coreKeys,
          nodes,
          links,
          addedPubkeys
        );
        console.log(`Graph now has ${updatedLinks.length} links and ${updatedNodes.length} nodes`);
        
        // Fetch profiles for first-degree connections
        const firstDegreeNodes = updatedNodes.filter(node => 
          !node.isCoreNode && firstDegreeConnections.has(node.pubkey)
        );
        
        console.log(`Fetching profiles for ${firstDegreeNodes.length} first-degree connections`);
        const firstDegreeWithProfiles = await fetchProfiles(firstDegreeNodes);
        
        // Update nodes with profile information
        const finalNodes = updatedNodes.map(node => {
          if (!node.isCoreNode && firstDegreeConnections.has(node.pubkey)) {
            // Find the updated node with profile
            const updatedNode = firstDegreeWithProfiles.find(n => n.id === node.id);
            return updatedNode || node;
          }
          return node;
        });
        
        // Count how many second-degree connections we have
        const secondDegreeCount = finalNodes.filter(node => 
          !node.isCoreNode && !firstDegreeConnections.has(node.pubkey)
        ).length;
        console.log(`Graph contains ${secondDegreeCount} second-degree connections`);
        
        // Final graph data
        const graphData: GraphData = {
          nodes: finalNodes,
          links: updatedLinks,
          lastUpdated: Date.now()
        };
        
        // Mark core nodes to ensure proper visualization
        const markedGraphData = markCoreNodes(graphData, effectiveNpubs);
        
        // Update state and refs directly
        setGraph(markedGraphData);
        graphDataRef.current = markedGraphData;
        
        // Only cache for this session
        GRAPH_CACHE.data = markedGraphData;
        GRAPH_CACHE.timestamp = Date.now();
        
        console.log(`Final graph has ${markedGraphData.links.length} links and ${markedGraphData.nodes.length} nodes`);
        
        // Preload images for all nodes
        for (const node of finalNodes) {
          if (node.picture && node.picture !== DEFAULT_PROFILE_IMAGE) {
            preloadImage(node.picture).catch(() => {});
          }
        }
      } else {
        // Final graph data
        const graphData: GraphData = {
          nodes: nodes,
          links: links,
          lastUpdated: Date.now()
        };
        
        // Mark core nodes to ensure proper visualization
        const markedGraphData = markCoreNodes(graphData, effectiveNpubs);
        
        // Update state and refs directly
        setGraph(markedGraphData);
        graphDataRef.current = markedGraphData;
        
        // Only cache for this session
        GRAPH_CACHE.data = markedGraphData;
        GRAPH_CACHE.timestamp = Date.now();
        
        console.log(`Final graph has ${markedGraphData.links.length} links and ${markedGraphData.nodes.length} nodes`);
        
        // Preload images for all nodes
        for (const node of nodes) {
          if (node.picture && node.picture !== DEFAULT_PROFILE_IMAGE) {
            preloadImage(node.picture).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('Error building graph:', err);
      setError('Failed to build social graph');
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [
    isNdkReady, effectiveNpubs, ndk, shortenNpub, 
    maxConnections, fetchProfiles, processSecondDegreeConnections, getConnectedRelays, showSecondDegree
  ]);

  // Update the forceRefresh implementation after buildGraph is defined
  useEffect(() => {
    forceRefreshRef.current = () => {
      if (isNdkReady) {
        // Clear all caches
        clearAllGraphCaches();
        
        // Clear current graph state
        setGraph(null);
        
        // Clear selection
        setSelectedNode(null);
        
        // Trigger rebuild
        buildGraph();
      } else {
        // If NDK not ready, try to reconnect
        if (reconnect) {
          reconnect();
          setTimeout(() => {
            buildGraph();
          }, 1000);
        }
      }
    };
  }, [isNdkReady, buildGraph, reconnect]);

  // Initialize the graph when NDK is ready
  useEffect(() => {
    if (isNdkReady && !graph) {
      // Check if we need to refresh due to errors
      const handleError = (event: ErrorEvent) => {
        // If error message includes "node not found", clear cache and refresh
        if (event.message && (
          event.message.includes('node not found') || 
          event.message.includes('Error building graph')
        )) {
          console.log('Detected graph error, refreshing...');
          forceRefresh();
        }
      };
      
      // Add error listener
      window.addEventListener('error', handleError);
      
      // Attempt build graph
      console.log('NDK ready, building graph...');
      buildGraph();
      
      // Clean up
      return () => {
        window.removeEventListener('error', handleError);
      };
    }
  }, [isNdkReady, graph, buildGraph, forceRefresh]);

  // Add an auto-refresh on errors
  useEffect(() => {
    if (error) {
      console.log('Graph error detected, will retry in 5 seconds');
      const timer = setTimeout(() => {
        setError(null);
        forceRefresh();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error, forceRefresh]);

  // Export social graph pubkeys for MadeiraFeed
  useEffect(() => {
    if (graph && isClient && window) {
      // Extract all non-core pubkeys for social graph integration
      const allPubkeys = graph.nodes
        .filter(node => !node.isCoreNode)
        .map(node => node.npub)
        .filter(Boolean) as string[];
        
      // Store in sessionStorage for MadeiraFeed to access
      try {
        sessionStorage.setItem('socialGraphNpubs', JSON.stringify(allPubkeys));
        console.log(`Exported ${allPubkeys.length} social graph npubs for MadeiraFeed`);
      } catch (err) {
        console.error('Failed to store social graph npubs:', err);
      }
    }
  }, [graph, isClient]);

  // Function to handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    // Verify node exists before setting it as selected
    if (!node) {
      console.warn('Attempted to select a null or undefined node');
      return;
    }
    
    try {
      setSelectedNode(node === selectedNode ? null : node);
    } catch (err) {
      console.error('Error selecting node:', err);
      // Force refresh on node selection error
      forceRefresh();
    }
  }, [selectedNode, forceRefresh]);

  // Custom node painting with improved image handling
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Skip invalid nodes to prevent rendering errors
    if (!node || node === undefined) {
      console.warn('Attempted to paint an invalid node');
      return;
    }
    
    const { x, y } = node as any;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    
    // Apply hover effect using slightly larger size
    const isHovered = node === selectedNode;
    const isCoreNode = node.isCoreNode;
    const hoverScale = isHovered ? 1.2 : 1;
    // Use different base sizes for core vs. regular nodes
    const baseSize = isCoreNode ? 18 : 4;
    const size = baseSize * Math.min(2, Math.max(0.5, 1 / globalScale)) * hoverScale;
    
    // Helper function to draw a circle
    const drawCircle = (color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw border (thicker for hovered nodes)
      ctx.strokeStyle = isHovered ? BRAND_COLORS.bitcoinOrange : 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = isHovered ? 1.5 : 0.5;
      ctx.stroke();
    };
    
    // Force preload the image if it exists and isn't already in cache
    if (node.picture && node.picture !== DEFAULT_PROFILE_IMAGE && !IMAGE_CACHE.has(node.picture)) {
      preloadImage(node.picture).catch(() => {
        console.warn(`Failed to preload image for node: ${node.name || node.npub}`);
      });
    }
    
    // Draw the node image if available
    if (node.picture && node.picture !== DEFAULT_PROFILE_IMAGE) {
      const cachedImage = IMAGE_CACHE.get(node.picture);
      
      if (cachedImage) {
        // Draw circle background first
        drawCircle(node.color || BRAND_COLORS.lightSand);
        
        // Draw the image as a circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size - 0.5, 0, 2 * Math.PI);
        ctx.clip();
        
        try {
          ctx.drawImage(
            cachedImage,
            x - size + 0.5,
            y - size + 0.5,
            (size - 0.5) * 2,
            (size - 0.5) * 2
          );
        } catch (e) {
          // Fallback to circle if image fails
          drawCircle(node.color || BRAND_COLORS.lightSand);
        }
        
        ctx.restore();
        
        // Draw highlighted border for core nodes or hovered nodes
        if (node.isCoreNode || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, size + 1, 0, 2 * Math.PI);
          ctx.strokeStyle = node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.blueGreen;
          ctx.lineWidth = isHovered ? 2.5 : 2;
          ctx.stroke();
          
          // Add glow effect for hovered nodes
          if (isHovered) {
            const glowSize = size + 3;
            ctx.beginPath();
            ctx.arc(x, y, glowSize, 0, 2 * Math.PI);
            const gradient = ctx.createRadialGradient(x, y, size, x, y, glowSize);
            gradient.addColorStop(0, `${BRAND_COLORS.bitcoinOrange}4D`); // 30% opacity
            gradient.addColorStop(1, `${BRAND_COLORS.bitcoinOrange}00`); // 0% opacity
            ctx.fillStyle = gradient;
            ctx.fill();
          }
        }
      } else {
        // No cached image yet, try to load it
        preloadImage(node.picture)
          .then(img => {
            // Once loaded, force a repaint
            if (forceGraphRef.current) {
              forceGraphRef.current.refresh();
            }
          })
          .catch(() => {});
        // Draw fallback circle
        drawCircle(node.color || BRAND_COLORS.lightSand);
      }
    } else {
      // Draw a basic circle for nodes without images
      drawCircle(node.color || BRAND_COLORS.lightSand);
      
      // Add glow effect for hovered nodes
      if (isHovered) {
        const glowSize = size + 3;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, size, x, y, glowSize);
        gradient.addColorStop(0, `${BRAND_COLORS.bitcoinOrange}4D`); // 30% opacity
        gradient.addColorStop(1, `${BRAND_COLORS.bitcoinOrange}00`); // 0% opacity
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
    
    // For core nodes, add a small star indicator
    if (node.isCoreNode && !isHovered) {
      const starSize = size / 2;
      ctx.fillStyle = BRAND_COLORS.bitcoinOrange;
      
      // Draw a small star or indicator dot
      ctx.beginPath();
      ctx.arc(x + size * 0.7, y - size * 0.7, starSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw node label only on hover - nowhere else!
    if (isHovered) {
      const labelText = node.name || shortenNpub(node.npub || '');
      if (labelText) {
        const fontSize = Math.max(12, size/globalScale/3);
        ctx.font = `${isHovered ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text background
        const textWidth = ctx.measureText(labelText).width;
        const bgPadding = 2;
        const bgHeight = Math.max(14, fontSize) + (bgPadding * 2);
        
        let bgColor = 'rgba(255, 255, 255, 0.7)';
        let textColor = '#333';
        
        if (node.isCoreNode) {
          bgColor = `${BRAND_COLORS.bitcoinOrange}CC`; // 80% opacity
          textColor = 'white';
        } else if (isHovered) {
          bgColor = `${BRAND_COLORS.blueGreen}CC`; // 80% opacity
          textColor = 'white';
        }
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(
          x - textWidth/2 - bgPadding,
          y + size + 2,
          textWidth + (bgPadding * 2),
          bgHeight
        );
        
        // Draw text
        ctx.fillStyle = textColor;
        ctx.fillText(labelText, x, y + size + 2 + bgHeight/2);
      }
    }
  }, [shortenNpub, selectedNode]);

  // Memory management - clear image cache on unmount
  useEffect(() => {
    return () => {
      // Clean up resources when component unmounts
      if (forceGraphRef.current) {
        forceGraphRef.current = null;
      }
    };
  }, []);

  // Process second-degree connections manually
  const processMoreConnections = useCallback(async () => {
    if (!graph || !isNdkReady || processingSecondDegree) return;
    
    setProcessingSecondDegree(true);
    setLoadingMessage("Fetching additional connections...");
    
    try {
      // Get existing first-degree connections
      const firstDegreeConnections = new Set<string>();
      const coreKeys: string[] = [];
      
      // Get core pubkeys
      for (const npub of effectiveNpubs) {
        try {
          const { data: pubkey } = nip19.decode(npub);
          coreKeys.push(pubkey as string);
        } catch (err) {
          console.warn('Invalid npub:', npub, err);
        }
      }
      
      // Find all first-degree connections
      for (const link of graph.links) {
        const source = typeof link.source === 'string' ? link.source : link.source?.id;
        const target = typeof link.target === 'string' ? link.target : link.target?.id;
        
        if (source && coreKeys.includes(source) && target && !coreKeys.includes(target)) {
          firstDegreeConnections.add(target);
        }
        
        if (target && coreKeys.includes(target) && source && !coreKeys.includes(source)) {
          firstDegreeConnections.add(source);
        }
      }
      
      console.log(`Found ${firstDegreeConnections.size} first-degree connections to process`);
      
      // Process additional second-degree connections
      const addedPubkeys = new Set<string>();
      graph.nodes.forEach(node => addedPubkeys.add(node.id));
      
      const { nodes: updatedNodes, links: updatedLinks } = await processSecondDegreeConnections(
        firstDegreeConnections,
        coreKeys,
        [...graph.nodes],
        [...graph.links],
        addedPubkeys
      );
      
      // Create new graph data
      const graphData: GraphData = {
        nodes: updatedNodes,
        links: updatedLinks,
        lastUpdated: Date.now()
      };
      
      // Mark core nodes to ensure proper visualization
      const markedGraphData = markCoreNodes(graphData, effectiveNpubs);
      
      // Update state and refs directly
      setGraph(markedGraphData);
      graphDataRef.current = markedGraphData;
      
      // Cache the updated data
      GRAPH_CACHE.data = markedGraphData;
      GRAPH_CACHE.timestamp = Date.now();
      
      // Count how many second-degree connections we have
      const secondDegreeCount = markedGraphData.nodes.filter(node => 
        !node.isCoreNode && !firstDegreeConnections.has(node.pubkey)
      ).length;
      
      console.log(`Graph now has ${markedGraphData.links.length} links, ${markedGraphData.nodes.length} nodes, and ${secondDegreeCount} second-degree connections`);
      
    } catch (err) {
      console.error('Error processing additional connections:', err);
      setError('Failed to process additional connections');
    } finally {
      setProcessingSecondDegree(false);
    }
  }, [graph, isNdkReady, effectiveNpubs, processSecondDegreeConnections]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height }}>
      {/* Remove the search filter */}
      
      {loading && isClient ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
          <div className="text-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-forest border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-forest dark:text-sand">{loadingMessage}</p>
          </div>
        </div>
      ) : null}
      
      {processingSecondDegree && isClient ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
          <div className="text-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-forest border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-forest dark:text-sand">Processing additional connections...</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 dark:bg-red-900 bg-opacity-80 dark:bg-opacity-80 z-10">
          <div className="text-center p-4">
            <p className="text-red-700 dark:text-red-200 mb-4">{error}</p>
            <button 
              className="px-4 py-2 bg-forest text-white rounded-md hover:bg-opacity-90 transition-colors"
              onClick={() => {
                setError(null);
                buildGraph();
              }}
            >
              Retry
            </button>
          </div>
            </div>
      ) : null}

      {graph && (
        <ForceGraph2D
          ref={forceGraphRef}
          graphData={convertGraphData(graph) as any}
          nodeLabel={() => ''}
          width={typeof width === 'number' ? width : undefined}
          height={typeof height === 'number' ? height : undefined}
          cooldownTime={5000}
          onEngineStop={() => {
            // Center graph on a core node after initial render
            if (forceGraphRef.current && graph.nodes.length > 0) {
              const centerNode = graph.nodes.find(node => 
                node.npub === centerNpub || node.isCoreNode
              );
              if (centerNode) {
                forceGraphRef.current.centerAt(
                  (centerNode as any).x,
                  (centerNode as any).y,
                  1000
                );
                forceGraphRef.current.zoom(2, 1000);
              }
            }
          }}
          onNodeClick={(node) => handleNodeClick((node as any) as GraphNode)}
          onNodeHover={(node) => {
            if (node) {
              document.body.style.cursor = 'pointer';
              setSelectedNode((node as any) as GraphNode); // Show tooltip on hover
            } else {
              document.body.style.cursor = 'default';
              setSelectedNode(null); // Hide tooltip when not hovering
            }
          }}
          nodeCanvasObject={(node, ctx, globalScale) => paintNode((node as any) as GraphNode, ctx, globalScale)}
          nodePointerAreaPaint={(node, color, ctx) => {
            const { x, y } = (node as any);
            const size = ((node as any) as GraphNode).val || 5 * 1.5;
            ctx.beginPath();
            ctx.arc(x, y, size + 3, 0, 2 * Math.PI); // Slightly larger hit area for better interaction
            ctx.fillStyle = 'transparent';
            ctx.fill();
          }}
          linkDirectionalParticles={link => (((link as any) as GraphLink).type === 'mutual' ? 4 : 0)}
          linkDirectionalParticleSpeed={0.005}
          linkWidth={link => {
            const graphLink = ((link as any) as GraphLink);
            const sourcePubkey = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as any).id;
            const targetPubkey = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as any).id;
            
            // Highlight links connected to the selected node
            if (selectedNode && 
                (sourcePubkey === selectedNode.pubkey || targetPubkey === selectedNode.pubkey)) {
              return graphLink.type === 'mutual' ? 3 : 2;
            }
            
            return graphLink.type === 'mutual' ? 2 : 1;
          }}
          linkColor={link => {
            const graphLink = ((link as any) as GraphLink);
            const sourcePubkey = typeof graphLink.source === 'string' ? graphLink.source : (graphLink.source as any).id;
            const targetPubkey = typeof graphLink.target === 'string' ? graphLink.target : (graphLink.target as any).id;
            
            // Highlight links connected to the selected node
            if (selectedNode && 
                (sourcePubkey === selectedNode.pubkey || targetPubkey === selectedNode.pubkey)) {
              return graphLink.type === 'mutual' 
                ? BRAND_COLORS.bitcoinOrange
                : BRAND_COLORS.blueGreen;
            }
            
            return graphLink.type === 'mutual' 
              ? BRAND_COLORS.bitcoinOrange
              : `${BRAND_COLORS.lightSand}99`;
          }}
          backgroundColor="rgba(0,0,0,0)"
        />
        )}

        {selectedNode && (
        <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg z-20 max-w-[250px] transition-all duration-300 ease-in-out">
          <div className="flex items-center mb-2">
            {selectedNode.picture ? (
              <a
                href={`https://njump.me/${selectedNode.npub}`}
                target="_blank"
                rel="noopener noreferrer" 
                className="block mr-2" 
              >
                <img 
                  src={selectedNode.picture} 
                  alt={selectedNode.name || shortenNpub(selectedNode.npub || '')}
                  className="w-10 h-10 rounded-full border-2 border-forest hover:border-bitcoin transition-colors"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
              </a>
            ) : (
              <a
                href={`https://njump.me/${selectedNode.npub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mr-2"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-forest hover:border-bitcoin transition-colors flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {(selectedNode.name?.substring(0, 2) || shortenNpub(selectedNode.npub || '').substring(0, 2)).toUpperCase()}
                  </span>
                </div>
              </a>
            )}
            <div>
              <a
                href={`https://njump.me/${selectedNode.npub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <h3 className="font-semibold">{selectedNode.name || shortenNpub(selectedNode.npub || '')}</h3>
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">{shortenNpub(selectedNode.npub || '')}</p>
            </div>
          </div>
          
          <div className="flex space-x-2 mt-2">
            <button 
              className="px-3 py-1 text-xs bg-forest text-white rounded hover:bg-opacity-90 transition-colors"
              onClick={() => {
                // Open user's profile in new tab
                if (selectedNode.npub) {
                  window.open(`https://njump.me/${selectedNode.npub}`, '_blank');
                }
              }}
            >
              View Profile
            </button>
            <button 
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-opacity-90 transition-colors"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
            </div>
          </div>
        )}

      {/* Keep only the refresh button */}
      <div className="absolute bottom-2 right-2 z-20 flex space-x-2">
        <button 
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          onClick={forceRefresh}
          aria-label="Refresh graph"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        
        {/* Add button to fetch more connections */}
        {graph && (
          <button 
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={processMoreConnections}
            disabled={processingSecondDegree}
            aria-label="Process more connections"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SocialGraph;