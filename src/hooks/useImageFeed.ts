'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { CORE_NPUBS } from '../constants/nostr';
import useCache from './useCache';
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
}

interface UseImageFeedResult {
  notes: ImageNote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * A hook for fetching and managing image-based Nostr notes.
 * Can be used by both MadeiraFeed and CommunityFeed components.
 */
export function useImageFeed({
  npubs = [],
  hashtags = [],
  useCorePubs = true,
  limit = 25,
  onlyWithImages = true,
  profilesMap = new Map(),
}: UseImageFeedOptions = {}): UseImageFeedResult {
  const { ndk, getUserProfile, ndkReady } = useNostr();
  const cache = useCache();

  // State for notes and loading status
  const [notes, setNotes] = useState<ImageNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for tracking ongoing operations
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const fetchingRef = useRef(false);

  // Determine which npubs to use
  const effectiveNpubs = useMemo(() => {
    return useCorePubs ? [...new Set([...CORE_NPUBS, ...npubs])] : npubs;
  }, [npubs, useCorePubs]);

  // Create a cache key for this specific feed
  const cacheKey = useMemo(() => {
    return cache.createFeedCacheKey(effectiveNpubs, hashtags);
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
          console.error('Error processing author for note', e);
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
        console.error('Error processing note', e);
      }
    }
    
    return processedNotes.sort((a, b) => b.created_at - a.created_at);
  }, [extractImages, extractHashtags, hashtags, onlyWithImages, ndk, getUserProfile, profilesMap]);

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

  // Fetch notes from the Nostr network
  const fetchNotes = useCallback(async () => {
    if (!ndkReady || fetchingRef.current || !ndk) return;
    
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cachedNotes = cache.getCachedPosts(cacheKey);
      if (cachedNotes && cachedNotes.length > 0) {
        const processed = await processNotes(cachedNotes as NDKEvent[]);
        setNotes(processed);
        setLoading(false);
      }
      
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
        } catch (e) {
          console.error('Error stopping existing subscription', e);
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
          console.error(`Error getting pubkey for ${npub}`, e);
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
        limit
      };
      
      // Add hashtag filtering if needed
      if (hashtags.length > 0) {
        // Use lowercase hashtags
        filter['#t'] = hashtags.map(tag => tag.toLowerCase());
      }
      
      // Subscribe to notes
      const fetchedNotes: NDKEvent[] = [];
      const sub = ndk.subscribe(filter);
      subscriptionRef.current = sub;
      
      sub.on('event', async (event: NDKEvent) => {
        fetchedNotes.push(event);
      });
      
      sub.on('eose', async () => {
        // Process all fetched notes
        const processed = await processNotes(fetchedNotes);
        setNotes(processed);
        setLoading(false);
        
        // Cache the fetched notes - convert to NostrPost format
        const nostrPosts = fetchedNotes.map(ndkEventToNostrPost);
        cache.setCachedPosts(cacheKey, nostrPosts);
        
        // Clean up subscription
        if (subscriptionRef.current) {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
        }
        
        fetchingRef.current = false;
      });
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to fetch notes');
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [ndk, ndkReady, effectiveNpubs, limit, hashtags, cacheKey, processNotes, cache]);

  // Initial data fetch
  useEffect(() => {
    if (ndkReady) {
      fetchNotes();
    }
    
    // Clean up subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
        } catch (e) {
          console.error('Error stopping subscription during cleanup', e);
        }
      }
    };
  }, [ndkReady, fetchNotes]);
  
  // Refresh notes on demand
  const refresh = useCallback(async () => {
    fetchingRef.current = false;
    await fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    refresh
  };
}

export default useImageFeed; 