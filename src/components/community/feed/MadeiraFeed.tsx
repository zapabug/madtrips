'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ProfileData } from '../../../hooks/useCachedProfiles';
import { useImageFeed } from '../../../hooks/useImageFeed';
import LoadingAnimation from '../../ui/LoadingAnimation';

// Madeira-related hashtags to filter by
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

interface MadeiraFeedProps {
  // Accept either a Map or Record for flexibility
  profilesMap: Record<string, ProfileData> | Map<string, ProfileData>;
  // Additional optional props
  className?: string;
}

export default function MadeiraFeed({ 
  profilesMap,
  className = ''
}: MadeiraFeedProps) {
  // Convert profilesMap to Map if it's a Record
  const profilesAsMap = profilesMap instanceof Map 
    ? profilesMap 
    : new Map(Object.entries(profilesMap));

  const { notes, loading, refresh } = useImageFeed({
    hashtags: MADEIRA_HASHTAGS,
    onlyWithImages: true,
    profilesMap: profilesAsMap
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Only set up auto-scroll if we have images
    if (notes.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % notes.length);
    }, 3500); // Auto-scroll every 3.5 seconds

    return () => clearInterval(interval);
  }, [notes.length]);

  if (loading && notes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full w-full ${className}`}>
        <LoadingAnimation category="FEED" size="large" showText={true} />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full w-full text-center p-8 ${className}`}>
        <p className="text-gray-500 mb-4">No images found with Madeira-related hashtags.</p>
        <button 
          onClick={refresh}
          className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          Refresh
        </button>
      </div>
    );
  }

  const currentNote = notes[currentIndex];

  return (
    <div className={`relative w-full h-full rounded-lg overflow-hidden shadow-md ${className}`}>
      {currentNote.images && currentNote.images.length > 0 && (
        <div className="relative w-full h-full">
          <Image 
            src={currentNote.images[0]} 
            alt="Nostr post" 
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center">
          {currentNote.author && currentNote.author.picture && (
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white">
              <Image 
                src={currentNote.author.picture} 
                alt="Profile" 
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="ml-2 text-white">
            <div className="font-medium text-sm">
              {currentNote.author?.displayName || currentNote.author?.name || 'Unknown'}
            </div>
            <div className="text-xs opacity-80">
              #{currentNote.hashtags[0] || 'madeira'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Image count indicator */}
      {notes.length > 1 && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {notes.length}
        </div>
      )}
    </div>
  );
} 