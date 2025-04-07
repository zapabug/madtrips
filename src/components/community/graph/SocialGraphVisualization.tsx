/**
 * SocialGraphVisualization - Community graph visualization wrapper
 * 
 * This component serves as a simple wrapper around the SocialGraph component,
 * providing a consistent interface for the community page.
 */

'use client'

import React from 'react'
import { CORE_NPUBS } from '../utils'
import SocialGraph from './SocialGraph'

// Component props
interface SocialGraphVisualizationProps {
  height?: number | string
  width?: number | string
  className?: string
  title?: string
  description?: string
  showSecondDegree?: boolean // Enable second degree connections
}

/**
 * SocialGraphVisualization Component
 * 
 * A simplified wrapper around the SocialGraph component for displaying
 * the community social graph. This visualization shows connections between
 * Bitcoin Madeira community members using Nostr social data.
 */
const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  height = 600,
  width = '100%',
  className = '',
  title = 'Bitcoin Madeira Community Graph',
  description = 'Visual representation of connections between Bitcoin community members in Madeira.',
  showSecondDegree = true // Enable by default for richer web of trust
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
      
      {/* Use the refactored SocialGraph component */}
      <SocialGraph 
        height={height} 
        width={width}
        npubs={CORE_NPUBS}
        maxConnections={20}
        showSecondDegree={showSecondDegree}
        continuousLoading={true}
      />
      
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          This visualization shows connections between Bitcoin Madeira community members and their extended network.
          Mutual follows are shown with a stronger orange connection.
        </p>
      </div>
    </div>
  )
}

export default SocialGraphVisualization 