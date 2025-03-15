'use client'

import { useState, useEffect } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import SocialGraphAdmin from './SocialGraphAdmin'

export const metadata: Metadata = {
  title: 'Social Graph Admin | MadTrips',
  description: 'Admin controls for Nostr social graph data collection.'
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [lastUpdate, setLastUpdate] = useState<string>('Unknown')
  const [nodeCount, setNodeCount] = useState<number>(0)
  const [linkCount, setLinkCount] = useState<number>(0)
  const [newNpub, setNewNpub] = useState<string>('')
  const [isAddingNpub, setIsAddingNpub] = useState(false)

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [])

  // Function to fetch current stats
  const fetchStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/socialgraph')
      if (response.ok) {
        const data = await response.json()
        if (data.timestamp) {
          setLastUpdate(new Date(data.timestamp).toLocaleString())
        }
        setNodeCount(data.nodes?.length || 0)
        setLinkCount(data.links?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      setStatusMessage('Error fetching social graph stats.')
    } finally {
      setLoading(false)
    }
  }

  // Function to force update of the social graph
  const handleForceUpdate = async () => {
    setLoading(true)
    setStatusMessage('Updating social graph data...')
    try {
      const response = await fetch('/api/socialgraph?update=true')
      if (response.ok) {
        const data = await response.json()
        setStatusMessage('Social graph updated successfully!')
        if (data.timestamp) {
          setLastUpdate(new Date(data.timestamp).toLocaleString())
        }
        setNodeCount(data.nodeCount || 0)
        setLinkCount(data.linkCount || 0)
      } else {
        setStatusMessage('Error updating social graph.')
      }
    } catch (error) {
      console.error('Error updating social graph:', error)
      setStatusMessage('Error updating social graph.')
    } finally {
      setLoading(false)
    }
  }

  // Function to add a new npub
  const handleAddNpub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNpub.trim() || !newNpub.startsWith('npub1')) {
      setStatusMessage('Please enter a valid npub starting with npub1.')
      return
    }

    setIsAddingNpub(true)
    setStatusMessage(`Adding ${newNpub} to tracking...`)
    
    try {
      const response = await fetch('/api/socialgraph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ npub: newNpub }),
      })

      if (response.ok) {
        setStatusMessage(`Added ${newNpub} successfully!`)
        setNewNpub('')
        await fetchStats()
      } else {
        setStatusMessage('Error adding npub.')
      }
    } catch (error) {
      console.error('Error adding npub:', error)
      setStatusMessage('Error adding npub.')
    } finally {
      setIsAddingNpub(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24 bg-sand/10 dark:bg-gray-900">
      <div className="z-10 max-w-5xl w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-forest dark:text-white mb-2">
              Nostr Social Graph Admin
            </h1>
            <p className="text-forest/70 dark:text-gray-400">
              Manage and monitor the Nostr social graph data collection process.
            </p>
          </div>
          
          <Link 
            href="/community" 
            className="mt-4 md:mt-0 px-4 py-2 bg-forest text-white rounded-md hover:bg-forest/90 transition-colors"
          >
            View Community Page
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <SocialGraphAdmin />
        </div>
        
        <div className="mt-12 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-forest dark:text-white mb-4">
              About Nostr Social Graph Collection
            </h2>
            <div className="prose dark:prose-invert">
              <p>
                This tool collects Nostr social graph data by:
              </p>
              <ol>
                <li>Fetching follows data for known "core" members (Free Madeira community members)</li>
                <li>Collecting interactions (mentions, likes, zaps) between users</li>
                <li>Storing profile metadata for visualization</li>
              </ol>
              <p>
                The data is stored in JSON format and can be switched to SQLite in the future if needed.
                All data comes from the public Nostr network and is updated periodically.
              </p>
              <p>
                The social graph visualization shows relationships between users with:
              </p>
              <ul>
                <li><strong>Core members</strong> (purple): Free Madeira and key community members</li>
                <li><strong>Followers</strong> (blue): Users who follow core members</li>
                <li><strong>Following</strong> (green): Users who are followed by core members</li>
                <li><strong>Mutual</strong> (amber): Users with mutual follows with core members</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-forest dark:text-white mb-4">
              How to Use
            </h2>
            <div className="prose dark:prose-invert">
              <p>
                To manage the social graph data collection:
              </p>
              <ul>
                <li><strong>Force Update</strong>: Manually trigger a full data collection run.</li>
                <li><strong>Add Core Member</strong>: Add a new Nostr user as a core member (Free Madeira community).</li>
                <li><strong>View Logs</strong>: Monitor the data collection process for any issues.</li>
                <li><strong>Raw Data</strong>: Inspect the raw data for debugging purposes.</li>
              </ul>
              <p>
                For automated collection, you can set up a cron job to hit the <code>/api/socialgraph?update=true</code> endpoint.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 