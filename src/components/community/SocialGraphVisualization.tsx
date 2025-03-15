'use client';

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
  data: {
    nodes: any[];
    links: any[];
  };
  width: number;
  height: number;
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

// Add debug log helper
const DEBUG = true;
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[SocialGraphViz]', ...args);
  }
}

export function SocialGraphVisualization({ data, width, height }: SocialGraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    // Clear existing SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    // Create SVG
    const svg = d3.select(svgRef.current);

    // Add zoom behavior
    const zoom = d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom as any);

    // Create main group for zoom
    const g = svg.append('g');

    // Create the force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody()
        .strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links
    const links = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Create nodes
    const nodes = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', 8)
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Add labels to nodes
    nodes.append('text')
      .text((d: any) => d.name || d.id.slice(0, 8))
      .attr('x', 12)
      .attr('y', 4)
      .attr('class', 'text-sm fill-current')
      .style('pointer-events', 'none');

    // Add titles for hover
    nodes.append('title')
      .text((d: any) => d.name || d.id);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
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

    // Node color based on type
    function getNodeColor(node: any) {
      switch (node.type) {
        case 'freeMadeira':
          return '#4CAF50';  // Green
        case 'agency':
          return '#2196F3';  // Blue
        case 'core':
          return '#FFC107';  // Amber
        case 'follower':
          return '#9C27B0';  // Purple
        default:
          return '#E91E63';  // Pink
      }
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  return (
    <div 
      ref={svgRef} 
      className="w-full h-full bg-background"
      style={{ touchAction: 'none' }} // Prevents touch scrolling issues
    />
  );
} 