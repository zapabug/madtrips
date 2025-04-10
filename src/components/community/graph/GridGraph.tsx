'use client';

import React from 'react';
import { GraphData, GraphNode } from '../../../types/graph-types';
import { LiteProfile } from '../../../types/lite-nostr';

interface GridGraphProps {
  graphData: GraphData | null;
  profiles: Map<string, LiteProfile>;
  maxNodes?: number;
  className?: string;
}

/**
 * GridGraph - A grid-based visualization of community members
 * 
 * Displays community members in a responsive grid layout,
 * showing their profile pictures and names.
 */
const GridGraph: React.FC<GridGraphProps> = ({
  graphData,
  profiles,
  maxNodes = 50,
  className = '',
}) => {
  if (!graphData?.nodes || graphData.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm">
        <div className="px-3 py-2 dark:bg-gray-800 border-b border-transparent dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Community Members</h3>
        </div>
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No community members found
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white dark:bg-gray-700 rounded-lg shadow-sm ${className}`}>
      <div className="px-3 py-2 dark:bg-gray-800 border-b border-transparent dark:border-gray-600">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Community Members</h3>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {graphData.nodes
            .sort((a, b) => (b.val || 0) - (a.val || 0))
            .slice(0, maxNodes)
            .map((node: GraphNode) => {
              const profile = node.npub ? profiles.get(node.npub) : null;
              return (
                <div 
                  key={node.id} 
                  className="bg-transparent dark:bg-gray-900 rounded-lg p-3 flex flex-col items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden mb-2 bg-gray-300 dark:bg-gray-700 border-2 border-transparent dark:border-gray-600 shadow-sm">
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
                    <div className="font-medium text-xs truncate text-gray-800 dark:text-gray-200">
                      {node.name || profile?.displayName || profile?.name || 'Unknown'}
                    </div>
                    {node.isCoreNode && (
                      <span className="bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 text-xs px-1.5 py-0.5 rounded-full inline-block mt-1">
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
  );
};

export default GridGraph; 