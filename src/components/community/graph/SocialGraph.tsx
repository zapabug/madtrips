'use client'

import React, { useState } from 'react';
import Image from 'next/image';
import { GraphData, GraphNode } from '../../../types/graph-types';
import { ProfileData } from '../../../hooks/useCachedProfiles';
import LoadingAnimation from '../../ui/LoadingAnimation';
import GraphRenderer from './GraphRenderer';

interface SocialGraphProps {
  graphData: GraphData | null;
  profilesMap: Record<string, ProfileData>;
  isLoading: boolean;
  error: string | null;
  compact?: boolean;
  height?: number;
}

export default function SocialGraph({ 
  graphData,
  profilesMap,
  isLoading, 
  error,
  compact = false,
  height
}: SocialGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Handle node click
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node === selectedNode ? null : node);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex justify-center items-center p-4">
        <LoadingAnimation category="GRAPH" size={compact ? "medium" : "large"} showText={!compact} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex justify-center items-center p-4">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="w-full h-full flex justify-center items-center p-4">
        <div className="text-gray-500 text-sm">No graph data available</div>
      </div>
    );
  }

  // Calculate height to use - use prop value, or derive from compact mode
  const graphHeight = height || (compact ? 300 : 500);

  // Use GraphRenderer for interactive visualization
  return (
    <div className="w-full h-full">
      <GraphRenderer 
        graph={graphData}
        height={graphHeight}
        onNodeClick={handleNodeClick}
        selectedNode={selectedNode}
      />
    </div>
  );
}