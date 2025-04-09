/**
 * SocialGraph - Community graph controller component
 * 
 * This component handles all social graph loading, data processing, 
 * and passes visualization duties to GraphRenderer.
 */

'use client'

import React, { useState } from 'react'
import { GraphData, GraphNode } from '../../../types/graph-types'
import { ProfileData } from '../../../hooks/useCachedProfiles'
import LoadingAnimation from '../../ui/LoadingAnimation'
import GraphRenderer from './GraphRenderer'
import { Slider } from '../../ui/slider'

// Component props
interface SocialGraphProps {
  className?: string
  graphData?: GraphData | null
  profiles?: Map<string, ProfileData>
  loading?: boolean
  error?: string | null
  onRefresh?: () => Promise<void>
  compact?: boolean
  initialFollowDepth?: number; // Re-add prop
  onFollowDepthChange?: (depth: number) => void; // Re-add prop
}

export default function SocialGraph({
  className = '',
  graphData = null,
  profiles = new Map(),
  loading = false,
  error = null,
  onRefresh,
  compact = false,
  initialFollowDepth = 10, // Keep default value here
  onFollowDepthChange // Keep prop destructuring
}: SocialGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [currentDepth, setCurrentDepth] = useState(initialFollowDepth);

  // Uncomment slider handler
  const handleSliderChange = (value: number[]) => {
    const newDepth = value[0];
    setCurrentDepth(newDepth);
    if (onFollowDepthChange) {
        onFollowDepthChange(newDepth);
    }
  };

  // Update internal state if prop changes
  React.useEffect(() => {
      setCurrentDepth(initialFollowDepth);
  }, [initialFollowDepth]);

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

  // Render the graph visualization and uncommented slider
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${className}`}>
      {/* Graph Renderer */}
      <div className="w-full flex-grow relative"> 
         {/* Render only if graphData is valid */} 
         {graphData && graphData.nodes && graphData.nodes.length > 0 && (
           <GraphRenderer 
             graph={processedGraphData}
             height={graphHeight}
             onNodeClick={handleNodeClick}
             selectedNode={selectedNode}
           />
         )}
      </div>
      
      {/* Slider Control - Uncommented */}
      {!compact && onFollowDepthChange && ( 
        <div className="w-3/4 max-w-md p-4 mt-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow">
          <label htmlFor="depth-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Network Depth: {currentDepth}
          </label>
          <Slider
            id="depth-slider"
            min={1}
            max={100} 
            step={1}
            value={[currentDepth]}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adjust the depth of the follower/following network (higher values fetch more data).</p>
        </div>
      )}
    </div>
  );
} 