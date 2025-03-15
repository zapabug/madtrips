import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Image from 'next/image';

// Define types for our data
interface Node {
  id: string;
  name?: string;
  npub: string;
  picture?: string; // URL to profile picture
  displayName?: string;
  group?: number;
  isCoreNode?: boolean;
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

interface ProfileSocialGraphProps {
  data: SocialGraphData | null;
}

// Core NPUBs we want to highlight
const CORE_NPUBS = [
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e", // Free Madeira
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5", // Bitcoin Madeira
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh", // Madtrips
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc", // Funchal
];

// Default color scheme
const COLORS = {
  coreNode: "#F7931A", // Bitcoin Orange - was Amber-500
  selected: "#F7931A", // Bitcoin Orange - was Blue-500
  regular: "#9ca3af", // Gray-400
  highlighted: "#F7931A", // Bitcoin Orange - was Emerald-500
  link: "#d1d5db", // Gray-300
  highlightedLink: "#F7931A", // Bitcoin Orange - was Gray-500
};

export const ProfileSocialGraph: React.FC<ProfileSocialGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [highlightCoreNodes, setHighlightCoreNodes] = useState(true);
  const simulationRef = useRef<any>(null);

  // Helper to shorten npub for display
  const shortenNpub = (npub: string) => {
    if (!npub) return "";
    return npub.substring(0, 6) + "..." + npub.substring(npub.length - 4);
  };

  // Helper function to get a default profile picture
  const getDefaultProfilePic = (npub: string) => {
    // Generate a color based on the npub hash
    const hash = npub.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const color = `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
    
    // Create a data URI for a colored circle with the first letter
    const firstLetter = (npub.replace('npub1', '') || 'N').charAt(0).toUpperCase();
    
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="25" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${firstLetter}</text></svg>`;
  };

  // Drag function for nodes
  const drag = (simulation: any) => {
    function dragstarted(event: any) {
      if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active && simulation) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

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

  // Just before the useEffect for main visualization, add this diagnostic renderer
  useEffect(() => {
    // Diagnostic renderer - ensure basic SVG functionality works
    if (containerRef.current && dimensions.width > 0 && error === null) {
      try {
        const diagnosticSvg = document.createElement('svg');
        diagnosticSvg.setAttribute('width', '100%');
        diagnosticSvg.setAttribute('height', '100%');
        diagnosticSvg.setAttribute('style', 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: -1;');
        
        // Add a diagnostic circle to verify SVG rendering
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '50%');
        circle.setAttribute('cy', '50%');
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', 'red');
        circle.setAttribute('class', 'diagnostic-marker');
        
        diagnosticSvg.appendChild(circle);
        
        // Clean up any existing diagnostic SVG
        const existingDiagnostic = containerRef.current.querySelector('.diagnostic-svg');
        if (existingDiagnostic) {
          existingDiagnostic.remove();
        }
        
        // Add the new diagnostic SVG
        diagnosticSvg.classList.add('diagnostic-svg');
        containerRef.current.appendChild(diagnosticSvg);
        
        console.log("Diagnostic SVG rendered to verify basic SVG functionality");
        
        return () => {
          if (containerRef.current) {
            const diagnostic = containerRef.current.querySelector('.diagnostic-svg');
            if (diagnostic) {
              diagnostic.remove();
            }
          }
        };
      } catch (err) {
        console.error("Error creating diagnostic SVG:", err);
      }
    }
  }, [dimensions, error]);

  // Main visualization effect
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || dimensions.width === 0) {
      console.log("Missing required elements for rendering:", { 
        hasData: !!data, 
        hasSvgRef: !!svgRef.current, 
        hasContainerRef: !!containerRef.current, 
        dimensions 
      });
      return;
    }

    try {
      console.log("Rendering social graph with data:", { 
        nodeCount: data.nodes.length, 
        linkCount: data.links.length 
      });
      
      // Clear previous visualization
      d3.select(svgRef.current).selectAll("*").remove();
      
      // Process data - make sure all nodes have properly formatted data
      const processedNodes = data.nodes.map((node) => ({
        ...node,
        isCoreNode: CORE_NPUBS.includes(node.npub),
        // Ensure nodes have a profile picture (even if it's a placeholder)
        picture: node.picture || getDefaultProfilePic(node.npub),
        // Ensure nodes have a display name
        displayName: node.name || shortenNpub(node.npub),
      }));
      
      // Set up the SVG
      const svg = d3.select(svgRef.current)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", [0, 0, dimensions.width, dimensions.height])
        .attr("style", "max-width: 100%; height: auto;");

      // Create a container group with zoom
      const g = svg.append("g");
      
      // Add zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([0.2, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });
      
      svg.call(zoom as any);
      
      // Initial zoom to fit the visualization
      svg.call(zoom.transform as any, d3.zoomIdentity
        .translate(dimensions.width / 2, dimensions.height / 2)
        .scale(0.8));
      
      // Create pattern definitions for the profile pictures
      const defs = svg.append("defs");
      processedNodes.forEach((node) => {
        defs.append("pattern")
          .attr("id", `profile-pic-${node.id}`)
          .attr("width", 1)
          .attr("height", 1)
          .attr("patternUnits", "objectBoundingBox")
          .append("image")
          .attr("href", node.picture || getDefaultProfilePic(node.npub))
          .attr("width", 50)
          .attr("height", 50)
          .attr("preserveAspectRatio", "xMidYMid slice");
      });
      
      // Create links first so they appear behind nodes
      const link = g.append("g")
        .attr("stroke", COLORS.link)
        .attr("stroke-opacity", 0.4)
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", (d: any) => Math.sqrt(d.value || 1) * 1.5);
      
      // Create node groups
      const node = g.append("g")
        .selectAll(".node")
        .data(processedNodes)
        .join("g")
        .attr("class", "node")
        .on("click", (event, d: any) => {
          setSelectedNode(selectedNode === d ? null : d);
          event.stopPropagation();
        })
        .call(drag(simulationRef.current) as any);
      
      // Add node circles with profile pictures
      node.append("circle")
        .attr("r", (d: any) => d.isCoreNode ? 25 : 18)
        .attr("fill", (d: any) => `url(#profile-pic-${d.id})`)
        .attr("stroke", (d: any) => {
          if (selectedNode === d) return COLORS.selected;
          if (d.isCoreNode && highlightCoreNodes) return COLORS.coreNode;
          return "#ffffff";
        })
        .attr("stroke-width", (d: any) => {
          if (selectedNode === d) return 4;
          if (d.isCoreNode && highlightCoreNodes) return 3;
          return 2;
        });
      
      // Add labels
      if (showLabels) {
        node.append("text")
          .attr("dy", (d: any) => d.isCoreNode ? 38 : 30)
          .attr("text-anchor", "middle")
          .attr("font-size", (d: any) => d.isCoreNode ? "12px" : "10px")
          .attr("font-weight", (d: any) => d.isCoreNode ? "bold" : "normal")
          .text((d: any) => d.displayName)
          .attr("fill", "#333333")
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .attr("stroke-linejoin", "round")
          .attr("paint-order", "stroke")
          .attr("pointer-events", "none");
      }
      
      // Set up the simulation
      const simulation = d3.forceSimulation(processedNodes as any)
        .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("x", d3.forceX(dimensions.width / 2).strength(0.05))
        .force("y", d3.forceY(dimensions.height / 2).strength(0.05))
        .force("collide", d3.forceCollide().radius((d: any) => d.isCoreNode ? 40 : 30).strength(0.8));
      
      // Store reference to the simulation
      simulationRef.current = simulation;
      
      // Update positions on simulation tick
      simulation.on("tick", () => {
        // Keep nodes within bounds
        processedNodes.forEach((d: any) => {
          const r = d.isCoreNode ? 25 : 18;
          d.x = Math.max(r, Math.min(dimensions.width - r, d.x));
          d.y = Math.max(r, Math.min(dimensions.height - r, d.y));
        });
        
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);
        
        node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });
      
      // Function to update link highlighting based on selected node
      function updateLinkHighlighting() {
        if (!selectedNode) {
          link.attr("stroke", COLORS.link).attr("stroke-opacity", 0.4);
          return;
        }
        
        link.attr("stroke", (d: any) => {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          
          if (selectedNode.id === sourceId || selectedNode.id === targetId) {
            return COLORS.highlightedLink;
          }
          return COLORS.link;
        }).attr("stroke-opacity", (d: any) => {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          
          if (selectedNode.id === sourceId || selectedNode.id === targetId) {
            return 0.8;
          }
          return 0.1;
        });
      }
      
      // Initial link highlighting
      updateLinkHighlighting();
      
      // Listen for clicks on the SVG to deselect nodes
      svg.on("click", () => {
        setSelectedNode(null);
      });
      
      // Add a node details panel that appears when a node is selected
      const detailsPanel = svg.append("g")
        .attr("class", "details-panel")
        .attr("opacity", 0)
        .attr("transform", `translate(10, 10)`);
      
      const detailsRect = detailsPanel.append("rect")
        .attr("width", 250)
        .attr("height", 120)
        .attr("rx", 5)
        .attr("fill", "white")
        .attr("stroke", "#ccc")
        .attr("fill-opacity", 0.9);
      
      const detailsContent = detailsPanel.append("g")
        .attr("transform", "translate(10, 10)");
      
      const detailsName = detailsContent.append("text")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("y", 20);
      
      const detailsNpub = detailsContent.append("text")
        .attr("font-size", "10px")
        .attr("y", 40)
        .attr("fill", "#666");
      
      const detailsConnections = detailsContent.append("text")
        .attr("font-size", "12px")
        .attr("y", 65);
      
      const detailsType = detailsContent.append("text")
        .attr("font-size", "12px")
        .attr("y", 85);
      
      // Update details panel when a node is selected
      function updateDetailsPanel() {
        if (selectedNode && data) {
          // Count connections
          const connectionCount = data.links.filter(link => {
            const sourceId = typeof link.source === 'object' && link.source ? (link.source as {id: string}).id : link.source;
            const targetId = typeof link.target === 'object' && link.target ? (link.target as {id: string}).id : link.target;
            return sourceId === selectedNode.id || targetId === selectedNode.id;
          }).length;
          
          console.log("Selected Node:", selectedNode);
          console.log("Connection count:", connectionCount);
          
          detailsName.text(selectedNode.name || 'Unknown');
          detailsNpub.text(selectedNode.npub || '');
          detailsConnections.text(`Connections: ${connectionCount}`);
          detailsType.text(`Type: ${selectedNode.isCoreNode ? 'Core Community Member' : 'Community Member'}`);
          
          detailsPanel.transition().duration(200).attr("opacity", 1);
          
          // Adjust height based on content
          detailsRect.attr("height", 100);
        } else {
          detailsPanel.transition().duration(200).attr("opacity", 0);
        }
      }
      
      // Initial update of details panel
      updateDetailsPanel();
      
      // Add controls
      const resetButton = svg.append("g")
        .attr("class", "reset-button")
        .attr("transform", `translate(${dimensions.width - 90}, 20)`)
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
      
      // Clean up
      return () => {
        try {
          if (simulation) {
            // Create a local reference to avoid race conditions
            const sim = simulation;
            sim.stop();
            console.log("Stopped D3 force simulation");
          }
        } catch (err) {
          console.error("Error stopping simulation:", err);
        }
      };
    } catch (err) {
      console.error("Error rendering social graph:", err);
      setError(err instanceof Error ? err.message : "Unknown error rendering graph");
    }
  }, [data, dimensions, selectedNode, showLabels, highlightCoreNodes]);

  // Control panel
  const controls = (
    <div className="absolute top-4 left-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 z-10 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-80">
      <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Graph Controls</h3>
      
      <div className="flex items-center mb-2">
        <input
          id="show-labels"
          type="checkbox"
          checked={showLabels}
          onChange={() => setShowLabels(!showLabels)}
          className="mr-2 accent-[#F7931A]"
        />
        <label htmlFor="show-labels" className="text-xs text-gray-600 dark:text-gray-400">Show Labels</label>
      </div>
      
      <div className="flex items-center mb-2">
        <input
          id="highlight-core"
          type="checkbox"
          checked={highlightCoreNodes}
          onChange={() => setHighlightCoreNodes(!highlightCoreNodes)}
          className="mr-2 accent-[#F7931A]"
        />
        <label htmlFor="highlight-core" className="text-xs text-gray-600 dark:text-gray-400">Highlight Core Nodes</label>
      </div>
      
      <div className="text-xs mt-2">
        <button
          onClick={() => setSelectedNode(null)}
          className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300 transition-colors"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-red-500 mb-4">Error: {error}</div>
        <pre className="text-xs text-gray-600 max-w-full overflow-auto bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
          {data ? `Data contains ${data.nodes.length} nodes and ${data.links.length} links` : 'No data available'}
        </pre>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-[#F7931A] text-white rounded-md hover:bg-[#F7931A]/90 transition-colors"
        >
          Retry
        </button>
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

  // Count core nodes
  const coreNodeCount = data.nodes.filter(node => CORE_NPUBS.includes(node.npub)).length;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {controls}
      
      <svg 
        ref={svgRef} 
        className="w-full h-full"
        style={{ cursor: "grab" }}
      />
      
      {selectedNode && (
        <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-md shadow-md max-w-xs">
          <div className="flex items-center mb-2">
            <Image
              src={selectedNode.picture || getDefaultProfilePic(selectedNode.npub)}
              alt={selectedNode.name || "Profile"}
              width={40}
              height={40}
              className="rounded-full mr-3"
            />
            <div>
              <h3 className="font-medium text-sm">{selectedNode.name || "Unknown"}</h3>
              <p className="text-xs text-gray-500">{shortenNpub(selectedNode.npub)}</p>
            </div>
          </div>
          <a 
            href={`https://njump.me/${selectedNode.npub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#F7931A] hover:underline block mt-2"
          >
            View on Nostr →
          </a>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 opacity-80">
        {data.nodes.length} nodes / {data.links.length} links / {coreNodeCount} core nodes
        {dimensions.width > 0 && ` • Canvas: ${dimensions.width}×${dimensions.height}`}
      </div>

      {/* Debug button */}
      <button
        onClick={() => {
          console.log("Social Graph Data:", data);
          console.log("Core NPUBs:", CORE_NPUBS);
          console.log("Current dimensions:", dimensions);
          console.log("Selected node:", selectedNode);
          alert(`Debug info logged to console. ${data.nodes.length} nodes, ${data.links.length} links.`);
        }}
        className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 p-2 rounded-md text-xs text-gray-600 dark:text-gray-300 opacity-60 hover:opacity-100 transition-opacity shadow-sm border border-gray-200 dark:border-gray-700"
      >
        Debug
      </button>
    </div>
  );
}; 