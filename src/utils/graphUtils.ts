import { GraphNode } from '../types';

/**
 * Preloads images for graph nodes with better error handling
 * @param nodes Array of graph nodes
 * @param onLoad Callback when all images are loaded
 * @param onError Callback when an error occurs
 */
export const preloadImages = (nodes: GraphNode[], onLoad: () => void, onError: (error: any) => void) => {
  let loadedImages = 0;
  let validNodes = 0;
  
  // If there are no nodes, call onLoad immediately
  if (!nodes || nodes.length === 0) {
    console.log('No nodes to preload images for');
    onLoad();
    return;
  }
  
  try {
    // Filter nodes that have both picture and npub
    const nodesWithImages = nodes.filter(node => 
      node && node.picture && typeof node.picture === 'string' && 
      node.picture.trim() !== '' && node.picture.startsWith('http')
    );
    
    validNodes = nodesWithImages.length;
    
    // If no valid nodes with images, call onLoad immediately
    if (validNodes === 0) {
      console.log('No valid nodes with images to preload');
      onLoad();
      return;
    }
    
    console.log(`Preloading ${validNodes} images...`);
    
    // Process each node with an image
    nodesWithImages.forEach((node) => {
      const img = new Image();
      
      // Set crossOrigin to anonymous to avoid CORS issues
      img.crossOrigin = 'anonymous';
      
      // Handle successful image load
      img.onload = () => {
        loadedImages += 1;
        if (loadedImages === validNodes) {
          console.log(`Successfully preloaded ${loadedImages} images`);
          onLoad();
        }
      };
      
      // Handle image loading error
      img.onerror = (err) => {
        console.warn(`Failed to load image for node: ${node.id || 'unknown'}`, err);
        loadedImages += 1;
        if (loadedImages === validNodes) {
          console.log(`Finished preloading with ${loadedImages} images (some may have failed)`);
          onLoad();
        }
      };
      
      // Set a timeout to handle cases where the image might hang
      const timeout = setTimeout(() => {
        console.warn(`Image load timeout for node: ${node.id || 'unknown'}`);
        if (img.complete) return;
        
        // Cancel the image loading
        img.src = '';
        loadedImages += 1;
        if (loadedImages === validNodes) {
          console.log(`Finished preloading with ${loadedImages} images (some timed out)`);
          onLoad();
        }
      }, 5000); // 5 second timeout
      
      // Start loading the image
      try {
        img.src = node.picture as string;
      } catch (err) {
        console.error('Error setting image source:', err);
        clearTimeout(timeout);
        loadedImages += 1;
        if (loadedImages === validNodes) {
          onLoad();
        }
      }
    });
  } catch (err) {
    console.error('Error in preloadImages:', err);
    onError(err);
    onLoad(); // Still call onLoad to prevent UI from being stuck
  }
};

export const handleNodeClick = (node: GraphNode) => {
  if (node.npub) {
    window.open(`https://njump.me/${node.npub}`, '_blank');
  }
}; 