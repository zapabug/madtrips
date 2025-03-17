'use client';

import React from 'react';
import SocialGraph from '@/components/community/SocialGraph';
import { NostrProfileImage } from '@/components/community/NostrProfileImage';

export default function CommunityPage() {
  // Define the core NPUBs with their descriptions
  const coreProfiles = [
    {
      npub: "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e",
      name: "Free Madeira",
      description: "Madeira Community focused on Bitcoin adoption and education."
    },
    {
      npub: "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5",
      name: "Organization promoting Freedom and Sovereignty in Madeira",
      description: "."
    },
    {
      npub: "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh",
      name: "Madtrips",
      description: "Pleb Travel Solutions."
    },
    {
      npub: "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc",
      name: "Funchal",
      description: "Descentralized Community Ads"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6"><span className="text-bitcoin">Bitcoin Madeira Community</span></h1>
      
      <div className="bg-forest text-white rounded-lg shadow-md p-4 mb-8">
        <h3 className="text-xl font-semibold mb-4 text-sand">This visualization shows the connections between key community members</h3>
        <div className="h-[600px] w-full mb-6">
          <SocialGraph 
            height={600} 
            className="rounded-lg border border-gray-200"
          />
        </div>
        
        <p className="mb-6">
          The Bitcoin Madeira community is a network of individuals, businesses, and organizations 
          committed to promoting Bitcoin adoption and education in Madeira.
        </p>
        
        <h2 className="text-2xl font-bold mb-4">Key Community Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {coreProfiles.map((profile) => (
            <div key={profile.npub} className="bg-white/10 rounded-lg p-4 flex flex-col items-center">
              <NostrProfileImage 
                npub={profile.npub} 
                width={80} 
                height={80} 
                className="mb-3"
                alt={profile.name}
              />
              <h3 className="text-lg font-semibold text-bitcoin mb-2">{profile.name}</h3>
              <p className="text-center text-sm">{profile.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 