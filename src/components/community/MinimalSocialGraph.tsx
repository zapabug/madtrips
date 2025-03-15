'use client'

import { useEffect, useRef, useState } from 'react'

// Define types for our graph data
interface GraphNode {
  id: string
  name?: string
  type: string
}

interface GraphLink {
  source: string
  target: string
  value: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  timestamp: number
}

export default function MinimalSocialGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/socialgraph')
        const graphData = await res.json() as GraphData
        console.log('Graph data:', graphData)
        setData(graphData)
      } catch (err) {
        console.error('Error fetching graph data:', err)
        setError('Failed to load graph data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  if (loading) return <p>Loading social graph...</p>
  if (error) return <p className="text-red-500">{error}</p>
  
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-md">
        <p>No social graph data available.</p>
        <a 
          href="/api/socialgraph?update=true" 
          className="inline-block px-3 py-1 mt-2 bg-bitcoin text-white rounded-md"
        >
          Update Graph Data
        </a>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-md">
      <div className="mb-2">
        <p className="text-sm">Displaying {data.nodes.length} nodes and {data.links.length} links</p>
      </div>
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <h3 className="font-bold mb-2">Node List:</h3>
        <ul className="text-sm max-h-96 overflow-y-auto">
          {data.nodes.slice(0, 20).map((node: GraphNode, index: number) => (
            <li key={index} className="mb-1">
              {node.name || node.id.substring(0, 10)}... ({node.type})
            </li>
          ))}
          {data.nodes.length > 20 && (
            <li className="italic">...and {data.nodes.length - 20} more nodes</li>
          )}
        </ul>
      </div>
    </div>
  )
} 