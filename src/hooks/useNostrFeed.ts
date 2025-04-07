import { useState, useEffect, useRef, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { extractImageUrls, extractHashtags, handleNostrError } from '../utils/nostrUtils';
import { createEnhancedSubscription, MCPNostrOptions } from '../../mcp';
import { MCP_CONFIG } from '../../mcp/config';
import RelayService from '../lib/services/RelayService';

// Define the note interface
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

// Cache for storing fetched notes
const noteCache: {[key: string]: {notes: Note[], timestamp: number}} = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Image cache removed as unused
// const IMAGE_CACHE = new Map<string, HTMLImageElement>();
// const MAX_IMAGE_CACHE_SIZE = 100;

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
  onlyWithImages = false
}: UseNostrFeedOptions) {
  const { getUserProfile } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [socialGraphNpubs, setSocialGraphNpubs] = useState<string[]>([]);
  const [hasLoadedInitialNotes, setHasLoadedInitialNotes] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  
  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const isMounted = useRef<boolean>(true);

  // Set isClient on mount and track relay connections
  useEffect(() => {
    setIsClient(true);
    isMounted.current = true;
    
    // Update relay count
    const updateRelayCount = () => {
      const relays = RelayService.getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    // Initial update
    updateRelayCount();
    
    // Subscribe to relay status updates
    const unsubscribe = RelayService.onStatusUpdate((relays) => {
      setRelayCount(relays.length);
      
      // If we get new relay connections and haven't loaded notes yet, try fetching
      if (relays.length > 0 && !hasLoadedInitialNotes && fetchInProgress.current === false) {
        fetchNotes();
      }
    });
    
    return () => {
      isMounted.current = false;
      
      // Clean up the subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
          subscriptionRef.current = null;
          console.log('Feed subscription cleaned up');
        } catch (e) {
          console.error('Error cleaning up feed subscription:', e);
        }
      }
      
      unsubscribe(); // Clean up the subscription
      fetchInProgress.current = false;
    };
  }, [hasLoadedInitialNotes]);

  // Get social graph data from session storage
  useEffect(() => {
    const loadSocialGraphData = () => {
      try {
        const graphData = sessionStorage.getItem('madeira-social-graph');
        if (graphData) {
          const parsedData = JSON.parse(graphData);
          if (parsedData && Array.isArray(parsedData.npubs) && parsedData.npubs.length > 0) {
            console.log(`useNostrFeed: Loaded ${parsedData.npubs.length} npubs from social graph`);
            setSocialGraphNpubs(parsedData.npubs);
          }
        }
      } catch (e) {
        console.error('Error loading social graph data:', e);
      }
    };
    
    if (isClient) {
      loadSocialGraphData();
    }
    
    // Listen for storage events to update
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'madeira-social-graph' && event.newValue) {
        loadSocialGraphData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]);

  // Generate cache key
  const getCacheKey = useCallback(() => {
    const npubKey = npubs.length > 0 ? npubs.join('-').substring(0, 20) : 'all';
    return `feed-${npubKey}-${requiredHashtags.join('-')}`;
  }, [npubs, requiredHashtags]);

  // Filter notes based on criteria
  const filterNotes = useCallback((notes: Note[]): Note[] => {
    return notes.filter(note => {
      const content = note.content?.toLowerCase() || '';
      
      // Skip empty content
      if (!content.trim()) return false;
      
      // Filter NSFW content
      const hasNSFWKeywords = nsfwKeywords.some(keyword => 
        content.includes(keyword.toLowerCase()) || 
        note.hashtags.includes(keyword.toLowerCase())
      );
      if (hasNSFWKeywords) return false;
      
      // Check for required hashtags if specified
      if (requiredHashtags.length > 0) {
        const matchesRequiredHashtag = requiredHashtags.some(tag => 
          note.hashtags.includes(tag.toLowerCase()) || 
          content.includes(`#${tag.toLowerCase()}`) ||
          content.includes(tag.toLowerCase())
        );
        if (!matchesRequiredHashtag) return false;
      }
      
      // Check for filter keywords if specified
      if (filterKeywords.length > 0) {
        const matchesFilterKeyword = filterKeywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
        if (!matchesFilterKeyword) return false;
      }
      
      // Check for images if required
      if (onlyWithImages && (!note.images || note.images.length === 0)) {
        return false;
      }
      
      return true;
    });
  }, [requiredHashtags, filterKeywords, nsfwKeywords, onlyWithImages]);

  // Process Nostr event into a note
  const processEvent = useCallback((event: NDKEvent) => {
    if (!isMounted.current) return;
    
    try {
      // Extract event data
      const id = event.id;
      const content = event.content;
      const pubkey = event.pubkey;
      const created_at = event.created_at || 0;
      const npub = nip19.npubEncode(pubkey);
      
      // Extract images and hashtags
      const images = extractImageUrls(content);
      const hashtags = extractHashtags(content);
      
      // Create note object
      const note: Note = {
        id,
        created_at,
        content,
        pubkey,
        npub,
        author: {
          name: '',
          displayName: '',
          picture: '',
        },
        images,
        hashtags,
      };
      
      // Get profile info
      getUserProfile(npub).then(profile => {
        if (profile && isMounted.current) {
          setNotes(prevNotes => {
            const index = prevNotes.findIndex(n => n.id === id);
            if (index >= 0) {
              const updatedNotes = [...prevNotes];
              updatedNotes[index] = {
                ...updatedNotes[index],
                author: {
                  name: profile.name || '',
                  displayName: profile.displayName || profile.name || '',
                  picture: profile.picture || '',
                  nip05: profile.nip05
                }
              };
              return updatedNotes;
            }
            return prevNotes;
          });
        }
      }).catch(error => {
        console.warn(`Error fetching profile for ${npub}:`, error);
      });
      
      return note;
    } catch (error) {
      console.warn('Error processing event:', error);
      return null;
    }
  }, [getUserProfile]);

  // Main function to fetch notes
  const fetchNotes = useCallback(async () => {
    if (fetchInProgress.current || !isClient) return;
    
    fetchInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Get NDK instance from RelayService
      const ndk = RelayService.getNDK();
      
      if (!ndk) {
        setError('Nostr client not ready. Please try again later.');
        setRetryCount(prev => prev + 1);
        
        // If multiple failures, try reconnecting
        if (retryCount >= 2) {
          await RelayService.reconnect();
        }
        
        return;
      }
        
      // Check cache first
      const cacheKey = getCacheKey();
      const cachedNotes = noteCache[cacheKey];
      
      if (cachedNotes && Date.now() - cachedNotes.timestamp < CACHE_TTL) {
        console.log(`Using cached notes for ${cacheKey}`);
        setNotes(cachedNotes.notes);
        setLoading(false);
        setHasLoadedInitialNotes(true);
        return;
      }
      
      console.log(`Fetching notes with parameters:`, { 
        npubs: npubs.length > 0 ? npubs.slice(0, 3) : 'all', 
        requiredHashtags, 
        limit 
      });
      
      // Combine user's npubs with social graph npubs if WoT enabled
      const effectiveNpubs = useWebOfTrust && socialGraphNpubs.length > 0
        ? [...new Set([...npubs, ...socialGraphNpubs.slice(0, 50)])]
        : npubs;
      
      // Enhanced subscription options
      const mcpOptions: MCPNostrOptions = {
        enforceRealData: true,
        useWebOfTrust: useWebOfTrust && npubs.length > 0,
        maxSecondDegreeNodes: 50,
        coreNpubs: effectiveNpubs,
      };
      
      // Create filters
      let filter: NDKFilter = {
        kinds: [1], // Regular posts only
        limit: Math.min(limit * 2, 100) // Fetch more to account for filtering
      };
      
      // Add authors if specified
      if (effectiveNpubs.length > 0) {
        // Convert npubs to hex format
        const pubkeys = await Promise.all(effectiveNpubs.map(async (npubOrPk) => {
          try {
            return npubOrPk.startsWith('npub') 
              ? nip19.decode(npubOrPk).data as string 
              : npubOrPk;
          } catch (e) {
            return null;
          }
        }));
        
        filter.authors = pubkeys.filter(Boolean) as string[];
      }
      
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      
      // Create a regular subscription instead of using createEnhancedSubscription
      // to avoid type issues
      console.log('Creating subscription with filter:', filter);
      const subscription = ndk.subscribe(
        filter,
        { closeOnEose: false }
      );
      
      // Store the subscription reference for cleanup
      subscriptionRef.current = subscription;
      
      // Process events
      const processedNotes: Note[] = [];
      
      // Use NDK to fetch events with a timeout
      const timeoutPromise = new Promise<Set<NDKEvent>>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout fetching notes')), 10000)
      );
      
      const eventsPromise = ndk.fetchEvents([filter], { 
        closeOnEose: true,
        groupable: false
      });
      
      const events = await Promise.race([eventsPromise, timeoutPromise]);
      
      for (const event of events) {
        const note = processEvent(event);
        if (note) {
          processedNotes.push(note);
        }
      }
      
      // Sort by timestamp (newest first)
      processedNotes.sort((a, b) => b.created_at - a.created_at);
      
      // Apply filters
      const filteredNotes = filterNotes(processedNotes).slice(0, limit);
      
      // Update state
      setNotes(filteredNotes);
      setHasLoadedInitialNotes(true);
      
      // Cache results
      noteCache[cacheKey] = {
        notes: filteredNotes,
        timestamp: Date.now()
      };
      
      console.log(`Loaded ${filteredNotes.length} notes out of ${processedNotes.length} fetched`);
      
    } catch (error) {
      handleNostrError(error, 'useNostrFeed.fetchNotes');
      setError('Failed to fetch notes. Please try again later.');
    } finally {
      if (isMounted.current) {
        fetchInProgress.current = false;
        setLoading(false);
      }
    }
  }, [
    isClient, 
    npubs, 
    limit, 
    requiredHashtags, 
    useWebOfTrust, 
    socialGraphNpubs, 
    getCacheKey, 
    processEvent, 
    filterNotes
  ]);

  // Fetch notes when component mounts or when critical dependencies change
  useEffect(() => {
    if (isClient) {
      fetchNotes();
    }
    
    return () => {
      // Clean up subscription
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping subscription:', e);
        }
        subscriptionRef.current = null;
      }
    };
  }, [isClient, fetchNotes]);

  return {
    notes,
    loading,
    error,
    refresh: fetchNotes,
    relayCount
  };
} 