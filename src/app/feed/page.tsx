'use client';

import React, { useState } from 'react';
import MadeiraFeed from '../../components/community/feed/MadeiraFeed';
import CommunityFeed from '../../components/community/feed/CommunityFeed';
import { SocialGraphVisualization } from '../../components/community';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function FeedPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [maxConnections, setMaxConnections] = useState(15);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Bitcoin Madeira Community</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MadeiraFeed - Auto-scrolling image billboard */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Madeira Moments</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stunning images from the Bitcoin Madeira community - updated in real-time
            </p>
          </div>
          
          <div className="p-4">
            <MadeiraFeed />
          </div>
        </div>
        
        {/* Social Graph - Core connections visualization */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Community Connections</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See how the Bitcoin Madeira community is connected
            </p>
          </div>
          
          <div className="p-4">
            <SocialGraphVisualization 
              height={isMobile ? 400 : 500} 
              showSecondDegree={false}
              maxConnections={maxConnections}
            />
          </div>
        </div>
        
        {/* CommunityFeed - Image grid */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Community Feed</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Recent posts with images from the community
            </p>
          </div>
          
          <div className="p-4">
            <CommunityFeed maxHeight={800} />
          </div>
        </div>
      </div>
    </div>
  );
} 