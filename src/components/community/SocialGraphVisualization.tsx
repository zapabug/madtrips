'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false })

// Types for the visualization
interface Node {
  id: string
  name?: string
  npub: string
  type: string
  picture?: string
  x?: number
  y?: number
  color?: string
  val?: number
}

interface Link {
  source: string | { id: string }
  target: string | { id: string }
  value?: number
  color?: string
}

interface SocialGraphVisualizationProps {
  data: {
    nodes: Node[]
    links: Link[]
  }
  width: number
  height: number
}

export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  data,
  width,
  height
}) => {
  // State to hold preloaded images
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  // Preload images for better rendering
  useEffect(() => {
    const preloadImages = async () => {
      console.log('Preloading images for nodes:', data.nodes.length)
      setIsLoadingImages(true)
      
      const imageMap = new Map<string, HTMLImageElement>()
      const imagePromises: Promise<void>[] = []

      // Process nodes with pictures
      data.nodes.forEach(node => {
        if (node.picture && node.npub) {
          const img = new Image()
          
          const promise = new Promise<void>((resolve) => {
            img.onload = () => {
              imageMap.set(node.npub, img)
              resolve()
            }
            img.onerror = () => {
              console.warn(`Failed to load image for ${node.npub}`)
              resolve()
            }
          })
          
          img.src = node.picture
          imagePromises.push(promise)
        }
      })

      try {
        await Promise.all(imagePromises)
        console.log(`Successfully loaded ${imageMap.size} images`)
      } catch (err) {
        console.error('Error preloading images:', err)
      } finally {
        setNodeImages(imageMap)
        setIsLoadingImages(false)
      }
    }

    if (data && data.nodes && data.nodes.length > 0) {
      preloadImages()
    }
  }, [data])

  // Handle node click
  const handleNodeClick = (node: any, event: MouseEvent) => {
    console.log('Node clicked:', node)
    
    // Open the Nostr profile in njump.me
    if (node.npub && node.npub.startsWith('npub')) {
      const url = `https://njump.me/${node.npub}`
      window.open(url, '_blank')
    }
  }

  console.log(`Rendering social graph with ${data?.nodes?.length || 0} nodes and ${data?.links?.length || 0} links`)

  return (
    <ForceGraph2D
      graphData={data}
      nodeColor={(node: any) => node.color || '#1a8bf7'}
      nodeVal={(node: any) => node.val || 5}
      linkColor={(link: any) => link.color || '#cccccc'}
      linkWidth={(link: any) => Math.sqrt(link.value || 1)}
      onNodeClick={handleNodeClick}
      width={width}
      height={height}
      nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const nodeSize = node.val || 5
        const imageSource = nodeImages.get(node.npub)
        
        // Draw the node - with profile image if available
        if (imageSource) {
          try {
            // Create circular clipping path
            ctx.save()
            ctx.beginPath()
            ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
            ctx.clip()
            
            // Draw the profile image
            const imgSize = nodeSize * 2
            ctx.drawImage(
              imageSource,
              (node.x as number) - nodeSize,
              (node.y as number) - nodeSize,
              imgSize,
              imgSize
            )
            
            // Draw a border
            ctx.beginPath()
            ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
            ctx.strokeStyle = node.color || '#1a8bf7'
            ctx.lineWidth = 1.5
            ctx.stroke()
            
            ctx.restore()
          } catch (err) {
            // Fallback to circle if image drawing fails
            console.warn('Failed to draw node image, falling back to circle', err)
            ctx.beginPath()
            ctx.fillStyle = node.color || '#1a8bf7'
            ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
            ctx.fill()
          }
        } else {
          // Fallback to plain circle if no image
          ctx.beginPath()
          ctx.fillStyle = node.color || '#1a8bf7'
          ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
          ctx.fill()
        }
        
        // Draw node label if we're zoomed in enough
        const label = node.name || (node.npub ? `${node.npub.substring(0, 6)}...` : node.id)
        if (globalScale > 1.5) {
          ctx.font = '8px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#000'
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          
          // Draw text outline for better visibility
          ctx.strokeText(label, node.x as number, (node.y as number) + nodeSize + 8)
          ctx.fillText(label, node.x as number, (node.y as number) + nodeSize + 8)
        }
      }}
      cooldownTicks={100}
    />
  )
} 