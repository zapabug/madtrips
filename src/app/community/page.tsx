'use client';

/**
 * Community Page - Showcases the Bitcoin Madeira community connections and activity.
 * Uses shared hooks for efficient data fetching and caching.
 */

import { useNostrGraph } from '../../hooks/useNostrGraph';
import { useCachedProfiles } from '../../hooks/useCachedProfiles';
import { CommunityFeed, MadeiraFeed } from '../../components/community';
import { CORE_NPUBS } from '../../constants/nostr';
import SocialGraphVisualization from '../../components/community/graph/SocialGraphVisualization';
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
  } = useCachedProfiles(npubsInGraph);

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
            {graphLoading ? (
              <div className="flex flex-col items-center justify-center p-8">
                <LoadingAnimation category="GRAPH" size="large" showText={true} />
              </div>
            ) : graphError ? (
              <div className="flex flex-col items-center justify-center h-full text-red-500">
                <p>Error loading graph: {graphError}</p>
                <button 
                  onClick={refreshGraph}
                  className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Retry
                </button>
              </div>
            ) : (
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
                  {/* Graph visualization - retaining the original component */}
                  <div className="h-[600px] bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Interactive Network</h3>
                      <span className="text-xs text-gray-500">Experimental Feature</span>
                    </div>
                    <div className="h-full w-full relative flex items-center justify-center">
                      {/* This ensures the graph is properly centered */}
                      <SocialGraphVisualization 
                        graphData={graphData}
                        profiles={profiles}
                        loading={false}
                        error={null}
                        onRefresh={refreshGraph}
                        className="w-full h-full"
                      />
                      
                      {/* Message explaining how to use the graph */}
                      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-2 rounded max-w-xs">
                        <p>Click and drag to move. Scroll to zoom. Click nodes to focus.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Profile grid - now smaller with scrolling */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Community Members</h3>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {graphData?.nodes
                          .sort((a, b) => (b.val || 0) - (a.val || 0))
                          .slice(0, 50) // Increased from 25 to 50 since we now have scrolling
                          .map(node => {
                            const profile = node.npub ? profiles.get(node.npub) : null;
                            return (
                              <div 
                                key={node.id} 
                                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex flex-col items-center hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                              >
                                <div className="w-12 h-12 rounded-full overflow-hidden mb-2 bg-gray-200 border-2 border-white dark:border-gray-700 shadow-sm">
                                  {node.picture || (profile && profile.picture) ? (
                                    <img 
                                      src={node.picture || profile?.picture}
                                      alt={node.name || 'Profile'} 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sm">
                                      👤
                                    </div>
                                  )}
                                </div>
                                <div className="text-center w-full">
                                  <div className="font-medium text-xs truncate">
                                    {node.name || profile?.displayName || profile?.name || 'Unknown'}
                                  </div>
                                  {node.isCoreNode && (
                                    <span className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100 text-xs px-1.5 py-0.5 rounded-full inline-block mt-1">
                                      Core
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            profilesMap={profiles}
            filterLinks={true}
            hashtags={[]}
            maxCacheSize={1000}
          />
        </Section>
      </div>
    </div>
  )
} 