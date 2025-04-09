'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { NostrProfileImage } from '../profile/NostrProfileImage';
import { CORE_NPUBS, POPULAR_HASHTAGS } from '../../../hooks/utils';
import { useNostrFeed, Note } from '../../../hooks/useNostrFeed';
import { getRandomLoadingMessage } from '../../../constants/loadingMessages';
import { MCP_CONFIG } from '../../../../mcp/config';

// Define NSFW keywords for content filtering
const NSFW_KEYWORDS = [
  'nsfw', 'nude', 'explicit', 'porn', 'xxx'
];

// Use a static loading message for initial server/client render
const INITIAL_LOADING_MESSAGE = "Loading community feed...";

interface CommunityFeedProps {
  npub?: string;
  npubs?: string[];
  limit?: number;
  hashtags?: string[];
  autoScroll?: boolean;
  scrollInterval?: number;
  useCorePubs?: boolean;
  className?: string;
  showLoadingAnimation?: boolean;
  showHeader?: boolean;
  showHashtagFilter?: boolean;
  hideEmpty?: boolean;
  maxHeight?: number;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  npub,
  npubs = [],
  limit = 25,
  hashtags = [],
  autoScroll = false,
  scrollInterval = 10000,
  useCorePubs = true,
  className = '',
  showLoadingAnimation = true,
  showHeader = true,
  showHashtagFilter = true,
  hideEmpty = false,
  maxHeight,
}) => {
  // State for UI
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(INITIAL_LOADING_MESSAGE);
  const [errorShown, setErrorShown] = useState(false);
  const [autoScrollIndex, setAutoScrollIndex] = useState(0);
  const [isClientSide, setIsClientSide] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Properly memoize arrays to prevent unnecessary rerenders
  const hashtagsArray = useMemo(() => [...hashtags], [hashtags.join(',')]);
  const npubsArray = useMemo(() => [...npubs], [npubs.join(',')]);
  
  // Determine which npubs to use - with proper memoization
  const effectiveNpubs = useMemo(() => {
    if (npub) return [npub]; // Single npub mode
    if (useCorePubs) return [...CORE_NPUBS, ...npubsArray]; // Core npubs + additional npubs
    return npubsArray; // Only specified npubs
  }, [npub, npubsArray, useCorePubs]);
  
  // Special handling flag for Free Madeira NPUB - moved outside of render
  const isFreeMadeiraNpub = useMemo(() => 
    npub === 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e',
  [npub]);
  
  // Memoize hook parameters to prevent unnecessary fetches
  const feedParams = useMemo(() => ({
    npubs: effectiveNpubs,
    limit: isFreeMadeiraNpub ? 50 : limit,
    requiredHashtags: hashtagsArray,
    nsfwKeywords: NSFW_KEYWORDS,
    useWebOfTrust: MCP_CONFIG.defaults.useWebOfTrust && !npub
  }), [effectiveNpubs, isFreeMadeiraNpub, limit, hashtagsArray, npub]);
  
  // Use the Nostr feed hook with memoized parameters
  const { notes: allNotes, loading, error, refresh } = useNostrFeed(feedParams);

  // Client-side detection effect - runs once after hydration
  useEffect(() => {
    setIsClientSide(true);
  }, []);
  
  // Show error in console but not more than once
  useEffect(() => {
    if (error && !errorShown) {
      console.error('CommunityFeed error:', error);
      setErrorShown(true);
    }
  }, [error, errorShown]);
  
  // Filter notes by active hashtag if set - memoize to prevent recalculation
  const filteredNotes = useMemo(() => {
    if (!selectedHashtag) return allNotes;
    
    return allNotes.filter(note => 
      note.hashtags.includes(selectedHashtag.toLowerCase()) || 
      note.content.toLowerCase().includes(`#${selectedHashtag.toLowerCase()}`)
    );
  }, [allNotes, selectedHashtag]);

  // Set random loading message - only after client-side rendering is confirmed
  useEffect(() => {
    if (!loading || !isClientSide) return;
    
    setLoadingMessage(getRandomLoadingMessage('FEED'));
    const interval = setInterval(() => {
      setLoadingMessage(getRandomLoadingMessage('FEED'));
    }, 3000);
    
    return () => clearInterval(interval);
  }, [loading, isClientSide]);

  // Fixed auto-scrolling logic with proper state management
  useEffect(() => {
    if (!autoScroll || filteredNotes.length === 0 || loading) {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }
      };
    }
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    
    // Set up the timeout
    scrollTimeoutRef.current = setTimeout(() => {
      setAutoScrollIndex(prev => {
        const nextIndex = (prev + 1) % filteredNotes.length;
        const noteElement = document.querySelector(`.note-item:nth-child(${nextIndex + 1})`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return nextIndex;
      });
    }, scrollInterval);
    
    // Cleanup
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [autoScroll, filteredNotes.length, loading, scrollInterval, autoScrollIndex]);

  // Extract popular hashtags from notes - memoized to prevent recalculation
  const popularHashtags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    allNotes.forEach(note => {
      note.hashtags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .filter(([tag]) => POPULAR_HASHTAGS.includes(tag))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([tag, count]) => ({ tag, count }));
  }, [allNotes]);

  // Open post in njump when clicked - memoized callback
  const openInNjump = useCallback((note: Note) => {
    if (!note || !note.id) return;
    const njumpUrl = `https://njump.me/${note.id}`;
    window.open(njumpUrl, '_blank');
  }, []);

  // Memoized handler for refreshing feed
  const handleRefresh = useCallback(() => {
    setSelectedHashtag(null);
    refresh();
  }, [refresh]);

  return (
    <div className={`w-full ${className}`} style={maxHeight ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' } : {}}>
      {/* Header and controls */}
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold dark:text-white">Community</h2>
          <div className="flex space-x-2">
            <button 
              onClick={handleRefresh}
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
      
      {/* Hashtag filter */}
      {showHashtagFilter && popularHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {popularHashtags.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setSelectedHashtag(tag)}
              className={`text-xs px-2 py-1 rounded-full ${
                selectedHashtag === tag 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              #{tag} ({count})
            </button>
          ))}
          {selectedHashtag && (
            <button
              onClick={() => setSelectedHashtag(null)}
              className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-full ml-2"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      
      {/* Notes */}
      {loading && showLoadingAnimation ? (
        <div className="flex flex-col items-center justify-center h-64 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-pulse space-y-4 w-full">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
            </div>
            <div className="h-40 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {loadingMessage}
          </div>
        </div>
      ) : (
        <>
          {filteredNotes.length === 0 ? (
            // Empty state
            !hideEmpty && (
              <div className="flex flex-col items-center justify-center h-40 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500 dark:text-gray-400 mb-2">No posts to display</p>
                <button 
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Refresh
                </button>
              </div>
            )
          ) : (
            // Notes list
            <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
              {filteredNotes.map(note => (
                <div 
                  key={note.id} 
                  className="note-item bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => openInNjump(note)}
                >
                  {/* Author info */}
                  <div className="flex items-center space-x-2 mb-3">
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
                  
                  {/* Note content */}
                  <div className="text-sm dark:text-gray-200 mb-3">
                    {note.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < note.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  
                  {/* Image(s) */}
                  {note.images && note.images.length > 0 && (
                    <div className="my-3 rounded-md overflow-hidden">
                      <Image
                        src={note.images[0]}
                        alt="Post image"
                        width={500}
                        height={300}
                        className="object-cover w-full max-h-[300px]"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  {/* Hashtags */}
                  {note.hashtags && note.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.hashtags.map(tag => (
                        <span 
                          key={tag} 
                          className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Error message */}
          {error && !loading && (
            <div className="flex items-center justify-center mt-4">
              <button 
                onClick={handleRefresh}
                className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
              >
                Refresh
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunityFeed; 