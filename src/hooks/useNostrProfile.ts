"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { PROFILE_CACHE_TTL } from '../components/community/utils';
import CacheService from '../lib/services/CacheService';

interface UseNostrProfileOptions {
  skipCache?: boolean;
  retryAttempts?: number;
  minimalProfile?: boolean; // Only fetch minimal profile data
  retryInterval?: number; // Time in ms between retries
  liveDataOnly?: boolean; // Only use live data, no placeholders
  highPriority?: boolean; // Consider this profile high priority for loading
  preloadImages?: boolean; // Whether to preload profile images
  metadataOnly?: boolean; // Only fetch minimal metadata (good for lists)
}

/**
 * Hook for fetching and caching Nostr profiles with optimizations for live data
 * Optimized for client-side performance with minimal network usage
 */
export function useNostrProfile(npub: string | null, options: UseNostrProfileOptions = {}) {
  const { 
    skipCache = false, 
    retryAttempts = 2, 
    minimalProfile = false,
    retryInterval = 1000,
    liveDataOnly = true, // Default to live data only mode
    highPriority = false,
    preloadImages = true, // Preload images by default
    metadataOnly = false // Don't fetch full profile data by default
  } = options;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { getUserProfile, ndkReady, reconnect } = useNostr();
  const [retryCount, setRetryCount] = useState(0);
  
  // Use a ref to track if a fetch is in progress to prevent concurrent fetches
  const fetchInProgress = useRef<boolean>(false);
  // Use a ref to track retry timers for cleanup
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref to track if the component is mounted
  const isMountedRef = useRef<boolean>(true);
  
  // Clear any pending retry timers on unmount and set mounted state
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);
  
  // Safe state setter functions to prevent updates after unmount
  const safeSetProfile = useCallback((data: any) => {
    if (isMountedRef.current) {
      setProfile(data);
    }
  }, []);
  
  const safeSetLoading = useCallback((isLoading: boolean) => {
    if (isMountedRef.current) {
      setLoading(isLoading);
    }
  }, []);
  
  const safeSetError = useCallback((err: string | null) => {
    if (isMountedRef.current) {
      setError(err);
    }
  }, []);
  
  const safeSetRetryCount = useCallback((count: number) => {
    if (isMountedRef.current) {
      setRetryCount(count);
    }
  }, []);
  
  // Optimized profile processor for client-side use
  const processProfileData = useCallback((profileData: any) => {
    if (!profileData) return null;
    
    // For metadata-only mode, return just the essential fields
    if (metadataOnly) {
      return {
        pubkey: profileData.pubkey,
        name: profileData.name || '',
        displayName: profileData.displayName || profileData.name || '',
        picture: profileData.picture || null,
        nip05: profileData.nip05 || null,
      };
    }
    
    // For minimal profile mode
    if (minimalProfile) {
      return {
        pubkey: profileData.pubkey,
        name: profileData.name || '',
        displayName: profileData.displayName || profileData.name || '',
        picture: profileData.picture || null,
        nip05: profileData.nip05 || null,
      };
    }
    
    // Return full profile
    return profileData;
  }, [metadataOnly, minimalProfile]);
  
  const fetchProfile = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }
    
    // Validate npub format
    if (!npub || !npub.startsWith('npub1')) {
      safeSetError('Invalid npub format');
      return;
    }
    
    // In liveDataOnly mode, don't proceed if NDK is not ready
    if (!ndkReady) {
      console.log('NDK not ready, waiting...');
      if (retryCount < retryAttempts) {
        // Schedule retry
        const newRetryCount = retryCount + 1;
        safeSetRetryCount(newRetryCount);
        
        // Clear any existing timer
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        
        // Set new retry timer with backoff
        // High priority profiles get faster retry
        const backoffFactor = highPriority ? 1.2 : 1.5;
        const backoffTime = retryInterval * Math.min(Math.pow(backoffFactor, newRetryCount), highPriority ? 3 : 5);
        console.log(`Retrying in ${backoffTime}ms (attempt ${newRetryCount}/${retryAttempts})`);
        
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (isMountedRef.current) {
            fetchProfile(forceRefresh);
          }
        }, backoffTime);
        return;
      } else {
        safeSetError('Nostr connection not available after multiple attempts');
        return;
      }
    }
    
    // Check cache first unless skipCache is true or forceRefresh is true
    if (!skipCache && !forceRefresh) {
      const cachedProfile = CacheService.profileCache.get(npub);
      if (cachedProfile) {
        console.log('Using cached profile for:', npub);
        
        // Process the profile data based on options
        const processedCachedProfile = processProfileData(cachedProfile);
        safeSetProfile(processedCachedProfile);
        
        // If high priority, always do a background refresh even if we have cached data
        if (highPriority) {
          console.log('High priority profile - doing background refresh');
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchProfile(true).catch(console.error);
            }
          }, 100);
        }
        return;
      }
    }
    
    // Mark fetch as in progress and set loading state
    fetchInProgress.current = true;
    safeSetLoading(true);
    safeSetError(null);
    
    try {
      console.log('Fetching profile for:', npub);
      const profileData = await getUserProfile(npub);
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      if (profileData) {
        console.log('Profile fetched successfully:', npub);
        
        // Process the profile data based on options
        const processedProfile = processProfileData(profileData);
        
        // Update state with processed profile
        safeSetProfile(processedProfile);
        
        // Cache the full profile data for future use
        CacheService.profileCache.set(npub, profileData);
        
        // Preload profile image if available and preloading is enabled
        if (preloadImages && processedProfile?.picture && typeof processedProfile.picture === 'string') {
          try {
            // Use low priority for image loading to not block UI
            setTimeout(() => {
              if (isMountedRef.current) {
                // Provide a fallback URL (empty string if we don't have one)
                const fallbackUrl = '';
                CacheService.preloadImage(processedProfile.picture, fallbackUrl);
              }
            }, 50);
          } catch (err) {
            console.warn('Failed to preload profile image:', err);
          }
        }
        
        // Reset retry count on success
        if (retryCount > 0) {
          safeSetRetryCount(0);
        }
      } else {
        console.warn('Profile not found for:', npub);
        
        // In liveDataOnly mode, don't use placeholder data
        if (liveDataOnly) {
          if (retryCount < retryAttempts) {
            // Try to reconnect
            await reconnect();
            
            // Check if component is still mounted
            if (!isMountedRef.current) return;
            
            // Increment retry count
            const newRetryCount = retryCount + 1;
            safeSetRetryCount(newRetryCount);
            
            // Clear any existing timer
            if (retryTimerRef.current) {
              clearTimeout(retryTimerRef.current);
            }
            
            // Retry with backoff
            const backoffTime = retryInterval * Math.min(Math.pow(highPriority ? 1.2 : 1.5, newRetryCount), highPriority ? 3 : 5);
            console.log(`Profile not found, retrying in ${backoffTime}ms (attempt ${newRetryCount}/${retryAttempts})`);
            
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              fetchInProgress.current = false; // Reset the in-progress flag
              if (isMountedRef.current) {
                fetchProfile(forceRefresh);
              }
            }, backoffTime);
            return;
          } else {
            safeSetError('Profile not found after multiple attempts');
          }
        } else {
          // In non-liveDataOnly mode, set a minimal placeholder profile
          const placeholderProfile = {
            pubkey: npub,
            name: npub.slice(0, 8) + '...',
            displayName: 'Loading...',
            picture: null
          };
          safeSetProfile(placeholderProfile);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // Try to reconnect and retry on error
      if (retryCount < retryAttempts) {
        // Try to reconnect
        await reconnect();
        
        // Check if component is still mounted again after async operation
        if (!isMountedRef.current) return;
        
        // Increment retry count
        const newRetryCount = retryCount + 1;
        safeSetRetryCount(newRetryCount);
        
        // Clear any existing timer
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        
        // Retry with exponential backoff
        const backoffTime = retryInterval * Math.min(Math.pow(2, newRetryCount), 10);
        console.log(`Error fetching profile, retrying in ${backoffTime}ms (attempt ${newRetryCount}/${retryAttempts})`);
        
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          fetchInProgress.current = false; // Reset the in-progress flag
          if (isMountedRef.current) {
            fetchProfile(forceRefresh);
          }
        }, backoffTime);
        return;
      } else {
        // Set error message based on the actual error
        safeSetError(err instanceof Error ? err.message : 'Failed to fetch profile');
      }
    } finally {
      if (!retryTimerRef.current && isMountedRef.current) {
        // Only reset loading and in-progress flag if we're not scheduling a retry
        safeSetLoading(false);
        fetchInProgress.current = false;
      }
    }
  }, [
    npub, 
    getUserProfile, 
    ndkReady, 
    skipCache, 
    retryCount, 
    retryAttempts, 
    reconnect, 
    retryInterval, 
    liveDataOnly, 
    highPriority, 
    preloadImages,
    safeSetProfile,
    safeSetLoading,
    safeSetError,
    safeSetRetryCount,
    processProfileData
  ]);
  
  // Effect to handle initial fetch when npub changes
  useEffect(() => {
    // Cleanup any previous fetch attempts when npub changes
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    
    // Reset state when npub changes
    if (npub) {
      safeSetRetryCount(0);
      safeSetError(null);
      fetchInProgress.current = false;
      fetchProfile();
    } else {
      // If npub is null, reset profile
      safeSetProfile(null);
    }
  }, [npub, fetchProfile, safeSetRetryCount, safeSetError, safeSetProfile]);
  
  const refetch = useCallback((forceRefresh = true) => {
    // Don't attempt refetch if already in progress
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping refetch request');
      return;
    }
    
    // Clear from cache first if force refresh
    if (npub) {
      if (forceRefresh) {
        // Delete only the specific profile from cache
        CacheService.profileCache.delete(npub);
      }
      
      // Reset retry count for a fresh start
      safeSetRetryCount(0);
      fetchInProgress.current = false;
      fetchProfile(forceRefresh);
    }
  }, [npub, fetchProfile, safeSetRetryCount]);
  
  // For client-side optimization, add a pubkey derived from npub
  const enhancedProfile = profile ? {
    ...profile,
    pubkey: profile.pubkey || npub || undefined
  } : null;
  
  return {
    profile: enhancedProfile,
    loading,
    error,
    refetch
  };
} 