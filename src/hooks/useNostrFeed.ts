'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import useCache from './useCache';
import { NDKEvent, NDKFilter, NDKSubscription, NDKKind } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { extractImageUrls, extractHashtags, handleNostrError } from '../utils/nostrUtils';
import RelayService from '../lib/services/RelayService';
import { ProfileData } from './useCachedProfiles';
import { npubToHex } from '../utils/profileUtils';
import { MCP_CONFIG } from '../../mcp/config';

// Define a stable empty map reference outside the hook
const defaultProfilesMap = new Map<string, ProfileData>();

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

export interface NostrPost {
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  hashtags: string[];
  profile?: ProfileData;
  npub?: string; 
  reactions?: { [key: string]: number };
  repostCount?: number;
}

interface UseNostrFeedOptions {
  filter?: NDKFilter;
  authors?: string[];
  hashtags?: string[];
  since?: number;
  limit?: number;
  initialFetchCount?: number;
  loadProfiles?: boolean;
  profilesMap?: Map<string, ProfileData>;
  excludeKinds?: NDKKind[];
  includeKinds?: NDKKind[];
  useWebOfTrustOverride?: boolean;
}

interface UseNostrFeedResult {
  posts: NostrPost[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_KINDS = [NDKKind.Text];

export function useNostrFeed({
  filter: initialFilter = {},
  authors = [],
  hashtags = [],
  since: initialSince,
  limit = MCP_CONFIG.feed.defaultLimit || 30,
  initialFetchCount = limit,
  loadProfiles = true,
  profilesMap = defaultProfilesMap,
  excludeKinds = [],
  includeKinds = DEFAULT_KINDS,
  useWebOfTrustOverride,
}: UseNostrFeedOptions = {}): UseNostrFeedResult {
  const { ndk, ndkReady, getEvents, getUserProfile, logMessage } = useNostr();
  const cache = useCache();

  const [posts, setPosts] = useState<NostrPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  
  const fetchingRef = useRef(false);
  const postsCacheRef = useRef<NostrPost[]>([]);

  logMessage('log', '[useNostrFeed]', `Hook initialized/re-rendered. Loading: ${loading}, Posts: ${posts.length}`);

  // Stabilize the authors prop internally
  const stableAuthors = useMemo(() => {
    // Sort to ensure order doesn't affect stability, then stringify for memo key
    return [...authors].sort(); 
  }, [authors]); // Only depends on the authors prop itself

  // Determine if Web of Trust should be used
  const shouldUseWoT = useWebOfTrustOverride !== undefined 
                         ? useWebOfTrustOverride 
                         : MCP_CONFIG.defaults.useWebOfTrust;
  
  logMessage('log', '[useNostrFeed]', `WoT Setting: ${shouldUseWoT} (Override: ${useWebOfTrustOverride}, MCP: ${MCP_CONFIG.defaults.useWebOfTrust})`);

  // Derive effective authors, potentially including WoT
  const effectiveAuthors = useMemo(() => {
    let baseAuthors = [...new Set(stableAuthors.filter(Boolean))]; // Use stableAuthors
    
    if (shouldUseWoT) {
      logMessage('log', '[useNostrFeed]', 'Web of Trust enabled, should expand authors (logic TBD/external)');
      if (baseAuthors.length === 0 && MCP_CONFIG.coreNpubs) {
         baseAuthors = MCP_CONFIG.coreNpubs;
         logMessage('log', '[useNostrFeed]', 'Using MCP coreNpubs as base for WoT');
      }
    }
    
    return baseAuthors;
    // Use stableAuthors as dependency
  }, [stableAuthors, shouldUseWoT, logMessage]);

  // Filter construction (uses effectiveAuthors)
  const filter: NDKFilter = useMemo(() => {
    logMessage('log', '[useNostrFeed]', 'Recalculating filter memo');
    const kindsToInclude = includeKinds.filter(k => !excludeKinds.includes(k));
    const baseFilter: NDKFilter = {
      kinds: kindsToInclude.length > 0 ? kindsToInclude : undefined,
      limit: limit,
      ...initialFilter,
    };

    if (effectiveAuthors.length > 0) {
       const pubkeys = effectiveAuthors
                          .filter(npub => typeof npub === 'string' && npub.startsWith('npub1'))
                          .map(npub => npubToHex(npub))
                          .filter(Boolean);
       if (pubkeys.length > 0) {
          logMessage('log', '[useNostrFeed]', `Using ${pubkeys.length} authors in filter from effectiveAuthors`, { authors: effectiveAuthors });
          baseFilter.authors = pubkeys as string[];
       }
    }

    if (hashtags.length > 0) {
      baseFilter['#t'] = hashtags.map(tag => tag.toLowerCase());
    }

    return baseFilter;
    // Use stableAuthors and effectiveAuthors as dependencies
  }, [initialFilter, effectiveAuthors, hashtags, limit, excludeKinds, includeKinds, logMessage]);

  const processEvents = useCallback(async (events: NDKEvent[]): Promise<NostrPost[]> => {
    logMessage('log', '[useNostrFeed]', `Processing ${events.length} events...`, { loadProfiles });
    if (!events || events.length === 0) return [];
    
    const newPosts: NostrPost[] = [];
    const profilesToFetch = new Set<string>();
    
    for (const event of events) {
      try {
          let npub = '';
          try {
             if (ndk) npub = ndk.getUser({ pubkey: event.pubkey }).npub;
          } catch (npubError) {
             logMessage('warn', '[useNostrFeed]', `Could not get npub for ${event.pubkey}:`, npubError);
          }

          let profile: ProfileData | undefined = undefined;
          if (loadProfiles && npub) {
             if (profilesMap.has(npub)) {
                 profile = profilesMap.get(npub);
             } else {
                 profilesToFetch.add(npub);
             }
          }

          const post: NostrPost = {
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at ?? 0,
            content: event.content,
            tags: event.tags,
            hashtags: event.tags.filter(t => t[0] === 't').map(t => t[1]),
            profile,
            npub,
          };
          newPosts.push(post);
      } catch (processingError) {
          logMessage('error', '[useNostrFeed]', `Error processing event ${event.id}:`, processingError);
      }
    }

    if (loadProfiles && profilesToFetch.size > 0) {
      const fetchedProfiles = new Map<string, ProfileData>();
      const promises = Array.from(profilesToFetch).map(async (npubToFetch) => {
        try {
          const profileData = await getUserProfile(npubToFetch);
          if (profileData && profileData.pubkey) {
            fetchedProfiles.set(npubToFetch, profileData as ProfileData);
          }
        } catch (profileError) {
          logMessage('error', '[useNostrFeed]', `Error fetching profile ${npubToFetch}:`, profileError);
        }
      });
      await Promise.all(promises);
      
      newPosts.forEach(post => {
        if (post.npub && !post.profile && fetchedProfiles.has(post.npub)) {
          post.profile = fetchedProfiles.get(post.npub);
        }
      });
    }

    return newPosts.sort((a, b) => b.created_at - a.created_at);
  }, [loadProfiles, profilesMap, ndk, getUserProfile, logMessage]);

  const fetchPosts = useCallback(async (pagination = false) => {
    logMessage('log', '[useNostrFeed]', `fetchPosts called. Pagination: ${pagination}, Fetching: ${fetchingRef.current}, NDKReady: ${ndkReady}`);
    if (fetchingRef.current || !ndkReady) return;
    fetchingRef.current = true;
    logMessage('log', '[useNostrFeed]', 'Setting loading START');
    setLoading(true);
    setError(null);

    const currentFilter = { ...filter };
    currentFilter.limit = pagination ? limit : initialFetchCount;
    if (pagination && lastCreatedAt) {
      currentFilter.until = lastCreatedAt;
      logMessage('log', '[useNostrFeed]', `Pagination fetch until: ${lastCreatedAt}`);
    } else if (initialSince) {
       currentFilter.since = initialSince;
       logMessage('log', '[useNostrFeed]', `Initial fetch since: ${initialSince}`);
    } else {
       logMessage('log', '[useNostrFeed]', 'Fetching latest (no since/until)');
    }


    try {
      logMessage('log', '[useNostrFeed]', 'Fetching events with filter:', currentFilter);
      const events = await getEvents(currentFilter, { closeOnEose: true, forceFresh: pagination ? false : true });
      
      const newPosts = await processEvents(events);
      logMessage('log', '[useNostrFeed]', `Processed ${newPosts.length} new posts`);

      if (pagination) {
        const combined = [...postsCacheRef.current, ...newPosts];
        const uniquePosts = Array.from(new Map(combined.map(p => [p.id, p])).values())
                             .sort((a, b) => b.created_at - a.created_at);
        postsCacheRef.current = uniquePosts;
        logMessage('log', '[useNostrFeed]', `Setting posts (pagination): ${uniquePosts.length} total`);
        setPosts(uniquePosts);
        logMessage('log', '[useNostrFeed]', `Setting hasMore (pagination): ${newPosts.length === limit}`);
        setHasMore(newPosts.length === limit);
      } else {
        postsCacheRef.current = newPosts;
        logMessage('log', '[useNostrFeed]', `Setting posts (initial/refresh): ${newPosts.length} total`);
        setPosts(newPosts);
        logMessage('log', '[useNostrFeed]', `Setting hasMore (initial/refresh): ${newPosts.length === initialFetchCount}`);
        setHasMore(newPosts.length === initialFetchCount);
      }

      if (newPosts.length > 0) {
        const newLastCreatedAt = newPosts[newPosts.length - 1].created_at;
        logMessage('log', '[useNostrFeed]', `Setting lastCreatedAt: ${newLastCreatedAt}`);
        setLastCreatedAt(newLastCreatedAt);
      } else {
         logMessage('log', '[useNostrFeed]', 'No new posts, not updating lastCreatedAt');
         if (pagination) {
             logMessage('log', '[useNostrFeed]', 'Setting hasMore to false (pagination empty)');
             setHasMore(false);
         }
      }

    } catch (err: any) {
      logMessage('error', '[useNostrFeed]', 'Error fetching posts:', err);
      setError('Failed to fetch posts.');
    } finally {
      logMessage('log', '[useNostrFeed]', 'Setting loading END');
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [ndkReady, filter, limit, initialFetchCount, lastCreatedAt, getEvents, processEvents, initialSince, logMessage]);

  useEffect(() => {
    logMessage('log', '[useNostrFeed]', 'Initial fetch useEffect triggered. FetchPosts reference changed?', { fetchPostsStable: fetchPosts === (fetchPostsRef.current || fetchPosts) });
    fetchPostsRef.current = fetchPosts;
    fetchPosts(false);
  }, [fetchPosts, logMessage]);

  const fetchPostsRef = useRef(fetchPosts);


  const loadMore = useCallback(() => {
    logMessage('log', '[useNostrFeed]', 'loadMore called.', { hasMore, loading });
    if (hasMore && !loading) {
      fetchPosts(true);
    }
  }, [hasMore, loading, fetchPosts]);

  const refresh = useCallback(() => {
    logMessage('log', '[useNostrFeed]', 'Refresh called.');
    setLastCreatedAt(undefined);
    setHasMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    loadMore,
    refresh,
    hasMore,
  };
}