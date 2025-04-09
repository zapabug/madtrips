'use client';

import { useState, useEffect, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useCache } from './useCache';

interface ProfileData {
  pubkey: string;
  displayName: string;
  picture: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MEMORY_PROFILES = 100; // Based on typical usage

export const useCachedProfiles = (npubs: string[]) => {
  const { getUserProfile, ndkReady, reconnect } = useNostr();
  const cache = useCache();
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(new Map());
  const [loading, setLoading] = useState(false);

  // Use refs for tracking internal state
  const isMounted = useRef(true);
  const retryCountRef = useRef(0);
  const fetchInProgress = useRef(false);

  // Constants for performance optimization
  const BATCH_SIZE = 10;
  const CONCURRENCY_LIMIT = 3;
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 1000;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchProfiles = async (pubkeys: string[]) => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    const toFetch = pubkeys.filter(pubkey => {
      // Check if already in state
      if (profiles.has(pubkey)) return false;
      
      // Check cache
      const cachedProfile = cache.getCachedProfile(pubkey);
      if (cachedProfile) {
        // Add from cache to state
        setProfiles(prev => {
          const newProfiles = new Map(prev);
          newProfiles.set(pubkey, {
            pubkey,
            displayName: cachedProfile.displayName || cachedProfile.name || 'Unknown',
            picture: cachedProfile.picture || '',
          });
          return newProfiles;
        });
        return false;
      }
      return true;
    });

    if (toFetch.length === 0) {
      fetchInProgress.current = false;
      return;
    }

    console.time('fetchProfiles');
    setLoading(true);

    // Create batches for efficient fetching
    const batches = [];
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      batches.push(toFetch.slice(i, i + BATCH_SIZE));
    }

    // Process each batch with controlled concurrency
    const fetchBatch = async (batch: string[], attempt = 1) => {
      try {
        const batchProfiles = new Map<string, ProfileData>();
        const promises = batch.map(pubkey => 
          new Promise<void>(async (resolve) => {
            try {
              const profileData = await getUserProfile(pubkey);
              if (profileData) {
                const profile = {
                  pubkey,
                  displayName: profileData.displayName || profileData.name || 'Unknown',
                  picture: profileData.picture || '',
                };
                batchProfiles.set(pubkey, profile);
                
                // Cache the profile
                cache.setCachedProfile(pubkey, profileData);
              }
            } catch (error) {
              console.error(`Error fetching profile for ${pubkey}:`, error);
            }
            resolve();
          })
        );

        // Process with concurrency control
        for (let i = 0; i < promises.length; i += CONCURRENCY_LIMIT) {
          await Promise.all(promises.slice(i, i + CONCURRENCY_LIMIT));
        }

        return batchProfiles;
      } catch (error) {
        if (attempt >= MAX_RETRIES) throw error;
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchBatch(batch, attempt + 1);
      }
    };

    try {
      for (const batch of batches) {
        if (!isMounted.current) break;
        
        const batchResults = await fetchBatch(batch);
        
        if (isMounted.current) {
          setProfiles(prev => {
            const newProfiles = new Map(prev);
            batchResults.forEach((profile, pubkey) => {
              newProfiles.set(pubkey, profile);
            });
            return newProfiles;
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
      console.timeEnd('fetchProfiles');
    }
  };

  // Fetch profiles when npubs change
  useEffect(() => {
    if (npubs.length > 0 && ndkReady) {
      fetchProfiles(npubs);
    }
  }, [npubs, ndkReady]);

  return { profiles, loading };
};

export default useCachedProfiles; 