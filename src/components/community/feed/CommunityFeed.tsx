'use client';

import React, { useState } from 'react';
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
  profilesMap?: Map<string, ProfileData>;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  npub,
  npubs = [],
  limit = 25,
  hashtags = [],
  useCorePubs = true,
  className = '',
  showLoadingAnimation = true,
  showHeader = true,
  hideEmpty = false,
  maxHeight,
  profilesMap = new Map()
}) => {
  // State for UI
  const [activeTag, setActiveTag] = useState<string | null>(null);
  
  // Determine effective npubs
  const effectiveNpubs = npub ? [npub] : npubs;
  
  // Use the shared image feed hook
  const { notes, loading, error, refresh } = useImageFeed({
    npubs: effectiveNpubs,
    hashtags: activeTag ? [...hashtags, activeTag] : hashtags,
    useCorePubs,
    limit,
    onlyWithImages: true,
    profilesMap
  });
  
  // Extract unique hashtags from all notes for filtering
  const uniqueTags = Array.from(
    new Set(notes.flatMap(note => note.hashtags))
  ).sort();

  // Format date for display
  const formatDate = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
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
      
      {/* Tags filter */}
      {uniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="px-3 py-1 bg-orange-500 text-white text-sm rounded-full hover:bg-orange-600"
            >
              Clear filter
            </button>
          )}
          {uniqueTags.slice(0, 10).map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 text-sm rounded-full ${
                activeTag === tag 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      
      {/* Notes Grid */}
      {loading && showLoadingAnimation ? (
        <div className="flex justify-center items-center py-10">
          <LoadingAnimation category="FEED" size="large" showText={true} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {notes.map(note => (
            <div key={note.id} className="relative aspect-square group rounded-lg overflow-hidden">
              {/* Image */}
              <Image
                src={note.images[0]}
                alt="Community post"
                fill
                className="object-cover transition-transform group-hover:scale-105"
                unoptimized
              />
              
              {/* Overlay with metadata */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <NostrProfileImage
                      npub={note.npub}
                      width={32}
                      height={32}
                      className="rounded-full border-2 border-white"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">
                        {note.author.displayName || note.author.name || 'Unknown'}
                      </div>
                      <div className="text-white/80 text-xs">
                        {formatDate(note.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Hashtags */}
                  {note.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.hashtags.slice(0, 3).map(tag => (
                        <span 
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-black/30 text-white rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.hashtags.length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-black/30 text-white rounded-full">
                          +{note.hashtags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty state */}
      {!loading && notes.length === 0 && !hideEmpty && (
        <div className="flex flex-col items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No posts to display</p>
          <button 
            onClick={() => {
              setActiveTag(null);
              refresh();
            }}
            className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            Refresh
          </button>
        </div>
      )}
      
      {/* Error state */}
      {error && notes.length === 0 && !loading && (
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
  );
};

export default CommunityFeed; 