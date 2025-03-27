'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import Image from 'next/image';
import { stripLinks, extractImageUrls, extractHashtags } from '../../utils/nostrUtils';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { RELAYS } from '../../constants/relays';
import { useSocialGraph } from '../../lib/contexts/SocialGraphContext';

// NSFW-related keywords to filter out
const NSFW_KEYWORDS = [
  'nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', 
  '18+', 'explicit', 'content warning', 'cw'
];

interface CommunityUpdatesProps {
  npubs: string[];
  limit?: number;
  rotationInterval?: number; // Time in ms between image rotations
  minImages?: number; // Minimum images to display
  autoScroll?: boolean; // Whether to auto-scroll through notes
  scrollInterval?: number; // Time in ms between scrolls
  hashtags?: string[]; // Optional hashtags to filter by
  imageOnly?: boolean; // Whether to only show notes with images
}

// Define custom UserProfile type
interface UserProfile {
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
  // Add other profile fields as needed
}

// Update the note interface
interface Note {
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

// Cache for storing fetched notes by hashtag
const noteCache: {[hashtag: string]: {notes: Note[], timestamp: number}} = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of notes to store in cache

export const CommunityUpdates: React.FC<CommunityUpdatesProps> = ({ 
  npubs, 
  limit = 30, // Increased from 50 to 30 for optimal initial loading
  rotationInterval = 5000,
  minImages = 20, // Increased from 10 to 20 for more variety
  autoScroll = false,
  scrollInterval = 1000,
  hashtags = [],
  imageOnly = true
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const { graph, graphLoading } = useSocialGraph();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredImageNotes, setFilteredImageNotes] = useState<Note[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [recentAuthors, setRecentAuthors] = useState<string[]>([]);
  
  const rotationTimerRef = useRef<number | null>(null);
  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  
  // Generate cache key based on hashtags and npubs
  const getCacheKey = useCallback(() => {
    const tagKey = hashtags.length > 0 ? hashtags.sort().join('-') : 'all';
    const npubKey = npubs.length > 0 ? npubs.join('-').substring(0, 20) : 'all';
    return `${tagKey}-${npubKey}${imageOnly ? '-img' : ''}`;
  }, [hashtags, npubs, imageOnly]);
  
  // After notes are loaded, filter only those with images if imageOnly is true
  useEffect(() => {
    if (imageOnly) {
      const notesWithImages = notes.filter(note => note.images && note.images.length > 0);
      setFilteredImageNotes(notesWithImages);
      
      // Reset the image index when the filtered notes change
      if (notesWithImages.length > 0) {
        setCurrentImageIndex(0);
      }

      // Extract recent authors for SocialGraph integration
      const uniqueAuthors = new Set<string>();
      notesWithImages.forEach(note => {
        if (note.npub) {
          uniqueAuthors.add(note.npub);
        }
      });
      setRecentAuthors(Array.from(uniqueAuthors));
    } else {
      setFilteredImageNotes(notes);
      
      // Extract recent authors for SocialGraph integration from all notes
      const uniqueAuthors = new Set<string>();
      notes.forEach(note => {
        if (note.npub) {
          uniqueAuthors.add(note.npub);
        }
      });
      setRecentAuthors(Array.from(uniqueAuthors));
    }
  }, [notes, imageOnly]);
  
  // Handle image transitions with animation
  const transitionToNextImage = useCallback((nextIndex: number) => {
    if (nextIndex === currentImageIndex) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex(nextIndex);
      // Short delay to ensure the new image is rendered before removing the transition effect
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300); // Match this with the CSS transition duration
  }, [currentImageIndex]);
  
  // Setup image rotation
  useEffect(() => {
    if (filteredImageNotes.length === 0) return;
    
    // Clear any existing timer
    if (rotationTimerRef.current) {
      window.clearInterval(rotationTimerRef.current);
    }
    
    // Set up the rotation timer
    rotationTimerRef.current = window.setInterval(() => {
      const nextIndex = (currentImageIndex + 1) % filteredImageNotes.length;
      transitionToNextImage(nextIndex);
    }, rotationInterval);
    
    // Cleanup function
    return () => {
      if (rotationTimerRef.current) {
        window.clearInterval(rotationTimerRef.current);
      }
    };
  }, [filteredImageNotes, rotationInterval, currentImageIndex, transitionToNextImage]);
  
  // Check if a relay supports hashtag search using NIP-50
  const testRelaySupportsHashtagSearch = useCallback(async (relayUrl: string, testTag: string): Promise<boolean> => {
    if (!ndk) return false;
    
    try {
      // Find the relay object
      const relay = Array.from(ndk.pool.relays.values()).find(r => r.url === relayUrl);
      if (!relay) return false;
      
      // Create a test filter using NIP-50 search
      const filter: NDKFilter = {
        kinds: [1],
        limit: 5,
        search: `#${testTag}`
      };
      
      // Try to fetch events with this filter
      // Use proper NDKSubscriptionOptions interface
      const events = await ndk.fetchEvents([filter], { 
        relaySet: [relay] 
      });
      
      // Check if we got any results that actually have the hashtag
      for (const event of events) {
        const content = event.content || '';
        if (content.includes(`#${testTag}`)) {
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.log(`Relay ${relayUrl} does not support hashtag search:`, err);
      return false;
    }
  }, [ndk]);
  
  // Fetch notes with optimized strategy based on hashtags
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping duplicate request');
      return;
    }
    
    if (!ndk) {
      if (retryCount < 3) {
        console.log(`NDK not available, retry ${retryCount + 1}/3`);
        setRetryCount(prev => prev + 1);
        setError("Nostr connection not available. Retrying...");
        
        // Try to reconnect and then fetch again after a delay
        const reconnected = await reconnect();
        if (reconnected) {
          setTimeout(() => fetchNotes(), 1000);
        } else {
          setError("Could not connect to Nostr relays. Please try again later.");
          setLoading(false);
        }
        return;
      } else {
        setError("Nostr connection not available after multiple attempts");
        setLoading(false);
        return;
      }
    }
    
    const cacheKey = getCacheKey();
    
    // Check cache first unless forceRefresh is true
    if (!forceRefresh) {
      const cached = noteCache[cacheKey];
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log('Using cached notes for', cacheKey);
        setNotes(cached.notes);
        setLoading(false);
        return;
      }
    }
    
    // Check if we have any connected relays
    const hasConnectedRelays = Array.from(ndk.pool.relays.values()).some(relay => relay.status === 1);
    
    if (!hasConnectedRelays) {
      console.log('No connected relays found, attempting to reconnect...');
      setError("No connected relays. Attempting to reconnect...");
      
      // Try to reconnect to relays
      const reconnected = await reconnect();
      if (!reconnected) {
        setError("Failed to connect to any Nostr relays. Please try again later.");
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    fetchInProgress.current = true;
    
    if (forceRefresh) {
      setError(null);
    }
    
    try {
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }
      
      // Convert npubs to hex pubkeys
      const pubkeys = npubs.map(npub => {
        if (npub.startsWith('npub1')) {
          try {
            const { data } = nip19.decode(npub);
            return data as string;
          } catch (err) {
            console.error('Failed to decode npub:', npub, err);
            return null;
          }
        }
        return npub;
      }).filter(Boolean) as string[];
      
      // Enhance with follows from social graph if available
      let enhancedPubkeys = [...pubkeys];
      
      if (graph && pubkeys.length > 0) {
        // Get follows from social graph for all specified npubs
        const graphFollows = pubkeys.flatMap(pubkey => 
          graph.getFollowing(pubkey).slice(0, 20) // Limit to prevent too many
        );
        
        // Add unique pubkeys from graph
        graphFollows.forEach(pubkey => {
          if (!enhancedPubkeys.includes(pubkey)) {
            enhancedPubkeys.push(pubkey);
          }
        });
        
        console.log(`Enhanced with ${enhancedPubkeys.length - pubkeys.length} additional pubkeys from social graph`);
      }
      
      if (enhancedPubkeys.length === 0 && hashtags.length === 0) {
        setError("No Nostr accounts or hashtags specified");
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }
      
      // Determine if we can use the optimized relay hashtag search
      let useHashtagSearch = false;
      if (hashtags.length > 0) {
        // Try to use relay.olas.app for hashtag search
        useHashtagSearch = await testRelaySupportsHashtagSearch('wss://relay.olas.app', hashtags[0]);
      }
      
      let filter: NDKFilter;
      let preferredRelays = [...RELAYS.PRIMARY];
      
      // Create filter based on available capabilities
      if (hashtags.length > 0 && useHashtagSearch) {
        // Use NIP-50 search for hashtags
        filter = {
          kinds: [1],
          search: hashtags.map(t => `#${t}`).join(' '),
          limit: limit * 3 
        };
        
        // Prefer relay.olas.app for hashtag search
        preferredRelays = ['wss://relay.olas.app', ...preferredRelays];
      } else if (enhancedPubkeys.length > 15) {
        // Split into batches to prevent relay issues
        const batchSize = 15;
        const pubkeyBatches: string[][] = [];
        
        for (let i = 0; i < enhancedPubkeys.length; i += batchSize) {
          pubkeyBatches.push(enhancedPubkeys.slice(i, i + batchSize));
        }
        
        console.log(`Split ${enhancedPubkeys.length} pubkeys into ${pubkeyBatches.length} batches`);
        
        // Create parallel filter promises
        const filterPromises = pubkeyBatches.map(batch => {
          const batchFilter: NDKFilter = {
            kinds: [1],
            authors: batch,
            limit: Math.ceil(limit * 3 / pubkeyBatches.length)
          };
          
          // Add hashtags if needed
          if (hashtags.length > 0) {
            (batchFilter as any)['#t'] = hashtags;
          }
          
          // Create proper relay set from relay objects
          const relayObjects = Array.from(ndk.pool.relays.values())
            .filter(relay => preferredRelays.includes(relay.url));
          
          return ndk.fetchEvents([batchFilter], { relaySet: relayObjects });
        });
        
        // Wait for all batches
        const batchResults = await Promise.allSettled(filterPromises);
        
        // Combine results
        const events = new Set<NDKEvent>();
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            result.value.forEach(event => events.add(event));
          }
        });
        
        // Continue processing with the combined events
        console.log(`Fetched ${events.size} events from all batches`);
        
        // Process events into notes
        const processedNotes: Note[] = [];
        const profilePromises: { [key: string]: Promise<any> } = {};
        
        // First pass: collect events and setup profile fetching
        for (const event of Array.from(events)) {
          if (!event.pubkey) continue;
          
          const npub = nip19.npubEncode(event.pubkey);
          const content = event.content || '';
          
          // Extract hashtags from content
          const extractedHashtags = extractHashtags(content);
          
          // If filtering by hashtags, ensure at least one matches
          if (hashtags.length > 0 && !extractedHashtags.some(tag => hashtags.includes(tag))) {
            // Skip events without matching hashtags
            continue;
          }
          
          // Filter out NSFW content
          const contentLower = content.toLowerCase();
          const isNSFW = NSFW_KEYWORDS.some(keyword => 
            contentLower.includes(keyword) || 
            extractedHashtags.some(tag => tag.toLowerCase() === keyword)
          );
          
          if (isNSFW) {
            // Skip NSFW content
            continue;
          }
          
          // Extract image URLs
          const extractedImages = validateAndFilterImages(extractImageUrls(content));
          
          // Skip if we only want images and there are none
          if (imageOnly && extractedImages.length === 0) {
            continue;
          }
          
          // Queue profile fetch (only once per pubkey)
          if (!profilePromises[npub]) {
            profilePromises[npub] = getUserProfile(npub).catch(err => {
              console.error(`Failed to fetch profile for ${npub}:`, err);
              return null;
            });
          }
          
          // Add to processed notes
          processedNotes.push({
            id: event.id || '', 
            created_at: event.created_at || 0,
            content: stripLinks(content),
            pubkey: event.pubkey,
            npub: npub,
            author: {}, // Will be populated later
            images: extractedImages,
            hashtags: extractedHashtags
          });
        }
        
        // Fetch all profiles in parallel with timeout safety
        const fetchProfiles = async () => {
          try {
            const profiles = await Promise.all(
              Object.values(profilePromises).map(p => p.catch(() => null))
            );
            return Object.fromEntries(
              Object.keys(profilePromises).map((npub, i) => [npub, profiles[i]])
            );
          } catch (err) {
            console.error('Error fetching profiles:', err);
            return {};
          }
        };
        
        const profileTimeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve({}), 5000);
        });
        
        // Define the type for profileMap
        const profileMap: Record<string, UserProfile | null> = 
          await Promise.race([fetchProfiles(), profileTimeoutPromise as Promise<Record<string, UserProfile | null>>]);
        
        // Add author info to notes
        const completeNotes = processedNotes.map(note => ({
          ...note,
          author: profileMap[note.npub] ? {
            name: profileMap[note.npub]?.name,
            displayName: profileMap[note.npub]?.displayName,
            picture: profileMap[note.npub]?.picture,
            nip05: profileMap[note.npub]?.nip05
          } : {}
        }));
        
        // Sort by created_at in descending order (newest first)
        completeNotes.sort((a, b) => b.created_at - a.created_at);
        
        // Take at most MAX_CACHE_SIZE notes for the cache
        const cachedNotes = completeNotes.slice(0, MAX_CACHE_SIZE);
        
        // Take at most 'limit' notes for display
        const limitedNotes = completeNotes.slice(0, limit);
        
        // Save to cache
        noteCache[cacheKey] = {
          notes: cachedNotes,
          timestamp: Date.now()
        };
        
        setNotes(limitedNotes);
        setLoading(false);
        setError(null);
        setRetryCount(0);
        
        // Skip the rest of the function
        fetchInProgress.current = false;
        return;
      } else {
        // Use standard filter for smaller pubkey lists
        filter = {
          kinds: [1],
          limit: limit * 6
        };
        
        // Add authors filter if available
        if (enhancedPubkeys.length > 0) {
          filter.authors = enhancedPubkeys;
        }
        
        // Add t tags filter if we have hashtags but no hashtag search support
        if (hashtags.length > 0) {
          (filter as any)['#t'] = hashtags;
        }
      }
      
      console.log('Fetching events with filter:', filter, 'preferred relays:', preferredRelays);
      
      // Create a specialized relay set for image-heavy queries
      const imageRelays = ndk.pool.relays.values();
      const relaySet = Array.from(imageRelays)
        .filter(relay => preferredRelays.includes(relay.url));
      
      // Check if filter has any properties before using it
      if (!filter || Object.keys(filter).length === 0) {
        console.error("Empty filter object - cannot fetch events");
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }
      
      // Use timeout for fetching
      // Use proper NDKSubscriptionOptions interface
      const fetchPromise = ndk.fetchEvents([filter], { 
        relaySet 
      });
      const timeoutPromise = new Promise<Set<NDKEvent>>((_, reject) => 
        setTimeout(() => reject(new Error('Events fetch timeout')), 8000)
      );
      
      const events = await Promise.race([fetchPromise, timeoutPromise])
        .catch(async (err) => {
          console.error('Events fetch error, trying reconnect:', err);
          await reconnect();
          return new Set<NDKEvent>();
        });
        
      console.log(`Fetched ${events.size} events`);
      
      if (events.size === 0 && retryCount < 2) {
        console.log(`No events found, retry ${retryCount + 1}/2`);
        setRetryCount(prev => prev + 1);
        
        await reconnect();
        setTimeout(() => fetchNotes(true), 1000);
        return;
      }
      
      // Process events into notes
      const processedNotes: Note[] = [];
      const profilePromises: { [key: string]: Promise<any> } = {};
      
      // First pass: collect events and setup profile fetching
      for (const event of Array.from(events)) {
        if (!event.pubkey) continue;
        
        const npub = nip19.npubEncode(event.pubkey);
        const content = event.content || '';
        
        // Extract hashtags from content
        const extractedHashtags = extractHashtags(content);
        
        // If filtering by hashtags, ensure at least one matches
        if (hashtags.length > 0 && !extractedHashtags.some(tag => hashtags.includes(tag))) {
          // Skip events without matching hashtags
          continue;
        }
        
        // Filter out NSFW content
        const contentLower = content.toLowerCase();
        const isNSFW = NSFW_KEYWORDS.some(keyword => 
          contentLower.includes(keyword) || 
          extractedHashtags.some(tag => tag.toLowerCase() === keyword)
        );
        
        if (isNSFW) {
          // Skip NSFW content
          continue;
        }
        
        // Extract image URLs
        const extractedImages = validateAndFilterImages(extractImageUrls(content));
        
        // Skip if we only want images and there are none
        if (imageOnly && extractedImages.length === 0) {
          continue;
        }
        
        // Queue profile fetch (only once per pubkey)
        if (!profilePromises[npub]) {
          profilePromises[npub] = getUserProfile(npub).catch(err => {
            console.error(`Failed to fetch profile for ${npub}:`, err);
            return null;
          });
        }
        
        // Add to processed notes
        processedNotes.push({
          id: event.id || '', 
          created_at: event.created_at || 0,
          content: stripLinks(content),
          pubkey: event.pubkey,
          npub: npub,
          author: {}, // Will be populated later
          images: extractedImages,
          hashtags: extractedHashtags
        });
      }
      
      // Fetch all profiles in parallel with timeout safety
      const fetchProfiles = async () => {
        try {
          const profiles = await Promise.all(
            Object.values(profilePromises).map(p => p.catch(() => null))
          );
          return Object.fromEntries(
            Object.keys(profilePromises).map((npub, i) => [npub, profiles[i]])
          );
        } catch (err) {
          console.error('Error fetching profiles:', err);
          return {};
        }
      };
      
      const profileTimeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({}), 5000);
      });
      
      // Define the type for profileMap
      const profileMap: Record<string, UserProfile | null> = 
        await Promise.race([fetchProfiles(), profileTimeoutPromise as Promise<Record<string, UserProfile | null>>]);
      
      // Add author info to notes
      const completeNotes = processedNotes.map(note => ({
        ...note,
        author: profileMap[note.npub] ? {
          name: profileMap[note.npub]?.name,
          displayName: profileMap[note.npub]?.displayName,
          picture: profileMap[note.npub]?.picture,
          nip05: profileMap[note.npub]?.nip05
        } : {}
      }));
      
      // Sort by created_at in descending order (newest first)
      completeNotes.sort((a, b) => b.created_at - a.created_at);
      
      // Take at most MAX_CACHE_SIZE notes for the cache
      const cachedNotes = completeNotes.slice(0, MAX_CACHE_SIZE);
      
      // Take at most 'limit' notes for display
      const limitedNotes = completeNotes.slice(0, limit);
      
      // Save to cache
      noteCache[cacheKey] = {
        notes: cachedNotes,
        timestamp: Date.now()
      };
      
      setNotes(limitedNotes);
      setLoading(false);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load posts. Please try again later.');
      setLoading(false);
    } finally {
      fetchInProgress.current = false;
    }
  }, [ndk, npubs, limit, hashtags, getCacheKey, reconnect, retryCount, imageOnly, getUserProfile, testRelaySupportsHashtagSearch, graph]);
  
  // Initial fetch when NDK is ready
  useEffect(() => {
    if (ndkReady) {
      fetchNotes();
    }
  }, [fetchNotes, ndkReady]);
  
  // Set up reconnection attempt if NDK is not ready
  useEffect(() => {
    if (!ndkReady && !fetchInProgress.current && retryCount < 3) {
      const timer = setTimeout(async () => {
        console.log('Attempting to reconnect to relays...');
        await reconnect();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ndkReady, reconnect, retryCount]);

  // Refresh periodically when visible
  useEffect(() => {
    const refreshInterval = 180000; // Refresh every 3 minutes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotes(true);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchNotes]);
  
  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }
      
      if (rotationTimerRef.current) {
        window.clearInterval(rotationTimerRef.current);
      }
    };
  }, []);

  // Validate image URLs when extracting
  const validateAndFilterImages = useCallback((imageUrls: string[]): string[] => {
    return imageUrls.filter(url => {
      // Must start with http:// or https://
      if (!url.match(/^https?:\/\//i)) return false;
      
      // Ignore tiny images that are likely icons
      if (url.includes('favicon') || url.includes('icon')) return false;
      
      // Additional checks for common valid image extensions
      const hasValidExtension = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
      
      return hasValidExtension;
    });
  }, []);

  // Add real-time subscription for new notes
  useEffect(() => {
    // Only set up subscription if NDK is ready
    if (!ndk || !ndkReady || !npubs.length) return;

    // Clean up any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.stop();
    }

    // Convert npubs to hex pubkeys for subscription
    const pubkeys = npubs.map(npub => {
      if (npub.startsWith('npub1')) {
        try {
          const { data } = nip19.decode(npub);
          return data as string;
        } catch (err) {
          console.error('Failed to decode npub:', npub, err);
          return null;
        }
      }
      return npub;
    }).filter(Boolean) as string[];

    // Create subscription filter
    const filter: NDKFilter = {
      kinds: [1], // Text notes
      authors: pubkeys,
      limit: 10, // Only get latest notes
      since: Math.floor(Date.now() / 1000) - 60 // Get notes from last minute
    };

    // Add hashtag filter if applicable
    if (hashtags.length > 0) {
      (filter as any)['#t'] = hashtags;
    }

    // Check if filter has any properties before subscribing
    if (!filter || Object.keys(filter).length === 0) {
      console.error("Empty filter object - cannot create subscription");
      return;
    }

    // Create subscription
    try {
      const sub = ndk.subscribe([filter], { closeOnEose: false });
      
      // Handle new events
      sub.on('event', async (event: NDKEvent) => {
        if (!event.pubkey || !event.content) return;
        
        const npub = nip19.npubEncode(event.pubkey);
        const content = event.content;
        
        // Extract hashtags
        const extractedHashtags = extractHashtags(content);
        
        // Check if any hashtag matches our filter (if we have one)
        if (hashtags.length > 0 && !extractedHashtags.some(tag => hashtags.includes(tag))) {
          return;
        }
        
        // Filter NSFW content
        const contentLower = content.toLowerCase();
        const isNSFW = NSFW_KEYWORDS.some(keyword => 
          contentLower.includes(keyword) || 
          extractedHashtags.some(tag => tag.toLowerCase() === keyword)
        );
        
        if (isNSFW) return;
        
        // Extract and validate images
        const extractedImages = validateAndFilterImages(extractImageUrls(content));
        
        // Skip if we only want images and there are none
        if (imageOnly && extractedImages.length === 0) return;
        
        // Get user profile
        const profile = await getUserProfile(npub);
        
        // Create new note
        const newNote: Note = {
          id: event.id || '',
          created_at: event.created_at || Math.floor(Date.now() / 1000),
          content: stripLinks(content),
          pubkey: event.pubkey,
          npub: npub,
          author: {
            name: profile?.name,
            displayName: profile?.displayName,
            picture: profile?.picture,
            nip05: profile?.nip05
          },
          images: extractedImages,
          hashtags: extractedHashtags
        };
        
        // Add the new note to our list
        setNotes(prevNotes => {
          // Check if we already have this note
          if (prevNotes.some(note => note.id === newNote.id)) {
            return prevNotes;
          }
          
          // Add new note and sort by timestamp (newest first)
          const updatedNotes = [newNote, ...prevNotes]
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, MAX_CACHE_SIZE); // Keep in memory cache up to MAX_CACHE_SIZE
          
          // Update the cache with this new note
          const cacheKey = getCacheKey();
          if (noteCache[cacheKey]) {
            noteCache[cacheKey] = {
              notes: updatedNotes,
              timestamp: Date.now()
            };
          }
          
          // Only display up to limit notes
          return updatedNotes.slice(0, limit);
        });
      });
      
      // Save subscription reference
      subscriptionRef.current = sub;
      
      // Return cleanup function
      return () => {
        sub.stop();
      };
    } catch (err) {
      console.error('Error setting up real-time subscription:', err);
    }
  }, [ndk, ndkReady, npubs, hashtags, imageOnly, limit, getUserProfile]);

  return (
    <div className="w-full">
      {loading && filteredImageNotes.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin"></div>
          <p className="ml-3 text-bitcoin">Loading images{hashtags.length > 0 ? ` with #${hashtags.join(', #')}` : ''}...</p>
        </div>
      )}
      
      {error && (
        <div className="text-center p-4 bg-red-50 dark:bg-red-900 rounded-lg">
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => fetchNotes(true)}
            className="mt-2 px-4 py-2 bg-bitcoin text-white rounded-lg hover:bg-bitcoin/80"
          >
            Try Again
          </button>
        </div>
      )}
      
      {!loading && !error && filteredImageNotes.length === 0 && (
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">
            No {imageOnly ? 'images' : 'posts'} found
            {hashtags.length > 0 ? ` with #${hashtags.join(', #')}` : ''}
          </p>
        </div>
      )}
      
      {filteredImageNotes.length > 0 && currentImageIndex < filteredImageNotes.length && (
        <div className="relative rounded-lg overflow-hidden w-full aspect-video bg-gray-800">
          {/* Main image with animation */}
          <div 
            className="relative w-full h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ 
              transform: `translateX(${isTransitioning ? '-20px' : '0px'})`,
              opacity: isTransitioning ? 0 : 1
            }}
          >
            <Image 
              src={filteredImageNotes[currentImageIndex].images[0]} 
              alt="Nostr image"
              fill
              sizes="100vw"
              priority={true}
              className="object-contain"
              onError={(e) => {
                // Handle image loading error
                (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
              }}
            />
            
            {/* Author profile overlay with NIP-05 verification */}
            <a 
              href={`https://njump.me/${filteredImageNotes[currentImageIndex].npub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 left-4 flex items-center bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-bitcoin">
                <Image 
                  src={filteredImageNotes[currentImageIndex].author.picture || '/assets/bitcoin.png'} 
                  alt={filteredImageNotes[currentImageIndex].author.displayName || "Profile"}
                  width={40}
                  height={40}
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
                  }}
                />
              </div>
              <div className="ml-2 text-white">
                <div className="flex items-center gap-1">
                  <p className="font-medium">
                    {filteredImageNotes[currentImageIndex].author.displayName || 
                     filteredImageNotes[currentImageIndex].author.name || 
                     shortenNpub(filteredImageNotes[currentImageIndex].npub)}
                  </p>
                  {filteredImageNotes[currentImageIndex].author.nip05 && (
                    <span title={`Verified as ${filteredImageNotes[currentImageIndex].author.nip05}`} className="text-xs bg-green-500 text-white rounded-full px-1 flex items-center">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-80">
                  {new Date(filteredImageNotes[currentImageIndex].created_at * 1000).toLocaleDateString()}
                </p>
              </div>
            </a>
            
            {/* Display hashtags if present */}
            {filteredImageNotes[currentImageIndex].hashtags.length > 0 && (
              <div className="absolute top-4 right-4 flex flex-wrap gap-1 max-w-[70%] justify-end">
                {filteredImageNotes[currentImageIndex].hashtags.map((tag, index) => (
                  <span 
                    key={`${tag}-${filteredImageNotes[currentImageIndex].id}-${index}`} 
                    className="text-xs bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Image navigation dots */}
          <div className="absolute bottom-4 right-4 flex space-x-2">
            {filteredImageNotes.map((_, index) => (
              <button
                key={index}
                onClick={() => transitionToNextImage(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? 'bg-bitcoin scale-125' 
                    : 'bg-gray-400/50 hover:bg-gray-400'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Export recent authors as a hidden data attribute for parent components */}
      <div data-recent-authors={JSON.stringify(recentAuthors)} className="hidden" />
    </div>
  );
};

export default CommunityUpdates; 