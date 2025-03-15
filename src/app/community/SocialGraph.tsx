'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { SocialGraphVisualization } from '@/components/community/SocialGraphVisualization'
import dynamic from 'next/dynamic'

interface Node {
  id: string;
  name: string;
  npub: string;
  type: string;
  picture?: string;
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
}

export function SocialGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Debug log for mounting
  console.log('SocialGraph mounting')

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/socialgraph')
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }
        const json = await response.json()
        console.log('Fetched graph data:', json)
        setData(json)
      } catch (err) {
        console.error('Error fetching graph data:', err)
        setError(err.message || 'Failed to load graph data')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [])

  // Update dimensions
  useEffect(() => {
    if (!containerRef.current) return
    
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        console.log('Container size updated:', rect.width, rect.height)
        setContainerSize({ 
          width: Math.max(rect.width, 100), 
          height: Math.max(rect.height, 400) 
        })
      }
    }
    
    // Initial update
    updateSize()
    
    // Update on resize
    window.addEventListener('resize', updateSize)
    
    // Set a timeout to double-check sizing after component has fully rendered
    const timeoutId = setTimeout(updateSize, 500)
    
    return () => {
      window.removeEventListener('resize', updateSize)
      clearTimeout(timeoutId)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-500">Error: {error}</div>
        <button
          className="px-4 py-2 bg-primary text-white rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || !data.nodes || !data.nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p>No graph data available</p>
        <a 
          href="/api/socialgraph?update=true"
          className="px-4 py-2 bg-primary text-white rounded" 
        >
          Update Graph
        </a>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full border rounded-lg overflow-hidden relative bg-white"
      style={{ minHeight: '500px', height: '100%' }}
    >
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-sm">
        Nodes: {data.nodes.length} | Links: {data.links.length}
      </div>
      
      {/* Only render when container has dimensions */}
      {containerSize.width > 0 && containerSize.height > 0 && (
        <SocialGraphVisualization 
          data={data} 
          width={containerSize.width} 
          height={containerSize.height} 
        />
      )}
      
      {/* Fallback when SVG isn't rendering */}
      <div className="absolute bottom-2 left-2 z-10">
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
          onClick={() => window.location.href = '/api/socialgraph?update=true'}
        >
          Force Update
        </button>
      </div>
    </div>
  )
} 