'use client'

import React, { useState, useEffect } from 'react'
import { SocialGraph, clearAllGraphCaches } from './SocialGraph'
import { CORE_NPUBS } from './utils'
import { ClearGraphCache } from './ClearGraphCache'

// Component props
interface SocialGraphVisualizationProps {
  height?: number | string
  width?: number | string
  className?: string
  title?: string
  description?: string
}

// Main component
export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  height = 600,
  width = '100%',
  className = '',
  title = 'Bitcoin Madeira Community Graph',
  description = 'Visual representation of connections between Bitcoin community members in Madeira.'
}) => {
  const [simplified, setSimplified] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Toggle simplified view and clear cache to force refresh
  const toggleView = () => {
    clearAllGraphCaches(); // Force refresh of graph data when switching modes
    setSimplified(!simplified);
  };
  
  if (!isClient) {
    return <div className="h-64 w-full flex items-center justify-center">Loading graph...</div>;
  }
  
  return (
    <div 
      className={`relative ${className}`} 
      role="figure" 
      aria-label={title}
      title={title}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={toggleView}
          className="px-2 py-1 bg-forest text-white text-sm rounded hover:bg-forest/80 transition-colors"
        >
          {simplified ? 'Detailed View' : 'Simple View'}
        </button>
        <ClearGraphCache buttonText="Clear Cache" />
      </div>
      
      <SocialGraph 
        height={height} 
        width={width}
        className={className}
        npubs={CORE_NPUBS}
        maxConnections={simplified ? 10 : 20}
        key={simplified ? 'simple' : 'detailed'} // Force remount when toggling
      />
    </div>
  )
} 