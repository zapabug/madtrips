'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNostr, NostrContextType } from '../lib/contexts/NostrContext';
import { CORE_NPUBS } from '../constants/nostr';
import { useCache } from '../hooks/useCache';
import { NDKEvent, NDKSubscription, NDKFilter, NDKUser } from '@nostr-dev-kit/ndk';
import { ProfileData } from './useCachedProfiles';

// Common NSFW-related keywords to filter out
const NSFW_KEYWORDS = [
  'nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', 
  '18+', 'explicit', 'content warning', 'cw'
];

// Image note with author data
export interface ImageNote {
  id: string;
  content: string;
  pubkey: string;
  created_at: number;
  tags: string[][];
  images: string[];
  hashtags: string[];
  author: {
    pubkey: string;
    name?: string;
    displayName?: string;
    picture?: string;
    nip05?: string;
  };
  npub: string;
}

interface UseImageFeedOptions {
  npubs?: string[];
  hashtags?: string[];
  useCorePubs?: boolean;
  limit?: number;
  onlyWithImages?: boolean;
  profilesMap?: Map<string, ProfileData>;
  filterLinks?: boolean;
  initialFetchCount?: number;
  maxCacheSize?: number;
}

interface UseImageFeedResult {
  notes: ImageNote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * A hook for fetching and managing image-based Nostr notes.
 * Can be used by both MadeiraFeed and CommunityFeed components.
 * Supports semi-infinite scrolling with caching.
 */
export function useImageFeed({
  npubs = [],
  hashtags = [],
  useCorePubs = true,
  limit = 30, // Default to 30 items initially
  onlyWithImages = true,
  profilesMap = new Map(),
  filterLinks = false,
  initialFetchCount = 30,
  maxCacheSize = 500, // Increased default cache size from 100 to 500
}: UseImageFeedOptions = {}): UseImageFeedResult {
  const { ndk, getUserProfile, ndkReady, getEvents } = useNostr();
  const cache = useCache();

  // State for notes and loading status
  const [notes, setNotes] = useState<ImageNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastSince, setLastSince] = useState<number | undefined>(undefined);
  
  // Refs for tracking ongoing operations
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const fetchingRef = useRef(false);
  const notesCache = useRef<ImageNote[]>([]);
  const lastFetchTimeRef = useRef<number>(0);
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate dynamic cache size based on network size
  const effectiveCacheSize = useMemo(() => {
    // For larger networks (many npubs), use a larger cache size
    if (npubs.length > 50) {
      return Math.max(maxCacheSize, 1000); // Minimum 1000 for large networks
    } else if (npubs.length > 20) {
      return Math.max(maxCacheSize, 500); // Minimum 500 for medium networks
    }
    return maxCacheSize; // Use the provided value for smaller networks
  }, [npubs.length, maxCacheSize]);
  
  // Track if we need to handle cache limit
  const handleCacheLimit = useCallback((newNotes: ImageNote[]) => {
    // Merge existing cache with new notes, removing duplicates
    const existingIds = new Set(notesCache.current.map(note => note.id));
    const uniqueNewNotes = newNotes.filter(note => !existingIds.has(note.id));
    
    const updatedCache = [...notesCache.current, ...uniqueNewNotes];
    
    // If cache exceeds the maximum size, remove oldest items
    if (updatedCache.length > effectiveCacheSize) {
      // Sort by created_at and keep the most recent items
      updatedCache.sort((a, b) => b.created_at - a.created_at);
      notesCache.current = updatedCache.slice(0, effectiveCacheSize);
    } else {
      notesCache.current = updatedCache;
    }
    
    // Update the state with the latest notes - respect limit
    setNotes(notesCache.current.slice(0, limit));
  }, [effectiveCacheSize, limit]);

  // Determine which npubs to use
  const effectiveNpubs = useMemo(() => {
    return useCorePubs ? [...new Set([...CORE_NPUBS, ...npubs])] : npubs;
  }, [npubs, useCorePubs]);

  // Create a cache key for this specific feed
  const postCacheKey = useMemo(() => {
    return cache.createFeedCacheKey(effectiveNpubs, hashtags);
  }, [effectiveNpubs, hashtags, cache]);
  
  // Create an event cache key for the centralized event cache
  const eventCacheKey = useMemo(() => {
    return cache.createEventCacheKey([1], effectiveNpubs, hashtags);
  }, [effectiveNpubs, hashtags, cache]);

  // Extract image URLs from note content and tags
  const extractImages = useCallback((content: string, tags: string[][]): string[] => {
    const images: string[] = [];
    
    // Extract from tags
    const imageTags = tags.filter(tag => tag[0] === 'image' || tag[0] === 'img');
    imageTags.forEach(tag => {
      if (tag[1] && tag[1].match(/\.(jpg|jpeg|png|gif|webp)/i)) {
        images.push(tag[1]);
      }
    });
    
    // Extract from content
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
    const contentUrls = content.match(urlRegex) || [];
    contentUrls.forEach(url => {
      if (!images.includes(url)) {
        images.push(url);
      }
    });
    
    return images;
  }, []);

  // Extract hashtags from content and tags
  const extractHashtags = useCallback((content: string, tags: string[][]): string[] => {
    const hashtags: string[] = [];
    
    // Extract from tags
    const hashtagTags = tags.filter(tag => tag[0] === 't');
    hashtagTags.forEach(tag => {
      if (tag[1] && !hashtags.includes(tag[1].toLowerCase())) {
        hashtags.push(tag[1].toLowerCase());
      }
    });
    
    // Extract from content
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(content)) !== null) {
      const hashtag = match[1].toLowerCase();
      if (!hashtags.includes(hashtag)) {
        hashtags.push(hashtag);
      }
    }
    
    return hashtags;
  }, []);

  // Filter notes using provided criteria
  const processNotes = useCallback(async (rawNotes: NDKEvent[]): Promise<ImageNote[]> => {
    if (!rawNotes || !Array.isArray(rawNotes)) return [];
    
    const processedNotes: ImageNote[] = [];
    
    for (const event of rawNotes) {
      try {
        // Skip notes with NSFW keywords
        const hasNsfw = NSFW_KEYWORDS.some(keyword => 
          event.content.toLowerCase().includes(keyword) ||
          event.tags.some((tag: string[]) => 
            tag[0] === 'content-warning' || 
            (tag[0] === 't' && tag[1]?.toLowerCase() === keyword)
          )
        );
        
        if (hasNsfw) continue;
        
        // Extract images and skip if none found and onlyWithImages is true
        const images = extractImages(event.content, event.tags);
        if (onlyWithImages && images.length === 0) continue;
        
        // Filter out notes with links if filterLinks is true
        if (filterLinks) {
          // URLs that aren't image URLs
          const urlRegex = /https?:\/\/[^\s]+(?!\.(jpg|jpeg|png|gif|webp))/gi;
          const hasNonImageLinks = urlRegex.test(event.content);
          if (hasNonImageLinks) continue;
        }
        
        // Extract hashtags
        const noteHashtags = extractHashtags(event.content, event.tags);
        
        // Filter by hashtags if provided
        if (hashtags.length > 0) {
          const matchesHashtags = hashtags.some(tag => 
            noteHashtags.includes(tag.toLowerCase())
          );
          if (!matchesHashtags) continue;
        }
        
        // Get author profile - first check the provided profilesMap
        let author = { 
          pubkey: event.pubkey,
          name: '',
          displayName: '',
          picture: '',
          nip05: ''
        };
        
        // Convert pubkey to npub
        let npub = '';
        try {
          if (ndk) {
            const user = ndk.getUser({ pubkey: event.pubkey });
            npub = user.npub;
            
            // Check if we have the profile in the provided map
            if (profilesMap.has(npub)) {
              const profile = profilesMap.get(npub);
              if (profile) {
                author = {
                  pubkey: event.pubkey,
                  name: profile.name || '',
                  displayName: profile.displayName || profile.name || '',
                  picture: profile.picture || '',
                  nip05: profile.nip05 || ''
                };
              }
            } else {
              // Fallback to fetching profile
              const profile = await getUserProfile(event.pubkey);
              if (profile) {
                author = {
                  pubkey: event.pubkey,
                  name: profile.name || '',
                  displayName: profile.displayName || profile.name || '',
                  picture: profile.picture || '',
                  nip05: profile.nip05 || ''
                };
              }
            }
          }
        } catch (e) {
          // Error handling moved to NostrContext.tsx
        }
        
        // Add to processed notes
        processedNotes.push({
          id: event.id,
          content: event.content,
          pubkey: event.pubkey,
          created_at: event.created_at || 0,
          tags: event.tags,
          images,
          hashtags: noteHashtags,
          author,
          npub
        });
      } catch (e) {
        // Error handling moved to NostrContext.tsx
      }
    }
    
    return processedNotes.sort((a, b) => b.created_at - a.created_at);
  }, [extractImages, extractHashtags, hashtags, onlyWithImages, ndk, getUserProfile, profilesMap, filterLinks]);

  // Convert NDKEvent to NostrPost for caching
  const ndkEventToNostrPost = (event: NDKEvent): any => {
    return {
      id: event.id || '',
      pubkey: event.pubkey || '',
      created_at: event.created_at || 0,
      kind: event.kind || 1,
      tags: event.tags || [],
      content: event.content || '',
      sig: event.sig || ''
    };
  };

  // Update fetchNotes callback with debounce protection and better caching
  const fetchNotes = useCallback(async (since?: number) => {
    if (!ndkReady || fetchingRef.current || !ndk) return;
    
    // *** FIX: Remove setting state at the top level if fetched recently ***
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 5000 && notesCache.current.length > 0) {
      // Instead of setting state, just return quietly
      fetchingRef.current = false;
      return;
    }
    
    // Set fetching flag to prevent concurrent fetches
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    // Record the fetch time
    lastFetchTimeRef.current = now;
    
    try {
      // First, check the centralized event cache - this is a common optimization point
      const cachedEvents = cache.getCachedEvents(eventCacheKey);
      
      // If we have cached events and they're not expired, use them immediately
      if (cachedEvents && cachedEvents.length > 0) {
        const processed = await processNotes(cachedEvents as NDKEvent[]);
        handleCacheLimit(processed);
        
        // If we have enough processed items and not paginating, we can stop loading
        if (!since && processed.length >= initialFetchCount) {
          setLoading(false);
          fetchingRef.current = false;
          
          // If cache is very fresh (less than 30 seconds old), don't fetch again
          const cacheAge = cache.getCacheAge(eventCacheKey);
          if (cacheAge && cacheAge < 30000) {
            return;
          }
        }
      }
      
      // Check post cache if not paginating - this is feed-specific data
      if (!since) {
        const cachedNotes = cache.getCachedPosts(postCacheKey);
        const postCacheAge = cache.getCacheAge(postCacheKey);
        
        if (cachedNotes && cachedNotes.length > 0) {
          const processed = await processNotes(cachedNotes as NDKEvent[]);
          handleCacheLimit(processed);
          
          // If post cache is less than 30 seconds old, use it and return
          if (postCacheAge && postCacheAge < 30000 && processed.length >= limit) {
            setLoading(false);
            fetchingRef.current = false;
            return;
          }
        }
      }
      
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
        } catch (e) {
          // Error handling moved to NostrContext.tsx
        }
      }
      
      // Create pubkey set for the filter
      const pubkeys: string[] = [];
      
      for (const npub of effectiveNpubs) {
        try {
          if (npub) {
            const user = ndk.getUser({ npub });
            if (user.pubkey) {
              pubkeys.push(user.pubkey);
            }
          }
        } catch (e) {
          // Error handling moved to NostrContext.tsx
        }
      }
      
      // Skip if no pubkeys found
      if (pubkeys.length === 0) {
        setError('No valid pubkeys found');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
      
      // Create filter for notes (kind 1 = text notes)
      const filter: NDKFilter = {
        kinds: [1],
        authors: pubkeys,
        limit: initialFetchCount
      };
      
      // Add hashtag filtering if needed
      if (hashtags.length > 0) {
        // Use lowercase hashtags
        filter['#t'] = hashtags.map(tag => tag.toLowerCase());
      }
      
      // Add since parameter for pagination if loading more
      if (since) {
        filter.until = since;
      }
      
      // Use the centralized getEvents method for better caching
      try {
        // Get events using the NostrContext's centralized getEvents method
        const fetchedNotes = await getEvents(filter, { closeOnEose: true });
        
        // Process fetched notes
        const processed = await processNotes(fetchedNotes);
        
        // Store the timestamp of the oldest note for pagination
        if (processed.length > 0) {
          const oldestNote = processed.reduce((oldest, note) => 
            note.created_at < oldest.created_at ? note : oldest, processed[0]);
          setLastSince(oldestNote.created_at);
        } else {
          setHasMore(false);
        }
        
        // Update cache and state based on whether we're loading more or not
        if (since) {
          // Adding older notes to existing cache
          handleCacheLimit(processed);
        } else {
          // Initial load or refresh - reset local component cache
          notesCache.current = processed;
          setNotes(processed.slice(0, limit));
        }
        
        // Check if we've reached the end
        if (processed.length < initialFetchCount) {
          setHasMore(false);
        }
        
        // Also update the post cache for this specific feed
        const nostrPosts = fetchedNotes.map(ndkEventToNostrPost);
        cache.setCachedPosts(postCacheKey, nostrPosts);
        
        setLoading(false);
        fetchingRef.current = false;
      } catch (fetchError) {
        console.error('[useImageFeed] Error fetching events:', fetchError);
        setError('Failed to fetch notes');
        setLoading(false);
        fetchingRef.current = false;
      }
    } catch (error) {
      console.error('[useImageFeed] Error:', error);
      setError('Failed to fetch notes');
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [
    ndk, ndkReady, effectiveNpubs, initialFetchCount, 
    hashtags, postCacheKey, eventCacheKey, 
    processNotes, cache, handleCacheLimit, limit, getEvents
  ]);

  // Fix the initial fetch useEffect to prevent rerunning
  useEffect(() => {
    let mounted = true;
    
    // Only run this once when ndkReady becomes true
    if (ndkReady && !fetchingRef.current) {
      // Check centralized cache first
      const cachedEvents = cache.getCachedEvents(eventCacheKey);
      const cacheAge = cache.getCacheAge(eventCacheKey);
      
      if (cachedEvents && cachedEvents.length > 0 && cacheAge && cacheAge < 60000) {
        // Process and use cached data
        processNotes(cachedEvents as NDKEvent[]).then(processed => {
          if (mounted) {
            notesCache.current = processed;
            setNotes(processed.slice(0, limit));
            setLoading(false);
          }
        });
      } else {
        // Only fetch if no recent fetch has occurred
        const now = Date.now();
        if (now - lastFetchTimeRef.current > 5000) {
          fetchNotes();
        }
      }
    }
    
    // Clean up function
    return () => {
      mounted = false;
      
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
    // Remove any dependencies that change frequently
  }, [ndkReady, processNotes, cache, eventCacheKey, limit]);
  
  // Modify the refresh function to be more conservative
  const refresh = useCallback(async () => {
    // Prevent refreshing too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 10000 || fetchingRef.current) {
      return; // Prevent rapid successive refreshes
    }
    
    // Reset state for fresh fetch
    fetchingRef.current = false;
    setHasMore(true);
    setLastSince(undefined);
    
    // Do the actual fetch
    fetchNotes();
  }, [fetchNotes]);
  
  // Load more notes
  const loadMore = useCallback(async () => {
    if (!loading && hasMore && lastSince) {
      await fetchNotes(lastSince);
    }
  }, [loading, hasMore, lastSince, fetchNotes]);

  return {
    notes,
    loading,
    error,
    refresh,
    loadMore,
    hasMore
  };
}

export default useImageFeed; 