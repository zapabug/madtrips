'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SocialGraph from '../../components/community/SocialGraph';
import { NostrProfileImage } from '../../components/community/NostrProfileImage';
import { NostrFeed } from '../../components/community/NostrFeed';
import { useNostr } from '../../lib/contexts/NostrContext';
import { BRAND_COLORS } from '../../constants/brandColors';
import MultiUserNostrFeed from '../../components/community/MultiUserNostrFeed';
import { MultiTipJar } from '../../components/tip/MultiTipJar';

// Function to generate Nostr profile URL
const getNostrProfileUrl = (npub: string): string => {
  return `https://njump.me/${npub}`;
};

interface CoreProfile {
  npub: string;
  description: string;
}

export default function CommunityPage(): React.ReactElement {
  // Define the core NPUBs with their descriptions
  const coreProfiles: CoreProfile[] = [
    {
      npub: "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e",
      description: "Madeira Community focused on Bitcoin adoption and education."
    },
    {
      npub: "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5",
      description: "The Sovereign Individual"
    },
    {
      npub: "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh",
      description: "Pleb Travel Solutions."
    },
    {
      npub: "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc",
      description: "Descentralized Community Ads Madeira"
    }
  ];

  const [profileNames, setProfileNames] = useState<{[key: string]: string}>({});
  const { getUserProfile } = useNostr();

  // Extract just the npubs for the feed
  const npubs: string[] = coreProfiles.map(profile => profile.npub);

  // Fetch profile names using NDK
  useEffect(() => {
    const fetchProfileNames = async (): Promise<void> => {
      const names: {[key: string]: string} = {};
      
      for (const profile of coreProfiles) {
        try {
          const user = await getUserProfile(profile.npub);
          if (user?.profile?.name) {
            names[profile.npub] = user.profile.displayName || user.profile.name;
          }
        } catch (err) {
          console.error(`Failed to fetch name for ${profile.npub}:`, err);
        }
      }
      
      setProfileNames(names);
    };

    void fetchProfileNames();
  }, [getUserProfile, coreProfiles]);

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="flex flex-col w-full max-w-[800px]">
        <h1 className="text-3xl font-bold mb-6">
          <span className="text-bitcoin">Bitcoin Madeira Community</span>
        </h1>
        
        {/* Nostr Feed Section */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <h2 className="text-2xl font-bold mb-4 text-[#14857C]">Community Updates</h2>
          <div className="w-full overflow-hidden border-2 border-forest rounded-lg" style={{ minHeight: '400px' }}>
            <MultiUserNostrFeed 
              npubs={npubs} 
              limit={25} 
              autoScroll={true} 
              scrollInterval={5000} 
            />
          </div>
        </div>
        
        {/* Social Graph Section */}
        <div className="mb-8 bg-forest text-white rounded-lg shadow-md p-4">
          <h3 className="text-xl font-semibold mb-4 text-sand">Community Connections</h3>
          <div className="h-[400px] w-full mb-4">
            <SocialGraph 
              height={400} 
              className="rounded-lg border border-gray-200"
            />
          </div>
          
          <p className="mb-4 text-sm">
            The Bitcoin Madeira community is a network of individuals, businesses, and organizations 
            committed to promoting Bitcoin adoption and education in Madeira.
          </p>
        </div>
        
        {/* Add NostrFeed Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-bitcoin">Community Feed</h3>
          <div className="w-full rounded-lg overflow-hidden">
            <NostrFeed
              npubs={npubs}
              limit={12}
              autoScroll={true}
              scrollInterval={5000}
              useCorePubs={true}
            />
          </div>
        </div>
        
        {/* Support the community */}
        <div className="mb-12 mt-8">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-bitcoin">Support the Community</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Help grow the Bitcoin movement in Madeira
            </p>
          </div>
          <MultiTipJar />
        </div>
      </div>
    </div>
  );
} 