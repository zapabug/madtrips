/**
 * useCache - Custom hook for accessing centralized cache services
 * 
 * This hook provides access to the CacheService singleton for component-level cache operations.
 * It wraps common caching operations with React-friendly patterns.
 */

import { useState, useEffect } from 'react';
import CacheService, { UserProfile, NostrPost, GraphData } from '../lib/services/CacheService';
import { DEFAULT_PROFILE_IMAGE } from '../utils/profileUtils';

/**
 * Custom hook for accessing the centralized CacheService
 * Provides type-safe access to different cache stores
 */
export function useCache() {
  const [cacheStats, setCacheStats] = useState({
    profiles: 0,
    posts: 0,
    graph: 0,
    images: 0
  });

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = () => {
      setCacheStats({
        profiles: CacheService.profileCache.size(),
        posts: CacheService.postCache.size(),
        graph: CacheService.graphCache.size(),
        images: CacheService.imageCache.size()
      });
    };

    // Initial update
    updateStats();

    // Update stats every 30 seconds
    const interval = setInterval(updateStats, 30000);

    return () => clearInterval(interval);
  }, []);

  // Run cache maintenance on hook mount
  useEffect(() => {
    // Prune caches to remove expired items
    CacheService.pruneAll();
    
    // Set up interval for pruning caches regularly
    const interval = setInterval(() => {
      CacheService.pruneAll();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  /**
   * Get a cached profile
   * @param npub The npub to get profile for
   */
  const getCachedProfile = (npub: string): UserProfile | null => {
    return CacheService.profileCache.get(npub);
  };
  
  /**
   * Set a profile in the cache
   * @param npub The npub to cache
   * @param profile The profile data to cache
   */
  const setCachedProfile = (npub: string, profile: UserProfile): void => {
    CacheService.profileCache.set(npub, profile);
  };
  
  /**
   * Get cached posts
   * @param key Cache key for the posts
   */
  const getCachedPosts = (key: string): NostrPost[] | null => {
    return CacheService.postCache.get(key);
  };
  
  /**
   * Set posts in the cache
   * @param key Cache key
   * @param posts Posts to cache
   */
  const setCachedPosts = (key: string, posts: NostrPost[]): void => {
    CacheService.postCache.set(key, posts);
  };
  
  /**
   * Get cached graph data
   * @param key Cache key
   */
  const getCachedGraph = (key: string): GraphData | null => {
    return CacheService.graphCache.get(key);
  };
  
  /**
   * Set graph data in cache
   * @param key Cache key
   * @param data Graph data to cache
   */
  const setCachedGraph = (key: string, data: GraphData): void => {
    CacheService.graphCache.set(key, data);
  };
  
  // Image caching with preloading
  const preloadAndCacheImage = (url: string): Promise<HTMLImageElement> => {
    return CacheService.preloadImage(url, DEFAULT_PROFILE_IMAGE);
  };
  
  const getCachedImage = (url: string): HTMLImageElement | null => {
    return CacheService.imageCache.get(url);
  };
  
  /**
   * Create a cache key for graph data
   * @param npubs NPubs included in the graph
   * @param showSecondDegree Whether second degree connections are shown
   */
  const createGraphCacheKey = (npubs: string[], showSecondDegree: boolean): string => {
    return `graph:${npubs.sort().join(',')}_${showSecondDegree ? '2deg' : '1deg'}`;
  };
  
  /**
   * Create a cache key for feed data
   * @param npubs NPubs included in the feed
   * @param tags Tags to filter by
   */
  const createFeedCacheKey = (npubs: string[], tags: string[] = []): string => {
    return `feed:${npubs.sort().join(',')}_${tags.sort().join(',')}`;
  };
  
  /**
   * Clear all caches
   */
  const clearAllCaches = (): void => {
    CacheService.clearAll();
    setCacheStats({
      profiles: 0,
      posts: 0,
      graph: 0,
      images: 0
    });
  };
  
  /**
   * Clear a specific cache
   * @param cacheName Name of cache to clear
   */
  const clearCache = (cacheName: 'profiles' | 'posts' | 'graph' | 'images'): void => {
    switch (cacheName) {
      case 'profiles':
        CacheService.profileCache.clear();
        break;
      case 'posts':
        CacheService.postCache.clear();
        break;
      case 'graph':
        CacheService.graphCache.clear();
        break;
      case 'images':
        CacheService.imageCache.clear();
        break;
    }
    
    // Update stats after clearing
    setCacheStats(prev => ({
      ...prev,
      [cacheName]: 0
    }));
  };
  
  // Return all cache utilities
  return {
    // Profile cache operations
    getCachedProfile,
    setCachedProfile,
    
    // Posts cache operations
    getCachedPosts,
    setCachedPosts,
    
    // Graph cache operations
    getCachedGraph,
    setCachedGraph,
    
    // Image cache operations
    preloadAndCacheImage,
    getCachedImage,
    
    // Cache clearing utilities
    clearAllCaches,
    clearCache,
    
    // Key generation
    createGraphCacheKey,
    createFeedCacheKey,
    
    // Stats
    cacheStats
  };
}

export default useCache; 