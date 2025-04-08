'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import useCache from './useCache';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { extractImageUrls, extractHashtags, handleNostrError } from '../utils/nostrUtils';
import RelayService from '../lib/services/RelayService';

export interface Note {
  id: string;
  created_at: number;
  content: string;
  pubkey: string;
  npub: string;
  author: {
    name?: string;
    displayName?: string;
    picture?: string;
    nip05?: string;
  };
  images: string[];
  hashtags: string[];
}

interface UseNostrFeedOptions {
  npubs?: string[];
  limit?: number;
  filterKeywords?: string[];
  requiredHashtags?: string[];
  useWebOfTrust?: boolean;
  nsfwKeywords?: string[];
  onlyWithImages?: boolean;
}

export function useNostrFeed({
  npubs = [],
  limit = 25,
  filterKeywords = [],
  requiredHashtags = [],
  useWebOfTrust = true,
  nsfwKeywords = ['nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', '18+', 'explicit'],
  onlyWithImages = false,
}: UseNostrFeedOptions) {
  const { ndk, ndkReady, getUserProfile } = useNostr();
  const cache = useCache();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialGraphNpubs, setSocialGraphNpubs] = useState<string[]>([]);
  const [relayCount, setRelayCount] = useState(0);

  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const isMounted = useRef<boolean>(true);

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
        if (filterKeywords.length && !filterKeywords.some((kw) => content.includes(kw.toLowerCase())))
          return false;
        if (onlyWithImages && (!note.images || !note.images.length)) return false;
        return true;
      }),
    [requiredHashtags, filterKeywords, nsfwKeywords, onlyWithImages],
  );

  const processEvent = useCallback(
    async (event: NDKEvent): Promise<Note | null> => {
      if (!isMounted.current) return null;
      try {
        const id = event.id;
        const content = typeof event.content === 'string' ? event.content : '';
        if (!content) return null;
        const pubkey = event.pubkey;
        const npub = nip19.npubEncode(pubkey);
        const created_at = event.created_at || 0;
        const images = extractImageUrls(content);
        const hashtags = extractHashtags(content);

        const note: Note = { id, created_at, content, pubkey, npub, author: {}, images, hashtags };
        try {
          const profile = await getUserProfile(npub);
          if (profile && isMounted.current) {
            note.author = {
              name: profile.name || '',
              displayName: profile.displayName || profile.name || '',
              picture: profile.picture || '',
              nip05: profile.nip05,
            };
          }
        } catch (e) {
          console.warn(`Error fetching profile for ${npub}:`, e);
        }
        return note;
      } catch (e) {
        console.warn('Error processing event:', e);
        return null;
      }
    },
    [getUserProfile],
  );

  const fetchNotes = useCallback(
    async () => {
      if (fetchInProgress.current || !ndkReady || !ndk) return;
      fetchInProgress.current = true;
      setLoading(true);
      setError(null);

      try {
        const effectiveNpubs = useWebOfTrust && socialGraphNpubs.length ? [...new Set([...npubs, ...socialGraphNpubs.slice(0, 50)])] : npubs;
        const key = getCacheKey();
        const cachedEvents = cache.getCachedEvents(key) as NDKEvent[] | null;

        let processedNotes: Note[] = [];
        if (cachedEvents?.length) {
          processedNotes = (await Promise.all(cachedEvents.map(processEvent))).filter((n): n is Note => n !== null);
          const filteredNotes = filterNotes(processedNotes).slice(0, limit);
          if (filteredNotes.length >= limit) {
            setNotes(filteredNotes);
            setLoading(false);
            fetchInProgress.current = false;
            return;
          }
        }

        const pubkeys = effectiveNpubs.length
          ? effectiveNpubs.map((n) => (n.startsWith('npub') ? nip19.decode(n).data : n) as string).filter(Boolean)
          : undefined;
        const filter: NDKFilter = { kinds: [1], authors: pubkeys, limit: Math.min(limit * 2, 100) };
        if (requiredHashtags.length) filter['#t'] = requiredHashtags;

        if (subscriptionRef.current) subscriptionRef.current.stop();
        const subscription = ndk.subscribe(filter, { closeOnEose: false });
        subscriptionRef.current = subscription;

        subscription.on('event', async (event: NDKEvent) => {
          if (!isMounted.current) return;
          const note = await processEvent(event);
          if (!note) return;
          setNotes((prev) => {
            if (prev.some((n) => n.id === note.id)) return prev;
            const newNotes = [...prev, note].sort((a, b) => b.created_at - a.created_at);
            return filterNotes(newNotes).slice(0, limit);
          });
        });

        const events = await ndk.fetchEvents(filter, { closeOnEose: true });
        const newEvents = Array.from(events);
        cache.setCachedEvents(key, newEvents);

        processedNotes = (await Promise.all(newEvents.map(processEvent))).filter((n): n is Note => n !== null);
        const filteredNotes = filterNotes(processedNotes).slice(0, limit);
        setNotes(filteredNotes);
      } catch (e) {
        handleNostrError(e, 'useNostrFeed.fetchNotes');
        setError('Failed to fetch notes.');
      } finally {
        if (isMounted.current) {
          setLoading(false);
          fetchInProgress.current = false;
        }
      }
    },
    [ndk, ndkReady, npubs, limit, requiredHashtags, useWebOfTrust, socialGraphNpubs, cache, processEvent, filterNotes, getCacheKey],
  );

  useEffect(() => {
    if (ndkReady) fetchNotes();
  }, [ndkReady, fetchNotes]);

  return { notes, loading, error, refresh: fetchNotes, relayCount };
}