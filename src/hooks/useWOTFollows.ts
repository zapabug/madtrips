'use client';

import { useState, useEffect, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useCache } from './useCache';

interface WOTEntry {
  follows: string[];
  relevanceScore: number; // Higher score = more relevant (e.g., mutual follows)
}

export const useWOTFollows = (npubs: string[]) => {
  const { ndk, ndkReady } = useNostr();
  const cache = useCache();
  const [wot, setWOT] = useState<Map<string, WOTEntry>>(new Map());
  const [loading, setLoading] = useState(false);

  // Refs for tracking internal state
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);

  // Constants for performance optimization
  const BATCH_SIZE = 10;
  const CONCURRENCY_LIMIT = 3;
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 1000;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Cache key for follows data
  const cacheKey = `wot:${npubs.sort().join(',')}`;

  const fetchFollows = async () => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    // Check cache first
    const cachedWOT = cache.getCachedEvents(cacheKey);
    if (cachedWOT) {
      setWOT(new Map(cachedWOT));
      fetchInProgress.current = false;
      return;
    }

    console.time('fetchFollows');
    setLoading(true);

    if (!ndk || !ndkReady) {
      console.error('NDK not ready');
      setLoading(false);
      fetchInProgress.current = false;
      return;
    }

    // Create filters for each pubkey
    const filters = npubs.map(npub => {
      try {
        return {
          authors: [npub],
          kinds: [3],
          limit: 1,
        };
      } catch (error) {
        console.error(`Invalid npub: ${npub}`, error);
        return null;
      }
    }).filter(Boolean);

    // Create batches for efficient fetching
    const batches = [];
    for (let i = 0; i < filters.length; i += BATCH_SIZE) {
      batches.push(filters.slice(i, i + BATCH_SIZE));
    }

    const fetchBatch = async (batch: any[], attempt = 1) => {
      try {
        const batchResults: any[] = [];
        const promises = batch.map(filter =>
          new Promise<void>((resolve) => {
            try {
              const sub = ndk.subscribe(filter, { closeOnEose: true });
              
              sub.on('event', (event: any) => {
                batchResults.push(event);
              });
              
              sub.on('eose', () => {
                sub.stop();
                resolve();
              });
            } catch (error) {
              console.error('Error subscribing to events:', error);
              resolve();
            }
          })
        );

        // Process with concurrency control
        for (let i = 0; i < promises.length; i += CONCURRENCY_LIMIT) {
          await Promise.all(promises.slice(i, i + CONCURRENCY_LIMIT));
        }

        return batchResults;
      } catch (error) {
        if (attempt >= MAX_RETRIES) throw error;
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchBatch(batch, attempt + 1);
      }
    };

    try {
      // Fetch all batches
      const results: any[] = [];
      for (const batch of batches) {
        if (!isMounted.current) break;
        
        const batchResults = await fetchBatch(batch);
        results.push(...batchResults);
      }

      // Process follows and compute relevance
      const newWOT = new Map<string, WOTEntry>();
      const allFollows: string[] = [];
      
      results.forEach(event => {
        const follows = event.tags
          .filter((tag: string[]) => tag[0] === 'p')
          .map((tag: string[]) => tag[1]);
        
        allFollows.push(...follows);
        newWOT.set(event.pubkey, { follows, relevanceScore: 0 });
      });

      // Compute relevance score based on various factors
      newWOT.forEach((entry, pubkey) => {
        let score = 0;
        
        // Factor 1: Number of mutual follows (highest weight)
        const mutualFollows = allFollows.filter(follow => entry.follows.includes(follow));
        score += mutualFollows.length * 3; // Higher weight for mutual follows
        
        // Factor 2: Core npub status
        if (npubs.includes(pubkey)) {
          score += 10; // High score for core npubs
        }
        
        // Factor 3: Follow count (penalize extremely high follow counts)
        if (entry.follows.length > 0) {
          // Normalize: reward accounts with 50-200 follows, penalize extremely high
          const followNormalization = Math.min(
            Math.max(0, 10 - Math.abs(entry.follows.length - 100) / 20), 
            5
          );
          score += followNormalization;
        }
        
        entry.relevanceScore = Math.max(0, score); // Ensure non-negative score
      });

      // Convert to array for caching
      const wotArray = Array.from(newWOT.entries());
      cache.setCachedEvents(cacheKey, wotArray);
      
      if (isMounted.current) {
        setWOT(newWOT);
      }
    } catch (error) {
      console.error('Error fetching follows:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchInProgress.current = false;
      console.timeEnd('fetchFollows');
    }
  };

  // Fetch follows when npubs change or NDK is ready
  useEffect(() => {
    if (npubs.length > 0 && ndkReady) {
      fetchFollows();
    }
  }, [npubs, ndkReady]);

  return { wot, loading };
};

export default useWOTFollows; 