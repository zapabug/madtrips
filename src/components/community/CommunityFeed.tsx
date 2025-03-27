'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import Image from 'next/image';
import { 
  CORE_NPUBS,
  POPULAR_HASHTAGS, 
  stripLinks, 
  extractImageUrls, 
  extractHashtags 
} from './utils';
import { getRandomLoadingMessage, getLoadingMessageSequence } from '../../constants/loadingMessages';

interface NostrFeedProps {
  npub?: string;
  npubs?: string[];
  limit?: number;
  autoScroll?: boolean;
  scrollInterval?: number;
  useCorePubs?: boolean;
}

// Define the note interface
interface Note {
  id: string;
  created_at: number;
  content: string;
  author: {
    npub: string;
    profile?: {
      name?: string;
      displayName?: string;
      picture?: string;
    }
  };
  images: string[];
  hashtags: string[];
}

export const NostrFeed: React.FC<NostrFeedProps> = ({ 
  npub, 
  npubs = [],
  limit = 25,
  autoScroll = true,
  scrollInterval = 3000,
  useCorePubs = true
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHashtags, setActiveHashtags] = useState<string[]>([]);
  const [trendingTags, setTrendingTags] = useState<{tag: string, count: number}[]>([]);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);
  const shouldPauseScrolling = useRef<boolean>(false);
  const currentScrollIndexRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fetchInProgress = useRef<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [loadingMessages, setLoadingMessages] = useState<string[]>([]);
  const loadingMessageInterval = useRef<NodeJS.Timeout | null>(null);

  // Use loading messages from the loadingMessages.ts file
  useEffect(() => {
    if (loading) {
      // Initial loading message
      const messages = getLoadingMessageSequence('FEED', 5);
      setLoadingMessages(messages);
      setLoadingMessage(messages[0]);

      // Rotate through messages every 4 seconds
      let currentIndex = 0;
      loadingMessageInterval.current = setInterval(() => {
        currentIndex = (currentIndex + 1) % messages.length;
        setLoadingMessage(messages[currentIndex]);
      }, 4000);
    } else {
      // Clear interval when not loading
      if (loadingMessageInterval.current) {
        clearInterval(loadingMessageInterval.current);
        loadingMessageInterval.current = null;
      }
    }

    return () => {
      if (loadingMessageInterval.current) {
        clearInterval(loadingMessageInterval.current);
        loadingMessageInterval.current = null;
      }
    };
  }, [loading]);

  // Use the appropriate npubs list
  const effectiveNpubs = useCorePubs 
    ? [...CORE_NPUBS, ...(npub ? [npub] : []), ...npubs] 
    : [...(npub ? [npub] : []), ...npubs];
  
  // Fetch notes using real NDK implementation with retry logic
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (fetchInProgress.current) {
      console.log('NostrFeed: Fetch already in progress, skipping duplicate request');
      return;
    }
    
    // Set a new loading message when starting a new fetch
    if (!loading) {
      const newMessage = getRandomLoadingMessage('FEED');
      setLoadingMessage(newMessage);
    }
    
    if (!ndk) {
      if (retryCount < 3) {
        console.log(`NostrFeed: NDK not available, retry ${retryCount + 1}/3`);
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

    // Check if we have any connected relays by examining the pool
    const hasConnectedRelays = Array.from(ndk.pool.relays.values()).some(relay => relay.status === 1);
    
    if (!hasConnectedRelays) {
      console.log('NostrFeed: No connected relays found, attempting to reconnect...');
      setError("No connected relays. Attempting to reconnect...");
      
      // Try to reconnect to relays
      const reconnected = await reconnect();
      if (!reconnected) {
        setError("Failed to connect to any Nostr relays. Please try again later.");
      setLoading(false);
      return;
      }
    }

    if (effectiveNpubs.length === 0) {
      setError("No Nostr accounts specified");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetchInProgress.current = true;
    
    if (forceRefresh) {
    setError(null);
    }
    
    try {
      // Create proper NDK filters with all pubkeys properly decoded
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
      
      const filter: NDKFilter = {
        kinds: [1], // Text notes
        authors: pubkeys,
        limit: limit * 2 // Fetch more to allow for filtering
      };
      
      console.log('NostrFeed: Fetching events with filter:', filter);
      
      // Use NDK to fetch events with timeout
      const fetchPromise = ndk.fetchEvents([filter]);
      const timeoutPromise = new Promise<Set<NDKEvent>>((_, reject) => 
        setTimeout(() => reject(new Error('Events fetch timeout')), 8000)
      );
      
      const events = await Promise.race([fetchPromise, timeoutPromise])
        .catch(async (err) => {
          console.error('NostrFeed: Events fetch error, trying reconnect:', err);
          // Try to reconnect on timeout
          await reconnect();
          return new Set<NDKEvent>();
        });
        
      console.log(`NostrFeed: Fetched ${events.size} events`);
      
      if (events.size === 0 && retryCount < 2) {
        console.log(`NostrFeed: No events found, retry ${retryCount + 1}/2`);
        setRetryCount(prev => prev + 1);
        
        // Try reconnect and fetch again
        await reconnect();
        setTimeout(() => fetchNotes(true), 1000);
        return;
      }
      
      // Process events into notes
      const fetchedNotes: Note[] = [];
      const profilePromises: { [key: string]: Promise<any> } = {};
      
      // First pass: collect all events and setup profile fetching
      for (const event of Array.from(events)) {
        if (!event.pubkey) continue;
        
        const npub = nip19.npubEncode(event.pubkey);
        
        // Queue profile fetch (only once per pubkey)
        if (!profilePromises[npub]) {
          profilePromises[npub] = getUserProfile(npub).catch(err => {
            console.error(`Failed to fetch profile for ${npub}:`, err);
            return null;
          });
        }
        
        // Extract image URLs and hashtags
        const extractedImages = extractImageUrls(event.content || '');
        const extractedHashtags = extractHashtags(event.content || '');
        
        fetchedNotes.push({
          id: event.id || '', 
          created_at: event.created_at || 0,
          content: stripLinks(event.content || ''),
          author: { npub },
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
      
      // Enhance profile fetching with better error handling for images
      const profileMap: Record<string, { name?: string; displayName?: string; picture?: string } | null> = 
        await Promise.race([fetchProfiles(), profileTimeoutPromise as Promise<Record<string, any>>]);
      
      // Ensure profile images have valid URLs or fall back to a placeholder
      Object.keys(profileMap).forEach(npub => {
        if (profileMap[npub] && profileMap[npub]?.picture) {
          // Validate URL pattern
          const urlPattern = /^(https?:\/\/)/i;
          if (!urlPattern.test(profileMap[npub]?.picture || '')) {
            // If URL doesn't start with http/https, use a fallback
            profileMap[npub]!.picture = '/assets/bitcoin.png';
          }
        }
      });
      
      // Populate author info
      const completeNotes = fetchedNotes.map(note => ({
        ...note,
        author: {
          npub: note.author.npub,
          profile: profileMap[note.author.npub] ? {
            name: profileMap[note.author.npub]?.name,
            displayName: profileMap[note.author.npub]?.displayName,
            picture: profileMap[note.author.npub]?.picture
          } : undefined
        }
      }));
      
      // Sort by created_at in descending order (newest first)
      completeNotes.sort((a, b) => b.created_at - a.created_at);
      
      // Collect hashtags for trending display
      const hashtagCounts: {[tag: string]: number} = {};
      completeNotes.forEach(note => {
        note.hashtags.forEach(tag => {
          hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
        });
      });
      
      // Sort by count and take top 10
      const topTags = Object.entries(hashtagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      setTrendingTags(topTags);
      setNotes(completeNotes.slice(0, limit));
      setLoading(false);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching Nostr notes:', err);
      setError('Failed to load posts. Please try again later.');
      setLoading(false);
    } finally {
      fetchInProgress.current = false;
    }
  }, [ndk, effectiveNpubs, limit, getUserProfile, reconnect, retryCount, loading]);

  // Initial fetch when NDK is ready
  useEffect(() => {
    if (ndkReady && !fetchInProgress.current) {
      console.log('NostrFeed: Initial fetch triggered by ndkReady');
        fetchNotes();
    }
  }, [ndkReady]);
  
  // Set up reconnection attempt if NDK is not ready
  useEffect(() => {
    if (!ndkReady && !fetchInProgress.current && retryCount < 3) {
      const timer = setTimeout(async () => {
        console.log('NostrFeed: Attempting to reconnect to relays...');
        await reconnect();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ndkReady, reconnect, retryCount]);

  // Auto-scrolling mechanism
  useEffect(() => {
    if (autoScroll && notes.length > 0 && feedContainerRef.current) {
      // Clear any existing interval
      if (autoScrollRef.current) {
        window.clearInterval(autoScrollRef.current);
      }

      // Set up automatic scrolling
      autoScrollRef.current = window.setInterval(() => {
        if (feedContainerRef.current) {
          // Small-screen carousel-style scrolling
          if (window.innerWidth <= 768) {
            const cardWidth = feedContainerRef.current.querySelector('div')?.offsetWidth || 0;
            const scrollWidth = cardWidth + 16; // Card width + margin
            const cards = notes.length;
            
            // Increment index or reset to 0 if at the end
            currentScrollIndexRef.current = (currentScrollIndexRef.current + 1) % cards;
            
            // Smooth scroll to the next card
            feedContainerRef.current.scrollTo({
              left: currentScrollIndexRef.current * scrollWidth,
              behavior: 'smooth'
            });
          }
        }
      }, scrollInterval);
    }

    return () => {
      if (autoScrollRef.current) {
        window.clearInterval(autoScrollRef.current);
      }
    };
  }, [notes, autoScroll, scrollInterval]);

  // Handle manual horizontal scroll with mouse wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (feedContainerRef.current && e.deltaY !== 0) {
        // Stop auto-scrolling temporarily when user manually scrolls
        if (autoScrollRef.current) {
          window.clearInterval(autoScrollRef.current);
          autoScrollRef.current = null;
          
          // Restart auto-scrolling after 10 seconds of inactivity
          setTimeout(() => {
            if (autoScroll && notes.length > 0 && feedContainerRef.current) {
              autoScrollRef.current = window.setInterval(() => {
                if (feedContainerRef.current) {
                  if (window.innerWidth <= 768) {
                    const cardWidth = feedContainerRef.current.querySelector('div')?.offsetWidth || 0;
                    const scrollWidth = cardWidth + 16;
                    const cards = notes.length;
                    
                    currentScrollIndexRef.current = (currentScrollIndexRef.current + 1) % cards;
                    
                    feedContainerRef.current.scrollTo({
                      left: currentScrollIndexRef.current * scrollWidth,
                      behavior: 'smooth'
                    });
                  }
                }
              }, scrollInterval);
            }
          }, 10000);
        }
        
        if (window.innerWidth <= 768) {
          e.preventDefault();
          feedContainerRef.current.scrollLeft += e.deltaY;
        }
      }
    };

    const container = feedContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      
      // Update scroll index when user manually scrolls
      const handleScroll = () => {
        if (window.innerWidth <= 768 && container) {
          const cardWidth = container.querySelector('div')?.offsetWidth || 0;
          if (cardWidth > 0) {
            const scrollLeft = container.scrollLeft;
            const approxIndex = Math.round(scrollLeft / cardWidth);
            currentScrollIndexRef.current = approxIndex;
          }
        }
      };
      
      container.addEventListener('scroll', handleScroll);
      
      return () => {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('scroll', handleScroll);
      };
    }
    
    return undefined;
  }, [notes, autoScroll, scrollInterval]);

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      if (autoScrollRef.current) {
        window.clearInterval(autoScrollRef.current);
      }
      
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }
    };
  }, []);

  // Ensure proper flex/grid layout based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (feedContainerRef.current) {
        // Reset auto-scroll index on resize
        currentScrollIndexRef.current = 0;
        
        // Reset scroll position when resizing between mobile and desktop
        if (window.innerWidth > 768) {
          feedContainerRef.current.scrollLeft = 0;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Filter notes based on active hashtags
  const filteredNotes = activeHashtags.length > 0
    ? notes.filter(note => 
        note.hashtags.some(tag => activeHashtags.includes(tag))
      )
    : notes;

  return (
    <div ref={feedRef} className="overflow-y-auto h-full bg-white dark:bg-gray-900 p-4">
      {loading && (
        <div className="flex flex-col justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A] mb-4" />
          <p className="text-[#F7931A] text-center max-w-md animate-pulse">
            {loadingMessage}
          </p>
        </div>
      )}
      
      {error && (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4">
            <p className="text-red-500 mb-2">{error}</p>
            <button 
              onClick={(e) => {
                e.preventDefault();
                fetchNotes(true);
              }}
              className="px-4 py-2 bg-[#F7931A] text-white rounded hover:bg-[#E87F17]"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {!loading && !error && notes.length === 0 && (
        <div className="flex justify-center items-center h-full">
          <p className="text-gray-500">No posts found</p>
        </div>
      )}
      
      {!loading && !error && notes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 relative group">
              <a 
                href={`https://njump.me/${note.id}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="absolute inset-0 z-0 cursor-pointer"
                aria-label="Open post in Nostr client"
              ></a>
              <div className="flex items-start relative z-10">
                {note.author.profile?.picture ? (
                  <a 
                    href={`https://njump.me/${note.author.npub}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 mr-3 transition-transform hover:scale-110"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Image 
                      src={note.author.profile.picture}
                      alt="Profile"
                      width={48}
                      height={48}
                      className="rounded-full border border-gray-200 dark:border-gray-700"
                      unoptimized
                    />
                  </a>
                ) : (
                  <a 
                    href={`https://njump.me/${note.author.npub}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 mr-3 transition-transform hover:scale-110"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300">
                      {note.author.profile?.name?.substring(0, 1) || note.author.profile?.displayName?.substring(0, 1) || "?"}
                    </div>
                  </a>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline">
                    <a 
                      href={`https://njump.me/${note.author.npub}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 dark:text-white hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {note.author.profile?.displayName || note.author.profile?.name || shortenNpub(note.author.npub)}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {new Date(note.created_at * 1000).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-sand dark:text-gray-300 mb-3 line-clamp-4 flex-grow relative z-10">{note.content}</p>
              
              {/* Display hashtags in the note */}
              {note.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3 relative z-10">
                  {note.hashtags.map(tag => (
                    <span 
                      key={tag} 
                      className="text-xs bg-bitcoin/10 text-bitcoin px-2 py-0.5 rounded-full cursor-pointer hover:bg-bitcoin/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!activeHashtags.includes(tag)) {
                          setActiveHashtags(prev => [...prev, tag]);
                        }
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              {note.images.length > 0 && (
                <div className="mt-auto relative z-10">
                  <div className="relative w-full h-48 rounded-lg overflow-hidden">
                    <Image 
                      src={note.images[0]} 
                      alt="Note image"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                      onError={(e) => {
                        // Handle image loading error by using a fallback image instead of hiding
                        const imgElement = e.target as HTMLImageElement;
                        imgElement.src = '/assets/bitcoin.png';
                        // Add a small label to indicate it's a fallback
                        const parent = imgElement.parentElement;
                        if (parent) {
                          const label = document.createElement('div');
                          label.className = 'absolute bottom-0 right-0 bg-black/50 text-white text-xs p-1';
                          label.textContent = 'Image unavailable';
                          parent.appendChild(label);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NostrFeed; 