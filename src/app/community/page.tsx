'use client';

/**
 * Community Page - Showcases the Bitcoin Madeira community connections and activity.
 * Uses shared hooks for efficient data fetching and caching.
 */

import { useNostrGraph } from '../../hooks/useNostrGraph';
import { useCachedProfiles } from '../../hooks/useCachedProfiles';
import { CommunityFeed, MadeiraFeed } from '../../components/community';
import { CORE_NPUBS } from '../../constants/nostr';
import Image from 'next/image';
import { useSocialGraph } from '../../hooks/useSocialGraph';
import SocialGraphVisualization from '../../components/community/graph/SocialGraphVisualization';
import LoadingAnimation from '../../components/ui/LoadingAnimation';

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
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Madeira Moments</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Photos shared by the Madeira Bitcoin community and their connections. 
              This feed shows images with #madeira related hashtags from your network.
            </p>
          </div>
          
          <div className="px-6 pb-6">
            <div className="h-[400px]">
              <MadeiraFeed 
                npubs={npubsInGraph} 
                useCorePubs={false} 
                profilesMap={profiles}
              />
            </div>
          </div>
        </section>
        
        {/* Web of Trust visualization section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Community Connections</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Explore the Bitcoin Madeira web of trust - visualizing connections between community members 
              and their extended networks.
            </p>
          </div>
            
          <div className="px-6 pb-6">
            {/* Simple visualization - can be enhanced later */}
            <div className="h-[600px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
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
              ) : graphData ? (
                <div className="flex flex-col h-full">
                  <div className="text-sm mb-4">
                    <span className="font-bold">Network size:</span> {graphData.nodes.length} users, {graphData.links.length} connections
                  </div>
                  <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {graphData.nodes
                        .sort((a, b) => (b.val || 0) - (a.val || 0))
                        .slice(0, 20)
                        .map(node => {
                          const profile = node.npub ? profiles.get(node.npub) : null;
                          return (
                            <div 
                              key={node.id} 
                              className="bg-white dark:bg-gray-700 rounded-lg p-3 flex flex-col items-center"
                            >
                              <div className="w-16 h-16 rounded-full overflow-hidden mb-2 bg-gray-200">
                                {node.picture || (profile && profile.picture) ? (
                                  <Image 
                                    src={node.picture || profile?.picture || ''}
                                    alt={node.name || 'Profile'} 
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xl">
                                    👤
                                  </div>
                                )}
                              </div>
                              <div className="text-center">
                                <div className="font-bold truncate w-full">
                                  {node.name || profile?.displayName || profile?.name || 'Unknown'}
                                </div>
                                {node.isCoreNode && (
                                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
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
              ) : (
                <div className="flex items-center justify-center h-full">
                  No data available
                </div>
              )}
            </div>
          </div>
        </section>
        
        {/* Community Feed section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Community Feed</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              The latest posts from Bitcoin Madeira community members. Stay up to date with 
              discussions, announcements, and activities.
            </p>
          </div>
          
          <div className="px-6 pb-6">
            <CommunityFeed 
              npubs={npubsInGraph} 
              useCorePubs={false} 
              limit={30} 
              profilesMap={profiles}
            />
          </div>
        </section>
      </div>
    </div>
  )
} 