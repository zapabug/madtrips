import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// Define detailed types for our data
interface Node {
  id: string;
  name?: string;
  npub: string;
  picture?: string;
  group?: number;
  // Fields to track Venn diagram positioning
  vennGroups?: string[]; // Which core npubs this node is connected to
}

interface Link {
  source: string;
  target: string;
  value?: number;
  type?: string;
}

interface SocialGraphData {
  nodes: Node[];
  links: Link[];
}

interface VennSocialGraphProps {
  data: SocialGraphData | null;
}

// Core NPUBs we want to position as our Venn circles
const CORE_NPUBS = [
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e", // Free Madeira
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5", // Bitcoin Madeira
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh", // Madtrips
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc", // Funchal
];

// Names mapping for display
const NPUB_NAMES = {
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e": "Free Madeira",
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5": "Bitcoin Madeira",
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh": "Madtrips",
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc": "Funchal",
};

// Colors for each core npub
const CORE_COLORS = {
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e": "#3498db", // Free Madeira - blue
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5": "#e74c3c", // Bitcoin Madeira - red
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh": "#2ecc71", // Madtrips - green
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc": "#f39c12", // Funchal - orange
};

export const VennSocialGraph: React.FC<VennSocialGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNpub, setSelectedNpub] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nodeSizeScale, setNodeSizeScale] = useState(1.2);
  const simulationRef = useRef<any>(null);

  // Update dimensions when window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Process data to identify connections to core npubs
  const processData = (data: SocialGraphData) => {
    if (!data) return null;

    // Create a map to easily lookup nodes by ID
    const nodeMap = new Map();
    data.nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, vennGroups: [] });
    });

    // Build connection map to identify which core NPUBs each node connects to
    const coreNodeIds = data.nodes
      .filter(node => CORE_NPUBS.includes(node.npub))
      .map(node => node.id);

    // Process links to find connections to core nodes
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      // Check if source connects to a core node
      if (coreNodeIds.includes(targetId)) {
        const targetNode = data.nodes.find(n => n.id === targetId);
        if (targetNode && CORE_NPUBS.includes(targetNode.npub)) {
          const sourceNode = nodeMap.get(sourceId);
          if (sourceNode && !sourceNode.vennGroups.includes(targetNode.npub)) {
            sourceNode.vennGroups.push(targetNode.npub);
          }
        }
      }
      
      // Check if target connects to a core node
      if (coreNodeIds.includes(sourceId)) {
        const sourceNode = data.nodes.find(n => n.id === sourceId);
        if (sourceNode && CORE_NPUBS.includes(sourceNode.npub)) {
          const targetNode = nodeMap.get(targetId);
          if (targetNode && !targetNode.vennGroups.includes(sourceNode.npub)) {
            targetNode.vennGroups.push(sourceNode.npub);
          }
        }
      }
    });

    // Update core nodes to be part of their own group
    coreNodeIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node && CORE_NPUBS.includes(node.npub)) {
        node.vennGroups = [node.npub];
      }
    });

    // Convert map back to array
    const processedNodes = Array.from(nodeMap.values());
    
    return {
      nodes: processedNodes,
      links: data.links
    };
  };

  // Main visualization effect
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || dimensions.width === 0) {
      return;
    }

    try {
      // Clear previous visualization
      d3.select(svgRef.current).selectAll("*").remove();
      
      // Process data to identify connections to core nodes
      const processedData = processData(data);
      if (!processedData) return;
      
      // Set up the SVG
      const svg = d3.select(svgRef.current)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", [0, 0, dimensions.width, dimensions.height])
        .attr("style", "max-width: 100%; height: auto;");

      // Add definitions for gradient fills
      const defs = svg.append("defs");
      
      // Create a container group for zoom functionality
      const g = svg.append("g");
      
      // Add zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });
      
      svg.call(zoom as any);
      
      // Center the initial view
      svg.call(zoom.transform as any, d3.zoomIdentity
        .translate(dimensions.width / 2, dimensions.height / 2)
        .scale(0.9));
      
      // Calculate positions for core nodes in a Venn diagram layout
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.25;
      
      // Position core nodes in a circular arrangement
      const corePositions: {[key: string]: {x: number, y: number}} = {};
      
      CORE_NPUBS.forEach((npub, i) => {
        const angle = (i * (2 * Math.PI / CORE_NPUBS.length)) - Math.PI/2;
        corePositions[npub] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      });
      
      // Create circle "regions" for each core npub
      g.selectAll(".venn-region")
        .data(CORE_NPUBS)
        .join("circle")
        .attr("class", "venn-region")
        .attr("cx", (d: string) => corePositions[d].x)
        .attr("cy", (d: string) => corePositions[d].y)
        .attr("r", radius * 1.5)
        .attr("fill", (d: string) => d3.color(CORE_COLORS[d as keyof typeof CORE_COLORS])?.copy({opacity: 0.1})?.toString() || '')
        .attr("stroke", (d: string) => CORE_COLORS[d as keyof typeof CORE_COLORS])
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("pointer-events", "none");
      
      // Add region labels
      g.selectAll(".venn-label")
        .data(CORE_NPUBS)
        .join("text")
        .attr("class", "venn-label")
        .attr("x", npub => corePositions[npub].x)
        .attr("y", npub => corePositions[npub].y - radius * 1.1)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", npub => CORE_COLORS[npub as keyof typeof CORE_COLORS])
        .text(npub => NPUB_NAMES[npub as keyof typeof NPUB_NAMES] || shortenNpub(npub));
      
      // Custom force to position nodes based on their Venn group memberships
      const vennForce = (alpha: number) => {
        processedData.nodes.forEach((node: any) => {
          if (!node.vennGroups || node.vennGroups.length === 0) {
            // Nodes without connections drift toward center
            node.x += (centerX - node.x) * alpha * 0.01;
            node.y += (centerY - node.y) * alpha * 0.01;
            return;
          }
          
          if (node.vennGroups.length === 1) {
            // Single group - pull strongly toward that group's position
            const targetPos = corePositions[node.vennGroups[0]];
            node.x += (targetPos.x - node.x) * alpha * 0.1;
            node.y += (targetPos.y - node.y) * alpha * 0.1;
          } else {
            // Multiple groups - position in the overlap area
            let targetX = 0;
            let targetY = 0;
            
            // Calculate the centroid of all groups this node belongs to
            node.vennGroups.forEach((groupNpub: string) => {
              const pos = corePositions[groupNpub];
              if (pos) {
                targetX += pos.x;
                targetY += pos.y;
              }
            });
            
            targetX /= node.vennGroups.length;
            targetY /= node.vennGroups.length;
            
            node.x += (targetX - node.x) * alpha * 0.2;
            node.y += (targetY - node.y) * alpha * 0.2;
          }
        });
      };
      
      // Set up the simulation
      const simulation = d3.forceSimulation(processedData.nodes as any)
        .force("link", d3.forceLink(processedData.links)
          .id((d: any) => d.id)
          .distance(30))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("collide", d3.forceCollide().radius(d => getNodeRadius(d) + 2))
        .force("center", d3.forceCenter(centerX, centerY).strength(0.02))
        .on("tick", () => {
          // Apply custom Venn positioning force
          vennForce(simulation.alpha());
          
          // Update positions
          link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);
          
          node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });
      
      simulationRef.current = simulation;
      
      // Create links
      const link = g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.3)
        .selectAll("line")
        .data(processedData.links)
        .join("line")
        .attr("stroke-width", 1)
        .attr("class", (d: any) => {
          const sourceNode = typeof d.source === 'object' ? d.source : null;
          const targetNode = typeof d.target === 'object' ? d.target : null;
          
          // Highlight links connecting core npubs
          if (sourceNode && targetNode && 
              CORE_NPUBS.includes(sourceNode.npub) && 
              CORE_NPUBS.includes(targetNode.npub)) {
            return "core-link";
          }
          
          return selectedNpub ? (
            (sourceNode?.npub === selectedNpub || targetNode?.npub === selectedNpub) 
              ? "selected-link" : "unselected-link"
          ) : "";
        })
        .attr("stroke", (d: any) => {
          const sourceNode = typeof d.source === 'object' ? d.source : null;
          const targetNode = typeof d.target === 'object' ? d.target : null;
          
          // Core-to-core links get special colors
          if (sourceNode && targetNode && 
              CORE_NPUBS.includes(sourceNode.npub) && 
              CORE_NPUBS.includes(targetNode.npub)) {
            // Blend the colors
            return blendColors(
              CORE_COLORS[sourceNode.npub as keyof typeof CORE_COLORS], 
              CORE_COLORS[targetNode.npub as keyof typeof CORE_COLORS]
            );
          }
          
          return "#999";
        })
        .attr("stroke-opacity", (d: any) => {
          if (selectedNpub) {
            const sourceNode = typeof d.source === 'object' ? d.source : null;
            const targetNode = typeof d.target === 'object' ? d.target : null;
            return (sourceNode?.npub === selectedNpub || targetNode?.npub === selectedNpub) ? 0.7 : 0.1;
          }
          return 0.3;
        });

      // Helper function to get node radius
      function getNodeRadius(d: any) {
        if (CORE_NPUBS.includes(d.npub)) {
          return 18 * nodeSizeScale; // Core nodes are larger
        }
        
        // Size based on number of core groups this node belongs to
        const groupsCount = d.vennGroups?.length || 0;
        const baseSize = 6 + (groupsCount * 2);
        
        return baseSize * nodeSizeScale;
      }
      
      // Create node groups
      const node = g.append("g")
        .selectAll(".node")
        .data(processedData.nodes)
        .join("g")
        .attr("class", d => `node ${CORE_NPUBS.includes(d.npub) ? 'core-node' : ''}`)
        .on("click", (event, d: any) => {
          // Toggle selection
          setSelectedNpub(selectedNpub === d.npub ? null : d.npub);
          event.stopPropagation();
        })
        .call(drag(simulation) as any);
      
      // Add node circles
      node.append("circle")
        .attr("r", getNodeRadius)
        .attr("fill", (d: any): string => {
          // Core nodes get their specific colors
          if (CORE_NPUBS.includes(d.npub)) {
            return CORE_COLORS[d.npub as keyof typeof CORE_COLORS];
          }
          
          // Nodes connected to multiple core npubs get gradient fills
          if (d.vennGroups && d.vennGroups.length > 1) {
            // Create gradient for this node
            const gradientId = `gradient-${d.id}`;
            const gradient = defs.append("linearGradient")
              .attr("id", gradientId)
              .attr("x1", "0%")
              .attr("y1", "0%")
              .attr("x2", "100%")
              .attr("y2", "100%");
            
            // Add color stops
            d.vennGroups.forEach((npub: string, i: number) => {
              gradient.append("stop")
                .attr("offset", `${(i / (d.vennGroups.length - 1)) * 100}%`)
                .attr("stop-color", CORE_COLORS[npub as keyof typeof CORE_COLORS]);
            });
            
            return `url(#${gradientId})`;
          }
          
          // Nodes with single group connection get lighter versions of core colors
          if (d.vennGroups && d.vennGroups.length === 1) {
            const color = d3.color(CORE_COLORS[d.vennGroups[0] as keyof typeof CORE_COLORS]);
            return color?.brighter(0.7)?.toString() || "#ccc";
          }
          
          // Default color for nodes without connections
          return "#ccc";
        })
        .attr("stroke", (d: any) => {
          if (d.npub === selectedNpub) {
            return "#000";
          }
          if (CORE_NPUBS.includes(d.npub)) {
            return d3.color(CORE_COLORS[d.npub as keyof typeof CORE_COLORS])?.darker().toString() || "#000";
          }
          return "#fff";
        })
        .attr("stroke-width", (d: any) => d.npub === selectedNpub ? 2 : 1)
        .style("cursor", "pointer");

      // Add labels for core nodes and selected node
      node.append("text")
        .attr("dy", (d: any) => getNodeRadius(d) + 4)
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("font-size", (d: any) => CORE_NPUBS.includes(d.npub) ? "12px" : "10px")
        .attr("font-weight", (d: any) => CORE_NPUBS.includes(d.npub) ? "bold" : "normal")
        .attr("fill", "#333")
        .style("opacity", (d: any) => {
          if (CORE_NPUBS.includes(d.npub)) return 1;
          if (d.npub === selectedNpub) return 1;
          return 0; // Hide other labels initially
        })
        .text((d: any) => d.name || shortenNpub(d.npub));
      
      // Show node details on hover
      node.append("title")
        .text((d: any) => {
          const name = d.name || shortenNpub(d.npub);
          const groupsText = d.vennGroups?.length 
            ? `\nConnected to: ${d.vennGroups.map((npub: string) => NPUB_NAMES[npub as keyof typeof NPUB_NAMES]).join(", ")}`
            : "\nNo core connections";
          return `${name}${groupsText}`;
        });
      // Add legend for the Venn diagram
      const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(20, ${dimensions.height - 140})`);
      
      // Create legend background
      legend.append("rect")
        .attr("width", 180)
        .attr("height", 120)
        .attr("rx", 5)
        .attr("fill", "white")
        .attr("fill-opacity", 0.7)
        .attr("stroke", "#ccc");
      
      legend.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Web of Trust Legend");
      
      // Add legend items for each core npub
      CORE_NPUBS.forEach((npub, i) => {
        const g = legend.append("g")
          .attr("transform", `translate(10, ${40 + i * 20})`);
        
        g.append("circle")
          .attr("r", 6)
          .attr("fill", CORE_COLORS[npub as keyof typeof CORE_COLORS]);
          
        g.append("text")
          .attr("x", 15)
          .attr("y", 4)
          .attr("font-size", "10px")
          .text(NPUB_NAMES[npub as keyof typeof NPUB_NAMES]);
      });
      
      // Add click handler to clear selection when clicking on empty space
      svg.on("click", () => {
        setSelectedNpub(null);
      });
      
      // Clean up
      return () => {
        if (simulation) simulation.stop();
      };
    } catch (err) {
      console.error("Error rendering Venn social graph:", err);
      setError(err instanceof Error ? err.message : "Error rendering Venn diagram");
    }
  }, [data, dimensions, selectedNpub, nodeSizeScale]);

  // Helper to create drag behavior
  const drag = (simulation: any) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  // Helper to shorten npub for display
  const shortenNpub = (npub: string) => {
    if (!npub) return "";
    return npub.substring(0, 8) + "..." + npub.substring(npub.length - 4);
  };

  // Helper to blend two colors
  const blendColors = (color1: string, color2: string) => {
    const c1 = d3.color(color1) || d3.rgb(0, 0, 0);
    const c2 = d3.color(color2) || d3.rgb(0, 0, 0);
    // Convert colors to RGB to ensure we can access r,g,b properties
    const c1RGB = d3.rgb(c1);
    const c2RGB = d3.rgb(c2);
    
    const r = Math.floor((c1RGB.r + c2RGB.r) / 2);
    const g = Math.floor((c1RGB.g + c2RGB.g) / 2);
    const b = Math.floor((c1RGB.b + c2RGB.b) / 2);
    
    return d3.rgb(r, g, b).toString();
  };

  // Controls panel
  const controls = (
    <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-md shadow-md z-10">
      <h3 className="text-sm font-semibold mb-2">Visualization Controls</h3>
      
      <div className="mb-3">
        <label className="block text-xs mb-1">Node Size: {nodeSizeScale.toFixed(1)}x</label>
        <input 
          type="range" 
          min="0.5" 
          max="2" 
          step="0.1" 
          value={nodeSizeScale}
          onChange={(e) => setNodeSizeScale(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div>
        <button 
          onClick={() => setSelectedNpub(null)}
          className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );

  // Display state for loading or error
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No social graph data available</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-red-500 mb-4">Error: {error}</div>
        <div className="text-sm text-gray-600">
          {data ? `Data contains ${data.nodes.length} nodes and ${data.links.length} links` : 'No data available'}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {controls}
      
      <svg 
        ref={svgRef} 
        className="w-full h-full"
        style={{ cursor: "grab" }}
      />
      
      <div className="absolute bottom-2 left-2 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded opacity-80">
        {data.nodes.length} nodes / {data.links.length} links
        {selectedNpub && ` • Selected: ${NPUB_NAMES[selectedNpub as keyof typeof NPUB_NAMES] || shortenNpub(selectedNpub)}`}
      </div>
    </div>
  );
};