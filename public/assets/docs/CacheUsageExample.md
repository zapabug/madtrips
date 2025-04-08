'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useNostr } from '../../../lib/contexts/NostrContext';
import useCache from '../../../hooks/useCache';
import { NostrPost, UserProfile } from '../../../lib/services/CacheService';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { CORE_NPUBS } from '../utils';

/**
 * CacheUsageExample - Example component demonstrating the useCache hook
 * 
 * This component shows how to properly use the new centralized caching system
 * for both reading and writing different types of cached data.
 */
export const CacheUsageExample: React.FC = () => {
  const { ndk, ndkReady } = useNostr();
  const cache = useCache();
  
  const [posts, setPosts] = useState<NostrPost[]>([]);
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cacheHits: 0,
    cacheMisses: 0
  });
  
  // Example of fetching and caching posts
  const fetchPosts = useCallback(async () => {
    if (!ndk || !ndkReady) return;
    
    setLoading(true);
    const npubs = CORE_NPUBS.slice(0, 3); // Just use first 3 for example
    const limit = 10;
    
    // Try to get posts from cache first
    const cachedPosts = cache.getCachedPosts(npubs, limit);
    
    if (cachedPosts) {
      console.log('Cache hit: Using cached posts');
      setPosts(cachedPosts);
      setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
      setLoading(false);
      return;
    }
    
    // Cache miss - fetch from relays
    console.log('Cache miss: Fetching posts from relays');
    setStats(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
    
    try {
      // Convert npubs to pubkeys
      const pubkeys = npubs.map(npub => {
        try {
          const { data } = nip19.decode(npub);
          return data as string;
        } catch {
          return null;
        }
      }).filter(Boolean) as string[];
      
      // Create filter for fetching events
      const filter: NDKFilter = {
        kinds: [1], // Text notes
        authors: pubkeys,
        limit
      };
      
      // Fetch events
      const events = await ndk.fetchEvents([filter]);
      
      // Convert events to NostrPost format
      const fetchedPosts: NostrPost[] = Array.from(events).map(event => ({
        id: event.id,
        pubkey: event.pubkey,
        content: event.content || '',
        created_at: event.created_at || 0,
        tags: event.tags || []
      }));
      
      // Store posts in cache
      cache.setCachedPosts(npubs, limit, fetchedPosts);
      
      // Update state
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [ndk, ndkReady, cache]);
  
  // Example of fetching and caching profiles
  const fetchProfiles = useCallback(async () => {
    if (!posts.length) return;
    
    const newProfiles = new Map<string, UserProfile>();
    const uniquePubkeys = [...new Set(posts.map(post => post.pubkey))];
    
    // Try to get each profile from cache first
    for (const pubkey of uniquePubkeys) {
      try {
        const npub = nip19.npubEncode(pubkey);
        
        // Check cache first
        const cachedProfile = cache.getCachedProfile(npub);
        
        if (cachedProfile) {
          // Cache hit
          newProfiles.set(pubkey, cachedProfile);
          setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
        } else {
          // Cache miss - fetch from relays
          setStats(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
          
          if (ndk && ndkReady) {
            const user = ndk.getUser({ pubkey });
            await user.fetchProfile();
            
            if (user.profile) {
              const profile: UserProfile = {
                name: user.profile.name,
                displayName: user.profile.displayName,
                picture: user.profile.image,
                nip05: user.profile.nip05
              };
              
              // Cache the profile
              cache.setCachedProfile(npub, profile);
              
              // Add to our local state
              newProfiles.set(pubkey, profile);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    }
    
    setProfiles(newProfiles);
  }, [posts, ndk, ndkReady, cache]);
  
  // Fetch posts on mount
  useEffect(() => {
    if (ndkReady) {
      fetchPosts();
    }
  }, [ndkReady, fetchPosts]);
  
  // Fetch profiles when posts change
  useEffect(() => {
    if (posts.length > 0) {
      fetchProfiles();
    }
  }, [posts, fetchProfiles]);
  
  // Example of clearing specific caches
  const handleClearPostCache = () => {
    cache.clearPostCache();
    fetchPosts(); // Re-fetch after clearing
  };
  
  const handleClearProfileCache = () => {
    cache.clearProfileCache();
    fetchProfiles(); // Re-fetch after clearing
  };
  
  const handleClearAllCaches = () => {
    cache.clearAllCaches();
    fetchPosts(); // Re-fetch after clearing
  };
  
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h2 className="text-xl font-bold">Cache Usage Example</h2>
      
      {/* Cache statistics */}
      <div className="bg-gray-100 p-3 rounded">
        <h3 className="font-medium">Cache Statistics</h3>
        <p>Cache Hits: {stats.cacheHits}</p>
        <p>Cache Misses: {stats.cacheMisses}</p>
        <p>Hit Ratio: {stats.cacheHits + stats.cacheMisses > 0 
          ? Math.round((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100) 
          : 0}%</p>
      </div>
      
      {/* Cache control buttons */}
      <div className="flex gap-2">
        <button 
          onClick={handleClearPostCache}
          className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
        >
          Clear Post Cache
        </button>
        <button 
          onClick={handleClearProfileCache}
          className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
        >
          Clear Profile Cache
        </button>
        <button 
          onClick={handleClearAllCaches}
          className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
        >
          Clear All Caches
        </button>
        <button 
          onClick={() => fetchPosts()}
          className="px-3 py-1 bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
        >
          Refresh Data
        </button>
      </div>
      
      {/* Content display */}
      {loading ? (
        <div className="animate-pulse h-40 bg-gray-200 rounded"></div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-medium">Posts from Cache:</h3>
          {posts.length === 0 ? (
            <p>No posts found</p>
          ) : (
            <ul className="space-y-3">
              {posts.map(post => {
                const profile = profiles.get(post.pubkey);
                return (
                  <li key={post.id} className="border-b pb-2">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">
                        {profile?.displayName || profile?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.created_at * 1000).toLocaleString()}
                      </div>
                    </div>
                    <p className="mt-1">{post.content.substring(0, 100)}...</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CacheUsageExample; 