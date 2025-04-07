/**
 * SocialGraphVisualization - Community graph visualization wrapper
 * 
 * This component serves as a simple wrapper around the SocialGraph component,
 * providing a consistent interface for the community page.
 */

'use client'

import React from 'react'
import { CORE_NPUBS } from '../../../constants/nostr'
import SocialGraph from './SocialGraph'
import { GraphData } from '../../../types/graph-types'
import { ProfileData } from '../../../hooks/useCachedProfiles'

// Component props
interface SocialGraphVisualizationProps {
  className?: string
  title?: string
  description?: string
  graphData?: GraphData | null
  profiles?: Map<string, ProfileData>
  loading?: boolean
  error?: string | null
  onRefresh?: () => Promise<void>
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
  title = 'Bitcoin Madeira Community Graph',
  description = 'Visual representation of connections between Bitcoin community members in Madeira.',
  graphData = null,
  profiles = new Map(),
  loading = false,
  error = null,
  onRefresh
}) => {
  return (
    <div 
      className={`relative ${className}`} 
      role="figure" 
      aria-label={title}
    >
      {/* Optional title and description */}
      {title && (
        <h2 className="text-xl font-bold mb-2">{title}</h2>
      )}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      )}
      
      {/* Use the updated SocialGraph component with the shared data */}
      <SocialGraph 
        graphData={graphData}
        profilesMap={profiles instanceof Map ? Object.fromEntries(profiles.entries()) : {}}
        isLoading={loading}
        error={error}
      />
      
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {/* Footer space for optional information */}
        {onRefresh && (
          <button 
            onClick={onRefresh}
            className="text-primary hover:underline focus:outline-none"
            aria-label="Refresh graph data"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  )
}

export default SocialGraphVisualization 