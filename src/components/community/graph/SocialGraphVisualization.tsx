/**
 * SocialGraphVisualization - Community graph visualization wrapper
 * 
 * This component serves as a simple wrapper around the SocialGraph component,
 * providing a consistent interface for the community page.
 */

'use client'

import React from 'react'
import SocialGraph from './SocialGraph'
import { GraphData } from '../../../types/graph-types'
import { ProfileData } from '../../../hooks/useCachedProfiles'

// Component props
interface SocialGraphVisualizationProps {
  className?: string
  graphData?: GraphData | null
  profiles?: Map<string, ProfileData>
  loading?: boolean
  error?: string | null
  onRefresh?: () => Promise<void>
  compact?: boolean
}

/**
 * SocialGraphVisualization Component
 * 
 * A simplified wrapper around the SocialGraph component for displaying
 * the community social graph. This visualization shows connections between
 * Bitcoin Madeira community members using Nostr social data.
 */
const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  className = '',
  graphData = null,
  profiles = new Map(),
  loading = false,
  error = null,
  onRefresh,
  compact = false
}) => {
  return (
    <div 
      className={`relative h-full ${className}`} 
      role="figure" 
      aria-label="Community network graph"
    >
      {/* Use the updated SocialGraph component with the shared data */}
      <SocialGraph 
        graphData={graphData}
        profilesMap={profiles instanceof Map ? Object.fromEntries(profiles.entries()) : {}}
        isLoading={loading}
        error={error}
        compact={compact}
      />
      
      {/* Refresh button - only show if not in compact mode */}
      {onRefresh && !compact && (
        <div className="absolute bottom-2 right-2">
          <button 
            onClick={onRefresh}
            className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 focus:outline-none"
            aria-label="Refresh graph data"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}

export default SocialGraphVisualization 