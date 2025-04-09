'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useCache } from '../hooks/useCache';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { extractImageUrls, extractHashtags, handleNostrError } from '../utils/nostrUtils';
import RelayService from '../lib/services/RelayService';

export interface Note {
  id: string;
  content: string;
  created_at: number;
  pubkey: string;
  npub: string;
  sig: string;
  kind: number;
  tags: string[][];
  hashtags: string[];
  images: string[];
  author: {
    name?: string;
    displayName?: string;
    picture?: string;
    nip05?: string;
  };
}

export interface UseNostrFeedOptions {
  npubs?: string[];
  kinds?: number[];
  limit?: number;
  since?: number;
  until?: number;
  requiredHashtags?: string[];
  nsfwKeywords?: string[];
  useWebOfTrust?: boolean;
  onlyWithImages?: boolean;
}

export function useNostrFeed({
  npubs = [],
  kinds = [1], // Default to text notes
  limit = 20,
  since,
  until,
  requiredHashtags = [],
  nsfwKeywords = [],
  useWebOfTrust = false,
  onlyWithImages = false
}: UseNostrFeedOptions) {
  const { ndk, getEvents, getUserProfile, ndkReady } = useNostr();
  const cache = useCache();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [socialGraphNpubs, setSocialGraphNpubs] = useState<string[]>([]);
  const [relayCount, setRelayCount] = useState(0);

  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const isMounted = useRef<boolean>(true);
  
  // Cache for already processed events to avoid duplication
  const processedEventsRef = useRef<Set<string>>(new Set());
  
  // Memoize the filter to prevent unnecessary rerenders
  const filter = useMemo(() => {
    const baseFilter: NDKFilter = {
      kinds,
      limit
    };
    
    if (npubs && npubs.length > 0) {
      baseFilter.authors = npubs;
    }
    
    if (since) {
      baseFilter.since = since;
    }
    
    if (until) {
      baseFilter.until = until;
    }
    
    // Add hashtag filtering if required
    if (requiredHashtags && requiredHashtags.length > 0) {
      baseFilter['#t'] = requiredHashtags;
    }
    
    return baseFilter;
  }, [
    // Properly list all dependencies to ensure filter is only recreated when needed
    JSON.stringify(kinds),
    limit,
    JSON.stringify(npubs),
    since,
    until,
    JSON.stringify(requiredHashtags)
  ]);
  
  useEffect(() => {
    isMounted.current = true;
    const updateRelayCount = () => setRelayCount(RelayService.getConnectedRelays().length);
    updateRelayCount();
    const unsubscribe = RelayService.onStatusUpdate((relays) => {
      setRelayCount(relays.length);
    });
    return () => {
      isMounted.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadSocialGraphData = () => {
      try {
        const graphData = sessionStorage.getItem('madeira-social-graph');
        if (graphData) {
          const parsedData = JSON.parse(graphData);
          if (parsedData?.npubs?.length) {
            setSocialGraphNpubs(parsedData.npubs);
          }
        }
      } catch (e) {
        console.error('Error loading social graph:', e);
      }
    };
    loadSocialGraphData();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'madeira-social-graph' && event.newValue) loadSocialGraphData();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getCacheKey = useCallback(() => {
    const npubKey = npubs.length ? npubs.sort().join('-').substring(0, 20) : 'all';
    return cache.createEventCacheKey([1], npubs, requiredHashtags);
  }, [npubs, requiredHashtags, cache]);

  const filterNotes = useCallback(
    (notes: Note[]): Note[] =>
      notes.filter((note) => {
        const content = note.content?.toLowerCase() || '';
        if (!content.trim()) return false;
        if (nsfwKeywords.some((kw) => content.includes(kw.toLowerCase()) || note.hashtags.includes(kw.toLowerCase())))
          return false;
        if (requiredHashtags.length && !requiredHashtags.some((tag) => note.hashtags.includes(tag.toLowerCase()) || content.includes(`#${tag.toLowerCase()}`)))
          return false;
        if (onlyWithImages && (!note.images || !note.images.length)) return false;
        return true;
      }),
    [requiredHashtags, nsfwKeywords, onlyWithImages],
  );

  const processEvent = useCallback(async (event: NDKEvent): Promise<Note | null> => {
    try {
      // Skip if event has already been processed
      if (processedEventsRef.current.has(event.id)) {
        return null;
      }
      
      // Mark as processed
      processedEventsRef.current.add(event.id);
      
      // Basic properties
      const content = event.content || '';
      
      // Filter out NSFW content if keywords are provided
      if (nsfwKeywords && nsfwKeywords.length > 0) {
        const lowerContent = content.toLowerCase();
        if (nsfwKeywords.some(word => lowerContent.includes(word.toLowerCase()))) {
          return null;
        }
      }
      
      // Extract images and hashtags
      const images = extractImageUrls(content);
      const hashtags = extractHashtags(content);
      
      // If required hashtags are specified and none are found, skip this event
      if (requiredHashtags && requiredHashtags.length > 0) {
        const hasRequiredTag = requiredHashtags.some(tag => 
          hashtags.includes(tag.toLowerCase()) || 
          content.toLowerCase().includes(`#${tag.toLowerCase()}`)
        );
        
        if (!hasRequiredTag) {
          return null;
        }
      }
      
      // Get author profile
      let authorProfile;
      try {
        authorProfile = await getUserProfile(event.pubkey);
      } catch (err) {
        // If profile fetch fails, continue with what we have
        console.error('Error fetching profile:', err);
        authorProfile = {};
      }
      
      // Convert to Note format
      return {
        id: event.id,
        content: content, // Use content as-is, no parser needed
        created_at: event.created_at || Math.floor(Date.now() / 1000),
        pubkey: event.pubkey,
        npub: event.author?.npub || '',
        sig: event.sig || '',
        kind: event.kind || 1,
        tags: event.tags || [],
        hashtags,
        images,
        author: {
          name: authorProfile?.name || '',
          displayName: authorProfile?.displayName || authorProfile?.name || '',
          picture: authorProfile?.picture || '',
          nip05: authorProfile?.nip05 || ''
        }
      };
    } catch (error) {
      console.error('Error processing event:', error);
      return null;
    }
  }, [getUserProfile, nsfwKeywords, requiredHashtags]);

  const fetchNotes = useCallback(async () => {
    if (!ndk || !ndkReady || fetchInProgress.current) return;
    
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Create a stable filter reference
      const currentFilter = { ...filter };
      
      const events = await getEvents(currentFilter, { 
        closeOnEose: true,
        forceFresh: false // Use cache if available for better performance
      });
      
      // Process events in parallel for better performance
      const processPromises = events.map(event => processEvent(event));
      const processed = await Promise.all(processPromises);
      
      // Filter out null values and sort by created_at (newest first)
      const validNotes = processed
        .filter((note): note is Note => note !== null)
        .sort((a, b) => b.created_at - a.created_at);
      
      // Apply additional filtering
      const filteredNotes = filterNotes(validNotes);
      
      if (isMounted.current) {
        setNotes(filteredNotes);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [ndk, ndkReady, filter, getEvents, processEvent, filterNotes]);

  useEffect(() => {
    if (ndkReady) fetchNotes();
  }, [ndkReady, fetchNotes]);

  return { notes, loading, error, refresh: fetchNotes, relayCount };
}