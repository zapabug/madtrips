'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { LiteProfile } from '../../../types/lite-nostr';
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
  profilesMap: Map<string, LiteProfile> | Record<string, LiteProfile>;
  
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  
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
 * Displaysimages tagged with Madeira-related hashtags.
 * Uses the centralized caching system to efficiently fetch and display content.
 */
export default function MadeiraFeed({
  profilesMap,
  className = '',
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
    limit: 30, // Set limit to 30 for the slideshow
    initialFetchCount: 30, // Set initial fetch count to 30
    maxCacheSize: maxCached
  }), [profilesAsMap, maxCached, hashtags]);

  const { notes, loading, refresh } = useImageFeed(hookParams);
  
  // State for the current image index
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Ref for auto-scroll interval
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to clear auto-scroll interval safely
  const clearAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);
  
  // Reset current index when notes change to avoid out-of-bounds errors
  useEffect(() => {
    if (notes.length > 0 && currentIndex >= notes.length) {
      setCurrentIndex(0);
    }
  }, [notes, currentIndex]);
  
  // Start auto-scroll when component mounts and stops loading
  useEffect(() => {
    if (!loading && notes.length > 0) {
      clearAutoScroll();
      autoScrollRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % notes.length);
      }, 5000);
    }
    return clearAutoScroll;
  }, [loading, notes, clearAutoScroll]);
  
  return (
    <div 
      className={`w-full h-full relative overflow-hidden rounded-lg ${className}`}
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
            {notes.map((note, index) => (
              <div 
                key={note.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                {/* Display the main image */}
                <Image
                  src={note.images[0]}
                  alt={`Madeira image ${index + 1}`}
                  layout="fill"
                  objectFit="contain"
                  priority={index === currentIndex}
                />
                
                {/* Profile image overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  {note.author.picture && (
                    <Image
                      src={note.author.picture}
                      alt={note.author.displayName || note.author.name || 'Author'}
                      width={24}
                      height={24}
                      className="rounded-full mr-2"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Navigation controls */}
          <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2 z-20">
            {notes.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
} 