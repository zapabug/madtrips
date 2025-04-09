import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { LiteProfile } from '../types/lite-nostr';

interface UseLiteProfilesOptions {
  npubs: string[];
  batchSize?: number;
}

interface UseLiteProfilesResult {
  profiles: Map<string, LiteProfile>;
  loading: boolean;
  error: string | null;
  progress: number; // 0-100 percentage
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching lightweight Nostr profiles in real-time only
 * Does not use any caching, always fetches fresh data
 */
export function useLiteProfiles({
  npubs = [],
  batchSize = 10
}: UseLiteProfilesOptions): UseLiteProfilesResult {
  const { getUserProfile, ndkReady } = useNostr();
  
  // State for tracking profiles and loading state
  const [profiles, setProfiles] = useState<Map<string, LiteProfile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Refs for tracking internal state
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  
  // Create a set of unique NPUBs
  const uniqueNpubs = [...new Set(npubs.filter(Boolean))];
  
  // Clean up when unmounting
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to fetch profiles in batches
  const fetchProfiles = useCallback(async (): Promise<void> => {
    if (fetchInProgress.current || !uniqueNpubs.length || !ndkReady) return;
    
    fetchInProgress.current = true;
    
    if (isMounted.current) {
      setLoading(true);
      setError(null);
      setProgress(0);
    }
    
    try {
      const fetchedProfiles = new Map<string, LiteProfile>();
      let completedCount = 0;
      
      // Process profiles in batches for better performance
      for (let i = 0; i < uniqueNpubs.length; i += batchSize) {
        const batch = uniqueNpubs.slice(i, i + batchSize);
        
        // Create a batch of promises for concurrent fetching
        const batchPromises = batch.map(async (npub) => {
          try {
            // Skip invalid NPUBs
            if (!npub || !npub.startsWith('npub1')) {
              return null;
            }
            
            // Always fetch from network - no caching
            const profileData = await getUserProfile(npub);
            
            if (profileData) {
              // Create a lightweight profile
              const profile: LiteProfile = {
                pubkey: '', // Will be populated from network
                npub,
                name: profileData.name,
                picture: profileData.picture,
                lastFetched: Date.now()
              };
              
              return profile;
            }
            
            return null;
          } catch (err) {
            console.error(`Error fetching profile for ${npub}:`, err);
            return null;
          } finally {
            completedCount++;
            if (isMounted.current) {
              setProgress(Math.floor((completedCount / uniqueNpubs.length) * 100));
            }
          }
        });
        
        // Wait for all batch requests to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Add valid results to the profiles map
        batchResults.forEach(profile => {
          if (profile && profile.npub) {
            fetchedProfiles.set(profile.npub, profile);
          }
        });
      }
      
      // Update state with all fetched profiles
      if (isMounted.current) {
        setProfiles(fetchedProfiles);
        setProgress(100);
      }
    } catch (err) {
      console.error('Error fetching lite profiles:', err);
      if (isMounted.current) {
        setError('Error fetching profiles from Nostr network');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
    }
  }, [uniqueNpubs, getUserProfile, ndkReady, batchSize]);
  
  // Fetch profiles when dependencies change
  useEffect(() => {
    if (ndkReady && uniqueNpubs.length > 0 && !fetchInProgress.current) {
      fetchProfiles();
    }
  }, [ndkReady, uniqueNpubs, fetchProfiles]);
  
  // Function to manually refresh profiles
  const refresh = useCallback(async () => {
    // Clear existing profiles
    setProfiles(new Map());
    
    // Fetch fresh profiles
    await fetchProfiles();
  }, [fetchProfiles]);
  
  return {
    profiles,
    loading,
    error,
    progress,
    refresh
  };
}

export default useLiteProfiles; 