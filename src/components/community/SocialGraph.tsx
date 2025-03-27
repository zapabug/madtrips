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

// Function to preload images for better render performance
const preloadImage = (url: string): Promise<HTMLImageElement> => {
  // Check if image is already in cache
  if (IMAGE_CACHE.has(url)) {
    return Promise.resolve(IMAGE_CACHE.get(url)!);
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      IMAGE_CACHE.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      // Use default image on error
      const defaultImg = new Image();
      defaultImg.src = DEFAULT_PROFILE_IMAGE;
      IMAGE_CACHE.set(url, defaultImg);
      resolve(defaultImg);
    };
    img.src = url;
  });
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
  const [loadingMessage, setLoadingMessage] = useState<string>(getRandomLoadingMessage('GRAPH'));
  
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

  // Process second-degree connections (followers of followers) with improved performance 
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
    // Use the most connected nodes for better graph structure
    const firstDegreeArray = Array.from(firstDegreeConnections);
    const firstDegreeToProcess = firstDegreeArray.slice(0, Math.min(firstDegreeConnections.size, 10));
    
    // Process in smaller batches to avoid overwhelming the relays
    const batchSize = 2;
    for (let i = 0; i < firstDegreeToProcess.length; i += batchSize) {
      const batch = firstDegreeToProcess.slice(i, i + batchSize);
      
      // Process all pubkeys in the batch concurrently
      await Promise.all(batch.map(async (pubkey) => {
        // Skip if we've already processed this pubkey
        if (processedForFollowers.has(pubkey)) return;
        processedForFollowers.add(pubkey);
        
        try {
          // Fetch this user's follows
          const contactsEvents = await ndk.fetchEvents({
            kinds: [3], // Contact lists
            authors: [pubkey],
            limit: 1
          });
          
          for (const event of contactsEvents) {
            // Extract p tags (following)
            const following = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1]);
            
            // Limit the number of connections we add per node to avoid overloading the graph
            const limitedFollowing = following.slice(0, maxConnections);
            
            for (const followedPubkey of limitedFollowing) {
              // Skip core pubkeys and already added pubkeys
              if (coreKeys.includes(followedPubkey) || addedPubkeys.has(followedPubkey)) {
                continue;
              }
              
              // Add to second-degree connections set for later profile fetching
              secondDegreeConnections.add(followedPubkey);
              
              // Create link from the first degree pubkey to the followed pubkey
              links.push({
                source: pubkey,
                target: followedPubkey,
                type: 'follows',
              });
              
              // Add to set of pubkeys we've added to the graph
              addedPubkeys.add(followedPubkey);
            }
          }
        } catch (err) {
          console.warn('Error processing followers for pubkey:', pubkey, err);
        }
      }));
    }
    
    // Check if we need to fetch profiles for the second-degree connections
    if (secondDegreeConnections.size > 0) {
      // Only process a limited number of second-degree connections to keep graph manageable
      const limitedSecondDegree = Array.from(secondDegreeConnections).slice(0, Math.min(secondDegreeConnections.size, 20));
      
      // Create basic nodes for all second-degree connections
      // We'll fetch profile data later if needed
      for (const pubkey of limitedSecondDegree) {
        const npub = nip19.npubEncode(pubkey);
        nodes.push({
          id: pubkey,
          pubkey: pubkey,
          npub: npub,
          name: shortenNpub(npub),
          picture: DEFAULT_PROFILE_IMAGE,
          isCoreNode: false,
        });
      }
    }
    
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
      
      // Check if we have cached data
      if (GRAPH_CACHE.data && (Date.now() - GRAPH_CACHE.timestamp < GRAPH_CACHE.ttl)) {
        // Use cached data
        setGraph(GRAPH_CACHE.data);
        graphDataRef.current = GRAPH_CACHE.data;
        setIsLoading(false);
        fetchInProgress.current = false;
        return;
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
      
      // Fetch profiles for core nodes
      const coreNodesWithProfiles = await fetchProfiles(coreNodes);
      
      // Process first-degree connections
      const nodes: GraphNode[] = [...coreNodesWithProfiles];
      const links: GraphLink[] = [];
      const addedPubkeys = new Set<string>(coreKeys);
      const firstDegreeConnections = new Set<string>();
      
      // Get followers for each core pubkey
      for (const pubkey of coreKeys) {
        try {
          const contactsEvents = await ndk.fetchEvents({
            kinds: [3], // Contact lists
            authors: [pubkey],
            limit: 1
          });
          
          for (const event of contactsEvents) {
            // Extract p tags (following)
            const following = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1]);
            
            // Limit the number of connections per node
            const limitedFollowing = following.slice(0, maxConnections);
            
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
                });
                
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
      
      // Process second-degree connections
      const { nodes: updatedNodes, links: updatedLinks } = await processSecondDegreeConnections(
        firstDegreeConnections,
        coreKeys,
        nodes,
        links,
        addedPubkeys
      );
      
      // Fetch profiles for first-degree connections
      const firstDegreeNodes = updatedNodes.filter(node => 
        !node.isCoreNode && firstDegreeConnections.has(node.pubkey)
      );
      
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
      
      // Final graph data
      const graphData: GraphData = {
        nodes: finalNodes,
        links: updatedLinks,
        lastUpdated: Date.now()
      };
      
      // Mark core nodes to ensure proper visualization
      const markedGraphData = markCoreNodes(graphData, effectiveNpubs);
      
      // Cache the graph data
      GRAPH_CACHE.data = markedGraphData;
      GRAPH_CACHE.timestamp = Date.now();
      
      // Update state and refs
      setGraph(markedGraphData);
      graphDataRef.current = markedGraphData;
      
      // Preload images for all nodes
      for (const node of finalNodes) {
        if (node.picture && node.picture !== DEFAULT_PROFILE_IMAGE) {
          preloadImage(node.picture).catch(() => {});
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
    maxConnections, fetchProfiles, processSecondDegreeConnections
  ]);

  // Initialize the graph when NDK is ready
  useEffect(() => {
    if (isNdkReady && !graph) {
      buildGraph();
    }
  }, [isNdkReady, graph, buildGraph]);

  // Function to handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node === selectedNode ? null : node);
  }, [selectedNode]);

  // Custom node painting with improved image handling
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y } = node as any;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    
    const size = (node.val || 5) * Math.min(2, Math.max(0.5, 1 / globalScale));
    
    // Helper function to draw a circle
    const drawCircle = (color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };
    
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
        
        // Draw highlighted border for core nodes
        if (node.isCoreNode) {
          ctx.beginPath();
          ctx.arc(x, y, size + 1, 0, 2 * Math.PI);
          ctx.strokeStyle = BRAND_COLORS.bitcoinOrange;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        // No cached image yet, try to load it
        preloadImage(node.picture).catch(() => {});
        // Draw fallback circle
        drawCircle(node.color || BRAND_COLORS.lightSand);
      }
    } else {
      // Draw a basic circle for nodes without images
      drawCircle(node.color || BRAND_COLORS.lightSand);
    }
    
    // Draw node label if globalScale is large enough
    if (globalScale > 0.4 || node.isCoreNode) {
      const labelText = node.name || shortenNpub(node.npub || '');
      if (labelText) {
        ctx.font = `${Math.max(12, size/globalScale/3)}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = node.isCoreNode ? 'white' : '#333';
        
        // Draw text background
        const textWidth = ctx.measureText(labelText).width;
        const bgPadding = 2;
        const bgHeight = Math.max(14, size/globalScale/3) + (bgPadding * 2);
        
        ctx.fillStyle = node.isCoreNode ? 'rgba(247, 147, 26, 0.8)' : 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(
          x - textWidth/2 - bgPadding,
          y + size + 2,
          textWidth + (bgPadding * 2),
          bgHeight
        );
        
        // Draw text
        ctx.fillStyle = node.isCoreNode ? 'white' : '#333';
        ctx.fillText(labelText, x, y + size + 2 + bgHeight/2);
      }
    }
  }, [shortenNpub]);

  // Memory management - clear image cache on unmount
  useEffect(() => {
    return () => {
      // Clean up resources when component unmounts
      if (forceGraphRef.current) {
        forceGraphRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height }}>
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
          <div className="text-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-forest border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-forest dark:text-sand">{loadingMessage}</p>
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
          nodeLabel={node => `${node.name || shortenNpub(((node as any) as GraphNode).npub || '')}`}
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
          nodeCanvasObject={(node, ctx, globalScale) => paintNode((node as any) as GraphNode, ctx, globalScale)}
          nodePointerAreaPaint={(node, color, ctx) => {
            const { x, y } = (node as any);
            const size = ((node as any) as GraphNode).val || 5 * 1.5;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fillStyle = 'transparent';
            ctx.fill();
          }}
          linkDirectionalParticles={link => (((link as any) as GraphLink).type === 'mutual' ? 4 : 0)}
          linkDirectionalParticleSpeed={0.005}
          linkWidth={link => (((link as any) as GraphLink).type === 'mutual' ? 2 : 1)}
          backgroundColor="rgba(0,0,0,0)"
        />
      )}
      
      {selectedNode && (
        <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg z-20 max-w-[250px]">
          <div className="flex items-center mb-2">
            {selectedNode.picture ? (
              <img 
                src={selectedNode.picture} 
                alt={selectedNode.name || shortenNpub(selectedNode.npub || '')}
                className="w-10 h-10 rounded-full mr-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_PROFILE_IMAGE;
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 mr-2"></div>
            )}
            <div>
              <h3 className="font-semibold">{selectedNode.name || shortenNpub(selectedNode.npub || '')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{shortenNpub(selectedNode.npub || '')}</p>
            </div>
          </div>
          
          <div className="flex space-x-2 mt-2">
            <button 
              className="px-3 py-1 text-xs bg-forest text-white rounded hover:bg-opacity-90 transition-colors"
              onClick={() => {
                // Open user's profile in new tab
                if (selectedNode.npub) {
                  window.open(`https://primal.net/p/${selectedNode.npub}`, '_blank');
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
    </div>
  );
};

export default SocialGraph;