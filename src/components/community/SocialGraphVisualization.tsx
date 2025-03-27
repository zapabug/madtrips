'use client'

import React from 'react'
import { SocialGraph } from './SocialGraph'
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
  return (
    <div 
      className={`relative ${className}`} 
      role="figure" 
      aria-label={title}
      title={title}
    >
      <div className="absolute top-2 right-2 z-10">
        <ClearGraphCache buttonText="Clear Cache" />
      </div>
      <SocialGraph 
        height={height} 
        width={width}
        className={className}
        npubs={CORE_NPUBS}
        maxConnections={20}
      />
    </div>
  )
} 