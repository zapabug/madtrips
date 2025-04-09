'use client';

/**
 * Community Page - Showcases the Bitcoin Madeira community connections and activity.
 * Uses shared hooks for efficient data fetching and caching.
 */

import { useNostrGraph } from '../../hooks/useNostrGraph';
import { useCachedProfiles } from '../../hooks/useCachedProfiles';
import { CommunityFeed, MadeiraFeed } from '../../components/community';
import { CORE_NPUBS } from '../../constants/nostr';
import SocialGraph from '../../components/community/graph/SocialGraph';
import { GridGraph } from '../../components/community/graph';
import LoadingAnimation from '../../components/ui/LoadingAnimation';
import Section from '../../components/ui/Section';
import { useEffect, useState } from 'react';

export default function CommunityPage() {
  // Debug state for graph visualization
  const [graphDebugInfo, setGraphDebugInfo] = useState<string | null>(null);
  
  // Use the shared graph hook to fetch social connections
  const { 
    graphData,
    npubsInGraph, 
    loading: graphLoading, 
    error: graphError,
    refresh: refreshGraph 
  } = useNostrGraph({
    coreNpubs: CORE_NPUBS,
    followsLimit: 10,
    followersLimit: 10,
    showMutuals: true
  });
  
  // Fetch profiles for all users in the graph
  const {
    profiles
  } = useCachedProfiles(npubsInGraph, {
    minimalProfile: true,  // Only fetch minimal profile data for graph
    batchSize: 20          // Increase batch size for faster fetching
  });

  // Debug log for graph data
  useEffect(() => {
    if (graphData) {
      console.log('Graph data loaded:', 
        `${graphData.nodes.length} nodes, ${graphData.links.length} links`);
      setGraphDebugInfo(`Graph data loaded at ${new Date().toLocaleTimeString()}`);
    }
  }, [graphData]);
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Bitcoin Madeira Community</h1>
      
      <div className="space-y-12">
        {/* Madeira Image Feed section */}
        <Section 
          title="Madeira Moments"
          description="Photos shared by the Madeira Bitcoin community and their connections. This feed shows images with #madeira related hashtags from your network."
        >
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="h-[400px] flex items-center justify-center">
              <div className="w-full max-w-2xl h-full">
                <MadeiraFeed 
                  profilesMap={profiles} 
                  initialCount={30}
                  maxCached={150}
                />
              </div>
            </div>
          </div>
        </Section>
        
        {/* Web of Trust visualization section */}
        <Section
          title="Community Connections"
          description="Explore the Bitcoin Madeira web of trust - visualizing connections between community members and their extended networks."
        >
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex flex-col space-y-4">
              {/* Network stats with debug info */}
              <div className="text-sm font-medium mb-2 flex justify-between">
                <span>
                  <span className="font-bold">Network:</span> {graphData?.nodes.length || 0} members, {graphData?.links.length || 0} connections
                </span>
                {graphDebugInfo && (
                  <span className="text-xs text-gray-500">{graphDebugInfo}</span>
                )}
              </div>
              
              {/* Main content */}
              <div className="flex flex-col space-y-6">
                {/* Graph visualization - using SocialGraph directly */}
                <div className="h-[600px] bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Interactive Network</h3>
                    <span className="text-xs text-gray-500">Experimental Feature</span>
                  </div>
                  <div className="h-full w-full relative flex items-center justify-center">
                    <SocialGraph 
                      graphData={graphData}
                      profiles={profiles}
                      loading={graphLoading}
                      error={graphError}
                      onRefresh={refreshGraph}
                      className="w-full h-full"
                    />
                    
                    {/* Message explaining how to use the graph */}
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-2 rounded max-w-xs">
                      <p>Click and drag to move. Scroll to zoom. Click nodes to focus.</p>
                    </div>
                  </div>
                </div>
                
                {/* Profile grid - now using the GridGraph component */}
                <GridGraph
                  graphData={graphData}
                  profiles={profiles}
                  maxNodes={50}
                />
              </div>
            </div>
          </div>
        </Section>
        
        {/* Community Feed section */}
        <Section
          title="Community Feed"
          description="Notes with images from Bitcoin Madeira community members. A visual representation of community conversations and shared moments."
        >
          <CommunityFeed 
            npubs={npubsInGraph} 
            limit={30}
          />
        </Section>
      </div>
    </div>
  )
} 