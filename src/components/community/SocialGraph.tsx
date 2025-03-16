'use client'

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
import { useNostr } from '@/lib/contexts/NostrContext';

// Dynamically import the ForceGraph2D component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false });

// Define the core NPUBs that we want to focus on
const CORE_NPUBS = [
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e", // Free Madeira
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5", // Bitcoin Madeira
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh", // Madtrips
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc", // Funchal
];

// Branding colors
const BRAND_COLORS = {
  bitcoinOrange: '#F7931A', // Bitcoin & innovation - user likes this
  deepBlue: '#1E3A8A',     // Atlantic Ocean
  forestGreen: '#0F4C35',  // Lush landscapes
  lightSand: '#F5E3C3',    // Beach-inspired
};

// Reintroduce DEFAULT_PROFILE_IMAGE
const DEFAULT_PROFILE_IMAGE = "https://nostr.build/i/nostr.build_d421c1d7fd21c5d73c3428f0fc5ed7359cedb81bcad8074de350bec2d02e9a67.jpeg";

// Node and link types for the graph
interface GraphNode {
  id: string;
  name?: string;
  displayName?: string;
  npub?: string;
  picture?: string;
  group?: number;
  color?: string;
  val?: number;
  isCoreNode?: boolean;
  isCenter?: boolean;
  nodeType?: 'profile' | 'follower' | 'following' | 'connection';
  // Add coordinates for D3 (optional at runtime)
  x?: number;
  y?: number;
  // For image caching
  img?: HTMLImageElement;
}

// Define the shape of link objects
interface LinkSource {
  id?: string;
  npub?: string;
}

interface GraphLink {
  source: string | LinkSource;
  target: string | LinkSource;
  value?: number;
  color?: string;
  type?: 'follows' | 'followed_by' | 'mutual';
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

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
  // Include social data directly (optional, will mock if not provided)
  data?: GraphData;
}

export const SocialGraph: React.FC<SocialGraphProps> = ({
  centerNpub = CORE_NPUBS[0],
  npubs = CORE_NPUBS,
  maxConnections = 25,
  height = 600,
  width = '100%',
  className = '',
  data,
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [loadingImages, setLoadingImages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ndk, user, getSocialGraph } = useNostr();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Ensure user is not null before accessing properties
  const isUserLoggedIn = user !== null && !!user;

  // Handle undefined values for npub and other properties
  const handleNodeClick = (node: GraphNode) => {
    if (!node || !node.npub) return;
    
    setSelectedNode(node);
    console.log('Node clicked:', node);
    
    // Open the Nostr profile in njump.me
    const url = `https://njump.me/${node.npub}`;
    window.open(url, '_blank');
  };

  // Use optional chaining or default values
  const shortenNpub = (npub: string | undefined): string => {
    if (!npub) return '';
    return `${npub.substring(0, 6)}...${npub.substring(npub.length - 4)}`;
  };

  // Preload images for all nodes
  const preloadImages = (nodes: GraphNode[]) => {
    if (loadingImages) return;
    setLoadingImages(true);

    const newImages = new Map<string, HTMLImageElement>();
    let loadedCount = 0;
    const totalImages = nodes.length;

    nodes.forEach(node => {
      const npubKey = node.npub || '';
      // Skip if we already have this image
      if (nodeImages.has(npubKey)) return;

      // Get profile image URL
      let imageUrl = DEFAULT_PROFILE_IMAGE;
      
      // Use picture from node if available
      if (node.picture) {
        imageUrl = node.picture;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        newImages.set(npubKey, img);
        loadedCount++;
        
        // When all images are loaded, update the state
        if (loadedCount === totalImages) {
          setNodeImages(prev => new Map([...prev, ...newImages]));
          setLoadingImages(false);
        }
      };
      
      img.onerror = () => {
        // On error, try with the default image
        const defaultImg = new Image();
        defaultImg.crossOrigin = 'anonymous';
        defaultImg.src = DEFAULT_PROFILE_IMAGE;
        
        defaultImg.onload = () => {
          newImages.set(npubKey, defaultImg);
          loadedCount++;
          
          if (loadedCount === totalImages) {
            setNodeImages(prev => new Map([...prev, ...newImages]));
            setLoadingImages(false);
          }
        };
        
        defaultImg.onerror = () => {
          // If even the default fails, increment counter
          loadedCount++;
          if (loadedCount === totalImages) {
            setNodeImages(prev => new Map([...prev, ...newImages]));
            setLoadingImages(false);
          }
        };
      };
      
      img.src = imageUrl;
    });
  };

  // Convert our graph data to the format expected by the visualization libraries
  const convertGraphData = (data: GraphData) => {
    return {
      nodes: data.nodes.map(node => ({
        ...node,
        // Add any additional properties needed for visualization
        val: node.val || (node.isCoreNode ? 15 : 5), // Make core nodes more prominent
        color: node.color || (node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand), // Changed deepBlue to lightSand
      })),
      links: data.links.map(link => ({
        source: typeof link.source === 'string' ? link.source : link.source?.id || '',
        target: typeof link.target === 'string' ? link.target : link.target?.id || '',
        value: link.value || 1,
        color: link.color || (link.type === 'mutual' ? BRAND_COLORS.forestGreen : '#adb5bd'),
      })),
    };
  };

  // Fetch real data from Nostr
  const fetchNostrData = async () => {
    // First check if we have NDK and user available
    if (!ndk) {
      console.log("NDK not initialized - showing login prompt");
      setError("Nostr client not initialized. Please connect using a Nostr extension.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate NPUBs before making the API call
      const validNpubs = npubs.filter(npub => 
        typeof npub === 'string' && 
        npub.startsWith('npub1') && 
        npub.length >= 60 // slightly more lenient check
      );
      
      if (validNpubs.length === 0) {
        console.error("No valid NPUBs found in:", npubs);
        setError("No valid NPUBs provided to fetch social graph data.");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching Nostr social graph data for NPUBs:", validNpubs);
      
      // Use the getSocialGraph function from the NostrContext
      try {
        const realData = await getSocialGraph(validNpubs, maxConnections);
        
        // Add debugging to check data structure
        console.log("Raw graph data received:", JSON.stringify(realData, null, 2).substring(0, 500) + "...");
        
        // Validate nodes and links
        if (!realData) {
          throw new Error("No data returned from getSocialGraph");
        }
        
        if (!Array.isArray(realData.nodes)) {
          throw new Error("Invalid nodes data - not an array");
        }
        
        if (!Array.isArray(realData.links)) {
          throw new Error("Invalid links data - not an array");
        }
        
        // Check node data for all required fields
        realData.nodes.forEach((node, index) => {
          if (!node.id) {
            console.warn(`Node at index ${index} missing id:`, node);
          }
          if (!node.npub) {
            console.warn(`Node at index ${index} missing npub:`, node);
          }
        });
        
        // Check if we got valid data
        if (realData && realData.nodes && realData.nodes.length > 0) {
          console.log(`Successfully fetched social graph with ${realData.nodes.length} nodes and ${realData.links.length} links`);
          console.log("Sample node:", realData.nodes[0]);
          setGraphData(realData);
        } else {
          throw new Error("Received empty or invalid graph data from Nostr");
        }
      } catch (error) {
        console.error("Error in getSocialGraph:", error);
        throw error; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching social graph data:", errorMessage);
      setError(`Failed to fetch social graph: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 600,
        });
      }
    };

    // Initial dimensions update
    updateDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    
    // Cleanup
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize data when dependencies change
  useEffect(() => {
    const initializeData = async () => {
      // If we already have data (passed as prop), use that
      if (data) {
        console.log("Using provided data:", data);
        setGraphData(data);
        return;
      }
      
      // Otherwise, try to fetch from Nostr
      await fetchNostrData();
    };
    
    initializeData();
  }, [ndk, npubs.join(','), centerNpub, maxConnections]); // Re-fetch when these dependencies change

  // Preload images when graph data changes
  useEffect(() => {
    if (graphData?.nodes) {
      preloadImages(graphData.nodes);
    }
  }, [graphData]);

  // Update graph data based on login status
  useEffect(() => {
    if (isUserLoggedIn && user && user.npub) {
      // Fetch data including user's NPUB
      fetchNostrData();
    } else {
      // Display core NPUBs only
      setGraphData({
        nodes: CORE_NPUBS.map(npub => ({
          id: npub,
          npub,
          name: shortenNpub(npub),
          isCoreNode: true,
          nodeType: 'profile',
          group: 1,
        })),
        links: [],
      });
    }
  }, [isUserLoggedIn, user?.npub]);

  // Render appropriate UI based on loading/error state
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height, width }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <div className="mt-4 text-lg font-medium">Loading Nostr social graph...</div>
      </div>
    );
  }

  if (error && !graphData) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height, width }}>
        <div className="text-center p-6 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Social Graph</h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          
          {!ndk && (
            <div className="p-4 mt-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
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
            onClick={fetchNostrData}
            disabled={isLoading}
            className={`px-3 py-1 bg-white/20 hover:bg-white/30 rounded shadow-sm text-sm font-medium border border-gray-200 flex items-center ${isLoading ? 'opacity-50' : ''}`}
            aria-label="Reload graph"
            style={{ color: BRAND_COLORS.lightSand }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading...' : 'Reload'}
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
                    alt={selectedNode.name || shortenNpub(selectedNode.npub)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_PROFILE_IMAGE;
                    }}
                  />
                </div>
                <div>
                  <div className="font-medium" style={{ color: BRAND_COLORS.lightSand }}>{selectedNode.name || shortenNpub(selectedNode.npub)}</div>
                  <div className="text-xs" style={{ color: BRAND_COLORS.lightSand + '99' }}>{shortenNpub(selectedNode.npub)}</div>
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
          {graphData && (
            <ForceGraph2D
              graphData={convertGraphData(graphData)}
              nodeColor={(node: any) => node.color || BRAND_COLORS.lightSand}
              nodeVal={(node: any) => node.val || 1}
              linkColor={(link: any) => link.color || '#adb5bd'}
              linkWidth={(link: any) => Math.sqrt(link.value || 1)}
              onNodeClick={(node: any, event: MouseEvent) => handleNodeClick(node as GraphNode)}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const graphNode = node as GraphNode;
                const nodeSize = graphNode.val || 5;
                const imageSource = nodeImages.get(graphNode.npub || '');
                
                // Draw the node with profile image if available
                if (imageSource) {
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
                  } catch (err) {
                    // Fallback to circle if image drawing fails
                    ctx.beginPath();
                    ctx.fillStyle = graphNode.color as string || BRAND_COLORS.lightSand;
                    ctx.arc(graphNode.x as number, graphNode.y as number, nodeSize, 0, 2 * Math.PI);
                    ctx.fill();
                  }
                } else {
                  // Fallback to plain circle if no image
                  ctx.beginPath();
                  ctx.fillStyle = graphNode.color as string || BRAND_COLORS.lightSand;
                  ctx.arc(graphNode.x as number, graphNode.y as number, nodeSize, 0, 2 * Math.PI);
                  ctx.fill();
                }
                
                // Add highlight border for core nodes
                if (graphNode.isCoreNode) {
                  ctx.beginPath();
                  ctx.strokeStyle = BRAND_COLORS.bitcoinOrange; // Bitcoin orange for core nodes
                  ctx.lineWidth = 2;
                  ctx.arc(graphNode.x as number, graphNode.y as number, nodeSize + 2, 0, 2 * Math.PI);
                  ctx.stroke();
                }
                
                // No labels as per user's request
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialGraph; 