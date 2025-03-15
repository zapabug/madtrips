import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// Define more detailed types for our data
interface Node {
  id: string;
  name?: string;
  npub: string;
  picture?: string;
  group?: number;
  isCoreNode?: boolean;
}

interface Link {
  source: string;
  target: string;
  value?: number;
  type?: string; // e.g., 'follows', 'mutual', etc.
}

interface SocialGraphData {
  nodes: Node[];
  links: Link[];
}

interface SimpleSocialGraphProps {
  data: SocialGraphData | null;
}

// Core NPUBs that we want to focus on
const CORE_NPUBS = [
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e", // Free Madeira
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5", // Bitcoin Madeira
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh", // Madtrips
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc", // Funchal
];

export const SimpleSocialGraph: React.FC<SimpleSocialGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNodes, setSelectedNodes] = useState<string[]>(CORE_NPUBS);
  const [highlightMode, setHighlightMode] = useState<'all' | 'selected'>('selected');
  const [nodeScale, setNodeScale] = useState<number>(1.5);
  
  // Track simulation status
  const [simulationActive, setSimulationActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Main visualization effect
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || dimensions.width === 0) {
      return;
    }

    try {
      // Clear previous visualization
      d3.select(svgRef.current).selectAll("*").remove();
      
      // Process data to identify core nodes and their connections
      const processedData = preprocessData(data, selectedNodes);
      
      // Set up the SVG
      const svg = d3.select(svgRef.current)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", [0, 0, dimensions.width, dimensions.height])
        .attr("style", "max-width: 100%; height: auto; background: #f8f9fa;");

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
        .scale(0.8));
      
      // Set up the simulation
      const simulation = d3.forceSimulation(processedData.nodes as any)
        .force("link", d3.forceLink(processedData.links)
          .id((d: any) => d.id)
          .distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force("collide", d3.forceCollide().radius(30));
      
      // Store simulation for later access
      simulationRef.current = simulation;
      setSimulationActive(true);
      
      // Create the links
      const link = g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(processedData.links)
        .join("line")
        .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1) * 2)
        .attr("class", (d: any) => {
          let classes = "link";
          if (selectedNodes.includes(d.source.id) || selectedNodes.includes(d.target.id)) {
            classes += " highlighted-link";
          }
          return classes;
        });
      
      // Create the nodes
      const node = g.append("g")
        .selectAll(".node")
        .data(processedData.nodes)
        .join("g")
        .attr("class", "node")
        .call(drag(simulation) as any)
        .on("click", (event, d: any) => {
          // Toggle selection when clicking a node
          if (selectedNodes.includes(d.npub)) {
            setSelectedNodes(selectedNodes.filter(id => id !== d.npub));
          } else {
            setSelectedNodes([...selectedNodes, d.npub]);
          }
          event.stopPropagation();
        });
      
      // Add circles for each node
      node.append("circle")
        .attr("r", (d: any) => getNodeRadius(d, nodeScale))
        .attr("fill", (d: any) => getNodeColor(d, selectedNodes))
        .attr("stroke", (d: any) => selectedNodes.includes(d.npub) ? "#FF8C00" : "#fff")
        .attr("stroke-width", (d: any) => selectedNodes.includes(d.npub) ? 3 : 1);
      
      // Add labels for core nodes
      node.append("text")
        .attr("dx", (d: any) => getNodeRadius(d, nodeScale) + 5)
        .attr("dy", ".35em")
        .text((d: any) => d.name || shortenNpub(d.npub))
        .attr("font-size", (d: any) => d.isCoreNode ? "12px" : "10px")
        .attr("fill", (d: any) => d.isCoreNode ? "#000" : "#666")
        .style("pointer-events", "none");
      
      // Add hover tooltip
      node.append("title")
        .text((d: any) => d.name || d.npub);
      
      // Update positions on each tick
      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);
        
        node
          .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });
      
      // Add legend
      const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(20, ${dimensions.height - 100})`);
      
      const legendItems = [
        { color: "#3498db", label: "Core Node" },
        { color: "#2ecc71", label: "Selected" },
        { color: "#95a5a6", label: "Connected" },
      ];
      
      legend.selectAll(".legend-item")
        .data(legendItems)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .call(g => {
          g.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", d => d.color);
          
          g.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(d => d.label)
            .attr("font-size", "12px");
        });
      
      // Add reset view button
      const resetButton = svg.append("g")
        .attr("class", "reset-button")
        .attr("transform", `translate(${dimensions.width - 100}, 20)`)
        .style("cursor", "pointer")
        .on("click", () => {
          svg.transition().duration(750).call(
            zoom.transform as any,
            d3.zoomIdentity.translate(dimensions.width / 2, dimensions.height / 2).scale(0.8)
          );
        });
      
      resetButton.append("rect")
        .attr("width", 80)
        .attr("height", 30)
        .attr("rx", 5)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "#ccc");
      
      resetButton.append("text")
        .attr("x", 40)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Reset View")
        .attr("fill", "#333")
        .attr("font-size", "10px");
      
      // Clean up simulation when component unmounts
      return () => {
        if (simulation) simulation.stop();
        setSimulationActive(false);
      };
    } catch (err) {
      console.error("Error rendering social graph:", err);
      setError(err instanceof Error ? err.message : "Error rendering graph");
      setSimulationActive(false);
    }
  }, [data, dimensions, selectedNodes, highlightMode, nodeScale]);

  // Helper function to preprocess data
  const preprocessData = (rawData: SocialGraphData, selectedNodeIds: string[]) => {
    // Tag core nodes and compute node importance
    const nodes = rawData.nodes.map(node => ({
      ...node,
      isCoreNode: CORE_NPUBS.includes(node.npub),
      isSelected: selectedNodeIds.includes(node.npub),
      // Count connections to determine node size
      connections: rawData.links.filter(
        link => link.source === node.id || link.target === node.id
      ).length
    }));
    
    // Filter links based on highlight mode
    let links = rawData.links;
    if (highlightMode === 'selected') {
      links = rawData.links.filter(link => {
        const sourceNode = typeof link.source === 'string' ? link.source : (link.source as {id: string}).id;
        const targetNode = typeof link.target === 'string' ? link.target : (link.target as {id: string}).id;
        
        // Get the actual node objects
        const sourceObj = nodes.find(n => n.id === sourceNode);
        const targetObj = nodes.find(n => n.id === targetNode);
        
        // Include links that connect to selected or core nodes
        return (sourceObj && (sourceObj.isSelected || sourceObj.isCoreNode)) || 
               (targetObj && (targetObj.isSelected || targetObj.isCoreNode));
      });
    }
    
    return { nodes, links };
  };

  // Helper to get node radius based on importance
  const getNodeRadius = (node: any, scale: number) => {
    if (node.isCoreNode) return 15 * scale;
    if (selectedNodes.includes(node.npub)) return 12 * scale;
    return 8 * scale;
  };

  // Helper to get node color
  const getNodeColor = (node: any, selectedNodeIds: string[]) => {
    if (node.isCoreNode) return "#3498db"; // Core nodes are blue
    if (selectedNodeIds.includes(node.npub)) return "#2ecc71"; // Selected nodes are green
    return "#95a5a6"; // Other nodes are gray
  };

  // Helper to shorten npub for display
  const shortenNpub = (npub: string) => {
    if (!npub) return "";
    return npub.substring(0, 8) + "..." + npub.substring(npub.length - 4);
  };

  // Drag function for nodes
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

  // UI Controls
  const controls = (
    <div className="controls absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-md shadow-md z-10 max-w-xs">
      <h3 className="text-sm font-semibold mb-2">Graph Controls</h3>
      
      <div className="mb-3">
        <label className="block text-xs mb-1">Display Mode</label>
        <select 
          className="block w-full text-sm p-1 border rounded"
          value={highlightMode}
          onChange={(e) => setHighlightMode(e.target.value as any)}
        >
          <option value="selected">Focus on Selected</option>
          <option value="all">Show All Connections</option>
        </select>
      </div>
      
      <div className="mb-3">
        <label className="block text-xs mb-1">Node Size: {nodeScale.toFixed(1)}x</label>
        <input 
          type="range" 
          min="0.5" 
          max="3" 
          step="0.1" 
          value={nodeScale}
          onChange={(e) => setNodeScale(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div>
        <p className="text-xs mb-1">Selected: {selectedNodes.length} nodes</p>
        <button 
          onClick={() => setSelectedNodes(CORE_NPUBS)}
          className="text-xs bg-bitcoin text-white px-2 py-1 rounded mr-2"
        >
          Reset Selection
        </button>
        <button 
          onClick={() => setSelectedNodes([])}
          className="text-xs bg-gray-500 text-white px-2 py-1 rounded"
        >
          Clear All
        </button>
      </div>
    </div>
  );

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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No social graph data available</div>
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
      
      <div className="absolute bottom-2 right-2 text-xs text-gray-500">
        {data.nodes.length} nodes / {data.links.length} links
        {simulationActive ? " • Simulation active" : " • Simulation inactive"}
      </div>
    </div>
  );
}; 