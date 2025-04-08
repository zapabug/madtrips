'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useNostr } from '../../../lib/contexts/NostrContext';
import { GraphNode, GraphLink, GraphData } from '../../../types/graph-types';
import { BRAND_COLORS } from '../../../constants/brandColors';
import { nip19 } from 'nostr-tools';
import { CORE_NPUBS } from '../../../constants/nostr';
import { getRandomLoadingMessage } from '../../../constants/loadingMessages';
import * as d3 from 'd3';
import useCache from '../../../hooks/useCache';
import GraphControls from './GraphControls';
import GraphRenderer from './GraphRenderer';
import { useSocialGraph } from '../../../hooks/useSocialGraph';
import { shortenNpub } from '../../../utils/profileUtils';
import RelayService from '../../../lib/services/RelayService';

// Dynamically import the ForceGraph2D component with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then(mod => mod.default), { ssr: false });

// Define interface for the props
interface SocialGraphProps {
  // Primary NPUB to center the graph on (optional, defaults to first core NPUB)
  centerNpub?: string;
  // Additional NPUBs to include (optional, defaults to CORE_NPUBS)
  npubs?: string[];
  // Maximum connections to display per node
  maxConnections?: number;
  // Height of the graph container
  height?: number | string;
  // Width of the graph container
  width?: number | string;
  // Custom class names
  className?: string;
  // Whether to show second-degree connections (default: false)
  showSecondDegree?: boolean;
  // Enable continuous loading from relays
  continuousLoading?: boolean;
  // Default number of second-degree connections per node
  defaultMaxSecondDegreeConnections?: number;
}

/**
 * SocialGraph component for visualizing Nostr social connections
 */
const SocialGraph = React.memo<SocialGraphProps>(({
  centerNpub = CORE_NPUBS[0],
  npubs = CORE_NPUBS,
  maxConnections = 25,
  height = 600,
  width = '100%',
  className = '',
  showSecondDegree: initialShowSecondDegree = false,
  continuousLoading = false,
  defaultMaxSecondDegreeConnections = 10,
}) => {
  // Get context values
  const { ndk, getUserProfile, ndkReady, getConnectedRelays, isLoggedIn, user } = useNostr();
  const cache = useCache();
  
  // State
  const [showSecondDegree, setShowSecondDegree] = useState(initialShowSecondDegree);
  const [maxSecondDegreeConnections, setMaxSecondDegreeConnections] = useState(defaultMaxSecondDegreeConnections);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [profilesLoaded, setProfilesLoaded] = useState(0);
  const [relayCount, setRelayCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const forceGraphRef = useRef<any>(null);
  const subscriptions = useRef<(() => void)[]>([]);
  
  // Create a memoized version of the npub array with centerNpub always included
  const effectiveNpubs = useMemo(() => 
    Array.from(new Set([...npubs, centerNpub])), 
    [npubs, centerNpub]
  );
  
  // Use the custom hook to fetch social graph data
  const { 
    graph, 
    loading, 
    error, 
    refresh, 
    followUser,
    unfollowUser,
    isUserFollowing 
  } = useSocialGraph({
    npubs: effectiveNpubs,
    centerNpub,
    maxConnections,
    showSecondDegree,
    continuousLoading,
    maxSecondDegreeNodes: maxSecondDegreeConnections
  });
  
  // Update loading message during loading
  useEffect(() => {
    if (loading && !error) {
      const interval = setInterval(() => {
        setLoadingMessage(getRandomLoadingMessage());
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [loading, error]);
  
  // Update relay count when relays change
  useEffect(() => {
    const updateRelayCount = () => {
      const relays = getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    updateRelayCount();
    const unsubscribe = RelayService.onStatusUpdate(relays => {
      setRelayCount(relays.length);
    });
    
    return () => unsubscribe();
  }, [getConnectedRelays]);
  
  // When selectedNode changes, check if the logged-in user is following them
  useEffect(() => {
    if (!selectedNode || !isLoggedIn || !user) {
      setIsFollowing(false);
      return;
    }
    
    const checkFollowing = async () => {
      setIsFollowingLoading(true);
      try {
        const isFollowing = await isUserFollowing(user.pubkey, selectedNode.pubkey);
        setIsFollowing(isFollowing);
      } catch (error) {
        console.error('Error checking following status:', error);
        setIsFollowing(false);
      } finally {
        setIsFollowingLoading(false);
      }
    };
    
    checkFollowing();
  }, [selectedNode, isLoggedIn, user, isUserFollowing]);
  
  // Force refresh the graph
  const forceRefresh = useCallback(async () => {
    if (loading) return;
    
    setIsRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Error refreshing graph:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loading, refresh]);
  
  // Handle follow/unfollow actions
  const handleFollowToggle = useCallback(async () => {
    if (!selectedNode || !isLoggedIn || !user || isFollowingLoading) return;
    
    setIsFollowingLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(user.pubkey, selectedNode.pubkey);
        setIsFollowing(false);
      } else {
        await followUser(user.pubkey, selectedNode.pubkey);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsFollowingLoading(false);
    }
  }, [selectedNode, isLoggedIn, user, isFollowingLoading, isFollowing, unfollowUser, followUser]);
  
  // Handle when user changes the showSecondDegree option
  const handleToggleSecondDegree = useCallback(() => {
    setShowSecondDegree(prev => !prev);
  }, []);

  // Handle changes to the max connections slider
  const handleMaxConnectionsChange = useCallback((value: number) => {
    setMaxSecondDegreeConnections(value);
  }, []);
  
  // Add useEffect to refresh the graph when maxSecondDegreeConnections changes
  useEffect(() => {
    if (graph && showSecondDegree) {
      // Only refresh if we already have a graph and second degree connections are enabled
      forceRefresh();
    }
  }, [maxSecondDegreeConnections, showSecondDegree]);
  
  // Add additional debug information to help track performance
  useEffect(() => {
    console.log(`Graph rendering with ${graph?.nodes.length || 0} nodes and ${graph?.links.length || 0} links`);
    console.log(`Max second degree connections: ${maxSecondDegreeConnections}`);
  }, [graph, maxSecondDegreeConnections]);
  
  // Display loading message or error if necessary
  if (loading && !graph) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 ${className}`} style={{ height }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin mb-4"></div>
        <p className="text-center text-lg">{loadingMessage || 'Loading social graph...'}</p>
        <p className="text-center text-sm mt-2">Connected to {relayCount} relays</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 ${className}`} style={{ height }}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <button 
            className="mt-3 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            onClick={forceRefresh}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Render the graph
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Graph Controls */}
      <GraphControls 
        showSecondDegree={showSecondDegree}
        onToggleSecondDegree={handleToggleSecondDegree}
        onRefresh={forceRefresh}
        isRefreshing={isRefreshing}
        selectedNode={selectedNode}
        onFollowToggle={handleFollowToggle}
        isFollowing={isFollowing}
        isFollowingLoading={isFollowingLoading}
        isLoggedIn={isLoggedIn}
        relayCount={relayCount}
        maxSecondDegreeConnections={maxSecondDegreeConnections}
        onMaxConnectionsChange={handleMaxConnectionsChange}
        onClearCache={() => {
          cache.clearCache('graph');
          forceRefresh();
        }}
      />
      
      {/* Graph Visualization */}
      {graph && (
        <GraphRenderer
          graph={graph}
          height={height}
          width={width}
          onNodeClick={(node: GraphNode) => setSelectedNode(node)}
          selectedNode={selectedNode}
          centerNodeId={centerNpub}
        />
      )}
    </div>
  );
});

SocialGraph.displayName = 'SocialGraph';

export default SocialGraph;