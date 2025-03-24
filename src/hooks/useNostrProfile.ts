import { useState, useEffect, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { PROFILE_CACHE_TTL } from '../components/community/utils';

// Global profile cache
const profileCache = new Map<string, {
  profile: any;
  timestamp: number;
}>();

interface UseNostrProfileOptions {
  skipCache?: boolean;
}

/**
 * Hook for fetching and caching Nostr profiles
 */
export function useNostrProfile(npub: string | null, options: UseNostrProfileOptions = {}) {
  const { skipCache = false } = options;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getUserProfile, ndkReady } = useNostr();
  
  const fetchProfile = useCallback(async () => {
    if (!npub || !npub.startsWith('npub1')) {
      setLoading(false);
      setError('Invalid npub format');
      return;
    }
    
    // Check cache first unless skipCache is true
    if (!skipCache) {
      const cachedProfile = profileCache.get(npub);
      if (cachedProfile && (Date.now() - cachedProfile.timestamp) < PROFILE_CACHE_TTL) {
        setProfile(cachedProfile.profile);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Wait for NDK to be ready
      if (!ndkReady) {
        return; // Will retry due to ndkReady dependency in useEffect
      }
      
      // Fetch the profile
      const profileData = await getUserProfile(npub);
      
      if (profileData) {
        setProfile(profileData);
        
        // Store in cache
        profileCache.set(npub, {
          profile: profileData,
          timestamp: Date.now()
        });
      } else {
        setError('Profile not found');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [npub, getUserProfile, ndkReady, skipCache]);
  
  useEffect(() => {
    if (npub) {
      fetchProfile();
    }
  }, [fetchProfile, npub, ndkReady]);
  
  const refetch = useCallback(() => {
    // Clear from cache first
    if (npub) {
      profileCache.delete(npub);
      fetchProfile();
    }
  }, [npub, fetchProfile]);
  
  return {
    profile,
    loading,
    error,
    refetch
  };
} 