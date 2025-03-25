'use client';

import React, { useEffect, useState, useCallback, memo } from 'react';
import Link from 'next/link';
import { SocialGraphVisualization } from '../../components/community/SocialGraphVisualization';
import { NostrProfileImage } from '../../components/community/NostrProfileImage';
import { NostrFeed } from '../../components/community/NostrFeed';
import { useNostr } from '../../lib/contexts/NostrContext';
import { BRAND_COLORS } from '../../constants/brandColors';
import MultiUserNostrFeed from '../../components/community/MultiUserNostrFeed';
import { MultiTipJar } from '../../components/tip/MultiTipJar';

// Extract Core Profiles to avoid recreating on each render
const CORE_PROFILES = [
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

// Extract just the npubs array once
const CORE_NPUBS = CORE_PROFILES.map(profile => profile.npub);

// Memoized Community Updates section
const CommunityUpdates = memo(() => (
  <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
    <h2 className="text-2xl font-bold mb-4 text-[#14857C]">Community Updates</h2>
    <div className="w-full h-[500px] overflow-hidden border-2 border-forest rounded-lg">
      <MultiUserNostrFeed 
        npubs={CORE_NPUBS} 
        limit={25} 
        autoScroll={true} 
        scrollInterval={5000} 
      />
    </div>
  </div>
));

CommunityUpdates.displayName = 'CommunityUpdates';

// Memoized Social Graph section
const SocialGraphSection = memo(() => (
  <div className="mb-8 bg-forest text-white rounded-lg shadow-md p-4">
    <h3 className="text-xl font-semibold mb-4 text-sand">Community Connections</h3>
    <div className="h-[400px] w-full mb-4">
      <SocialGraphVisualization 
        height={400} 
        className="rounded-lg border border-gray-200"
      />
    </div>
    
    <p className="mb-4 text-sm">
      The Bitcoin Madeira community is a network of individuals, businesses, and organizations 
      committed to promoting Bitcoin adoption and education in Madeira.
    </p>
  </div>
));

SocialGraphSection.displayName = 'SocialGraphSection';

// Memoized Community Feed section
const CommunityFeed = memo(() => (
  <div className="mb-8">
    <h3 className="text-xl font-semibold mb-4 text-bitcoin">Community Feed</h3>
    <div className="w-full h-[600px] rounded-lg overflow-hidden border-2 border-forest">
      <NostrFeed
        npubs={CORE_NPUBS}
        limit={12}
        autoScroll={true}
        scrollInterval={5000}
        useCorePubs={true}
      />
    </div>
  </div>
));

CommunityFeed.displayName = 'CommunityFeed';

export default function CommunityPage(): React.ReactElement {
  const { getUserProfile, reconnect, ndkReady } = useNostr();
  const [profileNames, setProfileNames] = useState<{[key: string]: string}>({});
  const [connected, setConnected] = useState(false);

  // Reconnect to Nostr relays on page load
  useEffect(() => {
    // Always try to reconnect when the page loads to ensure fresh relay connections
    const initializeNostr = async () => {
      try {
        console.log('Community page: Initializing Nostr connections');
        const success = await reconnect();
        setConnected(success);
        
        if (!success) {
          console.warn('Community page: Initial relay connection failed, retrying in 2s');
          // Try again after 2 seconds
          setTimeout(async () => {
            const retrySuccess = await reconnect();
            setConnected(retrySuccess);
            if (!retrySuccess) {
              console.error('Community page: Failed to connect to relays after retry');
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Community page: Error initializing Nostr:', err);
      }
    };
    
    initializeNostr();
  }, [reconnect]);

  // Reconnect to Nostr relays if needed
  useEffect(() => {
    if (!ndkReady && !connected) {
      reconnect().then(success => {
        setConnected(success);
        console.log('Community page: Reconnection attempt result:', success);
      }).catch(err => {
        console.warn('Community page: Failed to reconnect to Nostr relays:', err);
      });
    }
  }, [ndkReady, reconnect, connected]);

  // Fetch profile names using NDK - optimized to avoid unnecessary re-fetches
  useEffect(() => {
    let isMounted = true;
    
    const fetchProfileNames = async (): Promise<void> => {
      if (!ndkReady) {
        console.log('Community page: NDK not ready, deferring profile fetch');
        return;
      }
      
      const names: {[key: string]: string} = {};
      
      await Promise.all(
        CORE_PROFILES.map(async (profile) => {
          try {
            const userProfile = await getUserProfile(profile.npub);
            if (userProfile?.name || userProfile?.displayName) {
              names[profile.npub] = userProfile.displayName || userProfile.name || '';
            }
          } catch (err) {
            console.error(`Failed to fetch name for ${profile.npub}:`, err);
          }
        })
      );
      
      if (isMounted) {
        setProfileNames(names);
      }
    };

    fetchProfileNames();
    
    return () => {
      isMounted = false;
    };
  }, [getUserProfile, ndkReady]);

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="flex flex-col w-full max-w-[800px]">
        <h1 className="text-3xl font-bold mb-6">
          <span className="text-bitcoin">Bitcoin Madeira Community</span>
        </h1>
        
        {/* Use memoized components */}
        <CommunityUpdates />
        <SocialGraphSection />
        <CommunityFeed />
        
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