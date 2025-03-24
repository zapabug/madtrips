'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useNostr } from '../../lib/nostr/NostrContext';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import Image from 'next/image';
import { BRAND_COLORS } from '../../constants/brandColors';
import { nip19 } from 'nostr-tools';
import NDK from '@nostr-dev-kit/ndk';

interface MultiUserNostrFeedProps {
  npubs: string[];
  limit?: number;
  autoScroll?: boolean;
  scrollInterval?: number;
}

// Helper function to strip links from content
const stripLinks = (content: string): string => {
  return content.replace(/https?:\/\/\S+/g, '');
};

// Helper function to detect image URLs
const extractImageUrls = (content: string): string[] => {
  const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp)(?:\?[^"']*)?)/gi;
  return content.match(imgRegex) || [];
};

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
}

export const MultiUserNostrFeed: React.FC<MultiUserNostrFeedProps> = ({ 
  npubs, 
  limit = 25,
  autoScroll = true,
  scrollInterval = 3000
}) => {
  const { ndk, getUserProfile, shortenNpub } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // References for auto-scrolling and feed container
  const autoScrollRef = useRef<number | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isPauseScrollingRef = useRef<boolean>(false);
  
  // Fetch notes when component mounts
  useEffect(() => {
    fetchNotes();
  }, [ndk, npubs, limit, getUserProfile]);
  
  // Handle auto-scrolling
  useEffect(() => {
    if (!autoScroll || notes.length === 0 || !feedContainerRef.current) {
      return;
    }
    
    const handleWheel = (e: TouchEvent) => {
      // Pause auto-scrolling when user interacts
      isPauseScrollingRef.current = true;
      
      // Resume after 5 seconds of inactivity
      setTimeout(() => {
        isPauseScrollingRef.current = false;
      }, 5000);
    };
    
    // Add wheel event listener
    feedContainerRef.current.addEventListener('touchstart', handleWheel, { passive: true });
    
    // Set up auto-scrolling interval
    autoScrollRef.current = window.setInterval(() => {
      if (isPauseScrollingRef.current || !feedContainerRef.current) {
        return;
      }
      
      const container = feedContainerRef.current;
      const scrollPosition = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // If we're near the end, scroll back to start
      if (scrollPosition + clientHeight >= scrollHeight - 50) {
        container.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Otherwise scroll down a bit
        container.scrollBy({
          top: 100,
          behavior: 'smooth'
        });
      }
    }, scrollInterval);
    
    // Cleanup function
    return () => {
      if (feedContainerRef.current) {
        feedContainerRef.current.removeEventListener('touchstart', handleWheel);
      }
      
      if (autoScrollRef.current) {
        window.clearInterval(autoScrollRef.current);
      }
    };
  }, [notes, autoScroll, scrollInterval]);
  
  // Function to fetch notes when NDK is available
  const fetchNotes = async () => {
    if (!ndk) {
      setError("Nostr connection not available");
      setLoading(false);
      return;
    }
    
    if (npubs.length === 0) {
      setError("No Nostr accounts specified");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create proper NDK filters
      const filters: NDKFilter[] = npubs.map(npub => ({
        kinds: [1],
        authors: [npub],
        limit: Math.ceil(limit / npubs.length)
      }));
      
      // Use NDK to fetch events
      const events = await ndk.fetchEvents(filters);
      
      // Process events using nostr-tools for encoding
      const fetchedNotes: Note[] = [];
      for (const event of events) {
        if (!event.pubkey) continue;
        
        const npub = nip19.npubEncode(event.pubkey);
        const author = {
          npub,
          profile: await getUserProfile(npub)
        };
        
        fetchedNotes.push({
          id: event.id || '', 
          created_at: event.created_at || 0,
          content: stripLinks(event.content || ''),
          author: { npub },
          images: extractImageUrls(event.content || '')
        });
      }
      fetchedNotes.sort((b, a) => b.created_at - a.created_at);
      
      setNotes(fetchedNotes.slice(0, limit));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load posts. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 relative">
      {loading && (
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A]" />
        </div>
      )}
      
      {error && (
        <div className="flex justify-center items-center h-full">
          <div className="text-center p-4">
            <p className="text-red-500 mb-2">{error}</p>
            <button 
              onClick={fetchNotes}
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
        <div className="grid grid-cols-1 gap-4">
          {notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="p-3 flex flex-col">
              <div className="flex items-center mb-2">
                {note.author.profile?.picture ? (
                  <div className="relative w-8 h-8 rounded-full mr-2 overflow-hidden border border-blueGreen">
                    <Image 
                      src={note.author.profile.picture} 
                      alt={note.author.profile.name || shortenNpub(note.author.npub)}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-blueGreen rounded-full mr-2 flex items-center justify-center text-white font-bold text-sm">
                    {(note.author.profile?.name || shortenNpub(note.author.npub))[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-bitcoin text-sm truncate">
                    {note.author.profile?.displayName || note.author.profile?.name || shortenNpub(note.author.npub)}
                  </h3>
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
              
              <p className="text-gray-800 dark:text-gray-200 text-sm mb-2 line-clamp-3">{note.content}</p>
              
              {note.images.length > 0 && (
                <div className="mt-1">
                  <div className="relative w-full h-32 rounded-lg overflow-hidden">
                    <Image 
                      src={note.images[0]} 
                      alt="Note image"
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
          </div>
        )}
    </div>
  );
};

export default MultiUserNostrFeed; 