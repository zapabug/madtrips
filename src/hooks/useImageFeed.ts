"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNostrFeed, Note } from './useNostrFeed';
import useCache from './useCache';
import RelayService from '../lib/services/RelayService';

interface UseImageFeedOptions {
  npubs?: string[];
  limit?: number;
  hashtags?: string[];
  priorityHashtags?: string[];
  nsfwKeywords?: string[];
  useCorePubs?: boolean;
  autoRefreshInterval?: number;
  sortByRecency?: boolean;
}

interface UseImageFeedResult {
  images: Note[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  relayCount: number;
  sortedByTags: Note[][];
}

/**
 * Custom hook for fetching and optimizing image feeds
 * Optimized for live data only - no placeholders or default images
 */
export function useImageFeed({
  npubs = [],
  limit = 50,
  hashtags = [],
  priorityHashtags = [],
  nsfwKeywords = [
    'nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', 
    '18+', 'explicit', 'content warning', 'cw'
  ],
  useCorePubs = true,
  autoRefreshInterval = 60000,
  sortByRecency = true
}: UseImageFeedOptions): UseImageFeedResult {
  const [relayCount, setRelayCount] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Map<string, boolean>>(new Map());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cache = useCache();
  
  // Get images using the base useNostrFeed hook
  const { 
    notes: allNotes, 
    loading, 
    error, 
    refresh 
  } = useNostrFeed({
    npubs,
    limit,
    requiredHashtags: hashtags,
    nsfwKeywords,
    onlyWithImages: true, // Only include posts with images
    useWebOfTrust: useCorePubs // If using core pubs, leverage web of trust
  });
  
  // Filter to posts that specifically have images
  const images = useMemo(() => {
    return allNotes.filter(note => note.images && note.images.length > 0);
  }, [allNotes]);
  
  // Sort images into categories based on hashtags
  const sortedByTags = useMemo(() => {
    if (!priorityHashtags || priorityHashtags.length === 0) {
      return [images];
    }
    
    // Create an array for each priority hashtag plus one for "other"
    const result: Note[][] = Array(priorityHashtags.length + 1).fill(null).map(() => []);
    
    // Sort each image into the appropriate category
    // An image can be in multiple categories if it has multiple priority hashtags
    images.forEach(note => {
      let foundMatch = false;
      
      // Check if the note has any priority hashtags
      for (let i = 0; i < priorityHashtags.length; i++) {
        const priorityTag = priorityHashtags[i].toLowerCase();
        if (
          note.hashtags.some(tag => tag.toLowerCase() === priorityTag) ||
          note.content.toLowerCase().includes(`#${priorityTag}`)
        ) {
          result[i].push(note);
          foundMatch = true;
        }
      }
      
      // If no priority tags matched, add to the "other" category
      if (!foundMatch) {
        result[priorityHashtags.length].push(note);
      }
    });
    
    // Sort each category by recency if requested
    if (sortByRecency) {
      result.forEach(category => {
        category.sort((a, b) => b.created_at - a.created_at);
      });
    }
    
    return result;
  }, [images, priorityHashtags, sortByRecency]);
  
  // Preload images for better user experience
  useEffect(() => {
    if (images.length === 0 || loading) return;
    
    const preloadBatch = async (startIdx: number, count: number) => {
      const newPreloaded = new Map(preloadedImages);
      const imagesToPreload = images
        .slice(startIdx, startIdx + count)
        .flatMap(note => note.images || [])
        .filter(url => url && !newPreloaded.has(url));
      
      for (const imageUrl of imagesToPreload) {
        try {
          if (!newPreloaded.has(imageUrl)) {
            await cache.preloadAndCacheImage(imageUrl);
            newPreloaded.set(imageUrl, true);
          }
        } catch (err) {
          console.error('Error preloading image:', err);
        }
      }
      
      setPreloadedImages(newPreloaded);
    };
    
    // Preload first batch of images
    preloadBatch(0, 10);
    
    // Schedule preloading of remaining images
    const timer = setTimeout(() => {
      preloadBatch(10, 20);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [images, loading, cache, preloadedImages]);
  
  // Update relay count when relays change
  useEffect(() => {
    const updateRelayCount = () => {
      const relays = RelayService.getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    updateRelayCount();
    const unsubscribe = RelayService.onStatusUpdate(relays => {
      setRelayCount(relays.length);
      
      // If we get new relay connections and are not currently loading, refresh data
      if (relays.length > 0 && !loading) {
        refresh();
      }
    });
    
    return () => unsubscribe();
  }, [loading, refresh]);
  
  // Auto-refresh data based on interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refresh();
      }, autoRefreshInterval);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshInterval, refresh]);
  
  return {
    images,
    loading,
    error,
    refresh,
    relayCount,
    sortedByTags
  };
} 