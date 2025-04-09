'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { NostrProfileImage } from './profile/NostrProfileImage';
import { CORE_NPUBS } from '../../constants/nostr';
import useCachedProfiles from '../../hooks/useCachedProfiles';
import useWOTFollows from '../../hooks/useWOTFollows';
import useImageNotes from '../../hooks/useImageNotes';

interface CommunityFeedProps {
  className?: string;
  showHeader?: boolean;
  maxHeight?: number;
  npubs?: string[];
  limit?: number;
  hashtags?: string[];
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  className = '',
  showHeader = true,
  maxHeight,
  npubs = [],
  limit = 3,
  hashtags = [],
}) => {
  // Step 1: Fetch follows for core npubs to get the full list
  const coreNpubs = npubs.length > 0 ? npubs : CORE_NPUBS.slice(0, 4); // Use provided npubs or fall back to core npubs
  const { wot, loading: wotLoading } = useWOTFollows(coreNpubs);

  // Step 2: Extract all npubs (core + follows)
  const allNpubs = useMemo(() => {
    const followedNpubsSet = new Set<string>(coreNpubs);
    
    wot.forEach((entry, pubkey) => {
      // Get 10 most relevant follows from each core npub
      if (coreNpubs.includes(pubkey)) {
        const sortedFollows = [...entry.follows].sort((a, b) => {
          const aHasFollow = wot.has(a) ? 1 : 0;
          const bHasFollow = wot.has(b) ? 1 : 0;
          return bHasFollow - aHasFollow;
        }).slice(0, 10);
        
        sortedFollows.forEach(follow => followedNpubsSet.add(follow));
      }
    });
    
    return Array.from(followedNpubsSet);
  }, [wot, coreNpubs]);

  // Step 3: Fetch profiles for all npubs
  const { profiles } = useCachedProfiles(allNpubs);

  // Step 4: Fetch notes with images
  const { notes, loading: notesLoading } = useImageNotes(allNpubs);

  // Step 5: Sort notes by WOT relevance and limit
  const previewNotes = useMemo(() => {
    // First, sort by relevance score
    const scoredNotes = notes.map(note => {
      // Get the author's relevance score from WOT
      const score = wot.get(note.pubkey)?.relevanceScore ?? 0;
      
      // Add bonus for being a core npub
      const coreBonus = coreNpubs.includes(note.pubkey) ? 50 : 0;
      
      // Add small bonus for recency
      const recencyBonus = Math.min(10, (Date.now() / 1000 - note.created_at) / (60 * 60 * 24 * 7));
      
      // Calculate final score
      const finalScore = score + coreBonus + recencyBonus;
      
      return { note, score: finalScore };
    });
    
    // Sort by score (highest first) and take top 'limit' entries
    return scoredNotes
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.note);
  }, [notes, wot, coreNpubs, limit]);

  // Open post in njump when clicked
  const openInNjump = (note: any) => {
    if (!note.id) return;
    const njumpUrl = `https://njump.me/${note.id}`;
    window.open(njumpUrl, '_blank');
  };

  // Loading state
  const isLoading = wotLoading || notesLoading;

  return (
    <div 
      className={`w-full ${className}`} 
      style={maxHeight ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' } : {}}
    >
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold dark:text-white">Community Preview</h2>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-40 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="animate-pulse w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 mb-4"></div>
          <div className="animate-pulse w-40 h-4 bg-gray-300 dark:bg-gray-600"></div>
        </div>
      ) : previewNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No image posts to display</p>
        </div>
      ) : (
        <div className="space-y-4">
          {previewNotes.map(note => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openInNjump(note)}
            >
              {/* Author info */}
              <div className="flex items-center space-x-2 mb-3">
                <NostrProfileImage 
                  npub={note.pubkey} 
                  width={40} 
                  height={40} 
                  className="rounded-full" 
                />
                <div>
                  <div className="font-semibold text-sm dark:text-white">
                    {profiles.get(note.pubkey)?.displayName || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(note.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Image */}
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

              {/* Text preview (limited to 100 chars) */}
              <div className="text-sm dark:text-gray-200">
                {note.content.length > 100 
                  ? `${note.content.slice(0, 100)}...` 
                  : note.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed; 