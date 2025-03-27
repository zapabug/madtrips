'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import Image from 'next/image';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { NostrProfileImage } from './NostrProfileImage';
import { extractImageUrls, extractHashtags, stripLinks } from './utils';

// Core npubs for the Madeira community
const CORE_NPUBS = [
  'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh', // MadTrips
  'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e', // Free Madeira
  'npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5', // Sovereign Individual
  'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc', // Funchal
];

// Madeira-related hashtags to filter by
const MADEIRA_HASHTAGS = [
  'madeira', 
  'travelmadeira', 
  'visitmadeira', 
  'funchal', 
  'fanal', 
  'espetada', 
  'freemadeira', 
  'madstr'
];

// NSFW-related keywords to filter out
const NSFW_KEYWORDS = [
  'nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', 
  '18+', 'explicit', 'content warning', 'cw'
];

interface MadeiraFeedProps {
  npubs?: string[];
  limit?: number;
  useCorePubs?: boolean;
  className?: string;
}

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

// Cache for storing fetched notes
const noteCache: {[key: string]: {notes: Note[], timestamp: number}} = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100;

export const MadeiraFeed: React.FC<MadeiraFeedProps> = ({ 
  npubs = [],
  limit = 25,
  useCorePubs = true,
  className = ''
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [socialGraphNpubs, setSocialGraphNpubs] = useState<string[]>([]);
  const [hasLoadedInitialNotes, setHasLoadedInitialNotes] = useState(false);
  
  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);

  // Use the appropriate npubs list
  const effectiveNpubs = useCorePubs 
    ? [...CORE_NPUBS, ...npubs] 
    : [...npubs];

  // Generate cache key
  const getCacheKey = useCallback(() => {
    const npubKey = effectiveNpubs.length > 0 ? effectiveNpubs.join('-').substring(0, 20) : 'all';
    return `madeira-${npubKey}`;
  }, [effectiveNpubs]);

  // Fetch friends-of-friends for social graph extension
  const fetchSocialGraph = useCallback(async (coreNpubs: string[]): Promise<string[]> => {
    if (!ndk) return [];
    
    try {
      const extendedNpubs = new Set<string>(coreNpubs);
      
      // For each core npub, get their contacts (NIP-02)
      for (const npub of coreNpubs) {
        try {
          // Decode npub to hex pubkey
          const { data: pubkey } = nip19.decode(npub);
          
          // Fetch kind 3 events (contact lists)
          const filter: NDKFilter = {
            kinds: [3],
            authors: [pubkey as string],
            limit: 1 // Only need the latest contact list
          };
          
          const events = await ndk.fetchEvents([filter]);
          
          for (const event of events) {
            // Process tags to extract contact pubkeys
            const contacts = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
              .filter(Boolean);
            
            // Convert hex pubkeys to npubs and add to set
            for (const contact of contacts) {
              try {
                const contactNpub = nip19.npubEncode(contact);
                extendedNpubs.add(contactNpub);
              } catch (e) {
                // Skip invalid pubkeys
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch contacts for ${npub}:`, e);
        }
      }
      
      return Array.from(extendedNpubs);
    } catch (e) {
      console.error('Error fetching social graph:', e);
      return coreNpubs;
    }
  }, [ndk]);

  // Fetch notes with hashtag filtering
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (fetchInProgress.current) {
      return;
    }
    
    if (!ndk) {
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        setError("Nostr connection not available. Retrying...");
        
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
        setNotes(cached.notes);
        setLoading(false);
        setHasLoadedInitialNotes(true);
        return;
      }
    }

    // Check if we have any connected relays
    const hasConnectedRelays = Array.from(ndk.pool.relays.values()).some(relay => relay.status === 1);
    
    if (!hasConnectedRelays) {
      setError("No connected relays. Attempting to reconnect...");
      
      const reconnected = await reconnect();
      if (!reconnected) {
        setError("Failed to connect to any Nostr relays. Please try again later.");
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    fetchInProgress.current = true;
    
    try {
      // Convert npubs to hex pubkeys
      const pubkeys = effectiveNpubs.map(npub => {
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
      
      if (pubkeys.length === 0) {
        setError("Invalid Nostr accounts");
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }
      
      // Extend the search with social graph if we've loaded initial notes
      if (hasLoadedInitialNotes && socialGraphNpubs.length > 0) {
        // Convert social graph npubs to hex pubkeys
        const socialPubkeys = socialGraphNpubs.map(npub => {
          if (npub.startsWith('npub1')) {
            try {
              const { data } = nip19.decode(npub);
              return data as string;
            } catch (err) {
              return null;
            }
          }
          return npub;
        }).filter(Boolean) as string[];
        
        // Combine core pubkeys with social graph pubkeys
        pubkeys.push(...socialPubkeys);
      }
      
      // Create filter with hashtags
      const filter: NDKFilter = {
        kinds: [1], // Text notes
        authors: pubkeys,
        limit: limit * 3 // Fetch more to allow for filtering
      };
      
      const events = await ndk.fetchEvents([filter]);
      
      // Process events into notes
      const processedNotes: Note[] = [];
      const profilePromises: { [key: string]: Promise<any> } = {};
      
      for (const event of events) {
        if (!event.pubkey) continue;
        
        const npub = nip19.npubEncode(event.pubkey);
        const content = event.content || '';
        
        // Check if the note contains any of the MADEIRA_HASHTAGS (case-insensitive)
        const eventHashtags = extractHashtags(content);
        
        // Only include notes with Madeira-related hashtags
        const hasMadeiraHashtag = eventHashtags.some(tag => 
          MADEIRA_HASHTAGS.some(madeiraTag => 
            tag.toLowerCase() === madeiraTag.toLowerCase()
          )
        );
        
        if (!hasMadeiraHashtag) continue;
        
        // Filter out NSFW content
        const hasNsfwKeywords = NSFW_KEYWORDS.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasNsfwKeywords) continue;
        
        // Extract images
        const extractedImages = extractImageUrls(content);
        
        // Only include notes with images 
        if (extractedImages.length === 0) continue;
        
        // Queue profile fetch (only once per pubkey)
        if (!profilePromises[npub]) {
          profilePromises[npub] = getUserProfile(npub).catch(err => {
            console.error(`Failed to fetch profile for ${npub}:`, err);
            return null;
          });
        }
        
        processedNotes.push({
          id: event.id || '', 
          created_at: event.created_at || 0,
          content: stripLinks(content),
          pubkey: event.pubkey,
          npub: npub,
          author: {}, // Will be populated later
          images: extractedImages,
          hashtags: eventHashtags
        });
      }
      
      // Fetch all profiles in parallel
      const fetchProfiles = async () => {
        try {
          const profileEntries = await Promise.all(
            Object.entries(profilePromises).map(async ([npub, promise]) => {
              const profile = await promise;
              return [npub, profile];
            })
          );
          
          // Create a map of npub to profile
          const profiles = Object.fromEntries(profileEntries);
          
          // Update notes with author information
          const notesWithProfiles = processedNotes.map(note => ({
            ...note,
            author: {
              name: profiles[note.npub]?.name || '',
              displayName: profiles[note.npub]?.displayName || '',
              picture: profiles[note.npub]?.picture || '',
              nip05: profiles[note.npub]?.nip05 || '',
            }
          }));
          
          // Sort by created_at timestamp (newest first)
          const sortedNotes = notesWithProfiles.sort((a, b) => b.created_at - a.created_at);
          
          // Cache the results
          noteCache[cacheKey] = {
            notes: sortedNotes,
            timestamp: Date.now()
          };
          
          // Prune cache if it gets too large
          const cacheKeys = Object.keys(noteCache);
          if (cacheKeys.length > MAX_CACHE_SIZE) {
            const oldestKey = cacheKeys.reduce((oldest, key) => 
              noteCache[key].timestamp < noteCache[oldest].timestamp ? key : oldest
            , cacheKeys[0]);
            
            delete noteCache[oldestKey];
          }
          
          setNotes(sortedNotes);
          setHasLoadedInitialNotes(true);
          
          return sortedNotes;
        } catch (error) {
          console.error('Error fetching profiles:', error);
          return processedNotes;
        }
      };
      
      await fetchProfiles();
      setLoading(false);
      fetchInProgress.current = false;
      
      // If this is the first successful fetch, get the social graph
      if (!hasLoadedInitialNotes) {
        // Asynchronously load the social graph to extend our search
        fetchSocialGraph(effectiveNpubs).then(extendedNpubs => {
          setSocialGraphNpubs(extendedNpubs);
        });
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to fetch posts. Please try again later.');
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [
    ndk, effectiveNpubs, limit, getCacheKey, getUserProfile, 
    reconnect, hasLoadedInitialNotes, socialGraphNpubs, retryCount, 
    fetchSocialGraph
  ]);

  // Setup live subscription for real-time updates
  const setupSubscription = useCallback(() => {
    if (!ndk || subscriptionRef.current) return;
    
    try {
      // Convert npubs to hex pubkeys for the filter
      const pubkeys = [...effectiveNpubs, ...socialGraphNpubs].map(npub => {
        if (npub.startsWith('npub1')) {
          try {
            const { data } = nip19.decode(npub);
            return data as string;
          } catch (err) {
            return null;
          }
        }
        return npub;
      }).filter(Boolean) as string[];
      
      // Create a filter for the subscription
      const filter: NDKFilter = {
        kinds: [1],
        authors: pubkeys,
        since: Math.floor(Date.now() / 1000) // Only new events from now on
      };
      
      // Create the subscription
      const sub = ndk.subscribe([filter], { closeOnEose: false });
      
      // Handle new events
      sub.on('event', async (event: NDKEvent) => {
        // Ignore events without pubkey
        if (!event.pubkey) return;
        
        const npub = nip19.npubEncode(event.pubkey);
        const content = event.content || '';
        
        // Extract hashtags and check if Madeira-related
        const eventHashtags = extractHashtags(content);
        const hasMadeiraHashtag = eventHashtags.some(tag => 
          MADEIRA_HASHTAGS.some(madeiraTag => 
            tag.toLowerCase() === madeiraTag.toLowerCase()
          )
        );
        
        // Skip if not Madeira-related
        if (!hasMadeiraHashtag) return;
        
        // Filter out NSFW content
        const hasNsfwKeywords = NSFW_KEYWORDS.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasNsfwKeywords) return;
        
        // Extract images and skip if none
        const extractedImages = extractImageUrls(content);
        if (extractedImages.length === 0) return;
        
        // Fetch profile for this author
        const profile = await getUserProfile(npub).catch(() => null);
        
        // Create the note object
        const newNote: Note = {
          id: event.id || '',
          created_at: event.created_at || Math.floor(Date.now() / 1000),
          content: stripLinks(content),
          pubkey: event.pubkey,
          npub: npub,
          author: {
            name: profile?.name || '',
            displayName: profile?.displayName || '',
            picture: profile?.picture || '',
            nip05: profile?.nip05 || '',
          },
          images: extractedImages,
          hashtags: eventHashtags
        };
        
        // Update the notes list with the new note
        setNotes(prevNotes => {
          // Check if we already have this note
          if (prevNotes.some(note => note.id === newNote.id)) {
            return prevNotes;
          }
          
          // Add to the beginning and maintain sort order
          const updatedNotes = [newNote, ...prevNotes];
          return updatedNotes.sort((a, b) => b.created_at - a.created_at);
        });
      });
      
      subscriptionRef.current = sub;
      
      // Unsubscribe on cleanup
      return () => {
        sub.stop();
        subscriptionRef.current = null;
      };
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }
  }, [ndk, effectiveNpubs, socialGraphNpubs, getUserProfile]);

  // Initial fetch and setup
  useEffect(() => {
    if (ndkReady) {
      fetchNotes();
    }
  }, [ndkReady, fetchNotes]);
  
  // Setup subscription after initial fetch
  useEffect(() => {
    if (ndkReady && hasLoadedInitialNotes) {
      setupSubscription();
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [ndkReady, hasLoadedInitialNotes, setupSubscription]);

  // Update social graph when we have new npubs
  useEffect(() => {
    if (socialGraphNpubs.length > 0 && ndkReady && hasLoadedInitialNotes) {
      fetchNotes(true);
    }
  }, [socialGraphNpubs, ndkReady, hasLoadedInitialNotes, fetchNotes]);

  if (loading && notes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-forest"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Loading Madeira updates...</p>
        </div>
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button 
            onClick={() => fetchNotes(true)} 
            className="mt-2 px-4 py-2 bg-forest text-white rounded hover:bg-forest/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-hidden ${className}`}>
      {notes.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No Madeira updates found.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 p-4 overflow-auto h-full">
          {notes.map(note => (
            <div 
              key={note.id} 
              className="relative w-full sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] xl:w-[calc(25%-12px)] overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 aspect-square group"
            >
              <div className="relative w-full h-full">
                {/* Main image */}
                <Image
                  src={note.images[0]}
                  alt={note.author.name || note.author.displayName || 'Madeira update'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                  unoptimized
                  onError={(e) => {
                    // Fallback to placeholder on error
                    (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
                  }}
                />
                
                {/* Profile overlay */}
                <div className="absolute top-2 left-2 z-10">
                  <NostrProfileImage 
                    npub={note.npub} 
                    width={40} 
                    height={40} 
                    className="border-2 border-white shadow-md" 
                  />
                </div>
                
                {/* Content overlay - visible on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                  <div className="text-white">
                    <h3 className="font-semibold text-sm">
                      {note.author.displayName || note.author.name || shortenNpub(note.npub)}
                    </h3>
                    <p className="text-xs mt-1 line-clamp-3">{note.content}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.hashtags.map(tag => (
                        <span 
                          key={tag} 
                          className={`text-xxs px-1.5 py-0.5 rounded-full ${
                            MADEIRA_HASHTAGS.includes(tag.toLowerCase()) 
                              ? 'bg-forest/80 text-white' 
                              : 'bg-gray-200/80 text-gray-800'
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MadeiraFeed; 