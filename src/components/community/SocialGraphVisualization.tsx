'use client'

import React, { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { GraphNode, GraphLink } from '../../types';
import { preloadImages, handleNodeClick } from '../../utils/graphUtils';
import { BRAND_COLORS } from '../../constants/brandColors';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false })

interface SocialGraphVisualizationProps {
  data: {
    nodes: GraphNode[]
    links: GraphLink[]
  }
  width: number
  height?: number
}

export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  data,
  width,
  height
}) => {
  // State to hold preloaded images
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const graphRef = useRef<any>(null)
  
  // Determine responsive height based on screen size
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)')
  
  const responsiveHeight = isMobile ? 400 : isTablet ? 600 : 800
  const actualHeight = height || responsiveHeight

  // Handle zoom behavior for the graph on mobile
  useEffect(() => {
    if (!graphRef.current || !isMobile) return
    
    const graphElem = graphRef.current?._toolbarElem?.parentElement
    if (!graphElem) return
    
    const handleTouchStart = (e: TouchEvent) => {
      // Allow pinch zoom (two fingers)
      if (e.touches.length >= 2) return
      
      // Prevent panning with single finger to make page scrolling easier
      e.preventDefault()
    }
    
    graphElem.addEventListener('touchstart', handleTouchStart, { passive: false })
    
    return () => {
      graphElem.removeEventListener('touchstart', handleTouchStart)
    }
  }, [isMobile, graphRef.current])

  // Use the shared preloadImages function instead of the duplicate one
  useEffect(() => {
    if (data && data.nodes && data.nodes.length > 0) {
      setIsLoadingImages(true);
      
      const imageMap = new Map<string, HTMLImageElement>();
      
      // Create a function to update the nodeImages state when images are loaded
      const handleImagesLoaded = () => {
        setNodeImages(imageMap);
        setIsLoadingImages(false);
        console.log(`Successfully loaded ${imageMap.size} images`);
      };
      
      // Create a function to handle errors
      const handleImageError = (error: any) => {
        console.error('Error preloading images:', error);
        setIsLoadingImages(false);
      };
      
      // Process nodes with pictures and npub
      const nodesWithImages = data.nodes.filter(node => 
        node.picture && node.npub && typeof node.npub === 'string'
      );
      
      // Create a custom preload function that updates our local imageMap
      const customPreload = (nodes: GraphNode[], onLoad: () => void, onError: (error: any) => void) => {
        let loadedImages = 0;
        let validNodes = 0;
        
        nodes.forEach((node) => {
          if (node.picture && node.npub) {
            validNodes++;
            const img = new Image();
            img.src = node.picture;
            img.onload = () => {
              if (node.npub) {
                imageMap.set(node.npub, img);
              }
              loadedImages += 1;
              if (loadedImages === validNodes) {
                onLoad();
              }
            };
            img.onerror = onError;
          }
        });
        
        if (validNodes === 0) {
          onLoad();
        }
      };
      
      // Use our custom preload function
      customPreload(nodesWithImages, handleImagesLoaded, handleImageError);
    }
  }, [data]);

  // Add proper data validation
  useEffect(() => {
    if (!data || !data.nodes || !data.links) {
      console.error('Invalid graph data provided to SocialGraphVisualization');
      return;
    }
  }, [data]);
  
  // Add error boundary
  const [renderError, setRenderError] = useState<string | null>(null);
  
  if (renderError) {
    return (
      <div className="p-4 border border-red-500 rounded bg-red-100 text-red-800">
        <h3 className="font-bold">Error rendering social graph</h3>
        <p>{renderError}</p>
      </div>
    );
  }
  
  if (!data || !data.nodes || !data.links) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>No graph data available</p>
      </div>
    );
  }

  console.log(`Rendering social graph with ${data?.nodes?.length || 0} nodes and ${data?.links?.length || 0} links`)

  // Ensure node.npub is defined before using it
  const handleNodeClickWrapper = (node: any, event: MouseEvent) => {
    if (node.npub && typeof node.npub === 'string') {
      handleNodeClick(node as GraphNode);
    }
  };

  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={data}
      nodeColor={(node: any) => node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand}
      nodeVal={(node: any) => node.isCoreNode ? 10 : 5}
      linkColor={(link: any) => link.type === 'mutual' ? BRAND_COLORS.forestGreen : '#adb5bd'}
      linkWidth={(link: any) => Math.sqrt(link.value || 1)}
      onNodeClick={handleNodeClickWrapper}
      width={width}
      height={actualHeight}
      backgroundColor="transparent"
      nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const nodeSize = node.isCoreNode ? 10 : 5
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
            ctx.strokeStyle = node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.deepBlue
            ctx.lineWidth = 1.5
            ctx.stroke()
            
            ctx.restore()
          } catch (err) {
            // Fallback to circle if image drawing fails
            console.warn('Failed to draw node image, falling back to circle', err)
            ctx.beginPath()
            ctx.fillStyle = node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand
            ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
            ctx.fill()
          }
        } else {
          // Fallback to plain circle if no image
          ctx.beginPath()
          ctx.fillStyle = node.isCoreNode ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand
          ctx.arc(node.x as number, node.y as number, nodeSize, 0, 2 * Math.PI)
          ctx.fill()
        }
        
        // Draw node label if we're zoomed in enough
        const label = node.name || (node.npub ? `${node.npub.substring(0, 6)}...` : node.id)
        if (globalScale > 1.5) {
          ctx.font = '8px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = BRAND_COLORS.lightSand
          ctx.strokeStyle = BRAND_COLORS.deepBlue
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