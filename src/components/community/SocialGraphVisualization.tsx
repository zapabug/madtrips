'use client'

import React, { useState, useEffect } from 'react'
import { SocialGraph, clearAllGraphCaches } from './SocialGraph'
import { CORE_NPUBS } from './utils'
import { ClearGraphCache } from './ClearGraphCache'
import { useNostr } from '../../lib/contexts/NostrContext'
import { DEFAULT_RELAYS, getAllRelays, createRelay } from '../../constants/relays'

// Component props
interface SocialGraphVisualizationProps {
  height?: number | string
  width?: number | string
  className?: string
  title?: string
  description?: string
}

// Main component
export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  height = 600,
  width = '100%',
  className = '',
  title = 'Bitcoin Madeira Community Graph',
  description = 'Visual representation of connections between Bitcoin community members in Madeira.'
}) => {
  const { getConnectedRelays, reconnect, ndk } = useNostr();
  const [simplified, setSimplified] = useState(false); // Default to more connections
  const [showSecondDegree, setShowSecondDegree] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    
    // Update relay count when mounted
    if (typeof getConnectedRelays === 'function') {
      const relays = getConnectedRelays();
      setRelayCount(relays.length);
      
      // Set up interval to check relay count periodically
      const interval = setInterval(() => {
        const updatedRelays = getConnectedRelays();
        setRelayCount(updatedRelays.length);
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [getConnectedRelays]);
  
  // Toggle simplified view and clear cache to force refresh
  const toggleView = () => {
    clearAllGraphCaches(); // Force refresh of graph data when switching modes
    setSimplified(!simplified);
  };
  
  // Toggle second degree connections and clear cache to force refresh
  const toggleSecondDegree = () => {
    clearAllGraphCaches(); // Force refresh of graph data when switching modes
    setShowSecondDegree(!showSecondDegree);
  };
  
  // Function to connect to more relays
  const connectMoreRelays = async () => {
    setIsConnecting(true);
    
    try {
      // First try to reconnect to default relays
      await reconnect();
      
      // Then try to connect to all available relays
      if (ndk && ndk.pool) {
        const allRelays = getAllRelays();
        console.log(`Attempting to connect to ${allRelays.length} relays...`);
        
        // Connect to all relays in our list
        for (const relayUrl of allRelays) {
          // Only try to connect if not already connected
          if (!ndk.pool.relays.has(relayUrl)) {
            try {
              await ndk.pool.addRelay(createRelay(relayUrl));
              console.log(`Connected to relay: ${relayUrl}`);
            } catch (e) {
              console.warn(`Failed to connect to relay: ${relayUrl}`, e);
            }
          }
        }
        
        // Update relay count after connecting
        const updatedRelays = getConnectedRelays();
        setRelayCount(updatedRelays.length);
      }
    } catch (e) {
      console.error("Error connecting to relays:", e);
    } finally {
      setIsConnecting(false);
    }
  };
  
  if (!isClient) {
    return <div className="h-64 w-full flex items-center justify-center">Loading graph...</div>;
  }
  
  // Get relay count color based on the number of connected relays
  const getRelayCountColor = () => {
    if (relayCount < 3) return '#ff3333'; // Red
    if (relayCount < 6) return '#ffcc00'; // Yellow
    return '#00ff44'; // Neon green
  };
  
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      role="figure" 
      aria-label="Community connections"
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={toggleView}
          className="px-2 py-1 bg-forest text-white text-sm rounded hover:bg-forest/80 transition-colors"
        >
          {simplified ? 'More' : 'Default'}
        </button>
        <button
          onClick={toggleSecondDegree}
          className="px-2 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          {showSecondDegree ? 'Hide Extended Network' : 'Show Extended Network'}
        </button>
        <ClearGraphCache buttonText="Clear Cache" />
      </div>
      
      {/* Discrete relay count indicator in bottom left */}
      <div 
        className="absolute bottom-2 left-2 z-10 text-xs font-mono font-bold"
        style={{ color: getRelayCountColor() }}
      >
        {relayCount}
      </div>
      
      {/* Connect more relays button in bottom right */}
      <button
        onClick={connectMoreRelays}
        disabled={isConnecting}
        className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-full bg-forest text-white flex items-center justify-center text-sm font-bold hover:bg-forest/80 transition-colors disabled:opacity-50 shadow"
        title="Connect to more relays"
      >
        {isConnecting ? '...' : '+'}
      </button>
      
      <SocialGraph 
        height={height} 
        width={width}
        className={className}
        npubs={CORE_NPUBS}
        maxConnections={simplified ? 5 : 15}
        showSecondDegree={showSecondDegree}
        key={`${simplified ? 'simple' : 'detailed'}-${showSecondDegree ? 'extended' : 'basic'}`} // Force remount when toggling
      />
    </div>
  )
} 