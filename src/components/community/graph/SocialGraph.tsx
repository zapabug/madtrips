/**
 * SocialGraph - Community graph controller component
 * 
 * This component handles all social graph loading, data processing, 
 * and passes visualization duties to GraphRenderer.
 */

'use client'

import React, { useState } from 'react'
import { GraphData, GraphNode } from '../../../types/graph-types'
import { LiteProfile } from '../../../types/lite-nostr'
import LoadingAnimation from '../../ui/LoadingAnimation'
import GraphRenderer from './GraphRenderer'

// Component props
interface SocialGraphProps {
  className?: string
  graphData?: GraphData | null
  profiles?: Map<string, LiteProfile>
  loading?: boolean
  error?: string | null
  onRefresh?: () => Promise<void>
  compact?: boolean
}

export default function SocialGraph({
  className = '',
  graphData = null,
  profiles = new Map(),
  loading = false,
  error = null,
  onRefresh,
  compact = false
}: SocialGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Handle node click
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node === selectedNode ? null : node);
  };

  // Loading state
  if (loading) {
    return (
      <div className={`w-full h-full flex justify-center items-center p-4 ${className}`}>
        <LoadingAnimation category="GRAPH" size={compact ? "medium" : "large"} showText={!compact} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`w-full h-full flex justify-center items-center p-4 ${className}`}>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  // Empty state
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className={`w-full h-full flex justify-center items-center p-4 ${className}`}>
        <div className="text-gray-500 text-sm">No graph data available</div>
      </div>
    );
  }

  // Calculate height to use based on compact mode
  const graphHeight = compact ? 400 : 600;

  // If profiles are provided, update node information
  const processedGraphData = {...graphData};
  if (profiles.size > 0 && processedGraphData.nodes) {
    processedGraphData.nodes = processedGraphData.nodes.map(node => {
      if (node.npub) {
        const profile = profiles.get(node.npub);
        if (profile) {
          return {
            ...node,
            name: node.name || profile.displayName || profile.name,
            picture: node.picture || profile.picture
          };
        }
      }
      return node;
    });
  }

  // Render the graph visualization
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <div className="w-full h-full">
        <GraphRenderer 
          graph={processedGraphData}
          height={graphHeight}
          onNodeClick={handleNodeClick}
          selectedNode={selectedNode}
        />
      </div>
    </div>
  );
} 