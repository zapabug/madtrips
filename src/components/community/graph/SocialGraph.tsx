'use client'

import React from 'react';
import Image from 'next/image';
import { GraphData, GraphNode } from '../../../types/graph-types';
import { ProfileData } from '../../../hooks/useCachedProfiles';
import LoadingAnimation from '../../ui/LoadingAnimation';

interface SocialGraphProps {
  graphData: GraphData | null;
  profilesMap: Record<string, ProfileData>;
  isLoading: boolean;
  error: string | null;
}

export default function SocialGraph({ 
  graphData,
  profilesMap,
  isLoading, 
  error 
}: SocialGraphProps) {
  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center p-12">
        <LoadingAnimation category="GRAPH" size="large" showText={true} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center items-center p-12">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="w-full flex justify-center items-center p-12">
        <div className="text-gray-500">No graph data available</div>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {graphData.nodes.map((node: GraphNode) => {
        const profile = profilesMap[node.id];
        const isCoreNode = node.isCoreNode;
        
        return (
          <div 
            key={node.id}
            className={`p-4 rounded-lg flex flex-col items-center ${
              isCoreNode ? 'bg-yellow-50 border border-yellow-200' : 'bg-white shadow'
            }`}
          >
            {profile && (
              <>
                <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                  <Image
                    src={profile.picture || '/images/default-profile.png'}
                    alt={profile.displayName || 'User'}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                </div>
                <div className="text-center">
                  <h3 className="font-medium text-sm truncate max-w-full">
                    {profile.displayName || profile.name || 'Anonymous'}
                  </h3>
                  {isCoreNode && (
                    <span className="inline-block bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full mt-1">
                      Core Member
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}