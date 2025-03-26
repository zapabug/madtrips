'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react';
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

// Custom loading messages specifically for the graph component
const GRAPH_LOADING_MESSAGES = [
  "Negotiating TLS handshakes with paranoid relays...",
  "Brewing relay coffee in the protocol percolator...",
  "Riding NPUB submarines through relay channels...",
  "Chasing kind:1 events through the stratosphere...",
  "Bribing NIP-05 validators for VIP access...",
];

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
}

// Convert graph data to the format expected by ForceGraph2D
const convertGraphData = (data: GraphData) => {
  return {
    nodes: data.nodes.map(node => ({
      ...node,
      val: node.val || (node.isCoreNode ? 15 : 5),
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
      node.val = (node.val || 1) * 1.5;
      node.color = BRAND_COLORS.bitcoinOrange; // Use brand color instead of hardcoded
    }
  });
  
  return graphData;
};

export const SocialGraph: React.FC<SocialGraphProps> = ({
  centerNpub = CORE_NPUBS[0],
  npubs = CORE_NPUBS,
  maxConnections = 25,
  height = 600,
  width = '100%',
  className = '',
  data,
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const [graph, setGraph] = useState<GraphData | null>(data || null);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>(GRAPH_LOADING_MESSAGES[0]);
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const fetchInProgress = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const forceGraphRef = useRef<any>(null);
  const isNdkReady = !!ndk && ndkReady;

  // Initialize loading messages
  useEffect(() => {
    if (loading) {
      // Set up rotation of loading messages
      const interval = setInterval(() => {
        const messages = getLoadingMessageSequence('GRAPH', 5);
        const index = Math.floor(Math.random() * messages.length);
        setLoadingMessage(messages[index]);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [loading]);

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

  // Process second-degree connections (followers of followers) 
  const processSecondDegreeConnections = useCallback(async (
    firstDegreeConnections: Set<string>,
    coreKeys: string[],
    nodes: GraphNode[],
    links: GraphLink[],
    addedPubkeys: Set<string>
  ): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
    if (!ndk) return { nodes, links };
    
    // Track pubkeys we're processing to avoid duplicates
    const processedForFollowers = new Set<string>();
    const secondDegreeConnections = new Set<string>();
    
    // Take a subset of first-degree connections to process
    // This prevents the graph from getting too large
    const firstDegreeToProcess = Array.from(firstDegreeConnections).slice(0, Math.min(firstDegreeConnections.size, 10));
    
    for (const pubkey of firstDegreeToProcess) {
      // Skip if we've already processed this pubkey
      if (processedForFollowers.has(pubkey)) continue;
      processedForFollowers.add(pubkey);
      
      try {
        // Fetch this user's follows
        const contactsEvents = await Promise.race([
          ndk.fetchEvents({
            kinds: [3], // Contact lists
            authors: [pubkey],
            limit: 1
          }),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]).catch(() => null);
        
        if (contactsEvents && contactsEvents instanceof Set && contactsEvents.size > 0) {
          const contactList = Array.from(contactsEvents)[0];
          
          if (contactList && contactList.tags && Array.isArray(contactList.tags)) {
            // Extract follows that are either already known or limit new ones
            const relevantFollows = contactList.tags
              .filter(tag => Array.isArray(tag) && tag[0] === 'p')
              .map(tag => tag[1])
              .filter(followPubkey => 
                // Include if it's already in our graph or one of our core keys
                addedPubkeys.has(followPubkey) || 
                coreKeys.includes(followPubkey) ||
                // Or if we're still under our second-degree connection limit
                secondDegreeConnections.size < 15
              )
              .slice(0, 5); // Limit connections per node
            
            for (const followPubkey of relevantFollows) {
              // Don't add self-connections
              if (followPubkey === pubkey) continue;
              
              // If this is a new node we haven't seen before, add to second degree connections
              if (!addedPubkeys.has(followPubkey) && !coreKeys.includes(followPubkey)) {
                secondDegreeConnections.add(followPubkey);
                addedPubkeys.add(followPubkey);
              }
              
              // Add the connection if it doesn't already exist
              const existingLink = links.find(link => 
                (link.source === pubkey && link.target === followPubkey) ||
                (link.source === followPubkey && link.target === pubkey)
              );
              
              if (!existingLink) {
                links.push({
                  source: pubkey,
                  target: followPubkey,
                  type: 'follows',
                  value: 1 // Thinner connection for second-degree relationships
                });
              }
              
              // Check if this is a mutual follow
              const reverseLinkExists = links.some(link => 
                link.source === followPubkey && link.target === pubkey
              );
              
              if (reverseLinkExists) {
                // Update both directions to mutual status
                links.forEach(link => {
                  if ((link.source === pubkey && link.target === followPubkey) ||
                      (link.source === followPubkey && link.target === pubkey)) {
                    link.type = 'mutual';
                    link.value = 2;
                  }
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Error fetching follows for ${pubkey}:`, error);
      }
    }
    
    // Now fetch profiles for second-degree connections
    if (secondDegreeConnections.size > 0) {
      const secondDegreeArray = Array.from(secondDegreeConnections);
      
      // Process in batches to not overwhelm the system
      for (let i = 0; i < secondDegreeArray.length; i += 5) {
        const batch = secondDegreeArray.slice(i, i + 5);
        
        const profilePromises = batch.map(async (pubkey) => {
          try {
            const npub = nip19.npubEncode(pubkey);
            const profile = await getUserProfile(npub);
            
            return {
              id: pubkey,
              pubkey,
              npub,
              name: profile?.displayName || profile?.name || shortenNpub(npub),
              picture: profile?.picture || DEFAULT_PROFILE_IMAGE,
              isCoreNode: false,
              val: 5, // Smaller size for second-degree connections
              color: '#8B5CF6' // Different color for second-degree nodes
            };
          } catch (error) {
            const npub = nip19.npubEncode(pubkey);
            
            return {
              id: pubkey,
              pubkey,
              npub,
              name: shortenNpub(npub),
              picture: DEFAULT_PROFILE_IMAGE,
              isCoreNode: false,
              val: 5,
              color: '#8B5CF6'
            };
          }
        });
        
        const profileResults = await Promise.allSettled(profilePromises);
        
        profileResults.forEach(result => {
          if (result.status === 'fulfilled') {
            nodes.push(result.value);
          }
        });
      }
    }
    
    return { nodes, links };
  }, [ndk, getUserProfile, shortenNpub]);
  
  // Fetch network data from Nostr - prioritizing real data only
  const fetchNostrData = useCallback(async () => {
    if (fetchInProgress.current) {
      // Skip if already fetching to prevent duplicate requests
      return;
    }
    
    setIsLoading(true);
    fetchInProgress.current = true;
    setError(null);
    
    // Start with empty graph
    setGraph({
      nodes: [],
      links: []
    });
    
    if (!ndk || !ndkReady) {
      // No NDK instance or not connected
      // Attempt to reconnect to relays before continuing
      await reconnect();
      
      if (!ndk) {
        setError('Nostr client not available');
        setIsLoading(false);
        return;
      }
    }
    
    try {
      // Convert npubs to pubkeys
      const pubkeyMap = new Map<string, string>();
      const coreKeys = npubs.map(npub => {
        try {
          if (npub.startsWith('npub')) {
            const decoded = nip19.decode(npub);
            const hexKey = decoded.data as string;
            pubkeyMap.set(hexKey, npub);
            return hexKey;
          }
          return npub;
        } catch (error) {
          return '';
        }
      }).filter(key => key !== '');
      
      if (coreKeys.length === 0) {
        throw new Error('No valid npubs provided');
      }
      
      // Track all pubkeys we add to graph
      const addedPubkeys = new Set<string>(coreKeys);
      
      // Arrays for our data
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const nodeImagesMap = new Map<string, HTMLImageElement>();
      
      // STEP 1: Fetch core profiles
      const fetchCoreProfiles = async (
        coreKeys: string[]
      ): Promise<GraphNode[]> => {
        // Fetch basic profile info for our core nodes
        const nodes: GraphNode[] = [];
        
        // Create a copy to modify core keys
        const coreKeysToProcess = [...coreKeys];
        
        // Convert npubs to hex pubkeys if needed
        const coreHexKeys: string[] = await Promise.all(
          coreKeysToProcess.map(async (key) => {
            if (key.startsWith('npub')) {
              try {
                const decoded = nip19.decode(key);
                return decoded.data as string;
              } catch (e) {
                return '';
              }
            }
            return key;
          })
        );
        
        // Filter out any invalid keys
        const validHexKeys = coreHexKeys.filter(key => key !== '');
        
        // Fetch profiles for valid keys
        const profilePromises = validHexKeys.map(async (pubkey) => {
          try {
            const profile = await getUserProfile(pubkeyMap.get(pubkey) || nip19.npubEncode(pubkey));
            
            // Preload image for smoother rendering
            let pictureUrl = profile?.picture || DEFAULT_PROFILE_IMAGE;
            if (pictureUrl && !/^https?:\/\//i.test(pictureUrl)) {
              pictureUrl = DEFAULT_PROFILE_IMAGE;
            }
            
            const img = new Image();
            img.src = pictureUrl;
            nodeImagesMap.set(pubkey, img);
            
            return {
              id: pubkey,
              pubkey,
              npub: pubkeyMap.get(pubkey) || nip19.npubEncode(pubkey),
              name: profile?.displayName || profile?.name || shortenNpub(pubkey),
              picture: pictureUrl,
              isCoreNode: true,
              val: 20, // Larger size for core nodes
              color: BRAND_COLORS.bitcoinOrange
            };
          } catch (err) {
            console.error(`Error fetching profile for ${pubkey}:`, err);
            
            return {
              id: pubkey,
              pubkey,
              npub: pubkeyMap.get(pubkey) || nip19.npubEncode(pubkey),
              name: shortenNpub(pubkey),
              picture: DEFAULT_PROFILE_IMAGE,
              isCoreNode: true,
              val: 20,
              color: BRAND_COLORS.bitcoinOrange
            };
          }
        });
        
        const profileResults = await Promise.allSettled(profilePromises);
        
        profileResults.forEach(result => {
          if (result.status === 'fulfilled') {
            nodes.push(result.value);
          }
        });
        
        return nodes;
      };
      
      const coreProfiles = await fetchCoreProfiles(coreKeys);
      
      // Add core nodes to graph
      setGraph({
        nodes: [...coreProfiles],
        links: []
      });
      setNodeImages(nodeImagesMap);
      
      // STEP 2: Get direct connections for core nodes
      // Track first-degree connections to process later
      const firstDegreeConnections = new Set<string>();
      
      // Process core nodes in sequence to avoid overwhelming relays
      for (const coreNode of coreProfiles) {
        try {
          // Fetch contacts with timeout
          const contactsEvents = await Promise.race([
            ndk.fetchEvents({
              kinds: [3], // Contact lists
              authors: [coreNode.pubkey],
              limit: 1
            }),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]).catch(() => null);
          
          // If we have contacts
          if (contactsEvents && contactsEvents instanceof Set && contactsEvents.size > 0) {
            const contactList = Array.from(contactsEvents)[0];
            
            // Extract follows from tags if they exist
            if (contactList && contactList.tags && Array.isArray(contactList.tags)) {
              const follows = contactList.tags
                .filter(tag => Array.isArray(tag) && tag[0] === 'p')
                .map(tag => tag[1])
                .filter(followPubkey => coreKeys.includes(followPubkey))
                .slice(0, maxConnections);
              
              // Add connections
              for (const followPubkey of follows) {
                if (followPubkey !== coreNode.pubkey) {
                  links.push({
                    source: coreNode.pubkey,
                    target: followPubkey,
                    type: 'follows',
                    value: 2
                  });
                  
                  // Check for mutual follows
                  const isMutual = links.some(
                    link => link.source === followPubkey && link.target === coreNode.pubkey
                  );
                  
                  if (isMutual) {
                    // Update both links to mutual
                    links.forEach(link => {
                      if ((link.source === coreNode.pubkey && link.target === followPubkey) ||
                          (link.source === followPubkey && link.target === coreNode.pubkey)) {
                        link.type = 'mutual';
                        link.value = 3;
                      }
                    });
                  }
                }
              }
              
              // Also collect non-core follows for second-degree processing
              const nonCoreFollows = contactList.tags
                .filter(tag => Array.isArray(tag) && tag[0] === 'p')
                .map(tag => tag[1])
                .filter(followPubkey => !coreKeys.includes(followPubkey))
                .slice(0, maxConnections);
                
              nonCoreFollows.forEach(pubkey => {
                firstDegreeConnections.add(pubkey);
                addedPubkeys.add(pubkey);
              });
            }
          }
          
          // Update the graph progressively to show connections forming
          setGraph({
            nodes: [...coreProfiles],
            links: [...links]
          });
        } catch (e) {
          console.warn(`Error fetching contacts for ${coreNode.pubkey}:`, e);
        }
      }
      
      // STEP 3: Get profiles for first-degree connections
      if (firstDegreeConnections.size > 0) {
        const firstDegreeArray = Array.from(firstDegreeConnections);
        
        // Process in batches to avoid overwhelming system
        for (let i = 0; i < firstDegreeArray.length; i += 5) {
          const batch = firstDegreeArray.slice(i, i + 5);
          
          const profilePromises = batch.map(async (pubkey) => {
            try {
              const npub = nip19.npubEncode(pubkey);
              const profile = await getUserProfile(npub);
              
              // Preload image
              let pictureUrl = profile?.picture || DEFAULT_PROFILE_IMAGE;
              if (pictureUrl && !/^https?:\/\//i.test(pictureUrl)) {
                pictureUrl = DEFAULT_PROFILE_IMAGE;
              }
              
              const img = new Image();
              img.src = pictureUrl;
              nodeImagesMap.set(npub, img);
              
              return {
                id: pubkey,
                pubkey,
                npub,
                name: profile?.displayName || profile?.name || shortenNpub(npub),
                picture: pictureUrl,
                isCoreNode: false,
                val: 10, // Medium size for first-degree connections
                color: BRAND_COLORS.forestGreen
              };
            } catch (err) {
              console.error(`Error fetching profile for ${pubkey}:`, err);
              const npub = nip19.npubEncode(pubkey);
              
              return {
                id: pubkey,
                pubkey,
                npub,
                name: shortenNpub(npub),
                picture: DEFAULT_PROFILE_IMAGE,
                isCoreNode: false,
                val: 10,
                color: BRAND_COLORS.forestGreen
              };
            }
          });
          
          const profileResults = await Promise.allSettled(profilePromises);
          
          // Add nodes and update images
          profileResults.forEach(result => {
            if (result.status === 'fulfilled') {
              nodes.push(result.value);
            }
          });
          
          // Show first-degree nodes as they're processed
          setGraph({
            nodes: [...coreProfiles],
            links: [...links]
          });
          setNodeImages(nodeImagesMap);
        }
        
        // STEP 4: Process second-degree connections (followers of followers)
        const { nodes: updatedNodes, links: updatedLinks } = 
          await processSecondDegreeConnections(
            firstDegreeConnections,
            coreKeys,
            nodes,
            links,
            addedPubkeys
          );
          
        // Final graph update with all nodes and links
        setNodeImages(nodeImagesMap);
        setGraph({
          nodes: updatedNodes,
          links: updatedLinks
        });
      } else {
        // If no first-degree connections found
        setGraph({
          nodes: coreProfiles,
          links: []
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching social graph data:', error);
      setError('Failed to load social graph data. Please try again.');
      setIsLoading(false);
    } finally {
      fetchInProgress.current = false;
    }
  }, [ndk, npubs, maxConnections, getUserProfile, reconnect, shortenNpub, processSecondDegreeConnections]);

  // Process graph data on mount or when data changes
  useEffect(() => {
    const processData = async () => {
      if (fetchInProgress.current) return;
      
      try {
        setError('');
        setIsLoading(true);
        fetchInProgress.current = true;
        
        let graphData = data;
        
        if (!graphData) {
          // Fetch from API if not provided directly
          try {
            const response = await fetch('/api/socialgraph');
            if (!response.ok) {
              throw new Error(`API responded with status ${response.status}`);
            }
            const responseData = await response.json();
            graphData = responseData.data;
          } catch (err) {
            setError('Failed to load social graph data from API');
            setIsLoading(false);
            fetchInProgress.current = false;
            return;
          }
        }
        
        if (graphData && graphData.nodes && graphData.links) {
          // Mark core nodes explicitly
          graphData = markCoreNodes(graphData, npubs);
          
          // Find center node
          const centerNodeId = centerNpub.startsWith('npub') 
            ? nip19.decode(centerNpub).data.toString()
            : centerNpub;
          
          const centerNode = graphData.nodes.find(node => 
            node.id === centerNodeId || node.npub === centerNpub
          );
          
          if (centerNode) {
            // Pin the center node in the middle
            if (typeof width === 'number' && typeof height === 'number') {
              centerNode.fx = width / 2;
              centerNode.fy = height / 2;
            }
            centerNode.val = (centerNode.val || 1) * 2;
            centerNode.isCoreNode = true;
          }
          
          // Process data for visualization
          setGraph(graphData);
          
          // Initialize the force graph with the processed data
          initializeForceGraph(graphData);
        } else {
          setError('Invalid social graph data format');
        }
      } catch (error) {
        setError(`Error processing social graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        fetchInProgress.current = false;
      }
    };
    
    processData();
  }, [data, npubs, centerNpub, height, width, initializeForceGraph]);

  // Effect to initialize force graph when data changes
  useEffect(() => {
    if (forceGraphRef.current && graph && graph.nodes.length > 0) {
      initializeForceGraph(graph);
    }
  }, [graph, initializeForceGraph]);

  // Render appropriate UI based on loading/error state
  if (loading) {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-forest rounded-lg ${className}`} 
        style={{ height, width }}
      >
        <div className="text-lg font-medium text-center text-sand">
          Loading Nostr social graph...
        </div>
        
        <div className="mt-4 text-center max-w-md px-4 h-16 flex items-center justify-center">
          <div 
            className="animate-fade-in-out text-lg font-medium text-bitcoin"
          >
            {loadingMessage}
          </div>
        </div>
        
        {/* Bitcoin Orange to Ocean Blue gradient bar that fills and empties */}
        <div className="mt-6 w-64 h-3 bg-sand dark:bg-sand/30 rounded-full overflow-hidden relative shadow-inner">
          <div 
            className="absolute h-full rounded-full animate-fill-empty-bar"
            style={{ 
              background: `linear-gradient(to right, 
                ${BRAND_COLORS.bitcoinOrange}, 
                ${BRAND_COLORS.deepBlue})`,
              boxShadow: '0 0 10px rgba(247, 147, 26, 0.5)'
            }}
          ></div>
        </div>
        
        <div className="mt-6 text-sm text-sand italic">
          Real-time data takes a moment to load
        </div>
      </div>
    );
  }

  if (error && !graph) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height, width }}>
        <div className="text-center p-6 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 max-w-md">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Social Graph</h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          
          <div className="mt-4">
            <button 
              onClick={() => fetchNostrData()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm transition-colors"
            >
              Try Again with Nostr Data
            </button>
          </div>
          
          {!ndk && (
            <div className="p-4 mt-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-amber-700 dark:text-amber-300 mb-2">
                To use the social graph, you need a Nostr extension. 
                Try installing one of these:
              </p>
              <ul className="list-disc list-inside text-amber-600 dark:text-amber-400">
                <li><a href="https://getalby.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800 dark:hover:text-amber-200">Alby</a></li>
                <li><a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800 dark:hover:text-amber-200">nos2x</a></li>
                <li><a href="https://getflamingo.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800 dark:hover:text-amber-200">Flamingo</a></li>
              </ul>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <p>We prioritize showing real-time data from the Nostr network rather than using static or mock data.</p>
            <p className="mt-1">This ensures you always see the most up-to-date social connections.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="social-graph-container rounded-lg shadow-lg overflow-hidden w-full h-full"
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        background: `linear-gradient(135deg, ${BRAND_COLORS.deepBlue} 0%, ${BRAND_COLORS.forestGreen} 100%)`,
      }}
    >
      <div className="w-full h-full relative">
        <div className="absolute top-0 left-0 z-10 p-2 flex items-center space-x-2">
          <div className="font-medium px-3 py-1 bg-white/30 border border-gray-200 rounded shadow-sm text-sm" style={{ color: BRAND_COLORS.lightSand }}>
            Bitcoin Madeira Social Graph
          </div>
          <button 
            onClick={() => fetchNostrData()}
            disabled={loading}
            className={`px-3 py-1 bg-white/20 hover:bg-white/30 rounded shadow-sm text-sm font-medium border border-gray-200 flex items-center ${loading ? 'opacity-50' : ''}`}
            aria-label="Reload graph with real data"
            style={{ color: BRAND_COLORS.lightSand }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading...' : 'Load Nostr Data'}
          </button>
        </div>

        {error && (
          <div className="absolute top-12 left-0 z-10 p-2 w-full">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded max-w-md mx-auto">
              <p className="text-sm">{error}</p>
              <div className="flex justify-end mt-1">
                <button 
                  onClick={() => setError(null)} 
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedNode && (
          <div className="absolute bottom-0 left-0 z-10 p-2 w-full">
            <div className="shadow-sm p-3 max-w-xs mx-auto border border-gray-200 rounded-lg" style={{ backgroundColor: BRAND_COLORS.deepBlue }}>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3 border-2" style={{ borderColor: BRAND_COLORS.bitcoinOrange }}>
                  <img 
                    src={selectedNode.picture || DEFAULT_PROFILE_IMAGE} 
                    alt={selectedNode.name || shortenNpub(selectedNode.npub || '')}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_PROFILE_IMAGE;
                    }}
                  />
                </div>
                <div>
                  <div className="font-medium" style={{ color: BRAND_COLORS.lightSand }}>{selectedNode.name || (selectedNode.npub ? shortenNpub(selectedNode.npub) : '')}</div>
                  <div className="text-xs" style={{ color: BRAND_COLORS.lightSand + '99' }}>{selectedNode.npub ? shortenNpub(selectedNode.npub) : ''}</div>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <a 
                  href={`https://njump.me/${selectedNode.npub}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: BRAND_COLORS.bitcoinOrange }}
                >
                  View on Nostr →
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full">
          {graph && (
            <ForceGraph2D
              graphData={convertGraphData(graph) as any}
              nodeColor={(node: any) => node.color || BRAND_COLORS.lightSand}
              nodeVal={(node: any) => node.val || 1}
              linkColor={(link: any) => link.color || BRAND_COLORS.lightSand + '99'}
              linkWidth={(link: any) => Math.sqrt(link.value || 1) * 1.5}
              onNodeClick={(node: any) => setSelectedNode(node as GraphNode)}
              width={typeof width === 'number' ? width : parseInt(width) || undefined}
              height={typeof height === 'number' ? height : parseInt(height) || undefined}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                // Helper function to draw fallback circle
                const drawFallbackCircle = (node: GraphNode, ctx: CanvasRenderingContext2D, size: number) => {
                  try {
                    ctx.beginPath();
                    ctx.fillStyle = node.color as string || BRAND_COLORS.lightSand;
                    ctx.arc(node.x as number, node.y as number, size, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Add highlight border for core nodes
                    if (node.isCoreNode) {
                      ctx.beginPath();
                      ctx.strokeStyle = BRAND_COLORS.bitcoinOrange; // Bitcoin orange for core nodes
                      ctx.lineWidth = 2;
                      ctx.arc(node.x as number, node.y as number, size + 2, 0, 2 * Math.PI);
                      ctx.stroke();
                    }
                  } catch (err) {
                    console.error('Error drawing fallback circle:', err);
                  }
                };

                try {
                  const graphNode = node as GraphNode;
                  const nodeSize = graphNode.val || 5;
                  
                  // Always draw the fallback circle first as a base layer
                  drawFallbackCircle(graphNode, ctx, nodeSize);
                  
                  // Then try to draw the profile image on top if available
                  if (graphNode.npub) {
                    const imageSource = nodeImages.get(graphNode.npub);
                    
                    if (imageSource && imageSource.complete && imageSource.naturalWidth > 0) {
                      try {
                        // Create circular clipping path
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(graphNode.x as number, graphNode.y as number, nodeSize, 0, 2 * Math.PI);
                        ctx.clip();
                        
                        // Draw the profile image
                        const imgSize = nodeSize * 2;
                        ctx.drawImage(
                          imageSource, 
                          (graphNode.x as number) - nodeSize, 
                          (graphNode.y as number) - nodeSize, 
                          imgSize, 
                          imgSize
                        );
                        
                        ctx.restore();
                        
                        // Add highlight border for core nodes
                        if (graphNode.isCoreNode) {
                          ctx.beginPath();
                          ctx.strokeStyle = BRAND_COLORS.bitcoinOrange; // Bitcoin orange for core nodes
                          ctx.lineWidth = 2;
                          ctx.arc(graphNode.x as number, graphNode.y as number, nodeSize + 2, 0, 2 * Math.PI);
                          ctx.stroke();
                        }
                      } catch (drawErr) {
                        // Image drawing failed, but we already have the fallback circle
                        console.warn('Error drawing profile image:', drawErr);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Error rendering node:', err);
                  // In case of any error, don't crash the rendering
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialGraph;