import { useState, useEffect, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { PROFILE_CACHE_TTL } from '../components/community/utils';
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
  const [retryCount, setRetryCount] = useState(0);
  
  const fetchProfile = useCallback(async (forceRefresh = false) => {
    if (!npub || !npub.startsWith('npub1')) {
      setLoading(false);
      setError('Invalid npub format');
      return;
    }
    
    // Check cache first unless skipCache is true or forceRefresh is true
    if (!skipCache && !forceRefresh) {
      const cachedProfile = CacheService.profileCache.get(npub);
      if (cachedProfile) {
        setProfile(cachedProfile);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Wait for NDK to be ready
      if (!ndkReady) {
        if (retryCount < retryAttempts) {
          setRetryCount(prev => prev + 1);
          // Try to reconnect to relays before giving up
          await reconnect();
          // Retry after a small delay
          setTimeout(() => fetchProfile(forceRefresh), 1000);
          return;
        } else {
          setError('Nostr connection not available');
          setLoading(false);
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
        
        setProfile(processedProfile);
        // Cache the processed profile
        CacheService.profileCache.set(npub, processedProfile);
      } else {
        // Try to reconnect if profile not found - might be a relay connection issue
        if (retryCount < retryAttempts) {
          setRetryCount(prev => prev + 1);
          // Try to reconnect
          await reconnect();
          // Retry after a small delay
          setTimeout(() => fetchProfile(forceRefresh), 1000);
          return;
        } else {
          setError('Profile not found');
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      
      // Try to reconnect and retry on error
      if (retryCount < retryAttempts) {
        setRetryCount(prev => prev + 1);
        // Try to reconnect
        await reconnect();
        // Retry after a small delay
        setTimeout(() => fetchProfile(forceRefresh), 1000 * Math.min(retryCount + 1, 3));
        return;
      } else {
        setError('Failed to fetch profile');
      }
    } finally {
      setLoading(false);
    }
  }, [npub, getUserProfile, ndkReady, skipCache, retryCount, retryAttempts, reconnect, minimalProfile]);
  
  useEffect(() => {
    if (npub) {
      // Reset retry count when npub changes
      setRetryCount(0);
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
      setRetryCount(0);
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