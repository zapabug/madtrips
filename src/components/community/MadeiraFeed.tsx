'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import Image from 'next/image';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { NostrProfileImage } from './NostrProfileImage';
import { extractImageUrls, extractHashtags, stripLinks } from './utils';
import { CORE_NPUBS } from './utils';
import { RELAYS } from '../../constants/relays';

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

// Image cache for the feed
const IMAGE_CACHE = new Map<string, HTMLImageElement>();
const MAX_IMAGE_CACHE_SIZE = 100;

// Function to preload images for better performance
const preloadImage = (url: string): Promise<HTMLImageElement> => {
  // Check if image is already in cache
  if (url && IMAGE_CACHE.has(url)) {
    return Promise.resolve(IMAGE_CACHE.get(url)!);
  }
  
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (!url) {
      reject(new Error('Invalid image URL'));
      return;
    }
    
    const img = document.createElement('img') as HTMLImageElement;
    img.onload = () => {
      // Manage cache size
      if (IMAGE_CACHE.size >= MAX_IMAGE_CACHE_SIZE) {
        // Remove oldest item (first key in the map)
        const firstKey = IMAGE_CACHE.keys().next().value;
        if (firstKey) {
          IMAGE_CACHE.delete(firstKey);
        }
      }
      IMAGE_CACHE.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
};

export const MadeiraFeed: React.FC<MadeiraFeedProps> = ({ 
  npubs = [],
  limit = 25,
  useCorePubs = true,
  className = ''
}) => {
  const { ndk, getUserProfile, reconnect, ndkReady, getConnectedRelays, shortenNpub } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [socialGraphNpubs, setSocialGraphNpubs] = useState<string[]>([]);
  const [hasLoadedInitialNotes, setHasLoadedInitialNotes] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  
  const fetchInProgress = useRef<boolean>(false);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const isMounted = useRef<boolean>(false);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set isClient on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Use the appropriate npubs list - using canonical source
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
    if (!ndk || !isMounted.current) return [];
    
    console.log("MadeiraFeed: Fetching social graph contacts from:", coreNpubs.map(npub => npub.substring(0, 10) + '...').join(', '));
    
    try {
      const extendedNpubs = new Set<string>(coreNpubs);
      let contactsFound = 0;
      
      // For each core npub, get their contacts (NIP-02)
      for (const npub of coreNpubs) {
        try {
          // Decode npub to hex pubkey
          const { data: pubkey } = nip19.decode(npub);
          
          console.log(`MadeiraFeed: Fetching contacts for ${npub.substring(0, 10)}... (${(pubkey as string).substring(0, 8)}...)`);
          
          // Fetch kind 3 events (contact lists)
          const filter: NDKFilter = {
            kinds: [3],
            authors: [pubkey as string],
            limit: 1 // Only need the latest contact list
          };
          
          const events = await ndk.fetchEvents([filter], { closeOnEose: true });
          
          if (events.size === 0) {
            console.log(`MadeiraFeed: No contacts found for ${npub.substring(0, 10)}...`);
            continue;
          }
          
          for (const event of events) {
            // Process tags to extract contact pubkeys
            const contacts = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
              .filter(Boolean);
            
            console.log(`MadeiraFeed: Found ${contacts.length} contacts for ${npub.substring(0, 10)}...`);
            
            // Convert hex pubkeys to npubs and add to set
            for (const contact of contacts) {
              try {
                const contactNpub = nip19.npubEncode(contact);
                if (!extendedNpubs.has(contactNpub)) {
                  extendedNpubs.add(contactNpub);
                  contactsFound++;
                }
              } catch (e) {
                // Skip invalid pubkeys
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch contacts for ${npub}:`, e);
        }
      }
      
      console.log(`MadeiraFeed: Added ${contactsFound} unique contacts to social graph`);
      return Array.from(extendedNpubs);
    } catch (e) {
      console.error('Error fetching social graph:', e);
      return coreNpubs;
    }
  }, [ndk]);

  // Fetch notes with hashtag filtering
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (fetchInProgress.current || !isMounted.current) {
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

    // Check connected relays
    const connectedRelays = getConnectedRelays();
    
    if (connectedRelays.length === 0) {
      setError("No connected relays. Attempting to reconnect...");
      
      const reconnected = await reconnect();
      if (!reconnected) {
        setError("Failed to connect to any Nostr relays. Please try again later.");
        setLoading(false);
        return;
      }
    } else {
      // Log which relays we're connected to
      console.log(`MadeiraFeed: Connected to ${connectedRelays.length} relays: ${connectedRelays.join(', ')}`);
    }
    
    setLoading(true);
    fetchInProgress.current = true;
    
    try {
      console.log(`MadeiraFeed: Fetching from ${effectiveNpubs.length} npubs: ${effectiveNpubs.map(n => n.substring(0, 10) + '...').join(', ')}`);
      
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
        
        // Combine core pubkeys with social graph pubkeys (deduplicated)
        const combinedPubkeys = new Set([...pubkeys, ...socialPubkeys]);
        pubkeys.length = 0; // Clear the array
        pubkeys.push(...Array.from(combinedPubkeys));
      }
      
      console.log(`MadeiraFeed: Using ${pubkeys.length} pubkeys for search`);
      
      // Create filter with hashtags
      const filter: NDKFilter = {
        kinds: [1], // Text notes
        authors: pubkeys,
        limit: limit * 4 // Fetch more to allow for filtering
      };
      
      const events = await ndk.fetchEvents([filter]);
      console.log(`MadeiraFeed: Fetched ${events.size} events`);
      
      if (!isMounted.current) return;
      
      // Process events into notes
      const processedNotes: Note[] = [];
      const profilePromises: { [key: string]: Promise<any> } = {};
      
      for (const event of events) {
        if (!event.pubkey) continue;
        
        const npub = nip19.npubEncode(event.pubkey);
        const content = event.content || '';
        
        // Extract hashtags from the content
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
        
        // Preload the main image
        if (extractedImages.length > 0) {
          preloadImage(extractedImages[0]).catch(() => {
            // Silently fail on image load errors
          });
        }
        
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
      
      console.log(`MadeiraFeed: Found ${processedNotes.length} Madeira-related posts with images`);
      
      if (!isMounted.current) return;
      
      // Fetch all profiles in parallel
      const fetchProfiles = async () => {
        try {
          const profileEntries = await Promise.all(
            Object.entries(profilePromises).map(async ([npub, promise]) => {
              const profile = await promise;
              return [npub, profile];
            })
          );
          
          if (!isMounted.current) return [];
          
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
          
          return sortedNotes;
        } catch (error) {
          console.error('Error fetching profiles:', error);
          return processedNotes;
        }
      };
      
      const finalNotes = await fetchProfiles();
      
      if (!isMounted.current) return;
      
      setNotes(finalNotes);
      setHasLoadedInitialNotes(true);
      setLoading(false);
      fetchInProgress.current = false;
      
      // If this is the first successful fetch, get the social graph
      if (!hasLoadedInitialNotes) {
        // Asynchronously load the social graph to extend our search
        fetchSocialGraph(effectiveNpubs).then(extendedNpubs => {
          if (isMounted.current) {
            console.log(`MadeiraFeed: Extended social graph with ${extendedNpubs.length - effectiveNpubs.length} additional npubs`);
            setSocialGraphNpubs(extendedNpubs);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      if (isMounted.current) {
        setError('Failed to fetch posts. Please try again later.');
        setLoading(false);
        fetchInProgress.current = false;
      }
    }
  }, [
    ndk, effectiveNpubs, limit, getCacheKey, getUserProfile, 
    reconnect, hasLoadedInitialNotes, socialGraphNpubs, retryCount, 
    fetchSocialGraph, getConnectedRelays
  ]);

  // Setup live subscription for real-time updates
  const setupSubscription = useCallback(() => {
    if (!ndk || subscriptionRef.current || !isMounted.current) return;
    
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
        if (!isMounted.current) return;
        
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
        
        if (!isMounted.current) return;
        
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

  // Setup carousel rotation
  useEffect(() => {
    if (notes.length > 0 && isClient) {
      // Clear any existing interval
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
      
      // Set up the carousel interval
      carouselIntervalRef.current = setInterval(() => {
        setCurrentNoteIndex(prevIndex => 
          prevIndex >= notes.length - 1 ? 0 : prevIndex + 1
        );
      }, 4000); // Rotate every 4 seconds
    }
    
    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [notes.length, isClient]);

  // Setup effect to load data and start live subscription
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Initial fetch after client-side render only
    if (isClient && ndkReady && !hasLoadedInitialNotes) {
      console.log(`MadeiraFeed: Using ${CORE_NPUBS.length} core NPUBs:`, CORE_NPUBS);
      fetchNotes();
    }
    
    // Set up auto-refresh timer
    let refreshInterval: NodeJS.Timeout | null = null;
    if (isClient) {
      refreshInterval = setInterval(() => {
        if (ndkReady && !fetchInProgress.current && isMounted.current) {
          console.log('MadeiraFeed: Auto-refreshing data');
          fetchNotes(true);
        }
      }, 15000); // 15 seconds
    }
    
    // Setup live subscription after initial load
    if (isClient && ndkReady && hasLoadedInitialNotes && !subscriptionRef.current) {
      console.log('MadeiraFeed: Setting up live subscription');
      setupSubscription();
    }
    
    return () => {
      // Clean up
      isMounted.current = false;
      
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [isClient, ndkReady, fetchNotes, hasLoadedInitialNotes, setupSubscription]);

  // Force refresh if social graph npubs change
  useEffect(() => {
    if (isClient && hasLoadedInitialNotes && socialGraphNpubs.length > 0) {
      console.log(`MadeiraFeed: Social graph updated with ${socialGraphNpubs.length} NPUBs, fetching new notes`);
      fetchNotes(true); // Force refresh to include social graph npubs
      
      // Update subscription with new npubs
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
        setupSubscription();
      }
    }
  }, [isClient, socialGraphNpubs, fetchNotes, hasLoadedInitialNotes, setupSubscription]);

  // Check for cached social graph on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const cachedNpubs = sessionStorage.getItem('socialGraphNpubs');
        if (cachedNpubs) {
          const parsedNpubs = JSON.parse(cachedNpubs);
          if (Array.isArray(parsedNpubs) && parsedNpubs.length > 0) {
            console.log(`MadeiraFeed: Found ${parsedNpubs.length} cached social graph npubs`);
            setSocialGraphNpubs(parsedNpubs);
          }
        }
      } catch (err) {
        console.error('Failed to parse cached social graph npubs:', err);
      }
    }
  }, []);
  
  // Check for social graph updates periodically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkForUpdates = () => {
      try {
        const cachedNpubs = sessionStorage.getItem('socialGraphNpubs');
        if (cachedNpubs) {
          const parsedNpubs = JSON.parse(cachedNpubs);
          if (Array.isArray(parsedNpubs) && 
              parsedNpubs.length > 0 && 
              parsedNpubs.length !== socialGraphNpubs.length) {
            console.log(`MadeiraFeed: Social graph updated with ${parsedNpubs.length} npubs`);
            setSocialGraphNpubs(parsedNpubs);
          }
        }
      } catch (err) {
        // Ignore errors
      }
    };
    
    const interval = setInterval(checkForUpdates, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [socialGraphNpubs.length]);

  // Server-side rendering placeholder to avoid hydration issues
  if (typeof window === 'undefined') {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="text-center py-20">
          <div className="h-8 w-8 border-t-2 border-b-2 border-forest mx-auto"></div>
        </div>
      </div>
    );
  }

  // Initial client render placeholder to avoid hydration issues
  if (!isClient) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="text-center py-20">
          <div className="h-8 w-8 border-t-2 border-b-2 border-forest mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
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
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      {notes.length === 0 ? (
        <div className="flex items-center justify-center h-64 w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-forest"></div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden rounded-lg shadow-md">
          {notes.map((note, index) => (
            <div 
              key={note.id} 
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentNoteIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div className="relative w-full h-full">
                {/* Main image */}
                <div className="w-full h-full bg-gray-200">
                  {note.images[0] && (
                    <Image
                      src={note.images[0]}
                      alt={note.author.name || note.author.displayName || 'Madeira update'}
                      fill
                      sizes="100vw"
                      className="object-cover object-center"
                      unoptimized
                      onError={(e) => {
                        // Fallback to placeholder on error
                        (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
                      }}
                    />
                  )}
                </div>
                
                {/* Profile overlay - clickable to navigate to profile */}
                <div className="absolute top-2 left-2 z-20">
                  <a 
                    href={`https://njump.me/${note.npub}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block cursor-pointer transition-transform hover:scale-110"
                  >
                    <NostrProfileImage 
                      npub={note.npub} 
                      width={40} 
                      height={40} 
                      className="rounded-full border-2 border-white shadow-md" 
                    />
                  </a>
                </div>
                
                {/* Carousel indicators */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
                  {notes.slice(0, 10).map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentNoteIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                      }`}
                    />
                  ))}
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