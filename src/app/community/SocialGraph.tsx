'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Dynamically import the SocialGraphVisualization component
// This is necessary because it uses D3 which relies on browser APIs
const SocialGraphVisualization = dynamic(
  () => import('@/components/community/SocialGraphVisualization').then(mod => mod.SocialGraphVisualization),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }
)

export default function SocialGraph() {
  const [lastUpdate, setLastUpdate] = useState<string>('calculating...')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Fetch the last update time on component mount
  useEffect(() => {
    async function fetchLastUpdate() {
      try {
        const response = await fetch('/api/socialgraph')
        if (response.ok) {
          const data = await response.json()
          if (data.timestamp) {
            const date = new Date(data.timestamp)
            setLastUpdate(date.toLocaleString())
          }
        }
      } catch (error) {
        console.error('Error fetching last update time:', error)
      }
    }
    
    fetchLastUpdate()
  }, [])
  
  // Function to trigger a manual update
  const handleUpdate = async () => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/socialgraph?update=true')
      if (response.ok) {
        const data = await response.json()
        if (data.timestamp) {
          const date = new Date(data.timestamp)
          setLastUpdate(date.toLocaleString())
        }
        // Force a reload of the visualization
        window.location.reload()
      }
    } catch (error) {
      console.error('Error updating social graph:', error)
    } finally {
      setIsUpdating(false)
    }
  }
  
  return (
    <div className="mb-12">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-forest dark:text-white mb-2">
          Madeira Bitcoin Social Graph
        </h2>
        <p className="text-forest/70 dark:text-gray-400">
          An interactive visualization of Bitcoin community connections in Madeira.
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-3 md:mb-0">
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-purple-600 mr-2"></span>
              <span className="text-sm text-forest/70 dark:text-gray-400">Core Members</span>
            </div>
            
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
              <span className="text-sm text-forest/70 dark:text-gray-400">Followers</span>
            </div>
            
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              <span className="text-sm text-forest/70 dark:text-gray-400">Following</span>
            </div>
            
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500 mr-2"></span>
              <span className="text-sm text-forest/70 dark:text-gray-400">Mutual</span>
            </div>
          </div>
          <div>
            <button 
              onClick={handleUpdate}
              disabled={isUpdating}
              className={`text-sm px-3 py-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? 'Updating...' : 'Update Data'}
            </button>
          </div>
        </div>
        
        <div className="text-center text-sm text-forest/70 dark:text-gray-400 mb-2">
          <p>
            <span className="font-medium">Interact with the graph:</span> 
            Drag nodes to reposition • Scroll to zoom • Click and drag background to pan
          </p>
        </div>
        
        <div className="h-[600px]">
          <SocialGraphVisualization 
            width={800}
            height={600}
            className="rounded-md"
          />
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-sm text-forest/60 dark:text-gray-500">
          Data is fetched from Nostr relays and updated periodically. Last update: <span className="font-mono">{lastUpdate}</span>
        </p>
        <p className="text-sm text-forest/60 dark:text-gray-500 mt-1">
          Profile images are from Nostr profiles. Hover over nodes to see full Npub.
        </p>
      </div>
    </div>
  )
} 