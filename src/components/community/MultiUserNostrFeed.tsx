'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import Image from 'next/image';
import { BRAND_COLORS } from '../../constants/brandColors';

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
  }, [ndk, npubs]);
  
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
      return;
    }

    try {
      setLoading(true);
      
      // Create a filter for recent notes from all provided npubs
      const filter: NDKFilter = {
        kinds: [1], // Regular notes
        authors: npubs,
        limit: limit,
      };

      // Get the initial notes
      const events = await ndk.fetchEvents(filter);
      
      // Process the events into notes
      const processedNotes: Note[] = [];
      for (const event of Array.from(events)) {
        try {
          const author = await getUserProfile(event.pubkey);
          
          const note: Note = {
            id: event.id,
            created_at: event.created_at || Math.floor(Date.now() / 1000),
            content: stripLinks(event.content),
            author: {
              npub: author?.npub || event.pubkey,
              profile: author?.profile,
            },
            images: extractImageUrls(event.content),
          };
          
          processedNotes.push(note);
        } catch (e) {
          console.error('Error processing note:', e);
        }
      }
      
      // Sort notes by timestamp (newest first)
      processedNotes.sort((a, b) => b.created_at - a.created_at);
      
      setNotes(processedNotes);
      setLoading(false);
      
      // Set up real-time subscription
      const sub = ndk.subscribe(filter, { closeOnEose: false });
      
      sub.on('event', async (event: NDKEvent) => {
        try {
          // Wait 5 seconds before processing the event, to prioritize images
          setTimeout(async () => {
            const author = await getUserProfile(event.pubkey);
            
            const newNote: Note = {
              id: event.id,
              created_at: event.created_at || Math.floor(Date.now() / 1000),
              content: stripLinks(event.content),
              author: {
                npub: author?.npub || event.pubkey,
                profile: author?.profile,
              },
              images: extractImageUrls(event.content),
            };
            
            // Add the new note to the beginning of the array
            setNotes(prev => {
              // Check if note already exists
              if (prev.some(note => note.id === newNote.id)) {
                return prev;
              }
              
              // Add new note to the beginning and keep the list limited
              const updated = [newNote, ...prev].slice(0, limit);
              return updated;
            });
          }, 5000);
        } catch (e) {
          console.error('Error handling real-time note:', e);
        }
      });
      
      return () => {
        sub.stop();
      };
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to load notes. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 relative">
      {loading && (
        <div className="flex justify-center items-center py-10 absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Scrollable feed container optimized for mobile */}
      <div 
        ref={feedContainerRef}
        className="flex flex-col gap-3 p-3 overflow-y-auto"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          height: '400px'
        }}
      >
        {notes.map((note) => (
          <div 
            key={note.id} 
            className="flex-none bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md 
                     border border-gray-200 dark:border-gray-700 hover:border-blueGreen"
          >
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
        
        {notes.length === 0 && !loading && !error && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No notes found</p>
            <p className="text-sm mt-2">Check back later for community updates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiUserNostrFeed; 