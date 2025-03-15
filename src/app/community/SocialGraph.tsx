'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

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
  const [data, setData] = useState<{ nodes: Node[]; links: Link[] } | null>(null)

  // Debug log for mounting
  console.log('SocialGraph mounting')

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/socialgraph')
        const json = await response.json()
        console.log('Fetched data:', json)
        setData(json)
      } catch (error) {
        console.error('Failed to fetch social graph:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Separate useEffect for D3 visualization
  useEffect(() => {
    if (!data || !containerRef.current) {
      console.log('No data or container yet')
      return
    }

    console.log('Creating visualization')
    
    // Get container dimensions
    const container = containerRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    console.log('Container dimensions:', { width, height })

    try {
      // Clear any existing SVG
      d3.select(container).selectAll('svg').remove()

      // Create new SVG with explicit dimensions
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('border', '1px solid red') // Debug border
        .style('background', '#f0f0f0') // Debug background

      console.log('SVG created:', svg.node())

      // Add zoom behavior
      const g = svg.append('g')
      svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)))

      // Prepare the data
      const links = data.links.map(d => ({
        source: data.nodes.find(n => n.id === d.source) || d.source,
        target: data.nodes.find(n => n.id === d.target) || d.target
      }))

      // Create simulation
      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30))

      // Create links
      const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1)

      // Create nodes
      const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(data.nodes)
        .join('g')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended))

      // Add circles to nodes
      node.append('circle')
        .attr('r', 8)
        .attr('fill', getNodeColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)

      // Add labels
      node.append('text')
        .text(d => d.name || d.id.slice(0, 8))
        .attr('x', 12)
        .attr('y', 4)
        .attr('font-size', '12px')
        .attr('fill', 'currentColor')

      // Update positions on tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as any).x)
          .attr('y1', d => (d.source as any).y)
          .attr('x2', d => (d.target as any).x)
          .attr('y2', d => (d.target as any).y)

        node.attr('transform', d => `translate(${d.x},${d.y})`)
      })

      // Drag functions
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      }

      function dragged(event: any) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      }

      console.log('Visualization complete')

      return () => {
        console.log('Cleaning up visualization')
        simulation.stop()
        svg.remove()
      }
    } catch (error) {
      console.error('Error creating visualization:', error)
    }
  }, [data])

  function getNodeColor(node: Node) {
    switch (node.type) {
      case 'core':
        return '#FFC107' // Amber
      case 'following':
        return '#2196F3' // Blue
      case 'freeMadeira':
        return '#4CAF50' // Green
      case 'agency':
        return '#9C27B0' // Purple
      default:
        return '#E91E63' // Pink
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative bg-white" // Added bg-white for visibility
      style={{ 
        minHeight: '500px',
        border: '1px solid blue' // Debug border
      }}
    >
      {/* Debug info */}
      <div className="absolute top-2 left-2 bg-white/80 px-2 py-1 rounded text-sm">
        Container size: {containerRef.current?.clientWidth}x{containerRef.current?.clientHeight}
      </div>
      <div className="absolute top-2 right-2 bg-white/80 px-2 py-1 rounded text-sm">
        Nodes: {data?.nodes?.length || 0} | Links: {data?.links?.length || 0}
      </div>
    </div>
  )
} 