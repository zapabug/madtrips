'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { ProfileData } from '../../../hooks/useCachedProfiles';
import { useImageFeed } from '../../../hooks/useImageFeed';
import LoadingAnimation from '../../ui/LoadingAnimation';

// Madeira-related hashtags to filter by
export const MADEIRA_HASHTAGS = [
  'madeira', 'funchal', 'madeirisland', 'visitmadeira', 'madeiraisland',
  'bitcoinmadeira', 'bitcoinfunchal', 'btcmadeira', 'btcfunchal',
  'lido', 'ponchinha', 'santana', 'machico', 'calheta', 'portosanto',
  'pontadosol', 'madeiramadness', 'madeiradiggers'
];

/**
 * Props for the MadeiraFeed component
 */
interface MadeiraFeedProps {
  /**
   * Map of Nostr profiles to display author information
   */
  profilesMap: Map<string, ProfileData> | Record<string, ProfileData>;
  
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  
  /**
   * Initial number of items to fetch and display
   * @default 30
   */
  initialCount?: number;
  
  /**
   * Maximum number of items to cache for this component
   * Recommended to keep lower (100-200) for focused feeds like MadeiraFeed
   * @default 150
   */
  maxCached?: number;
}

/**
 * MadeiraFeed Component
 * 
 * Displays a scrollable feed of images tagged with Madeira-related hashtags.
 * Uses the centralized caching system to efficiently fetch and display content.
 */
export default function MadeiraFeed({ 
  profilesMap,
  className = '',
  initialCount = 30,
  maxCached = 150
}: MadeiraFeedProps) {
  // Convert profilesMap to Map if it's a Record - use memoization to prevent unnecessary conversions
  const profilesAsMap = useMemo(() => {
    return profilesMap instanceof Map 
      ? profilesMap 
      : new Map(Object.entries(profilesMap));
  }, [profilesMap]);

  // Memoize MADEIRA_HASHTAGS to ensure stable reference
  const hashtags = useMemo(() => MADEIRA_HASHTAGS, []);

  // Memoize hook parameters to prevent unnecessary refetches
  const hookParams = useMemo(() => ({
    hashtags,
    onlyWithImages: true,
    profilesMap: profilesAsMap,
    limit: initialCount,
    initialFetchCount: initialCount,
    maxCacheSize: maxCached
  }), [profilesAsMap, initialCount, maxCached, hashtags]);

  const { notes, loading, refresh, hasMore } = useImageFeed(hookParams);
  
  // State for the current image index
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Ref for auto-scroll interval
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref for the container element
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to clear auto-scroll interval safely
  const clearAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);
  
  // Create a stable reference to the notes slice 
  const carouselNotes = useMemo(() => {
    return notes.slice(0, 8);
  }, [notes]);
  
  // Reset current index when notes change to avoid out-of-bounds errors
  useEffect(() => {
    if (carouselNotes.length > 0 && currentIndex >= carouselNotes.length) {
      setCurrentIndex(0);
    }
  }, [carouselNotes, currentIndex]);
  
  // Start auto-scroll when component mounts and stops loading
  useEffect(() => {
    // Only set up auto-scroll if we have notes and we're not loading
    if (!loading && carouselNotes.length > 0) {
      // Clear any existing interval first to prevent multiple intervals
      clearAutoScroll();
      
      // Auto-scroll every 5 seconds
      autoScrollRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
      }, 5000);
    }
    
    // Cleanup interval on unmount or when dependencies change
    return clearAutoScroll;
  }, [loading, carouselNotes, clearAutoScroll]);
  
  // Handle manual navigation - memoized callbacks
  const handlePrev = useCallback(() => {
    // Reset auto-scroll timer
    clearAutoScroll();
    
    // Start new interval
    autoScrollRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
    }, 5000);
    
    // Go to previous image
    setCurrentIndex(prev => (prev === 0 ? carouselNotes.length - 1 : prev - 1));
  }, [carouselNotes, clearAutoScroll]);
  
  const handleNext = useCallback(() => {
    // Reset auto-scroll timer
    clearAutoScroll();
    
    // Start new interval
    autoScrollRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
    }, 5000);
    
    // Go to next image
    setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
  }, [carouselNotes, clearAutoScroll]);

  // Memoized handler for clicking individual indicators
  const handleIndicatorClick = useCallback((index: number) => {
    // Reset auto-scroll timer
    clearAutoScroll();
    
    // Start new interval
    autoScrollRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
    }, 5000);
    
    // Go to selected index
    setCurrentIndex(index);
  }, [carouselNotes.length, clearAutoScroll]);
  
  return (
    <div 
      className={`w-full h-full relative overflow-hidden rounded-lg ${className}`}
      ref={containerRef}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
          <LoadingAnimation category="FEED" size="large" showText={true} />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col h-full items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
          <p className="mb-2">No images found</p>
          <button 
            onClick={refresh} 
            className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          {/* Main image */}
          <div className="absolute inset-0 transition-opacity duration-1000 ease-in-out">
            {carouselNotes.map((note, index) => (
              <div 
                key={note.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                {/* Use next/image properly with width and height */}
                <img 
                  src={note.images[0]} 
                  alt={`Madeira image ${index + 1}`}
                  className="object-contain w-full h-full"
                />
                
                {/* Caption overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  <p className="text-sm truncate">
                    {note.content.slice(0, 100)}{note.content.length > 100 ? '...' : ''}
                  </p>
                  <div className="flex items-center mt-2">
                    {note.author.picture && (
                      <img 
                        src={note.author.picture} 
                        alt={note.author.displayName || note.author.name || 'Author'} 
                        className="w-6 h-6 rounded-full mr-2"
                      />
                    )}
                    <span className="text-xs">
                      {note.author.displayName || note.author.name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Navigation controls */}
          <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2 z-20">
            {carouselNotes.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                onClick={() => handleIndicatorClick(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Left/Right buttons */}
          <button
            className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/20 text-white z-20 hover:bg-black/40"
            onClick={handlePrev}
            aria-label="Previous image"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/20 text-white z-20 hover:bg-black/40"
            onClick={handleNext}
            aria-label="Next image"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
} 