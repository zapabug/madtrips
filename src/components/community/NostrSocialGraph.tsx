'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the ForceGraph component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false })

interface NostrSocialGraphProps {
  npub: string
  maxConnections?: number
}

interface NostrProfile {
  id: string
  name?: string
  displayName?: string
  picture?: string
  about?: string
  followers: string[]
  following: string[]
}

interface GraphNode {
  id: string
  name: string
  val: number
  color: string
  img?: string
  isCenter?: boolean
  nodeType?: 'profile' | 'follower' | 'following'
}

interface GraphLink {
  source: string
  target: string
  type: 'follows' | 'followed_by'
  color: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function NostrSocialGraph({ npub, maxConnections = 30 }: NostrSocialGraphProps) {
  const [profile, setProfile] = useState<NostrProfile | null>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch and prepare mock data
  useEffect(() => {
    setLoading(true)
    
    // This would be replaced with actual Nostr API calls in production
    setTimeout(() => {
      try {
        // Different mock profiles based on npub
        let mockProfile: NostrProfile
        
        if (npub === 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh') {
          mockProfile = {
            id: npub,
            name: 'Free Madeira',
            displayName: 'Free Madeira Bitcoin Community',
            picture: 'https://pbs.twimg.com/profile_images/1678406730153041920/N58LQ9o-_400x400.jpg',
            about: 'Building a Bitcoin economy in Madeira',
            followers: Array.from({ length: 25 }, (_, i) => `follower_${i}_${Math.random().toString(36).substring(7)}`),
            following: Array.from({ length: 18 }, (_, i) => `following_${i}_${Math.random().toString(36).substring(7)}`)
          }
        } else if (npub === 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e') {
          mockProfile = {
            id: npub,
            name: 'Bitcoin Madeira',
            displayName: 'Bitcoin Madeira Explorer',
            picture: 'https://www.madbitcoin.org/wp-content/uploads/2023/11/mad-bitcoin.jpg',
            about: 'Exploring Bitcoin adoption in Madeira and beyond',
            followers: Array.from({ length: 42 }, (_, i) => `follower_${i}_${Math.random().toString(36).substring(7)}`),
            following: Array.from({ length: 31 }, (_, i) => `following_${i}_${Math.random().toString(36).substring(7)}`)
          }
        } else {
          // Generic profile for any other npub
          mockProfile = {
            id: npub,
            name: 'Nostr User',
            displayName: 'Bitcoin Community Member',
            picture: 'https://bitcoin.org/img/icons/opengraph.png',
            about: 'A member of the Bitcoin community',
            followers: Array.from({ length: 15 }, (_, i) => `follower_${i}_${Math.random().toString(36).substring(7)}`),
            following: Array.from({ length: 20 }, (_, i) => `following_${i}_${Math.random().toString(36).substring(7)}`)
          }
        }
        
        setProfile(mockProfile)
        
        // Create graph data
        const nodes: GraphNode[] = [
          {
            id: mockProfile.id,
            name: mockProfile.name || 'Nostr User',
            val: 25,
            color: '#F7931A', // Bitcoin orange
            img: mockProfile.picture,
            isCenter: true,
            nodeType: 'profile'
          }
        ]
        
        const links: GraphLink[] = []
        
        // Add follower nodes
        const displayedFollowers = mockProfile.followers.slice(0, maxConnections)
        displayedFollowers.forEach((followerId, i) => {
          const followingThisPerson = Math.random() > 0.7
          
          // Add node
          nodes.push({
            id: followerId,
            name: `Follower ${i + 1}`,
            val: 10,
            color: '#1E3A8A', // Ocean blue
            nodeType: 'follower'
          })
          
          // Add link
          links.push({
            source: followerId,
            target: mockProfile.id,
            type: 'follows',
            color: 'rgba(30, 58, 138, 0.5)' // Ocean blue
          })
          
          // If they also follow this person
          if (followingThisPerson) {
            links.push({
              source: mockProfile.id,
              target: followerId,
              type: 'follows',
              color: 'rgba(15, 76, 53, 0.5)' // Forest green
            })
          }
        })
        
        // Add following nodes
        const displayedFollowing = mockProfile.following.slice(0, maxConnections)
        displayedFollowing.forEach((followingId, i) => {
          const followsBack = Math.random() > 0.6
          
          // Check if this node already exists (mutual connection)
          const existingNode = nodes.find(node => node.id === followingId)
          
          if (!existingNode) {
            // Add node
            nodes.push({
              id: followingId,
              name: `Following ${i + 1}`,
              val: 10,
              color: '#0F4C35', // Forest green
              nodeType: 'following'
            })
          } else if (existingNode.nodeType === 'follower') {
            // It's a mutual connection, update the color
            existingNode.color = '#9333EA' // Purple for mutual connections
          }
          
          // Add link (if not already added for mutuals)
          const existingLink = links.find(link => 
            link.source === mockProfile.id && link.target === followingId
          )
          
          if (!existingLink) {
            links.push({
              source: mockProfile.id,
              target: followingId,
              type: 'follows',
              color: 'rgba(15, 76, 53, 0.5)' // Forest green
            })
          }
          
          // If they also follow back (and not already captured as a follower)
          if (followsBack && !links.find(link => link.source === followingId && link.target === mockProfile.id)) {
            links.push({
              source: followingId,
              target: mockProfile.id,
              type: 'follows',
              color: 'rgba(30, 58, 138, 0.5)' // Ocean blue
            })
          }
        })
        
        setGraphData({ nodes, links })
        setLoading(false)
      } catch (err) {
        setError('Failed to load Nostr profile data')
        setLoading(false)
      }
    }, 1000)
  }, [npub, maxConnections])
  
  // Node click handler
  const handleNodeClick = (node: GraphNode) => {
    window.open(`https://njump.me/${node.id}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin mx-auto"></div>
          <p className="mt-4 text-forest dark:text-gray-300">Loading Nostr social graph...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="text-center text-red-500 dark:text-red-400 p-6">
          <p className="text-lg font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }
  
  if (!profile) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="text-center text-forest dark:text-gray-300 p-6">
          <p>No profile data found</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center mb-6">
          {profile.picture && (
            <img 
              src={profile.picture} 
              alt={profile.displayName || profile.name || 'Nostr profile'} 
              className="w-16 h-16 rounded-full mr-4 border-2 border-bitcoin"
            />
          )}
          <div>
            <h2 className="text-xl font-bold text-forest dark:text-white">
              {profile.displayName || profile.name || 'Nostr User'}
            </h2>
            {profile.about && (
              <p className="text-forest/80 dark:text-gray-400">{profile.about}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-4 mb-6 text-sm">
          <div className="bg-sand/20 dark:bg-gray-700 px-3 py-1 rounded-full">
            <span className="font-semibold text-forest dark:text-white">{profile.followers.length}</span>
            <span className="ml-1 text-forest/70 dark:text-gray-400">followers</span>
          </div>
          <div className="bg-sand/20 dark:bg-gray-700 px-3 py-1 rounded-full">
            <span className="font-semibold text-forest dark:text-white">{profile.following.length}</span>
            <span className="ml-1 text-forest/70 dark:text-gray-400">following</span>
          </div>
        </div>
        
        <div className="relative h-96 w-full border border-sand/20 dark:border-gray-700 rounded-lg overflow-hidden">
          {graphData.nodes.length > 0 && (
            <ForceGraph2D
              graphData={graphData}
              nodeLabel={(node: any) => node.name}
              nodeColor={(node: any) => node.color}
              nodeVal={(node: any) => node.val}
              linkColor={(link: any) => link.color}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              backgroundColor={document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff'}
              onNodeClick={handleNodeClick}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const size = node.val
                const label = node.name
                const fontSize = 12/globalScale
                const img = node.img
                
                // Background circle
                ctx.beginPath()
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
                ctx.fillStyle = node.color
                ctx.fill()
                
                // Image (only for the center node)
                if (img && node.isCenter) {
                  const size = 2 * node.val
                  const image = new Image()
                  image.src = img
                  
                  // Only draw if image is loaded
                  if (image.complete) {
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, size * 0.9, 0, 2 * Math.PI)
                    ctx.clip()
                    ctx.drawImage(image, node.x - size * 0.9, node.y - size * 0.9, size * 1.8, size * 1.8)
                    ctx.restore()
                  }
                }
                
                // Label
                if (globalScale > 0.9 || node.isCenter) {
                  ctx.font = `${fontSize}px Sans-Serif`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillStyle = 'white'
                  if (node.isCenter) {
                    ctx.fillText(label, node.x, node.y)
                  } else {
                    // Draw a background for better readability
                    const textWidth = ctx.measureText(label).width
                    ctx.fillStyle = 'rgba(0,0,0,0.6)'
                    ctx.fillRect(node.x - textWidth/2 - 2, node.y + size + 2, textWidth + 4, fontSize + 4)
                    ctx.fillStyle = 'white'
                    ctx.fillText(label, node.x, node.y + size + fontSize/2 + 4)
                  }
                }
              }}
              cooldownTicks={100}
              linkWidth={1}
              width={800}
              height={500}
            />
          )}
        </div>
        
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-bitcoin mr-2"></div>
            <span className="text-sm text-forest dark:text-gray-300">Profile</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-[#1E3A8A] mr-2"></div>
            <span className="text-sm text-forest dark:text-gray-300">Followers</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-[#0F4C35] mr-2"></div>
            <span className="text-sm text-forest dark:text-gray-300">Following</span>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <a 
            href={`https://njump.me/${npub}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-bitcoin text-white rounded-md hover:bg-bitcoin/90 transition-colors"
          >
            View on Nostr
          </a>
        </div>
      </div>
    </div>
  )
} 