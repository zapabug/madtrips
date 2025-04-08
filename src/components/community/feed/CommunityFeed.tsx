'use client';

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import { NostrProfileImage } from '../profile/NostrProfileImage';
import { useImageFeed } from '../../../hooks/useImageFeed';
import { formatDistanceToNow } from 'date-fns';
import { ProfileData } from '../../../hooks/useCachedProfiles';
import LoadingAnimation from '../../ui/LoadingAnimation';

interface CommunityFeedProps {
  npub?: string;
  npubs?: string[];
  limit?: number;
  hashtags?: string[];
  useCorePubs?: boolean;
  className?: string;
  showLoadingAnimation?: boolean;
  showHeader?: boolean;
  hideEmpty?: boolean;
  maxHeight?: number;
  profilesMap?: Map<string, ProfileData> | Record<string, ProfileData>;
  filterLinks?: boolean;
  maxCacheSize?: number;
}

/**
 * CommunityFeed Component
 * 
 * Displays a grid of image notes from Nostr, filtered by authors (npubs)
 * and hashtags. Leverages the centralized cache system to efficiently
 * display content from multiple users, optimized for Web of Trust networks.
 */
export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  npub,
  npubs = [],
  limit = 30,
  hashtags = [],
  useCorePubs = true,
  className = '',
  showLoadingAnimation = true,
  showHeader = true,
  hideEmpty = false,
  maxHeight,
  profilesMap = new Map(),
  filterLinks = true,
  maxCacheSize = 1000 // Higher default for WoT networks
}) => {
  // Determine effective npubs
  const effectiveNpubs = npub ? [npub] : npubs;
  
  // Convert profilesMap to Map if it's a Record
  const profilesAsMap = profilesMap instanceof Map 
    ? profilesMap 
    : new Map(Object.entries(profilesMap));
  
  // Use the shared image feed hook with centralized caching
  const { notes, loading, error, refresh, loadMore, hasMore } = useImageFeed({
    npubs: effectiveNpubs,
    hashtags,
    useCorePubs,
    limit,
    onlyWithImages: true,
    profilesMap: profilesAsMap,
    filterLinks,
    initialFetchCount: limit,
    maxCacheSize // Use the specified cache size for WoT networks
  });

  // Load more when scrolling near the bottom
  const observerTarget = useRef(null);
  
  useEffect(() => {
    // Only set up intersection observer if we have more to load
    if (!hasMore) return;
    
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );
    
    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadMore]);

  // Format date for display
  const formatDate = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
  };

  // Format content to show only the first few lines
  const formatContent = (content: string, maxLength: number = 100) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className={`w-full ${className}`} 
      style={maxHeight ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' } : {}}
    >
      {/* Header and controls */}
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold dark:text-white">Community Feed</h2>
          <div className="flex space-x-2">
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
      )}
      
      {/* Notes Grid */}
      {loading && notes.length === 0 && showLoadingAnimation ? (
        <div className="flex justify-center items-center py-10">
          <LoadingAnimation category="FEED" size="large" showText={true} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {notes.map(note => (
              <div key={note.id} className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                {/* Image */}
                <div className="relative aspect-video w-full">
                  <Image
                    src={note.images[0]}
                    alt="Note image"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                
                {/* Note content */}
                <div className="p-4">
                  {/* Note text */}
                  <p className="text-gray-700 dark:text-gray-200 mb-3 line-clamp-3">
                    {note.content}
                  </p>
                  
                  {/* Author info */}
                  <div className="flex items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <NostrProfileImage
                      npub={note.npub}
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                    <div className="ml-2">
                      <div className="font-medium text-sm dark:text-white">
                        {note.author.displayName || note.author.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(note.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Load more indicator */}
          {hasMore && (
            <div 
              ref={observerTarget}
              className="flex justify-center items-center py-8"
            >
              {loading && (
                <LoadingAnimation category="FEED" size="small" showText={false} />
              )}
            </div>
          )}
        </>
      )}
      
      {/* Empty state */}
      {!loading && notes.length === 0 && !hideEmpty && (
        <div className="flex flex-col items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No posts to display</p>
          <button 
            onClick={() => refresh()}
            className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            Refresh
          </button>
        </div>
      )}
      
      {/* Error state */}
      {error && notes.length === 0 && !loading && (
        <div className="flex items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <button 
            onClick={() => refresh()}
            className="ml-2 p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default CommunityFeed; 