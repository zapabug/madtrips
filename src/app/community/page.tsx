'use client';

import React from 'react';
import SocialGraph from '@/components/community/SocialGraph';

export default function CommunityPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Bitcoin Madeira Community</h1>
      
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <p className="mb-4">
          The Bitcoin Madeira community is a network of individuals, businesses, and organizations 
          committed to promoting Bitcoin adoption and education in Madeira. This visualization shows 
          the connections between key community members.
        </p>
        
        <div className="h-[600px] w-full">
          <SocialGraph 
            height={600} 
            className="rounded-lg border border-gray-200"
          />
        </div>
      </div>
    </div>
  );
} 