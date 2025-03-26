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
  rotationInterval?: number; // Time in ms between image rotations
  minImages?: number; // Minimum images to display
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
  limit = 50,
  rotationInterval = 5000, // Default to 5 seconds rotation
  minImages = 10,
}) => {
  const { ndk, getUserProfile, shortenNpub, reconnect, ndkReady } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredImageNotes, setFilteredImageNotes] = useState<Note[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const rotationTimerRef = useRef<number | null>(null);
  const fetchInProgress = useRef<boolean>(false);
  
  // After notes are loaded, filter only those with images
  useEffect(() => {
    const notesWithImages = notes.filter(note => note.images && note.images.length > 0);
    setFilteredImageNotes(notesWithImages);
    
    // Reset the image index when the filtered notes change
    if (notesWithImages.length > 0) {
      setCurrentImageIndex(0);
    }
  }, [notes]);
  
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
        limit: limit * 3 // Fetch 3x requested limit to ensure enough images
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
        
        // Extract image URLs to filter out events without images
        const extractedImages = extractImageUrls(event.content || '');
        
        // Only add notes that have images
        if (extractedImages.length > 0) {
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

  // Add this after the existing useEffects
  useEffect(() => {
    const refreshInterval = 180000; // Refresh every 180 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotes(true);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchNotes]);

  return (
    <div className="w-full">
      {loading && filteredImageNotes.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bitcoin"></div>
          <p className="ml-3 text-bitcoin">Loading images from Nostr...</p>
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
          <p className="text-gray-600 dark:text-gray-300">No images found from these users</p>
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
            
            {/* Author profile overlay */}
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
                    // If profile image fails to load, replace with default
                    (e.target as HTMLImageElement).src = '/assets/bitcoin.png';
                  }}
                />
              </div>
              <div className="ml-2 text-white">
                <p className="font-medium">
                  {filteredImageNotes[currentImageIndex].author.displayName || 
                   filteredImageNotes[currentImageIndex].author.name || 
                   shortenNpub(filteredImageNotes[currentImageIndex].npub)}
                </p>
                <p className="text-xs opacity-80">
                  {new Date(filteredImageNotes[currentImageIndex].created_at * 1000).toLocaleDateString()}
                </p>
              </div>
            </a>
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
    </div>
  );
};

export default MultiUserNostrFeed;