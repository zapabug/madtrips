'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// Core NPUBs
const CORE_NPUBS = {
  FREE_MADEIRA: 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e',
  BITCOIN_MADEIRA: 'npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5',
  MADTRIPS: 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh',
  FUNCHAL: 'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc'
};

export function SimpleSocialGraph({ data }) {
  // We'll use a direct DOM ref instead of an SVG ref
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState({
    svgCreated: false,
    containerSize: { width: 0, height: 0 },
    nodesCount: 0,
    linksCount: 0
  });

  // Create the visualization
  useEffect(() => {
    if (!containerRef.current || !data) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Get container dimensions
      const containerWidth = containerRef.current.clientWidth || 800;
      const containerHeight = containerRef.current.clientHeight || 600;
      
      console.log('Container dimensions:', containerWidth, containerHeight);
      
      // Update debug state
      setDebug(prev => ({
        ...prev,
        containerSize: { width: containerWidth, height: containerHeight },
        nodesCount: data.nodes?.length || 0,
        linksCount: data.links?.length || 0
      }));
      
      // Explicitly create an SVG element
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', containerWidth.toString());
      svg.setAttribute('height', containerHeight.toString());
      svg.style.background = '#f0f0f0';
      svg.style.border = '1px solid #ccc';
      containerRef.current.appendChild(svg);
      
      // Update debug state to confirm SVG creation
      setDebug(prev => ({ ...prev, svgCreated: true }));
      
      // Create a testing circle to confirm SVG rendering
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', (containerWidth / 2).toString());
      circle.setAttribute('cy', (containerHeight / 2).toString());
      circle.setAttribute('r', '50');
      circle.setAttribute('fill', 'red');
      svg.appendChild(circle);
      
      // Use D3 to select the SVG and add content
      const d3svg = d3.select(svg);
      
      // Add a text element to show we're using D3
      d3svg.append('text')
        .attr('x', containerWidth / 2)
        .attr('y', containerHeight / 2 + 80)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('Social Graph Visualization');
      
      // If we have nodes, let's start creating a simple visualization
      if (data.nodes && data.nodes.length > 0) {
        // Create a simple force simulation
        const simulation = d3.forceSimulation(data.nodes)
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(containerWidth / 2, containerHeight / 2));
        
        // Add nodes as circles
        const node = d3svg.append('g')
          .selectAll('circle')
          .data(data.nodes)
          .join('circle')
          .attr('r', 5)
          .attr('fill', 'blue');
        
        // Update node positions on simulation tick
        simulation.on('tick', () => {
          node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        });
      }
      
    } catch (err) {
      console.error('Error creating visualization:', err);
      setError(err.message);
    }
  }, [data]);

  return (
    <div className="relative w-full h-full">
      {/* Debug overlay */}
      <div className="absolute top-0 left-0 bg-white/90 text-black p-2 z-50 text-xs">
        <div>SVG Created: {debug.svgCreated ? '✅' : '❌'}</div>
        <div>Container Size: {debug.containerSize.width}x{debug.containerSize.height}</div>
        <div>Nodes: {debug.nodesCount} | Links: {debug.linksCount}</div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          Error: {error}
        </div>
      )}
      
      {/* Visualization container */}
      <div 
        ref={containerRef} 
        className="w-full h-full bg-white"
        style={{ minHeight: '400px' }}
      ></div>
      
      {/* Action buttons */}
      <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow-md">
        <a 
          href="/api/socialgraph?update=true" 
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Force Update
        </a>
      </div>
    </div>
  );
} 