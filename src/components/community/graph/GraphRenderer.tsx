'use client'

import React, { useRef, useCallback, useEffect, memo, useState } from 'react';
import dynamic from 'next/dynamic';
import { GraphNode, GraphLink, GraphData } from '../../../types/graph-types';
import { useNostr } from '../../../lib/contexts/NostrContext';
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
      val: node.val || (node.isCoreNode ? 25 : 3),
      color: node.color || (node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand),
      // Ensure fx, fy are undefined rather than null to fix type issues
      fx: node.fx === null ? undefined : node.fx,
      fy: node.fy === null ? undefined : node.fy,
    })),
    links: graphData.links.map(link => ({
      source: typeof link.source === 'string' ? link.source : link.source?.id || '',
      target: typeof link.target === 'string' ? link.target : link.target?.id || '',
      value: link.value || 1,
      color: link.color || (link.type === 'mutual' 
        ? BRAND_COLORS.bitcoinOrange
        : BRAND_COLORS.lightSand + '99'),
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
  const { ndk } = useNostr();
  const graphRef = useRef<any>(null);
  const [nodeImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Format data for rendering
  const graphData = prepareGraphData(graph);

  // Preload profile images for nodes that have pictures
  useEffect(() => {
    if (!graphData?.nodes) return;

    graphData.nodes.forEach((node: any) => {
      if (node.picture && !nodeImages.has(node.id)) {
        const img = new Image();
        img.onload = () => {
          nodeImages.set(node.id, img);
        };
        img.onerror = () => {
          // If image fails to load, we don't add it to the map
          // so the fallback circle will be shown
        };
        img.src = node.picture;
      }
    });
  }, [graphData?.nodes, nodeImages]);

  // Focus on a node (e.g., when selected)
  const focusNode = useCallback((node: GraphNode | null) => {
    if (graphRef.current && node) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(4, 1000);
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

  // Customize node rendering
  const nodeCanvasObject = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, id, name, picture, color } = node;
    const size = Math.max(4, (node.val || 1) * 4);
    const fontSize = 12 / globalScale;
    const nodeSize = size;
    
    // Draw node circle
    ctx.beginPath();
    ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = color || BRAND_COLORS.deepBlue;
    ctx.fill();
    
    // Draw border for selected node
    if (selectedNode && id === selectedNode.id) {
      ctx.beginPath();
      ctx.arc(x, y, nodeSize + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = BRAND_COLORS.bitcoinOrange;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw profile picture if available
    if (picture) {
      const img = nodeImages.get(id);
      if (img) {
        ctx.save();
        // Create circular clip for the image
        ctx.beginPath();
        ctx.arc(x, y, nodeSize - 1, 0, 2 * Math.PI);
        ctx.clip();
        
        // Draw the image
        const imgSize = nodeSize * 2;
        ctx.drawImage(img, x - nodeSize, y - nodeSize, imgSize, imgSize);
        ctx.restore();
      }
    }
    
    // Draw label for the node
    if (name && globalScale > 0.5) {
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'black';
      
      // Draw background for text
      const textWidth = ctx.measureText(name).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(
        x - textWidth / 2 - 2,
        y + nodeSize + 2,
        textWidth + 4,
        fontSize + 4
      );
      
      // Draw text
      ctx.fillStyle = 'black';
      ctx.fillText(name, x, y + nodeSize + fontSize / 2 + 4);
    }
  };

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
        nodeCanvasObject={nodeCanvasObject}
        nodeLabel={(node: any) => node.name || 'Unknown'}
        linkColor={(link: any) => link.color || BRAND_COLORS.lightSand + '99'}
        linkWidth={(link: any) => link.value}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={(link: any) => link.value}
        linkDirectionalParticleSpeed={0.005}
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