'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import Image from 'next/image';

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

  useEffect(() => {
    // Set timeout to ensure NDK is initialized
    const timeout = setTimeout(() => {
      if (!ndk) {
        setError("Nostr connection not available. Please try refreshing the page.");
        setLoading(false);
      } else {
        fetchNotes();
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [ndk]);

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

  // Function to fetch notes when NDK is available
  const fetchNotes = async () => {
    if (!ndk) {
      return;
    }

    try {
      setLoading(true);
      
      // Determine which npubs to use for the feed
      let authorNpubs: string[] = [];
      
      if (npub) {
        authorNpubs.push(npub);
      }
      
      if (npubs && npubs.length > 0) {
        authorNpubs = [...authorNpubs, ...npubs];
      }
      
      if (useCorePubs && authorNpubs.length === 0) {
        authorNpubs = CORE_NPUBS;
      } else if (useCorePubs) {
        // Add core npubs if not already included
        CORE_NPUBS.forEach(corePub => {
          if (!authorNpubs.includes(corePub)) {
            authorNpubs.push(corePub);
          }
        });
      }
      
      // Create a filter for recent notes
      const filter: NDKFilter = {
        kinds: [1], // Regular notes
        authors: authorNpubs,
        limit: limit * 2, // Fetch more to account for filtering
        "#t": POPULAR_HASHTAGS, // Also fetch notes with our popular hashtags
      };

      // Get the initial notes
      const events = await ndk.fetchEvents(filter);
      
      // Process the events into notes
      const processedNotes: Note[] = [];
      const tagFrequency: Record<string, number> = {};
      
      for (const event of Array.from(events)) {
        try {
          const images = extractImageUrls(event.content);
          // Wait briefly for image validation
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const author = await getUserProfile(event.pubkey);
          const noteHashtags = extractHashtags(event.content);
          
          // Update tag frequency
          noteHashtags.forEach(tag => {
            tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
          });
          
          const note: Note = {
            id: event.id,
            created_at: event.created_at || Math.floor(Date.now() / 1000),
            content: stripLinks(event.content),
            author: {
              npub: author?.npub || event.pubkey,
              profile: author?.profile,
            },
            images,
            hashtags: noteHashtags
          };
          
          // Prioritize notes with images in the initial sort
          processedNotes.push(note);
        } catch (e) {
          console.error('Error processing note:', e);
        }
      }
      
      // Sort notes prioritizing images and recency
      processedNotes.sort((a, b) => {
        // First prioritize notes with images
        if (a.images.length && !b.images.length) return -1;
        if (!a.images.length && b.images.length) return 1;
        // Then sort by timestamp
        return b.created_at - a.created_at;
      });
      
      // Calculate trending tags
      const trending = Object.entries(tagFrequency)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);
      
      setTrendingTags(trending);
      setNotes(processedNotes.slice(0, limit));
      setLoading(false);
      
      // Set up real-time subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }
      
      const sub = ndk.subscribe(filter, { closeOnEose: false });
      
      sub.on('event', async (event: NDKEvent) => {
        try {
          // Wait 5 seconds before processing the event, to prioritize images
          setTimeout(async () => {
            const author = await getUserProfile(event.pubkey);
            const noteHashtags = extractHashtags(event.content);
            
            const newNote: Note = {
              id: event.id,
              created_at: event.created_at || Math.floor(Date.now() / 1000),
              content: stripLinks(event.content),
              author: {
                npub: author?.npub || event.pubkey,
                profile: author?.profile,
              },
              images: extractImageUrls(event.content),
              hashtags: noteHashtags
            };
            
            // Add the new note to the beginning of the array
            setNotes(prev => {
              // Check if note already exists
              if (prev.some(note => note.id === newNote.id)) {
                return prev;
              }
              
              // Add to beginning and sort
              const updated = [newNote, ...prev].sort((a, b) => b.created_at - a.created_at);
              
              // Limit to requested amount
              const limited = updated.slice(0, limit);
              
              // Reset scroll index when a new note is added
              currentScrollIndexRef.current = 0;
              
              // Update trending tags
              const newTagFrequency: Record<string, number> = {};
              limited.forEach(note => {
                note.hashtags.forEach(tag => {
                  newTagFrequency[tag] = (newTagFrequency[tag] || 0) + 1;
                });
              });
              
              const newTrending = Object.entries(newTagFrequency)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 7);
              
              setTrendingTags(newTrending);
              
              return limited;
            });
          }, 5000);
        } catch (e) {
          console.error('Error processing real-time note:', e);
        }
      });
      
      subscriptionRef.current = sub;
    } catch (e) {
      console.error('Error fetching notes:', e);
      setError('Failed to load notes. Please try again.');
      setLoading(false);
    }
  };

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
    <div className="w-full">
      {loading && (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bitcoin"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Hashtags filtering */}
      <div className="mb-6 overflow-x-auto whitespace-nowrap pb-2">
        <div className="inline-flex space-x-2">
          {POPULAR_HASHTAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveHashtags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag) 
                    : [...prev, tag]
                );
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                activeHashtags.includes(tag)
                  ? 'bg-bitcoin text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              #{tag}
            </button>
          ))}
          
          {/* Add any trending tags that aren't in POPULAR_HASHTAGS */}
          {trendingTags
            .filter(({ tag }) => !POPULAR_HASHTAGS.includes(tag) && tag.length > 2)
            .map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => {
                  setActiveHashtags(prev => 
                    prev.includes(tag) 
                      ? prev.filter(t => t !== tag) 
                      : [...prev, tag]
                  );
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  activeHashtags.includes(tag)
                    ? 'bg-bitcoin text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                #{tag} <span className="ml-1 text-xs opacity-70">{count}</span>
              </button>
            ))
          }
        </div>
      </div>
      
      {/* Desktop: Grid layout, Mobile: Horizontal scroll */}
      <div 
        ref={feedContainerRef}
        className="md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-4 
                  flex flex-nowrap overflow-x-auto pb-4 md:pb-0 md:overflow-x-visible 
                  snap-x snap-mandatory md:snap-none scroll-smooth"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch' 
        }}
      >
        {filteredNotes.map((note) => (
          <div 
            key={note.id} 
            className="flex-shrink-0 snap-center w-[85vw] md:w-auto md:flex-shrink-1 
                      bg-white/10 dark:bg-black/20 rounded-lg overflow-hidden shadow-md 
                      transition-transform hover:scale-[1.01] hover:shadow-lg 
                      border border-transparent hover:border-bitcoin mr-4 md:mr-0"
          >
            <div className="p-4 h-full flex flex-col">
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
          </div>
        ))}
      </div>
      
      {filteredNotes.length === 0 && !loading && !error && (
        <div className="text-center py-10 text-gray-500">
          {activeHashtags.length > 0 
            ? `No notes found with the selected hashtags: ${activeHashtags.map(tag => '#'+tag).join(', ')}`
            : 'No notes found'}
        </div>
      )}
    </div>
  );
};

export default NostrFeed; 