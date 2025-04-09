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
import Section from '../../components/ui/Section';
import { useEffect, useState } from 'react';
import { getRandomLoadingMessage } from '../../constants/loadingMessages';
import { BRAND_COLORS } from '../../constants/brandColors';

// Import the new loading indicator components (or define inline)
// import SimpleLoadingIndicator from '../../components/ui/SimpleLoadingIndicator'; // Assuming path - REMOVED FOR NOW

export default function CommunityPage() {
  // Debug state for graph visualization
  const [graphDebugInfo, setGraphDebugInfo] = useState<string | null>(null);
  // State for graph depth slider
  const [followDepth, setFollowDepth] = useState(10); // Initial depth
  // State for the loading message
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // Use the shared graph hook to fetch social connections
  const { 
    graphData,
    npubsInGraph, 
    loading: graphLoading,
    error: graphError,
    refresh: refreshGraph 
  } = useNostrGraph({
    coreNpubs: CORE_NPUBS,
    followsLimit: followDepth, // Use state for limit
    followersLimit: followDepth, // Use state for limit
    showMutuals: true
  });
  
  // Fetch profiles for all users in the graph
  const {
    profiles
  } = useCachedProfiles(npubsInGraph, {
    minimalProfile: true,  // Only fetch minimal profile data for graph
    batchSize: 20          // Increase batch size for faster fetching
  });

  // Set initial loading message
  useEffect(() => {
    setLoadingMessage(getRandomLoadingMessage('GRAPH'));
  }, []);

  // Debug log for graph data
  useEffect(() => {
    if (graphData) {
      console.log('Graph data loaded:', 
        `${graphData.nodes.length} nodes, ${graphData.links.length} links`);
      setGraphDebugInfo(`Graph loaded: ${graphData.nodes.length} nodes, ${graphData.links.length} links`);
    }
  }, [graphData]);
  
  // Handler for slider change
  const handleDepthChange = (newDepth: number) => {
      setFollowDepth(newDepth);
      // Optionally add debounce here if needed
      // Consider if refreshGraph needs to be called immediately or handled by useNostrGraph dependency change
  };

  // Main Loading Overlay
  if (graphLoading) {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center z-50"
        style={{ backgroundColor: `${BRAND_COLORS.deepBlue}e6` }}
      >
        <div className="animate-pulse text-white text-xl mb-4">
          <svg className="w-8 h-8 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <p className="text-white text-lg font-medium">{loadingMessage || 'Loading Community Data...'}</p>
        <p className="text-sm text-gray-300 mt-2">Please wait while we connect to the network.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Bitcoin Madeira Community</h1>
      
      <div>
        <Section 
          title="Madeira Moments"
          description="Photos shared by the Madeira Bitcoin community and their connections. This feed shows images with #madeira related hashtags from your network."
        >
          <div>
            <div className="w-full max-w-2xl">
              <MadeiraFeed 
                profilesMap={profiles} 
                initialCount={30}
                maxCached={150}
              />
            </div>
          </div>
        </Section>
        
        <Section
          title="Community Connections"
          description="Explore the Bitcoin Madeira web of trust - visualizing connections between community members and their extended networks."
        >
          <div>
            <div>
              <div className="text-sm font-medium">
                <span>
                  <span className="font-bold">Network:</span> {graphData?.nodes.length || 0} members, {graphData?.links.length || 0} connections
                </span>
                {graphDebugInfo && (
                  <span className="text-xs text-gray-500 ml-4">{graphDebugInfo}</span>
                )}
              </div>
              
              <div>
                <div>
                  <div className="px-3 py-2 border-b">
                    <h3 className="text-sm font-semibold">Interactive Network</h3>
                  </div>
                  <div>
                    <SocialGraph 
                      graphData={graphData}
                      profiles={profiles}
                      loading={false}
                      error={graphError}
                      onRefresh={refreshGraph}
                      className="w-full h-[600px]"
                      initialFollowDepth={followDepth}
                      onFollowDepthChange={handleDepthChange}
                    />
                    
                    <div className="bg-black/50 text-white text-xs p-2 rounded max-w-xs mt-2">
                      <p>Click and drag to move. Scroll to zoom. Click nodes to focus.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="px-3 py-2 border-b">
                    <h3 className="text-sm font-semibold">Community Members</h3>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {graphData?.nodes
                        .sort((a, b) => (b.val || 0) - (a.val || 0))
                        .slice(0, 50)
                        .map(node => {
                          const profile = node.npub ? profiles.get(node.npub) : null;
                          return (
                            <div 
                              key={node.id} 
                              className="flex flex-col items-center p-2 border rounded"
                            >
                              <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border">
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
                                  <span className="text-xs px-1.5 py-0.5 rounded-full inline-block mt-1 bg-orange-200 text-orange-800">
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
          </div>
        </Section>
        
        <Section
          title="Community Feed"
          description="Notes with images from Bitcoin Madeira community members. A visual representation of community conversations and shared moments."
        >
          <div>
             <CommunityFeed 
               npubs={npubsInGraph}
               limit={30}
               hashtags={[]}
             />
          </div>
        </Section>
      </div>
    </div>
  )
} 