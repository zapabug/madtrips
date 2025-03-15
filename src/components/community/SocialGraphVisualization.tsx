import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { NodeType, VISUALIZATION_CONFIG } from '@/lib/nostr/config';
import { nip19 } from 'nostr-tools';

interface Node {
  id: string;
  name?: string;
  type: NodeType;
  npub: string;
  picture?: string;
  // Add properties for D3 simulation
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string;
  target: string;
  value: number;
  type: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface ProcessedGraphData {
  nodes: Node[];
  links: Link[];
}

interface SocialGraphVisualizationProps {
  width?: number;
  height?: number;
  className?: string;
}

// Function to convert raw social graph data to the format needed for D3
function processGraphData(rawData: any): ProcessedGraphData {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const nodeMap = new Map<string, boolean>();
  
  // Check if we received the expected data format
  if (!rawData || !rawData.members) {
    // Return empty data if format doesn't match
    return { nodes, links };
  }
  
  // Process the data
  try {
    // Get known Free Madeira members (core nodes)
    const members = Object.keys(rawData.members);
    
    // Add all members as nodes
    members.forEach(pubkey => {
      // Only add each node once
      if (nodeMap.has(pubkey)) return;
      
      // Convert hex pubkey to npub
      let npub;
      try {
        npub = nip19.npubEncode(pubkey);
      } catch (e) {
        console.error('Failed to encode pubkey:', e);
        npub = 'unknown';
      }
      
      // Determine node type
      let type = NodeType.FOLLOWER;
      // Add logic here to determine core members
      
      nodes.push({
        id: pubkey,
        npub,
        type,
        // We'll fetch profile info separately
      });
      
      nodeMap.set(pubkey, true);
    });
    
    // Add follows as links
    members.forEach(pubkey => {
      const memberData = rawData.members[pubkey];
      
      if (memberData.follows && Array.isArray(memberData.follows)) {
        memberData.follows.forEach((targetPubkey: string) => {
          // Add target as node if not already added
          if (!nodeMap.has(targetPubkey)) {
            let npub;
            try {
              npub = nip19.npubEncode(targetPubkey);
            } catch (e) {
              npub = 'unknown';
            }
            
            nodes.push({
              id: targetPubkey,
              npub,
              type: NodeType.FOLLOWING,
            });
            
            nodeMap.set(targetPubkey, true);
          }
          
          // Add follow link
          links.push({
            source: pubkey,
            target: targetPubkey,
            value: 1,
            type: 'follows'
          });
        });
      }
    });
  } catch (error) {
    console.error('Error processing graph data:', error);
  }
  
  return { nodes, links };
}

export function SocialGraphVisualization({
  width = 800,
  height = 600,
  className = '',
}: SocialGraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcessedGraphData | null>(null);
  const [profileImages, setProfileImages] = useState<Map<string, string>>(new Map());

  // Fetch profile images for nodes
  async function fetchProfileImages(nodes: Node[]) {
    const imageMap = new Map<string, string>();
    const defaultImage = '/bitcoin-icon.svg'; // Fallback image
    
    // For each node, attempt to get the profile image
    const fetchPromises = nodes.map(async (node) => {
      try {
        // Try to fetch from primal.net first (they have good profile pics)
        const primalUrl = `https://primal.net/api/profile/picture/${node.npub}`;
        const response = await fetch(primalUrl, {
          method: 'GET',
          headers: {
            'Accept': 'image/webp,image/png,image/jpeg,*/*',
          },
          cache: 'force-cache',
        });
        
        if (response.ok) {
          imageMap.set(node.id, primalUrl);
          return;
        }
        
        // Try iris.to as fallback
        const irisUrl = `https://iris.to/api/images/nostr/picture/${node.npub}`;
        const irisResponse = await fetch(irisUrl, {
          method: 'HEAD',
          cache: 'force-cache',
        });
        
        if (irisResponse.ok) {
          imageMap.set(node.id, irisUrl);
          return;
        }
        
        // Use default image if both fail
        imageMap.set(node.id, defaultImage);
      } catch (error) {
        console.error(`Error fetching profile image for ${node.npub}:`, error);
        imageMap.set(node.id, defaultImage);
      }
    });
    
    // Wait for all fetches to complete
    await Promise.allSettled(fetchPromises);
    return imageMap;
  }

  // Fetch social graph data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/socialgraph');
        if (!response.ok) {
          throw new Error('Failed to fetch social graph data');
        }
        const rawData = await response.json();
        
        // Process the raw data into the format needed for D3
        const processedData = processGraphData(rawData);
        setData(processedData);
        
        // Fetch profile images for the nodes
        if (processedData.nodes.length > 0) {
          const imageMap = await fetchProfileImages(processedData.nodes);
          setProfileImages(imageMap);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching social graph:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Create or update visualization when data changes
  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    // Create a container group
    const g = svg.append('g');
    
    // Create defs for image patterns
    const defs = svg.append('defs');
    
    // Create patterns for each node's profile image
    data.nodes.forEach(node => {
      const imageUrl = profileImages.get(node.id) || '/bitcoin-icon.svg';
      
      defs.append('pattern')
        .attr('id', `image-${node.id}`)
        .attr('width', 1)
        .attr('height', 1)
        .attr('patternUnits', 'objectBoundingBox')
        .append('image')
        .attr('href', imageUrl)
        .attr('width', node.type === NodeType.CORE ? 
          VISUALIZATION_CONFIG.coreNodeSize * 2 : 
          VISUALIZATION_CONFIG.defaultNodeSize * 2)
        .attr('height', node.type === NodeType.CORE ? 
          VISUALIZATION_CONFIG.coreNodeSize * 2 : 
          VISUALIZATION_CONFIG.defaultNodeSize * 2)
        .attr('preserveAspectRatio', 'xMidYMid slice');
    });

    // Define forces
    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(data.links)
        .id((d: any) => d.id)
        .distance(VISUALIZATION_CONFIG.linkDistance)
        .strength(VISUALIZATION_CONFIG.linkStrength))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Add zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke-width', d => Math.sqrt(d.value))
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6);

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes with profile images
    node.append('circle')
      .attr('r', d => d.type === NodeType.CORE ? 
        VISUALIZATION_CONFIG.coreNodeSize : 
        VISUALIZATION_CONFIG.defaultNodeSize)
      .attr('fill', d => `url(#image-${d.id})`) // Use image pattern
      .attr('stroke', d => {
        // Color border based on node type
        switch(d.type) {
          case NodeType.CORE:
            return VISUALIZATION_CONFIG.coreNodeColor;
          case NodeType.FOLLOWER:
            return VISUALIZATION_CONFIG.followerNodeColor;
          case NodeType.FOLLOWING:
            return VISUALIZATION_CONFIG.followingNodeColor;
          case NodeType.MUTUAL:
            return VISUALIZATION_CONFIG.mutualNodeColor;
          default:
            return '#999';
        }
      })
      .attr('stroke-width', 2);

    // Add labels to nodes
    node.append('text')
      .attr('dx', 12)
      .attr('dy', '.35em')
      .text(d => d.name || d.npub.substring(0, 8) + '...')
      .attr('font-size', '10px')
      .attr('fill', 'currentColor');

    // Add tooltips
    node.append('title')
      .text(d => `${d.name || d.npub}\nType: ${d.type}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, profileImages, width, height]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-red-500 text-center">
          <p className="text-lg font-semibold">Error loading social graph</p>
          <p className="text-sm">{error}</p>
          <button 
            className="mt-3 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (data && data.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-center">
          <p className="text-lg font-semibold">No social graph data available</p>
          <p className="text-sm">Try updating the data or check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <svg 
      ref={svgRef} 
      className={`w-full h-full ${className}`}
      width={width}
      height={height}
    />
  );
} 