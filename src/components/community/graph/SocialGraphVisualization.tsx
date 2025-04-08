/**
 * SocialGraphVisualization - Community graph visualization wrapper
 * 
 * This component serves as a simple wrapper around the SocialGraph component,
 * providing a consistent interface for the community page.
 */

'use client'

import React, { useRef, useEffect, useState } from 'react'
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

export default function SocialGraphVisualization({
  className = '',
  graphData = null,
  profiles = new Map(),
  loading = false,
  error = null,
  onRefresh,
  compact = false
}: SocialGraphVisualizationProps) {
  // Convert profiles map to record for SocialGraph
  const profilesRecord = Object.fromEntries(profiles || new Map())

  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <div className="w-full h-full">
        <SocialGraph
          graphData={graphData}
          profilesMap={profilesRecord}
          isLoading={loading}
          error={error}
          compact={compact}
          height={compact ? 400 : undefined}
        />
      </div>
    </div>
  )
} 