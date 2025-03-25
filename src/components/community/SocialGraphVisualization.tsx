'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { BRAND_COLORS } from '../../constants/brandColors'
import { processGraphData, GraphNode, GraphData } from './utils'
import defaultGraphData from './socialgraph.json'

// Dynamically import the ForceGraph2D component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false, loading: () => <GraphPlaceholder /> })

// Add a placeholder component for when the graph is loading
const GraphPlaceholder = () => (
  <div className="w-full h-full flex items-center justify-center" 
       style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.deepBlue} 0%, ${BRAND_COLORS.forestGreen} 100%)` }}>
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin mx-auto mb-4"></div>
      <p className="text-lightSand text-sm">Loading social graph visualization...</p>
    </div>
  </div>
)

interface SocialGraphVisualizationProps {
  height?: number | string
  width?: number | string
  className?: string
}

export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  height = 600,
  width = '100%',
  className = '',
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const graphRef = useRef<any>(null)

  // Load static data
  useEffect(() => {
    try {
      const processedData = processGraphData(defaultGraphData)
      
      if (processedData.nodes.length === 0) {
        setGraphError('No social graph data available')
      } else {
        setGraphData(processedData)
        setGraphError(null)
      }
    } catch (err) {
      console.error('Failed to load graph data:', err)
      setGraphError('Failed to load social graph data')
    }
  }, [])

  // Add a function to retry loading data
  const reloadGraphData = useCallback(() => {
    try {
      console.log('Reloading social graph data')
      const processedData = processGraphData(defaultGraphData)
      
      if (processedData.nodes.length === 0) {
        setGraphError('No social graph data available')
      } else {
        setGraphData(processedData)
        setGraphError(null)
      }
    } catch (err) {
      console.error('Failed to reload graph data:', err)
      setGraphError('Failed to reload social graph data')
    }
  }, [])

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 600,
        })
      }
    }

    // Initial dimensions update
    updateDimensions()
    
    // Add resize listener
    window.addEventListener('resize', updateDimensions)
    
    // Cleanup
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Handle node clicks - fixed type signature to match ForceGraph2D requirements
  const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
    setSelectedNode(node as GraphNode)
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`rounded-lg shadow-lg overflow-hidden w-full h-full ${className}`}
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        background: `linear-gradient(135deg, ${BRAND_COLORS.deepBlue} 0%, ${BRAND_COLORS.forestGreen} 100%)`,
      }}
    >
      <div className="w-full h-full relative">
        {graphError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 max-w-xs text-center">
              <p className="text-lightSand mb-3">{graphError}</p>
              <button 
                onClick={reloadGraphData}
                className="bg-white/20 hover:bg-white/30 text-lightSand px-3 py-1 rounded-lg text-sm"
              >
                Reload Graph
              </button>
            </div>
          </div>
        )}
      
        {selectedNode && (
          <div className="absolute bottom-0 left-0 z-10 p-2 w-full">
            <div className="shadow-sm p-3 max-w-xs mx-auto border border-gray-200 rounded-lg" 
                 style={{ backgroundColor: BRAND_COLORS.deepBlue }}>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3 border-2" 
                     style={{ borderColor: BRAND_COLORS.bitcoinOrange }}>
                  <img 
                    src={selectedNode.picture || '/assets/bitcoin.png'} 
                    alt={selectedNode.name || 'User'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/bitcoin.png'
                    }}
                  />
                </div>
                <div>
                  <div className="font-medium" style={{ color: BRAND_COLORS.lightSand }}>
                    {selectedNode.name || 'Unknown User'}
                  </div>
                  {selectedNode.npub && (
                    <div className="text-xs" style={{ color: BRAND_COLORS.lightSand + '99' }}>
                      {selectedNode.npub.substring(0, 8)}...{selectedNode.npub.substring(selectedNode.npub.length - 4)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full">
          {graphData && !graphError && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeColor={(node: any) => node.color}
              nodeVal={(node: any) => node.val || 5}
              linkColor={(link: any) => link.color}
              linkWidth={(link: any) => Math.sqrt(link.value || 1) * 1.5}
              onNodeClick={handleNodeClick}
              width={dimensions.width}
              height={dimensions.height}
              cooldownTicks={100}
              nodeRelSize={6}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
            />
          )}
        </div>

        {/* Add a reload button to the bottom right */}
        <div className="absolute bottom-3 right-3 z-10">
          <button 
            onClick={reloadGraphData}
            className="bg-white/10 hover:bg-white/20 text-lightSand p-2 rounded-full shadow-lg" 
            title="Reload Graph"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
} 