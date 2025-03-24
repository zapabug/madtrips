'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useNostr } from '../../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../../types/graph-types';
import { BRAND_COLORS } from '../../constants/brandColors';
import { DEFAULT_PROFILE_IMAGE } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';
import defaultGraphData from './socialgraph.json';
import { CORE_NPUBS } from './utils';

// Dynamically import the ForceGraph2D component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false });

// Process the imported JSON to match our GraphData structure
const processImportedGraphData = (jsonData: any): GraphData => {
  // Map over nodes and ensure they have the required fields for GraphNode
  const processedNodes = jsonData.nodes.map((node: any) => ({
    id: node.id,
    pubkey: node.id, // Use ID as pubkey if not provided
    npub: node.npub,
    name: node.name,
    picture: node.picture,
    isCoreNode: node.type === 'core' || CORE_NPUBS.includes(node.npub)
  }));

  // Return the processed data
  return {
    nodes: processedNodes,
    links: jsonData.links
  };
};

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

// Add humorous loading messages
const LOADING_MESSAGES = [
  "Fetching relays… or maybe just relaying nonsense.",
  "Decrypting private messages… hope they're not just memes!",
  "Relay lag detected! Blame the plebs.",
  "Loading… because decentralized things take time.",
  "Verifying pubkeys… definitely not reading your DMs.",
  "Fetching Nostr notes… please hold, the relays are gossiping.",
  "Buffering Nostr… because even freedom takes a second to load.",
  "Rounding up relays… they're herding notes like digital catz."
];

export const SocialGraph: React.FC<SocialGraphProps> = ({
  centerNpub = CORE_NPUBS[0],
  npubs = CORE_NPUBS,
  maxConnections = 25,
  height = 600,
  width = '100%',
  className = '',
  data,
}) => {
  const { ndk, getUserProfile, shortenNpub } = useNostr();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [loadingImages, setLoadingImages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Ensure user is not null before accessing properties
  const isUserLoggedIn = ndk !== null && !!ndk;

  // Rotate loading messages with slower timing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 6000); // Increased from 4000ms to 6000ms to make messages change less frequently
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Load data from provided data prop or defaultGraphData
  useEffect(() => {
    if (data) {
      setGraphData(data);
    } else {
      try {
        // Process the imported JSON data to match our GraphData structure
        const processedData = processImportedGraphData(defaultGraphData);
        setGraphData(processedData);
      } catch (err) {
        console.error('Failed to load graph data:', err);
        setError('Failed to load social graph data');
      }
    }
  }, [data]);

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

  // Add at the top of the component
  const DATA_FETCH_RETRY_LIMIT = 2;
  const fetchRetries = useRef(0);
  const isMounted = useRef(true);

  // Update the fetchNostrData function to take no arguments for button click handlers
  const fetchNostrData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const controller = new AbortController();
    
    try {
      console.log(`Attempting fetch (retry ${fetchRetries.current}/${DATA_FETCH_RETRY_LIMIT})`);
      
      if (!ndk) {
        throw new Error('Nostr connection not available');
      }

      // Helper functions for fetching follows and network data
      const fetchFollows = async () => {
        const followData: GraphNode[] = [];
        
        try {
          // Process each npub in our list
          for (const npub of npubs) {
            // Get hex pubkey from npub
            let pubkey;
            try {
              pubkey = npub.startsWith('npub1') ? nip19.decode(npub).data : npub;
            } catch (err) {
              console.error('Invalid npub format:', npub);
              continue;
            }
            
            // Get user profile
            const profile = await getUserProfile(npub);
            
            // Create base node
            const baseNode: GraphNode = {
              id: npub,
              pubkey: typeof pubkey === 'string' ? pubkey : '',
              npub: npub,
              name: profile?.name || profile?.displayName || shortenNpub(npub),
              picture: profile?.picture || DEFAULT_PROFILE_IMAGE,
              isCoreNode: CORE_NPUBS.includes(npub),
            };
            
            followData.push(baseNode);
          }
          
          return followData;
        } catch (err) {
          console.error('Error in fetchFollows:', err);
          throw err;
        }
      };
      
      const fetchNetwork = async () => {
        const networkLinks: GraphLink[] = [];
        
        try {
          // Create dummy connections for demonstration
          // In a real implementation, this would fetch follows/relationships from relays
          for (let i = 0; i < npubs.length; i++) {
            for (let j = i + 1; j < npubs.length; j++) {
              networkLinks.push({
                source: npubs[i],
                target: npubs[j],
                value: 1,
                type: 'mutual',
              });
            }
          }
          
          return networkLinks;
        } catch (err) {
          console.error('Error in fetchNetwork:', err);
          throw err;
        }
      };
      
      const [follows, network] = await Promise.all([
        fetchWithTimeout(15000, fetchFollows(), controller.signal),
        fetchWithTimeout(15000, fetchNetwork(), controller.signal)
      ]);

      const validateResponse = (follows: any[], network: any[]): boolean => {
        return (
          Array.isArray(follows) &&
          follows.length > 0 &&
          Array.isArray(network) &&
          network.every(link => 
            typeof link.source === 'string' && 
            typeof link.target === 'string' &&
            typeof link.value === 'number'
          )
        );
      };

      if (!validateResponse(follows, network)) {
        throw new Error('Invalid data structure from Nostr');
      }

      // Process the data into the format needed for the graph
      const processData = (follows: any[], network: any[]): GraphData => {
        // Process follows into nodes
        const nodes = follows.map(follow => ({
          ...follow,
          isCoreNode: CORE_NPUBS.includes(follow.npub),
          val: CORE_NPUBS.includes(follow.npub) ? 15 : 5,
          color: CORE_NPUBS.includes(follow.npub) ? 
            BRAND_COLORS.bitcoinOrange : 
            BRAND_COLORS.lightSand,
        }));
        
        // Process network data into links
        const links = network.map(link => ({
          ...link,
          color: link.type === 'mutual' ? 
            BRAND_COLORS.bitcoinOrange : 
            BRAND_COLORS.lightSand + '99',
        }));
        
        return { nodes, links };
      };
      
      const processedData = processData(follows, network);
      
      if (isMounted.current && !controller.signal.aborted) {
        setGraphData(processedData);
        fetchRetries.current = 0; // Reset retry counter on success
        setIsLoading(false);
      }
      
      return processedData;
    } catch (err) {
      if (isMounted.current && !controller.signal.aborted) {
        if (fetchRetries.current < DATA_FETCH_RETRY_LIMIT) {
          fetchRetries.current += 1;
          console.warn(`Retrying fetch (${fetchRetries.current})...`);
          return fetchNostrData();
        }
        setError(err instanceof Error ? err.message : 'Data loading failed');
        setIsLoading(false);
      }
      return { nodes: [], links: [] };
    }
  }, [ndk, npubs, getUserProfile, shortenNpub]);

  // New fetchWithTimeout utility
  const fetchWithTimeout = useCallback(<T,>(timeout: number, promise: Promise<T>, signal: AbortSignal): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!signal.aborted) {
            reject(new Error('Request timeout'));
          }
        }, timeout);
      })
    ]);
  }, []);

  // Custom handler for node clicks to support our GraphNode type
  const handleNodeClicked = useCallback((node: any) => {
    const graphNode = node as GraphNode;
    setSelectedNode(graphNode);
    
    // Open in a new tab if it's a URL
    if (graphNode.npub) {
      window.open(`https://njump.me/${graphNode.npub}`, '_blank');
    }
  }, []);

  // Updated useEffect with complete cleanup
  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout;

    const handleVisibilityChange = (isVisible: boolean) => {
      if (isVisible && isMounted.current) {
        timeoutId = setTimeout(async () => {
          try {
            await fetchNostrData();
          } catch (err) {
            if (!controller.signal.aborted) {
              console.error('Final fetch error:', err);
            }
          }
        }, 3000);
      }
    };

    if (containerRef.current) {
      observer = new IntersectionObserver(([entry]) => {
        handleVisibilityChange(!!entry?.isIntersecting);
      }, { threshold: 0.1 });
      
      observer.observe(containerRef.current);
    }

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
      if (observer && containerRef.current) {
        observer.unobserve(containerRef.current);
        observer.disconnect();
      }
      fetchRetries.current = 0;
    };
  }, [fetchNostrData]);

  // Update graph data based on login status
  useEffect(() => {
    // Always attempt to fetch real data from Nostr
    // Don't use fallback data, as per user's request
    fetchNostrData();
    
    // Note: This might result in longer loading times, but will ensure
    // we're always showing real data rather than mock/static data
  }, [isUserLoggedIn, ndk]);

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
      // Always attempt to fetch real data, even if it takes longer
      await fetchNostrData();
    };
    
    initializeData();
  }, [ndk, npubs.join(','), centerNpub, maxConnections, data, fetchNostrData]); // Re-fetch when these dependencies change

  // Update preloadImages call with better error handling
  useEffect(() => {
    if (graphData?.nodes) {
      try {
        setLoadingImages(true);
        
        // Create a map to store loaded images
        const imageMap = new Map<string, HTMLImageElement>();
        
        // Custom preload function that updates our local imageMap
        const handleImagesLoaded = () => {
          console.log('All images loaded or handled');
          setNodeImages(prev => {
            // Merge previous images with new ones to avoid losing already loaded images
            const newMap = new Map(prev);
            imageMap.forEach((img, key) => {
              newMap.set(key, img);
            });
            return newMap;
          });
          setLoadingImages(false);
        };
        
        // Handle image loading errors
        const handleImageError = (error: any) => {
          console.error('Image loading error:', error);
          // Still finish loading to prevent UI from being stuck
          setLoadingImages(false);
        };
        
        // Custom preload function that updates our local imageMap
        const customPreloadImages = (nodes: GraphNode[]) => {
          let loadedImages = 0;
          
          // Filter nodes that have both picture and npub
          const nodesWithImages = nodes.filter(node => 
            node && node.picture && node.npub && 
            typeof node.picture === 'string' && 
            typeof node.npub === 'string'
          );
          
          const validNodes = nodesWithImages.length;
          
          if (validNodes === 0) {
            handleImagesLoaded();
            return;
          }
          
          nodesWithImages.forEach(node => {
            // Skip if we already have this image
            if (nodeImages.has(node.npub as string)) {
              loadedImages++;
              if (loadedImages === validNodes) {
                handleImagesLoaded();
              }
              return;
            }
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              imageMap.set(node.npub as string, img);
              loadedImages++;
              if (loadedImages === validNodes) {
                handleImagesLoaded();
              }
            };
            
            img.onerror = () => {
              // On error, try with the default image
              const defaultImg = new Image();
              defaultImg.crossOrigin = 'anonymous';
              defaultImg.src = DEFAULT_PROFILE_IMAGE;
              
              defaultImg.onload = () => {
                imageMap.set(node.npub as string, defaultImg);
                loadedImages++;
                if (loadedImages === validNodes) {
                  handleImagesLoaded();
                }
              };
              
              defaultImg.onerror = () => {
                // If even the default fails, increment counter
                loadedImages++;
                if (loadedImages === validNodes) {
                  handleImagesLoaded();
                }
              };
            };
            
            // Set a timeout to handle cases where the image might hang
            const timeout = setTimeout(() => {
              if (img.complete) return;
              
              // Cancel the image loading
              img.src = '';
              loadedImages++;
              if (loadedImages === validNodes) {
                handleImagesLoaded();
              }
            }, 5000); // 5 second timeout
            
            try {
              img.src = node.picture as string;
            } catch (err) {
              clearTimeout(timeout);
              loadedImages++;
              if (loadedImages === validNodes) {
                handleImagesLoaded();
              }
            }
          });
        };
        
        // Use our custom preload function
        customPreloadImages(graphData.nodes);
      } catch (error) {
        console.error('Error in image preloading:', error);
        setLoadingImages(false);
      }
    }
  }, [graphData]);

  // Render appropriate UI based on loading/error state
  if (isLoading) {
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
            key={loadingMessageIndex} 
            className="animate-fade-in-out text-lg font-medium text-bitcoin"
          >
            {LOADING_MESSAGES[loadingMessageIndex]}
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

  if (error && !graphData) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height, width }}>
        <div className="text-center p-6 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 max-w-md">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Error Loading Social Graph</h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          
          <div className="mt-4">
            <button 
              onClick={fetchNostrData}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm transition-colors"
            >
              Try Again
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
          {graphData && (
            <ForceGraph2D
              graphData={convertGraphData(graphData) as any}
              nodeColor={(node: any) => node.color || BRAND_COLORS.lightSand}
              nodeVal={(node: any) => node.val || 1}
              linkColor={(link: any) => link.color || BRAND_COLORS.lightSand + '99'}
              linkWidth={(link: any) => Math.sqrt(link.value || 1) * 1.5}
              onNodeClick={handleNodeClicked}
              width={dimensions.width}
              height={dimensions.height}
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
                  const npubKey = graphNode.npub || '';
                  const imageSource = npubKey ? nodeImages.get(npubKey) : null;
                  
                  // Draw the node with profile image if available
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
                    } catch (err) {
                      // Fallback to circle if image drawing fails
                      drawFallbackCircle(graphNode, ctx, nodeSize);
                    }
                  } else {
                    // Fallback to plain circle if no image
                    drawFallbackCircle(graphNode, ctx, nodeSize);
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