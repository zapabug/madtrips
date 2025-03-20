'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import Image from 'next/image';
// Removed unused import of Image
// Removed unused import of nip19

// Import core NPUBs from SocialGraph
const CORE_NPUBS = [
  "npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e", // Free Madeira
  "npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5", // Bitcoin Madeira
  "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh", // Madtrips
  "npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc", // Funchal
];

// Define popular hashtags
const POPULAR_HASHTAGS = [
  "madeira",
  "travelmadeira",
  "visitmadeira", 
  "funchal",
  "soveng"
];

interface NostrFeedProps {
  npub?: string;
  npubs?: string[];
  limit?: number;
  autoScroll?: boolean;
  scrollInterval?: number;
  useCorePubs?: boolean;
}

// Helper function to strip links from content
const stripLinks = (content: string): string => {
  // Remove all URLs but preserve text
  return content.replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ') // Clean up extra spaces
    .trim();
};

// Helper function to detect image URLs
const extractImageUrls = (content: string): string[] => {
  const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp)(?:\?[^"']*)?)/gi;
  const matches = content.match(imgRegex) || [];
  // Filter out any obviously invalid image URLs
  return matches.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
};

// Helper function to extract hashtags
const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex) || [];
  return matches.map(tag => tag.slice(1).toLowerCase());
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
  const { ndk, getUserProfile, shortenNpub } = useNostr();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHashtags, setActiveHashtags] = useState<string[]>([]);
  const [trendingTags, setTrendingTags] = useState<{tag: string, count: number}[]>([]);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);
  const currentScrollIndexRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Use the appropriate npubs list
  const effectiveNpubs = useCorePubs 
    ? [...CORE_NPUBS, ...(npub ? [npub] : []), ...npubs] 
    : [...(npub ? [npub] : []), ...npubs];
  
  // Fetch notes using real NDK implementation
  const fetchNotes = async () => {
    if (!ndk) {
      setError("Nostr connection not available");
      setLoading(false);
      return;
    }
    
    if (effectiveNpubs.length === 0) {
      setError("No Nostr accounts specified");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create proper NDK filters
      const filters: NDKFilter[] = effectiveNpubs.map(npub => ({
        kinds: [1], // Regular notes
        authors: [npub],
        limit: Math.ceil(limit / effectiveNpubs.length)
      }));
      
      // Use the NDK fetchEvents method
      const events = await ndk.fetchEvents(filters);
      
      // Process events to notes
      const fetchedNotes: Note[] = [];
      for (const event of events) {
        if (!event.pubkey) continue;
        
        // Use nip19 from nostr-tools to encode pubkey
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
          images: extractImageUrls(event.content || ''),
          hashtags: extractHashtags(event.content || '')
        });
      }
      
      // Sort by creation time, newest first
      fetchedNotes.sort((a, b) => b.created_at - a.created_at);
      
      setNotes(fetchedNotes.slice(0, limit));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load posts. Please try again later.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [ndk, effectiveNpubs]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-3">
                {note.author.profile?.picture ? (
                  <Image 
                    src={note.author.profile.picture} 
                    alt={note.author.profile.name || shortenNpub(note.author.npub)}
                    width={40}
                    height={40}
                    className="rounded-full mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-gray-600">
                    {(note.author.profile?.name || shortenNpub(note.author.npub))[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-bitcoin">
                    {note.author.profile?.displayName || note.author.profile?.name || shortenNpub(note.author.npub)}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {new Date(note.created_at * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <p className="text-sand mb-3 line-clamp-4 flex-grow">{note.content}</p>
              
              {/* Display hashtags in the note */}
              {note.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {note.hashtags.map(tag => (
                    <span 
                      key={tag} 
                      className="text-xs bg-bitcoin/10 text-bitcoin px-2 py-0.5 rounded-full cursor-pointer hover:bg-bitcoin/20"
                      onClick={() => {
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
                <div className="mt-auto">
                  <Image 
                    src={note.images[0]} 
                    alt="Note image"
                    width={300}
                    height={200}
                    className="rounded-lg w-full h-auto object-cover"
                  />
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