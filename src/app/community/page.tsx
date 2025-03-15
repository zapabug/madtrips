'use client';

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NostrProfileImage } from '@/components/community/NostrProfileImage'
import { ProfileSocialGraph } from '@/components/community/ProfileSocialGraph'

// Define types for our state
interface SocialGraphData {
  nodes: any[];
  links: any[];
  // Add other properties that exist in your actual data
}

// Note: Next.js metadata must be in a separate layout.tsx file since this is a client component

export default function CommunityPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SocialGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForceUpdating, setIsForceUpdating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/socialgraph');
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        const result = await response.json();
        console.log('Fetched data:', result);
        setData(result as SocialGraphData);
        
        // Set debug info
        setDebugInfo(`Data fetched at ${new Date().toLocaleTimeString()}: ${
          result.nodes?.length || 0} nodes, ${result.links?.length || 0} links`);
      } catch (err) {
        console.error('Error fetching social graph:', err);
        setError(err instanceof Error ? err.message : 'Failed to load social graph data');
        setDebugInfo(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        setIsForceUpdating(false);
      }
    }

    fetchData();
  }, []);

  // Function to force refresh the data
  const forceRefreshData = async () => {
    try {
      setIsForceUpdating(true);
      // Update URL to force a fresh fetch
      const response = await fetch(`/api/socialgraph?forceUpdate=true&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      const result = await response.json();
      console.log('Force updated data:', result);
      setData(result as SocialGraphData);
      setDebugInfo(`Data force updated at ${new Date().toLocaleTimeString()}: ${
        result.nodes?.length || 0} nodes, ${result.links?.length || 0} links`);
    } catch (err) {
      console.error('Error force updating social graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to force update social graph data');
      setDebugInfo(`Force update error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsForceUpdating(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#F7931A]">Bitcoin Community in Madeira</h1>
          <button
            onClick={forceRefreshData}
            disabled={isLoading || isForceUpdating}
            className={`px-4 py-2 rounded-md ${
              isLoading || isForceUpdating 
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            } transition-colors`}
          >
            {isForceUpdating ? 'Updating...' : 'Force Update'}
          </button>
        </div>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
          Explore the network of Bitcoin enthusiasts and businesses in Madeira Island.
        </p>
        
        {debugInfo && (
          <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 text-xs rounded border border-gray-200 dark:border-gray-700">
            <strong className="text-[#F7931A]">Debug:</strong> <span className="text-gray-600 dark:text-gray-400">{debugInfo}</span>
          </div>
        )}
        
        <div className="h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A]" />
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="text-red-500 mb-4">Error: {error}</div>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-[#F7931A] text-white rounded-md hover:bg-[#F7931A]/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {isMobile && (
                <div className="absolute top-4 right-4 left-4 z-10 bg-gray-50 dark:bg-gray-800 text-xs p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                  <strong className="text-[#F7931A]">Mobile View:</strong> Graph optimized for performance. Showing core nodes and immediate connections.
                </div>
              )}
              <ProfileSocialGraph data={data} />
            </>
          )}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[#F7931A]">Key Community Members</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Free Madeira */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
            <NostrProfileImage 
              npub="npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <h3 className="text-xl font-semibold text-center text-[#F7931A]">Free Madeira</h3>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Core community organizers
            </p>
            <div className="mt-4 text-center">
              <a 
                href="https://njump.me/npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#F7931A] hover:underline"
              >
                View on Nostr
              </a>
            </div>
          </div>
          
          {/* Bitcoin Madeira */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
            <NostrProfileImage 
              npub="npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <h3 className="text-xl font-semibold text-center text-[#F7931A]">Sovereign Engineering</h3>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Bitcoin education and Builders Guild
            </p>
            <div className="mt-4 text-center">
              <a 
                href="https://njump.me/npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#F7931A] hover:underline"
              >
                View on Nostr
              </a>
            </div>
          </div>
          
          {/* Madtrips */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
            <NostrProfileImage 
              npub="npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <h3 className="text-xl font-semibold text-center text-[#F7931A]">Mad⚡Trips</h3>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Madeira Pleb Travel Solutions
            </p>
            <div className="mt-4 text-center">
              <a 
                href="https://njump.me/npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#F7931A] hover:underline"
              >
                View on Nostr
              </a>
            </div>
          </div>
          
          {/* Funchal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
            <NostrProfileImage 
              npub="npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc"
              width={80}
              height={80}
              className="mx-auto mb-4"
            />
            <h3 className="text-xl font-semibold text-center text-[#F7931A]">Funchal</h3>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Decentralized Community Ads
            </p>
            <div className="mt-4 text-center">
              <a 
                href="https://njump.me/npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#F7931A] hover:underline"
              >
                View on Nostr
              </a>
            </div>
          </div>
        </div>
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-6 text-[#F7931A]">Join the Community</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            Connect with us on Nostr to stay updated with Bitcoin activities in Madeira. 
            Use any Nostr client to follow the accounts above.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="https://primal.net/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-3 bg-[#F7931A]/10 hover:bg-[#F7931A]/20 text-center rounded-md transition-colors"
            >
              Use Primal
            </a>
            <a 
              href="https://njump.me/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-3 bg-[#F7931A]/10 hover:bg-[#F7931A]/20 text-center rounded-md transition-colors"
            >
              Use Njump
            </a>
          </div>
          
          <div className="mt-8 text-right">
            <a 
              href="/admin/socialgraph" 
              className="text-sm text-gray-500 hover:text-[#F7931A]"
            >
              Manage Social Graph
            </a>
          </div>
        </div>
      </section>
    </main>
  )
} 