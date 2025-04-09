import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { PROFILE_CACHE_TTL } from './utils';
import CacheService from '../lib/services/CacheService';

interface UseNostrProfileOptions {
  skipCache?: boolean;
  retryAttempts?: number;
  minimalProfile?: boolean; // Only fetch minimal profile data
}

/**
 * Hook for fetching and caching Nostr profiles
 */
export function useNostrProfile(npub: string | null, options: UseNostrProfileOptions = {}) {
  const { skipCache = false, retryAttempts = 2, minimalProfile = false } = options;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getUserProfile, ndkReady, reconnect } = useNostr();
  
  // Use refs instead of state for values that shouldn't trigger re-renders
  const isMounted = useRef(true);
  const retryCountRef = useRef(0);
  const fetchInProgress = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Reset retry count when npub changes
  useEffect(() => {
    if (npub) {
      retryCountRef.current = 0;
    }
  }, [npub]);
  
  const fetchProfile = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    if (!npub || !npub.startsWith('npub1')) {
      if (isMounted.current) {
        setLoading(false);
        setError('Invalid npub format');
      }
      fetchInProgress.current = false;
      return;
    }
    
    // Check cache first unless skipCache is true or forceRefresh is true
    if (!skipCache && !forceRefresh) {
      const cachedProfile = CacheService.profileCache.get(npub);
      if (cachedProfile) {
        if (isMounted.current) {
          setProfile(cachedProfile);
          setLoading(false);
        }
        fetchInProgress.current = false;
        return;
      }
    }
    
    if (isMounted.current) {
      setLoading(true);
      setError(null);
    }
    
    try {
      // Wait for NDK to be ready
      if (!ndkReady) {
        if (retryCountRef.current < retryAttempts) {
          retryCountRef.current += 1;
          
          // Try to reconnect to relays before giving up
          await reconnect();
          
          // Retry after a small delay
          fetchInProgress.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              fetchProfile(forceRefresh);
            }
          }, 1000);
          return;
        } else {
          if (isMounted.current) {
            setError('Nostr connection not available');
            setLoading(false);
          }
          fetchInProgress.current = false;
          return;
        }
      }
      
      // Fetch the profile
      const profileData = await getUserProfile(npub);
      
      if (profileData) {
        // If minimalProfile is true, only include essential fields
        const processedProfile = minimalProfile ? {
          name: profileData.name,
          displayName: profileData.displayName,
          picture: profileData.picture
        } : profileData;
        
        if (isMounted.current) {
          setProfile(processedProfile);
        }
        // Cache the processed profile
        CacheService.profileCache.set(npub, processedProfile);
      } else {
        // Try to reconnect if profile not found - might be a relay connection issue
        if (retryCountRef.current < retryAttempts) {
          retryCountRef.current += 1;
          
          // Try to reconnect
          await reconnect();
          
          // Retry after a small delay
          fetchInProgress.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              fetchProfile(forceRefresh);
            }
          }, 1000);
          return;
        } else {
          if (isMounted.current) {
            setError('Profile not found');
            setLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      
      // Try to reconnect and retry on error
      if (retryCountRef.current < retryAttempts) {
        retryCountRef.current += 1;
        
        // Try to reconnect
        await reconnect();
        
        // Retry after a small delay
        fetchInProgress.current = false;
        setTimeout(() => {
          if (isMounted.current) {
            fetchProfile(forceRefresh);
          }
        }, 1000 * Math.min(retryCountRef.current, 3));
        return;
      } else {
        if (isMounted.current) {
          setError('Failed to fetch profile');
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
    }
  }, [npub, getUserProfile, ndkReady, skipCache, reconnect, minimalProfile, retryAttempts]);
  
  useEffect(() => {
    if (npub) {
      fetchProfile();
    }
  }, [fetchProfile, npub]);
  
  const refetch = useCallback((forceRefresh = true) => {
    // Clear from cache first if force refresh
    if (npub) {
      if (forceRefresh) {
        // Delete only the specific profile from cache
        CacheService.profileCache.delete(npub);
      }
      // Reset retry count for a fresh start
      retryCountRef.current = 0;
      fetchProfile(forceRefresh);
    }
  }, [npub, fetchProfile]);
  
  return {
    profile,
    loading,
    error,
    refetch
  };
} 