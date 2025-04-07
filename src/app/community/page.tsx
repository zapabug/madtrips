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

export default function CommunityPage() {
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
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Bitcoin Madeira Community</h1>
      
      <div className="space-y-12">
        {/* Madeira Image Feed section */}
        <Section 
          title="Madeira Moments"
          description="Photos shared by the Madeira Bitcoin community and their connections. This feed shows images with #madeira related hashtags from your network."
        >
          <div className="h-[400px]">
            <MadeiraFeed profilesMap={profiles} />
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
                {/* Network stats */}
                <div className="text-sm font-medium">
                  <span className="font-bold">Network:</span> {graphData?.nodes.length || 0} members, {graphData?.links.length || 0} connections
                </div>
                
                {/* Main content */}
                <div className="flex flex-col space-y-6">
                  {/* Interactive graph visualization */}
                  <div className="h-[250px] bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Interactive Network</h3>
                    </div>
                    <SocialGraphVisualization 
                      graphData={graphData}
                      profiles={profiles}
                      loading={graphLoading}
                      error={graphError}
                      onRefresh={refreshGraph}
                      compact={true}
                    />
                  </div>
                  
                  {/* Profile grid - simplified version of the original code */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Community Members</h3>
                    </div>
                    <div className="p-3 overflow-y-auto max-h-[220px]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {graphData?.nodes
                          .sort((a, b) => (b.val || 0) - (a.val || 0))
                          .slice(0, 30)
                          .map(node => {
                            const profile = node.npub ? profiles.get(node.npub) : null;
                            return (
                              <div 
                                key={node.id} 
                                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 flex flex-col items-center hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                              >
                                <div className="w-12 h-12 rounded-full overflow-hidden mb-1 bg-gray-200 border-2 border-white dark:border-gray-700 shadow-sm">
                                  {node.picture || (profile && profile.picture) ? (
                                    <img 
                                      src={node.picture || profile?.picture}
                                      alt={node.name || 'Profile'} 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl">
                                      👤
                                    </div>
                                  )}
                                </div>
                                <div className="text-center w-full">
                                  <div className="font-medium text-xs truncate">
                                    {node.name || profile?.displayName || profile?.name || 'Unknown'}
                                  </div>
                                  {node.isCoreNode && (
                                    <span className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100 text-xs px-1 py-0.5 rounded-full inline-block mt-1">
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
          description="The latest posts from Bitcoin Madeira community members. Stay up to date with discussions, announcements, and activities."
        >
          <CommunityFeed 
            npubs={npubsInGraph} 
            limit={30} 
            profilesMap={profiles}
          />
        </Section>
      </div>
    </div>
  )
} 