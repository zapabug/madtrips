'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import Image from 'next/image';
import { stripLinks, extractImageUrls } from './utils';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

interface MultiUserNostrFeedProps {
  npubs: string[];
  limit?: number;
  autoScroll?: boolean;
  scrollInterval?: number;
}

// Define the note interface
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
  };
  images: string[];
}

export const MultiUserNostrFeed: React.FC<MultiUserNostrFeedProps> = ({ 
  npubs, 
  limit = 25,
  autoScroll = true,
  scrollInterval = 3000
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // References for auto-scrolling and feed container
  const autoScrollRef = useRef<number | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isPauseScrollingRef = useRef<boolean>(false);
  const fetchInProgress = useRef<boolean>(false);
  
  // Fetch notes with retry mechanism
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
    
    // Check if we have any connected relays by examining the pool
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
    
    if (npubs.length === 0) {
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
      // Convert npubs to hex pubkeys in batch
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
      
      if (pubkeys.length === 0) {
        setError("Invalid Nostr accounts");
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }
      
      // Create proper filter with all pubkeys in a single query
      const filter: NDKFilter = {
        kinds: [1], // Text notes
        authors: pubkeys,
        limit: limit * 2 // Fetch more to allow for filtering
      };
      
      console.log('Fetching events with filter:', filter);
      
      // Use NDK to fetch events with timeout
      const fetchPromise = ndk.fetchEvents([filter]);
      const timeoutPromise = new Promise<Set<NDKEvent>>((_, reject) => 
        setTimeout(() => reject(new Error('Events fetch timeout')), 8000)
      );
      
      const events = await Promise.race([fetchPromise, timeoutPromise])
        .catch(async (err) => {
          console.error('Events fetch error, trying reconnect:', err);
          // Try to reconnect on timeout
          await reconnect();
          return new Set<NDKEvent>();
        });
        
      console.log(`Fetched ${events.size} events`);
      
      if (events.size === 0 && retryCount < 2) {
        console.log(`No events found, retry ${retryCount + 1}/2`);
        setRetryCount(prev => prev + 1);
        
        // Try reconnect and fetch again
        await reconnect();
        setTimeout(() => fetchNotes(true), 1000);
        return;
      }
      
      // Process events into notes
      const processedNotes: Note[] = [];
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
        
        // Extract image URLs first to filter out events without images if needed
        const extractedImages = extractImageUrls(event.content || '');
        
        processedNotes.push({
          id: event.id || '', 
          created_at: event.created_at || 0,
          content: stripLinks(event.content || ''),
          pubkey: event.pubkey,
          npub: npub,
          author: {}, // Will be populated later
          images: extractedImages
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
      const profileMap: Record<string, { name?: string; displayName?: string; picture?: string } | null> = 
        await Promise.race([fetchProfiles(), profileTimeoutPromise as Promise<Record<string, any>>]);
      
      // Populate author info
      const completeNotes = processedNotes.map(note => ({
        ...note,
        author: profileMap[note.npub] ? {
          name: profileMap[note.npub]?.name,
          displayName: profileMap[note.npub]?.displayName,
          picture: profileMap[note.npub]?.picture
        } : {}
      }));
      
      // Sort by created_at in descending order (newest first)
      completeNotes.sort((a, b) => b.created_at - a.created_at);
      
      setNotes(completeNotes.slice(0, limit));
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
  }, [ndk, npubs, limit, getUserProfile, reconnect, retryCount]);
  
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
  
  // Handle auto-scrolling
  useEffect(() => {
    if (!autoScroll || notes.length === 0 || !feedContainerRef.current) {
      return;
    }
    
    const handleTouch = () => {
      // Pause auto-scrolling when user interacts
      isPauseScrollingRef.current = true;
      
      // Resume after 5 seconds of inactivity
      setTimeout(() => {
        isPauseScrollingRef.current = false;
      }, 5000);
    };
    
    // Add event listeners
    const containerEl = feedContainerRef.current;
    containerEl.addEventListener('touchstart', handleTouch, { passive: true });
    containerEl.addEventListener('mousedown', handleTouch, { passive: true });
    
    // Set up auto-scrolling interval
    autoScrollRef.current = window.setInterval(() => {
      if (isPauseScrollingRef.current || !containerEl) {
        return;
      }
      
      const scrollPosition = containerEl.scrollTop;
      const scrollHeight = containerEl.scrollHeight;
      const clientHeight = containerEl.clientHeight;
      
      // If we're near the end, scroll back to start
      if (scrollPosition + clientHeight >= scrollHeight - 50) {
        containerEl.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Otherwise scroll down a bit
        containerEl.scrollBy({
          top: 150,
          behavior: 'smooth'
        });
      }
    }, scrollInterval);
    
    // Cleanup function
    return () => {
      if (containerEl) {
        containerEl.removeEventListener('touchstart', handleTouch);
        containerEl.removeEventListener('mousedown', handleTouch);
      }
      
      if (autoScrollRef.current) {
        window.clearInterval(autoScrollRef.current);
      }
    };
  }, [notes, autoScroll, scrollInterval]);

  return (
    <div className="w-full" ref={feedContainerRef}>
      {loading && notes.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin"></div>
          <p className="ml-3 text-bitcoin">Loading posts from Nostr...</p>
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
      
      {!loading && !error && notes.length === 0 && (
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">No posts found from these users</p>
        </div>
      )}
      
      <div
        className={`grid grid-cols-1 gap-4 md:${
          autoScroll ? "flex md:flex-nowrap md:space-x-4 overflow-x-auto" : "grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {notes.map(note => (
          <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col w-full">
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 rounded-full overflow-hidden mr-3 relative border-2 border-bitcoin">
                  <Image 
                    src={note.author.picture || '/assets/bitcoin.png'} 
                    alt="Profile"
                    width={48}
                    height={48}
                    className="object-cover"
                    priority={true}
                    onError={(e) => {
                      // If image fails to load, replace with default
                      (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(note.created_at * 1000).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-800 dark:text-gray-200 text-sm mb-3">{note.content}</p>
              
              {note.images.length > 0 && (
                <div className="mt-2">
                  <div className="relative w-full h-48 rounded-lg overflow-hidden">
                    <Image 
                      src={note.images[0]} 
                      alt="Note image"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                      onError={(e) => {
                        // Handle image loading error by using a fallback instead of hiding
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiUserNostrFeed; 