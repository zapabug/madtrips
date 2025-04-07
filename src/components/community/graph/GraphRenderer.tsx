'use client'

import React, { useRef, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { GraphNode, GraphLink, GraphData } from '../../../types/graph-types';
import { BRAND_COLORS } from '../../../constants/brandColors';

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false });

interface GraphRendererProps {
  graph: GraphData;
  height?: number | string;
  width?: number | string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: any | null) => void;
  selectedNode?: GraphNode | null;
  isLoggedIn?: boolean;
  centerNodeId?: string;
}

/**
 * Converts GraphData to the format expected by ForceGraph2D
 */
const prepareGraphData = (graphData: GraphData) => {
  // Create a new object to avoid mutating the original
  return {
    nodes: graphData.nodes.map(node => ({
      ...node,
      val: node.isCoreNode ? 20 : 8, // Core nodes are larger
      color: node.isCoreNode 
        ? BRAND_COLORS.bitcoinOrange 
        : BRAND_COLORS.lightSand,
      // Ensure fx, fy are undefined rather than null to fix type issues
      fx: node.fx === null ? undefined : node.fx,
      fy: node.fy === null ? undefined : node.fy,
    })),
    links: graphData.links.map(link => ({
      source: typeof link.source === 'string' ? link.source : link.source?.id || '',
      target: typeof link.target === 'string' ? link.target : link.target?.id || '',
      value: link.type === 'mutual' ? 2 : 1, // Mutual follows have thicker lines
      color: link.type === 'mutual' 
        ? BRAND_COLORS.bitcoinOrange 
        : BRAND_COLORS.lightSand + '80',
    })),
  };
};

// Use memo to prevent unnecessary re-renders
const GraphRenderer = memo(({
  graph,
  height = 600,
  width = '100%',
  onNodeClick,
  onNodeHover,
  selectedNode,
  isLoggedIn = false,
  centerNodeId
}: GraphRendererProps) => {
  const graphRef = useRef<any>(null);

  // Format data for rendering
  const graphData = prepareGraphData(graph);

  // Focus on a node (e.g., when selected)
  const focusNode = useCallback((node: GraphNode | null) => {
    if (graphRef.current && node) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(3, 1000);
    }
  }, []);

  // When selectedNode changes, focus on it
  useEffect(() => {
    if (selectedNode) {
      focusNode(selectedNode);
    }
  }, [selectedNode, focusNode]);

  // Center the graph on the center node when it first renders
  useEffect(() => {
    if (graphRef.current && centerNodeId) {
      const centerNode = graph.nodes.find(node => node.id === centerNodeId);
      if (centerNode) {
        setTimeout(() => {
          focusNode(centerNode);
        }, 500);
      }
    }
  }, [centerNodeId, graph.nodes, focusNode]);

  // Handle node rendering customization
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Calculate node radius (core nodes larger)
    const nodeRadius = node.val;
    
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Add profile image if available
    if (node.picture) {
      // Use a clip path for the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius - 2, 0, 2 * Math.PI, false);
      ctx.clip();
      
      // Create a temporary image to draw profile picture
      const img = new Image();
      img.src = node.picture;
      
      // Draw the image if it's loaded
      if (img.complete) {
        const imgSize = nodeRadius * 2;
        ctx.drawImage(img, node.x - nodeRadius, node.y - nodeRadius, imgSize, imgSize);
      } else {
        // Draw a placeholder
        ctx.fillStyle = '#888';
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    // Add border for selected node
    if (selectedNode && node.id === selectedNode.id) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Only show labels for core nodes or when zoomed in
    if (node.isCoreNode || globalScale > 1.2) {
      const fontSize = node.isCoreNode ? 14 : 12;
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw label with shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.fillText(node.name || (node.npub ? node.npub.slice(0, 6) + '...' : 'Unknown'), node.x, node.y + nodeRadius + 8);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  }, [selectedNode]);

  // Show loading message when no data is available
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div style={{ height, width }} className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md">
        <div className="text-center p-4">
          <div className="mb-2 text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-10 w-10 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p>Waiting for graph data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height, width, position: 'relative' }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        nodeLabel={(node: any) => node.name || node.npub || 'Unknown'}
        linkColor={(link: any) => link.color}
        linkWidth={(link: any) => link.value}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.1}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={(link: any) => link.value}
        linkDirectionalParticleSpeed={0.01}
        onNodeClick={(node: any) => onNodeClick && onNodeClick(node)}
        onNodeHover={onNodeHover}
        nodeRelSize={6}
        warmupTicks={20}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.1}
      />
    </div>
  );
});

GraphRenderer.displayName = 'GraphRenderer';

export default GraphRenderer; 