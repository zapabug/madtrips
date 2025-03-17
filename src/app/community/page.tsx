'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SocialGraph from '@/components/community/SocialGraph';
import { NostrProfileImage } from '@/components/community/NostrProfileImage';
import { useNostr } from '@/lib/contexts/NostrContext';
import { BRAND_COLORS } from '@/constants/brandColors';

// Function to generate Nostr profile URL
const getNostrProfileUrl = (npub: string) => {
  // You can choose any popular Nostr web client
  return `https://njump.me/${npub}`;
};

export default function CommunityPage() {
  // Define the core NPUBs with their descriptions
  const coreProfiles = [
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
  const [isLoading, setIsLoading] = useState(true);
  const { ndk, getUserProfile } = useNostr();

  // Fetch profile names using NDK
  useEffect(() => {
    if (!ndk) {
      console.warn("NDK not initialized yet, waiting...");
      return;
    }

    // Ensure NDK is connected to relays
    const ensureConnection = async () => {
      try {
        await ndk.connect();
        console.log("NDK connected to relays for community page");
      } catch (err) {
        console.error("Failed to connect NDK to relays:", err);
      }
    };

    const fetchProfileNames = async () => {
      setIsLoading(true);
      const names: {[key: string]: string} = {};
      
      // First ensure connection
      await ensureConnection();
      
      // Create promises for all profile fetches
      const fetchPromises = coreProfiles.map(async (profile) => {
        try {
          console.log(`Fetching profile for ${profile.npub}`);
          const user = await getUserProfile(profile.npub);
          if (user && user.profile?.name) {
            names[profile.npub] = user.profile.displayName || user.profile.name;
            console.log(`Successfully fetched name for ${profile.npub}: ${names[profile.npub]}`);
          } else {
            // Fall back to using a shortened npub if no profile name is available
            names[profile.npub] = `nostr:${profile.npub.substring(0, 8)}...`;
            console.log(`No profile name found for ${profile.npub}, using fallback`);
          }
        } catch (err) {
          console.error(`Failed to fetch name for ${profile.npub}:`, err);
          // Set a fallback name even if there's an error
          names[profile.npub] = `nostr:${profile.npub.substring(0, 8)}...`;
        }
      });
      
      // Wait for all profile fetches to complete or fail
      await Promise.allSettled(fetchPromises);
      
      setProfileNames(names);
      setIsLoading(false);
    };

    fetchProfileNames();
  }, [ndk, getUserProfile]);

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
        
        <h2 className="text-2xl font-bold mb-4 text-sand">Community Members</h2>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-sand">Loading community members from Nostr network...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
            {coreProfiles.map((profile) => (
              <Link 
                href={getNostrProfileUrl(profile.npub)} 
                key={profile.npub}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-transform hover:scale-105 focus:scale-105 hover:shadow-lg focus:shadow-lg outline-none"
              >
                <div className="bg-white/10 rounded-lg p-5 flex flex-col items-center h-full border border-transparent hover:border-bitcoin focus:border-bitcoin transition-all duration-300" style={{ minHeight: '220px' }}>
                  <NostrProfileImage 
                    npub={profile.npub} 
                    width={80} 
                    height={80} 
                    className="mb-4"
                    alt={profileNames[profile.npub] || "Community Member"}
                  />
                  <h3 className="text-lg font-semibold text-bitcoin mb-3">
                    {profileNames[profile.npub] || "Loading..."}
                  </h3>
                  <p className="text-center text-sm text-sand">{profile.description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 