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

  const { notes, loading } = useImageFeed({
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
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingAnimation category="FEED" size="large" showText={true} />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <p className="text-gray-500">No images found with Madeira-related hashtags.</p>
      </div>
    );
  }

  const currentNote = notes[currentIndex];

  return (
    <div className={`relative rounded-lg overflow-hidden shadow-md ${className}`}>
      {currentNote.images && currentNote.images.length > 0 && (
        <div className="relative h-48">
          <Image 
            src={currentNote.images[0]} 
            alt="Nostr post" 
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}
      {currentNote.author && currentNote.author.picture && (
        <div className="absolute bottom-2 left-2">
          <div className="relative w-10 h-10 rounded-full overflow-hidden">
            <Image 
              src={currentNote.author.picture} 
              alt="Profile" 
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
} 