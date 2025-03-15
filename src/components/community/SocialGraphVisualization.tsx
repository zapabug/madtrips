'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { NodeType, VISUALIZATION_CONFIG } from '@/lib/nostr/config';
import { nip19 } from 'nostr-tools';
import Image from 'next/image';

// Define important npubs
const CORE_NPUBS = {
  FREE_MADEIRA: 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e',
  BITCOIN_MADEIRA: 'npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5',
  MADTRIPS: 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh',
  FUNCHAL: 'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc'
};

// Simplified interfaces
interface Node {
  id: string;
  name?: string;
  type?: string;
  npub: string;
  group?: string;
  isCore?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string;
  target: string;
}

interface VisualizationData {
  nodes: Node[];
  links: Link[];
}

interface VisualizationProps {
  data: VisualizationData;
  width: number;
  height: number;
}

export function SocialGraphVisualization({ data, width, height }: VisualizationProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check for valid data
    if (!data || !data.nodes || !data.links || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error('Invalid data format:', data);
      setErrorMessage('Invalid data format');
      return;
    }
    
    if (data.nodes.length === 0) {
      console.error('No nodes in data');
      setErrorMessage('No nodes in data');
      return;
    }

    console.log('Starting visualization with', data.nodes.length, 'nodes and', data.links.length, 'links');
    
    try {
      // Clear previous SVG
      const svgElement = svgRef.current;
      if (!svgElement) {
        console.error('SVG ref not found');
        setErrorMessage('SVG ref not found');
        return;
      }
      
      d3.select(svgElement).selectAll("*").remove();
      
      // Process data to tag core nodes
      const coreNpubs = Object.values(CORE_NPUBS);
      
      // Make a copy of the data to avoid modifying the original
      const nodes = data.nodes.map(node => ({
        ...node,
        isCore: coreNpubs.includes(node.npub),
        group: coreNpubs.includes(node.npub) ? 
          (Object.entries(CORE_NPUBS).find(([_, value]) => value === node.npub)?.[0]?.toLowerCase() || 'other') : 'other'
      }));
      
      // Make a copy of links
      const links = data.links.map(link => ({
        ...link
      }));
      
      // Find the core nodes
      const freeMadeira = nodes.find(node => node.npub === CORE_NPUBS.FREE_MADEIRA);
      const bitcoinMadeira = nodes.find(node => node.npub === CORE_NPUBS.BITCOIN_MADEIRA);
      const madtrips = nodes.find(node => node.npub === CORE_NPUBS.MADTRIPS);
      const funchal = nodes.find(node => node.npub === CORE_NPUBS.FUNCHAL);
      
      // Log if core nodes are found or not
      console.log('Core nodes found:', {
        freeMadeira: !!freeMadeira,
        bitcoinMadeira: !!bitcoinMadeira,
        madtrips: !!madtrips,
        funchal: !!funchal
      });
      
      // Create basic simulation
      const simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force('collision', d3.forceCollide().radius(25));
      
      // Create SVG
      const svg = d3.select(svgElement)
        .attr('width', width)
        .attr('height', height)
        .style('background', '#f9f9f9')
        .style('border', '1px solid #ddd');
      
      // Create links
      const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1);
      
      // Create nodes
      const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .call(d3.drag<SVGGElement, any>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
        );
      
      // Add circles to nodes
      node.append('circle')
        .attr('r', d => d.isCore ? 15 : 8)
        .attr('fill', getNodeColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
      
      // Add labels to nodes
      node.append('text')
        .text(d => d.name || d.id.substring(0, 8))
        .attr('x', d => d.isCore ? 0 : 12)
        .attr('y', d => d.isCore ? -20 : 0)
        .attr('text-anchor', d => d.isCore ? 'middle' : 'start')
        .attr('fill', '#333')
        .style('font-weight', d => d.isCore ? 'bold' : 'normal')
        .style('font-size', d => d.isCore ? '14px' : '10px');
      
      // Position Fixed Nodes
      if (freeMadeira) {
        freeMadeira.fx = width / 2;
        freeMadeira.fy = height / 2;
      }
      
      if (bitcoinMadeira) {
        bitcoinMadeira.fx = width / 2 - 150;
        bitcoinMadeira.fy = height / 2 - 150;
      }
      
      if (madtrips) {
        madtrips.fx = width / 2 + 150;
        madtrips.fy = height / 2 - 150;
      }
      
      if (funchal) {
        funchal.fx = width / 2;
        funchal.fy = height / 2 + 150;
      }
      
      // Update function
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as any).x)
          .attr('y1', d => (d.source as any).y)
          .attr('x2', d => (d.target as any).x)
          .attr('y2', d => (d.target as any).y);
        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });
      
      // Add debug marker
      svg.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', 5)
        .attr('fill', 'red');
      
      // Drag functions
      function dragstarted(event: { active: boolean; subject: { fx: number; fy: number; x: number; y: number } }) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: { subject: { fx: number; fy: number }; x: number; y: number }) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: { active: boolean; subject: { isCore: boolean; fx: number | null; fy: number | null } }) {
        if (!event.active) simulation.alphaTarget(0);
        if (!event.subject.isCore) {
          event.subject.fx = null;
          event.subject.fy = null;
        }
      }
      // Helper function to determine node color
      function getNodeColor(d: { isCore: boolean; npub: string }) {
        if (d.isCore) {
          if (d.npub === CORE_NPUBS.FREE_MADEIRA) return '#4CAF50';
          if (d.npub === CORE_NPUBS.BITCOIN_MADEIRA) return '#FFC107';
          if (d.npub === CORE_NPUBS.MADTRIPS) return '#2196F3';
          if (d.npub === CORE_NPUBS.FUNCHAL) return '#9C27B0';
          return '#E91E63';
        }
        return '#888';
      }
      
      // Run for a while to get a nice layout
      simulation.alpha(1).restart();
      
    } catch (error: unknown) {
      console.error('Error creating visualization:', error);
      setErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  }, [data, width, height]);

  return (
    <div className="relative w-full h-full">
      {errorMessage && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 z-50">
          {errorMessage}
        </div>
      )}
      <svg 
        ref={svgRef}
        width={width} 
        height={height} 
        className="w-full h-full"
        style={{border: '1px solid #ddd'}}
      >
        {/* SVG content will be rendered here by D3 */}
      </svg>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 p-2 rounded shadow-md text-xs z-50">
        <div className="font-bold mb-1">Core Nodes</div>
        <div className="flex items-center my-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#4CAF50] mr-2"></span>
          <span>Free Madeira</span>
        </div>
        <div className="flex items-center my-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#FFC107] mr-2"></span>
          <span>Bitcoin Madeira</span>
        </div>
        <div className="flex items-center my-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#2196F3] mr-2"></span>
          <span>Madtrips</span>
        </div>
        <div className="flex items-center my-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[#9C27B0] mr-2"></span>
          <span>Funchal</span>
        </div>
      </div>
      
      {/* Debugging stats */}
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded shadow-md text-xs z-50">
        Nodes: {data?.nodes?.length || 0} | Links: {data?.links?.length || 0}
      </div>
    </div>
  );
} 