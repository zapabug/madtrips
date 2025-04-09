'use client';

import { useState, useEffect, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useCache } from './useCache';

interface Note {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
  images: string[];
}

export const useImageNotes = (npubs: string[]) => {
  const { ndk, ndkReady } = useNostr();
  const cache = useCache();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // Refs for tracking internal state
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  // Constants for performance optimization
  const FETCH_LIMIT = 30;
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 1000;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Generate cache key
  const cacheKey = `image-notes:${npubs.sort().join(',').substring(0, 100)}`;

  // Advanced image extraction with multiple detection methods
  const extractImageUrls = (content: string, tags: string[][]): string[] => {
    const urls: string[] = [];
    
    // Method 1: Regex for common image extensions
    const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?)/gi;
    const matches = content.match(imageRegex);
    if (matches) {
      urls.push(...matches);
    }
    
    // Method 2: Check tags for image URLs
    tags.forEach(tag => {
      // Look for image tags
      if ((tag[0] === 'image' || tag[0] === 'img' || tag[0] === 'picture') && tag[1]) {
        urls.push(tag[1]);
      }
      
      // Look for media tags that might contain images
      if (tag[0] === 'media' && tag[1] && 
          /\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i.test(tag[1])) {
        urls.push(tag[1]);
      }
    });
    
    // Method 3: Check for common image hosting services
    const contentUrls = content.match(/(https?:\/\/[^\s]+)/gi) || [];
    const imageHostingPatterns = [
      /https?:\/\/(i\.)?imgur\.com\/[a-zA-Z0-9]+/i,
      /https?:\/\/(?:www\.)?instagram\.com\/p\/[^\/\s]+/i,
      /https?:\/\/pbs\.twimg\.com\/media\/[^\s]+/i,
      /https?:\/\/cloudflare-ipfs\.com\/[^\s]+/i,
      /https?:\/\/[^\s]*nostr\.build\/[^\s]+/i,
      /https?:\/\/[^\s]*primal\.net\/[^\s]+/i
    ];
    
    contentUrls.forEach(url => {
      if (imageHostingPatterns.some(pattern => pattern.test(url))) {
        urls.push(url);
      }
    });
    
    // Deduplicate URLs and filter out obvious non-images
    return Array.from(new Set(urls)).filter(url => {
      // Filter out obvious video URLs
      return !/(\.mp4|\.webm|\.mov|\.avi|youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
    });
  };

  const fetchNotes = async () => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    // Check cache first
    const cachedNotes = cache.getCachedEvents(cacheKey);
    if (cachedNotes) {
      setNotes(cachedNotes);
      fetchInProgress.current = false;
      return;
    }

    console.time('fetchImageNotes');
    setLoading(true);

    if (!ndk || !ndkReady || npubs.length === 0) {
      console.error('NDK not ready or no npubs provided');
      setLoading(false);
      fetchInProgress.current = false;
      return;
    }

    const filter = {
      authors: npubs,
      kinds: [1],
      limit: FETCH_LIMIT,
    };

    const fetchEvents = async (attempt = 1) => {
      try {
        const results: any[] = [];
        const sub = ndk.subscribe(filter, { closeOnEose: true });
        
        sub.on('event', (event: any) => {
          results.push(event);
        });
        
        // Wait for a reasonable time or until EOSE
        const timeoutPromise = new Promise<void>(resolve => {
          setTimeout(() => {
            sub.stop();
            resolve();
          }, 5000); // 5 second timeout
        });
        
        const eosePromise = new Promise<void>(resolve => {
          sub.on('eose', () => {
            sub.stop();
            resolve();
          });
        });
        
        await Promise.race([timeoutPromise, eosePromise]);
        return results;
      } catch (error) {
        if (attempt >= MAX_RETRIES) throw error;
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchEvents(attempt + 1);
      }
    };

    try {
      const events = await fetchEvents();
      
      // Process events to extract images
      const notesWithImages: Note[] = [];
      
      for (const event of events) {
        const images = extractImageUrls(event.content, event.tags);
        
        if (images.length > 0) {
          notesWithImages.push({
            id: event.id,
            pubkey: event.pubkey,
            content: event.content,
            created_at: event.created_at,
            tags: event.tags,
            images
          });
        }
      }
      
      // Sort by most recent first
      notesWithImages.sort((a, b) => b.created_at - a.created_at);
      
      // Cache the results
      cache.setCachedEvents(cacheKey, notesWithImages);
      
      if (isMounted.current) {
        setNotes(notesWithImages);
      }
    } catch (error) {
      console.error('Error fetching image notes:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
      console.timeEnd('fetchImageNotes');
    }
  };

  // Fetch notes when npubs change or NDK is ready
  useEffect(() => {
    if (npubs.length > 0 && ndkReady) {
      fetchNotes();
    }
  }, [npubs, ndkReady]);

  return { notes, loading };
};

export default useImageNotes; 