import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import useCache from './useCache';

// Define a type for UserProfile to match what's returned from getUserProfile
interface UserProfile {
  name?: string;
  displayName?: string;
  picture?: string;
  banner?: string;
  website?: string;
  about?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  pubkey?: string;
}

export interface ProfileData {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
  about?: string;
  website?: string;
  lud16?: string;
  lastFetched?: number;
}

interface UseCachedProfilesOptions {
  skipCache?: boolean;
  minimalProfile?: boolean; // Only fetch minimal profile data
  batchSize?: number;
}

interface UseCachedProfilesResult {
  profiles: Map<string, ProfileData>;
  loading: boolean;
  error: string | null;
  progress: number; // 0-100 percentage progress
  refresh: (forceRefresh?: boolean) => Promise<void>;
}

/**
 * Hook for efficiently fetching and caching multiple Nostr profiles
 */
export function useCachedProfiles(
  npubs: string[] = [], 
  options: UseCachedProfilesOptions = {}
): UseCachedProfilesResult {
  const { skipCache = false, minimalProfile = false, batchSize = 10 } = options;
  const { getUserProfile, ndkReady } = useNostr();
  const cache = useCache();
  
  // State for profiles and loading status
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Refs for tracking internal state
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  
  // Create a consistent set of npubs without duplicates using useMemo
  const uniqueNpubs = useMemo(() => 
    [...new Set(npubs.filter(Boolean))],
    [npubs]
  );
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to fetch profiles in batches
  const fetchProfiles = useCallback(async (forceRefresh = false): Promise<void> => {
    if (fetchInProgress.current || !uniqueNpubs.length || !ndkReady) return;
    
    fetchInProgress.current = true;
    
    if (isMounted.current) {
      setLoading(true);
      setError(null);
      setProgress(0);
    }
    
    try {
      const fetchedProfiles = new Map<string, ProfileData>();
      let completedCount = 0;
      
      // Process npubs in batches for better performance
      for (let i = 0; i < uniqueNpubs.length; i += batchSize) {
        const batch = uniqueNpubs.slice(i, i + batchSize);
        const batchPromises = batch.map(async (npub) => {
          try {
            // Skip invalid npubs
            if (!npub || !npub.startsWith('npub1')) {
              return null;
            }
            
            // Check cache first unless forced refresh
            if (!skipCache && !forceRefresh) {
              const cachedProfile = cache.getCachedProfile(npub);
              if (cachedProfile && 'pubkey' in cachedProfile) {
                return { 
                  npub, 
                  ...cachedProfile,
                  pubkey: cachedProfile.pubkey || '' 
                } as ProfileData;
              }
            }
            
            // Fetch from network
            const profileData = await getUserProfile(npub) as UserProfile;
            
            if (profileData) {
              // Get pubkey from NDK if needed
              const pubkey = profileData.pubkey || '';
              
              // Create profile data object based on minimalProfile setting
              const profile: ProfileData = minimalProfile
                ? {
                    pubkey,
                    npub,
                    name: profileData.name,
                    displayName: profileData.displayName,
                    picture: profileData.picture,
                  }
                : {
                    pubkey,
                    npub,
                    name: profileData.name,
                    displayName: profileData.displayName,
                    picture: profileData.picture,
                    nip05: profileData.nip05,
                    about: profileData.about,
                    website: profileData.website,
                    lud16: profileData.lud16,
                    lastFetched: Date.now(),
                  };
              
              // Cache the profile
              cache.setCachedProfile(npub, profile);
              
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
        
        const batchResults = await Promise.all(batchPromises);
        
        // Add valid results to the map
        batchResults.forEach(profile => {
          if (profile && profile.npub) {
            fetchedProfiles.set(profile.npub, profile);
          }
        });
        
        // Update profiles map incrementally for better UX
        if (isMounted.current) {
          setProfiles(prev => {
            const newMap = new Map(prev);
            batchResults.forEach(profile => {
              if (profile && profile.npub) {
                newMap.set(profile.npub, profile);
              }
            });
            return newMap;
          });
        }
      }
      
      // Final update
      if (isMounted.current) {
        setProfiles(fetchedProfiles);
        setProgress(100);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
      if (isMounted.current) {
        setError('Error fetching profiles');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
    }
  }, [uniqueNpubs, getUserProfile, ndkReady, skipCache, minimalProfile, batchSize, cache]);
  
  // Fetch profiles when npubs change and NDK is ready
  useEffect(() => {
    if (ndkReady && uniqueNpubs.length > 0) {
      fetchProfiles();
    }
  }, [ndkReady, uniqueNpubs, fetchProfiles]);
  
  // Function to manually refresh profiles
  const refresh = useCallback(async (forceRefresh = true) => {
    await fetchProfiles(forceRefresh);
  }, [fetchProfiles]);
  
  return {
    profiles,
    loading,
    error,
    progress,
    refresh
  };
}

export default useCachedProfiles; 