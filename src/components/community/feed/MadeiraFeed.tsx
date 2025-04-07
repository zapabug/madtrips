'use client';

import React from 'react';
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
  profilesMap: Record<string, ProfileData>;
}

export default function MadeiraFeed({ profilesMap }: MadeiraFeedProps) {
  const { notes, loading } = useImageFeed({
    hashtags: MADEIRA_HASHTAGS,
    onlyWithImages: true,
    profilesMap: new Map(Object.entries(profilesMap))
  });

  if (loading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingAnimation category="FEED" size="large" showText={true} />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No images found with Madeira-related hashtags.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg overflow-hidden shadow-md">
          {note.images && note.images.length > 0 && (
            <div className="relative h-48">
              <Image 
                src={note.images[0]} 
                alt="Nostr post" 
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="p-4">
            <p className="text-sm line-clamp-3">{note.content}</p>
            {note.author && (
              <div className="flex items-center mt-3">
                {note.author.picture && (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden mr-2">
                    <Image 
                      src={note.author.picture} 
                      alt={note.author.displayName || 'User'} 
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <span className="text-sm font-medium">
                  {note.author.displayName || note.author.name || 'Anonymous'}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 