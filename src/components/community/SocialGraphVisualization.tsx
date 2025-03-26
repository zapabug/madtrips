'use client'

import React, { useEffect, useState } from 'react'
import { SocialGraph } from './SocialGraph'
import { CORE_NPUBS } from './utils'

// Component props
interface SocialGraphVisualizationProps {
  height?: number | string
  width?: number | string
  className?: string
}

// Main component
export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  height = 600,
  width = '100%',
  className = '',
}) => {
  const [loading, setLoading] = useState(false)

  // This component no longer needs to fetch data since SocialGraph will do it directly
  // using NDK for live Nostr data instead of the API endpoint

  return (
    <div className={className}>
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