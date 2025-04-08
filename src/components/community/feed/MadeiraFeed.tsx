'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { NostrProfileImage } from '../profile/NostrProfileImage';
import { CORE_NPUBS } from '../utils';
import { useNostrFeed, Note } from '../../../hooks/useNostrFeed';
import { MCP_CONFIG } from '../../../../mcp/config';
import useCache from '../../../hooks/useCache';
import RelayService from '../../../lib/services/RelayService';

// Madeira-related hashtags to filter by - prioritized
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

// High priority hashtags - these will be shown first
const PRIORITY_HASHTAGS = [
  'madeira',
  'travelmadeira',
  'funchal',
  'freemadeira'
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
  autoRefreshInterval?: number; // Auto refresh interval in ms
}

export const MadeiraFeed: React.FC<MadeiraFeedProps> = ({ 
  npubs = [],
  limit = 25,
  useCorePubs = true,
  className = '',
  autoRefreshInterval = 60000 // Default to 1 minute
}) => {
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [errorShown, setErrorShown] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Map<string, boolean>>(new Map());
  const [sortedNotes, setSortedNotes] = useState<Note[]>([]);
  const cache = useCache();
  
  // Use the shared hook with Madeira-specific settings
  const { notes, loading, error, refresh } = useNostrFeed({
    npubs: useCorePubs ? [...CORE_NPUBS, ...npubs] : npubs,
    limit,
    requiredHashtags: MADEIRA_HASHTAGS,
    nsfwKeywords: NSFW_KEYWORDS,
    onlyWithImages: true, // Only show posts with images
    useWebOfTrust: MCP_CONFIG.defaults.useWebOfTrust // Use the Web of Trust from social graph
  });

  // Update relay count when relays change
  useEffect(() => {
    const updateRelayCount = () => {
      const relays = RelayService.getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    updateRelayCount();
    const unsubscribe = RelayService.onStatusUpdate(relays => {
      setRelayCount(relays.length);
      
      // If we get new relay connections and are not currently loading, refresh data
      if (relays.length > 0 && !loading) {
        refresh();
      }
    });
    
    return () => unsubscribe();
  }, [loading, refresh]);

  // Auto-refresh data based on interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refresh();
      }, autoRefreshInterval);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshInterval, refresh]);

  // Show error in console but not more than once
  useEffect(() => {
    if (error && !errorShown) {
      console.error('MadeiraFeed error:', error);
      setErrorShown(true);
    }
  }, [error, errorShown]);

  // Sort notes by priority hashtags and preload images when notes update
  useEffect(() => {
    if (!loading && notes.length > 0) {
      // Sort notes by hashtag priority
      const sorted = [...notes].sort((a, b) => {
        // First, check for priority hashtags
        const aPriorityTags = a.hashtags.filter(tag => PRIORITY_HASHTAGS.includes(tag));
        const bPriorityTags = b.hashtags.filter(tag => PRIORITY_HASHTAGS.includes(tag));
        
        if (aPriorityTags.length !== bPriorityTags.length) {
          return bPriorityTags.length - aPriorityTags.length;
        }
        
        // Then sort by recency
        return b.created_at - a.created_at;
      });
      
      setSortedNotes(sorted);
      
      // Preload next few images for carousel
      const preloadNext = async (startIndex: number, count: number) => {
        const newPreloaded = new Map(preloadedImages);
        
        for (let i = 0; i < count; i++) {
          const idx = (startIndex + i) % sorted.length;
          const note = sorted[idx];
          
          if (note && note.images && note.images.length > 0) {
            const imageUrl = note.images[0];
            
            if (!newPreloaded.has(imageUrl)) {
              try {
                await cache.preloadAndCacheImage(imageUrl);
                newPreloaded.set(imageUrl, true);
              } catch (err) {
                console.error('Error preloading image:', err);
              }
            }
          }
        }
        
        setPreloadedImages(newPreloaded);
      };
      
      // Preload next 3 images
      preloadNext(currentNoteIndex, 3);
    }
  }, [notes, loading, currentNoteIndex, cache, preloadedImages]);

  // Auto-rotate carousel
  useEffect(() => {
    if (!loading && sortedNotes.length > 0) {
      carouselIntervalRef.current = setInterval(() => {
        setCurrentNoteIndex(prevIndex => (prevIndex + 1) % sortedNotes.length);
      }, 5000);
    }
    
    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [loading, sortedNotes]);

  // Manual navigation
  const goToNext = () => {
    if (sortedNotes.length === 0) return;
    setCurrentNoteIndex(prevIndex => (prevIndex + 1) % sortedNotes.length);
    resetCarouselTimer();
  };

  const goToPrevious = () => {
    if (sortedNotes.length === 0) return;
    setCurrentNoteIndex(prevIndex => (prevIndex - 1 + sortedNotes.length) % sortedNotes.length);
    resetCarouselTimer();
  };

  const resetCarouselTimer = () => {
    if (carouselIntervalRef.current) {
      clearInterval(carouselIntervalRef.current);
      carouselIntervalRef.current = setInterval(() => {
        setCurrentNoteIndex(prevIndex => (prevIndex + 1) % sortedNotes.length);
      }, 5000);
    }
  };

  // Open post in njump when clicked
  const openInNjump = (note: Note) => {
    if (!note || !note.id) return;
    const njumpUrl = `https://njump.me/${note.id}`;
    window.open(njumpUrl, '_blank');
  };

  // Render the current note
  const renderCurrentNote = () => {
    if (loading || sortedNotes.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-pulse">
            <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full mb-4"></div>
            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
            <div className="h-24 w-full bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      );
    }

    const note = sortedNotes[currentNoteIndex];
    if (!note) return null;

    // Highlight priority hashtags
    const highlightedHashtags = note.hashtags.map(tag => ({
      tag,
      isPriority: PRIORITY_HASHTAGS.includes(tag)
    }));

    return (
      <div 
        className="flex flex-col space-y-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer" 
        onClick={() => openInNjump(note)}
      >
        {/* Author info */}
        <div className="flex items-center space-x-2">
          <NostrProfileImage
            npub={note.npub}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div>
            <div className="font-semibold text-sm dark:text-white">
              {note.author.displayName || note.author.name || 'Unknown'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(note.created_at * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {/* Note content (truncated) */}
        <div className="text-sm dark:text-gray-200 line-clamp-3">
          {note.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < note.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        
        {/* Image - now uses preloaded images when available */}
        {note.images && note.images.length > 0 && (
          <div className="w-full h-48 relative rounded-md overflow-hidden">
            <Image
              src={note.images[0]}
              alt="Post image"
              fill
              priority={true}
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        
        {/* Hashtags - now prioritizes important ones */}
        {highlightedHashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {highlightedHashtags.slice(0, 4).map(({ tag, isPriority }) => (
              <span 
                key={tag} 
                className={`text-xs px-2 py-1 rounded ${
                  isPriority 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                #{tag}
              </span>
            ))}
            {highlightedHashtags.length > 4 && (
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded">
                +{highlightedHashtags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Madeira Updates</h2>
        <div className="flex items-center space-x-2">
          {/* Status indicator */}
          <div className="flex items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
              {relayCount} {relayCount === 1 ? 'relay' : 'relays'}
            </span>
            <div className={`w-2 h-2 rounded-full ${relayCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          
          <button 
            onClick={() => refresh()}
            className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
            aria-label="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Carousel */}
      <div className="relative">
        {/* Content */}
        {renderCurrentNote()}
        
        {/* Navigation */}
        {sortedNotes.length > 1 && (
          <>
            <button
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-30 hover:bg-opacity-50 text-white p-2 rounded-full -ml-4"
              onClick={goToPrevious}
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-30 hover:bg-opacity-50 text-white p-2 rounded-full -mr-4"
              onClick={goToNext}
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Dots - now reflect the sorted notes */}
            <div className="flex justify-center mt-4 space-x-2">
              {sortedNotes.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full ${currentNoteIndex === index ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => {
                    setCurrentNoteIndex(index);
                    resetCarouselTimer();
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
              {sortedNotes.length > 5 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">+{sortedNotes.length - 5}</span>
              )}
            </div>
          </>
        )}
        
        {/* Show very minimal error */}
        {error && sortedNotes.length === 0 && !loading && (
          <div className="flex items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button 
              onClick={() => refresh()}
              className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MadeiraFeed; 