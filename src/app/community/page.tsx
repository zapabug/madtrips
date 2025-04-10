'use client';

/**
 * Community Page - Showcases the Bitcoin Madeira community connections and activity.
 * Uses shared hooks for efficient data fetching and caching.
 */

import { useSimpleWOTGraph } from '../../hooks/useSimpleWOTGraph';
import { useLiteProfiles } from '../../hooks/useLiteProfiles';
import { CommunityFeed, MadeiraFeed } from '../../components/community';
import { CORE_NPUBS } from '../../constants/nostr';
import SocialGraph from '../../components/community/graph/SocialGraph';
import { GridGraph } from '../../components/community/graph';
import LoadingAnimation from '../../components/ui/LoadingAnimation';
import Section from '../../components/ui/Section';
import { useEffect, useState, useMemo } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';

export default function CommunityPage() {
  // Debug state for graph visualization
  const [graphDebugInfo, setGraphDebugInfo] = useState<string | null>(null);
  
  // Get relay count from Nostr context
  const { relayCount } = useNostr();

  // Use the simpler graph hook, passing only the core npubs
  const { 
    graphData,
    loading: graphLoading, 
    error: graphError
  } = useSimpleWOTGraph(CORE_NPUBS);

  // Extract npubs from the graph data itself
  const npubsInGraph = useMemo(() => 
    graphData?.nodes.map(node => node.id) || [], 
    [graphData]
  );

  // Fetch profiles separately if needed for other components (like CommunityFeed)
  // Note: The SocialGraph component now receives profiles directly from useSimpleWOTGraph's internal fetch
  const { profiles } = useLiteProfiles({
    npubs: npubsInGraph,
    batchSize: 20
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
      <h1 className="text-3xl font-bold mb-8 text-[#F7931A] mt-8 text-center">Bitcoin Madeira Community</h1>
      
      <div className="space-y-12">
        {/* Madeira Image Feed section */}
        <Section 
          title="Madeira Moments"
          description="Photos shared by the Madeira Bitcoin community and their connections. This feed shows images with #madeira related hashtags from your network."
          titleClassName="text-[#F7931A] dark:text-[#F7931A]"
          descriptionClassName="text-[#F5E3C3] dark:text-[#F5E3C3]"
        >
          <div className="bg-[#800080] rounded-lg p-2">
            <div className="h-[400px] flex items-center justify-center">
              <div className="w-full max-w-2xl h-full">
                <MadeiraFeed 
                  profilesMap={profiles} 
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
          titleClassName="text-[#F7931A] dark:text-[#F7931A]"
          descriptionClassName="text-[#F5E3C3] dark:text-[#F5E3C3]"
        >
          <div className="bg-[#800080] rounded-lg p-2">
            <div className="flex flex-col space-y-4">
              {/* Main content */}
              <div className="flex flex-col space-y-6">
                {/* Graph visualization - using SocialGraph directly */}
                <div className="h-[600px] bg-[#0F4C35] rounded-lg shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-[#1E3A8A] border-b border-gray-600 flex justify-between items-center">
                    <span className="text-sm font-medium text-[#F7931A]">
                      <span className="font-bold">Network:</span> {graphData?.nodes.length || 0} members, {graphData?.links.length || 0} connections
                    </span>
                    {graphDebugInfo && (
                      <span className="text-xs text-gray-400">{graphDebugInfo}</span>
                    )}
                  </div>
                  <div className="h-full w-full relative flex items-center justify-center bg-gray-800">
                    <SocialGraph 
                      graphData={graphData}
                      profiles={profiles}
                      loading={graphLoading}
                      error={graphError}
                      className="w-full h-full"
                    />
                    
                    {/* Relay Indicator */}
                    {relayCount !== undefined && (
                      <span className={`absolute bottom-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded 
                        ${relayCount < 3 ? 'text-[#FF3333]' : relayCount < 6 ? 'text-[#FFB020]' : 'text-[#33CC66]'}
                        bg-black/30 backdrop-blur-sm
                      `}>
                        {relayCount}
                      </span>
                    )}
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
          titleClassName="text-[#F7931A] dark:text-[#F7931A]"
          descriptionClassName="text-[#F5E3C3] dark:text-[#F5E3C3]"
        >
          <div className="bg-[#800080] rounded-lg p-2">
            <CommunityFeed 
              npubs={npubsInGraph}
              limit={30}
            />
          </div>
        </Section>
      </div>
    </div>
  )
} 