'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useLiteProfiles } from '../../../hooks/useLiteProfiles'

interface NostrProfileHeaderProps {
  npub: string
  className?: string
  showImage?: boolean
}

export function NostrProfileHeader({ npub, className = '', showImage = false }: NostrProfileHeaderProps) {
  const { profiles, loading } = useLiteProfiles({ 
    npubs: [npub],
    batchSize: 1 // Only fetching one
  });

  // Extract single profile
  const profile = profiles.get(npub);
  
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  
  // Get name from profile (use displayName first)
  const name = profile?.displayName || profile?.name || 'MadTrips';
  const picture = profile?.picture || null;
  
  // Handle image loading
  useEffect(() => {
    if (picture) {
      setImageLoading(true);
      
      // Preload the image
      const img = new globalThis.Image();
      img.src = picture;
      img.onload = () => setImageLoading(false);
      img.onerror = () => setImageLoading(false);
    } else {
      setImageLoading(false);
    }
  }, [picture]);

  return (
    <div className={`flex items-center font-bold transition-colors ${className}`}>
      {showImage && (
        <div className="relative rounded-full overflow-hidden mr-3" style={{ width: '3.75rem', height: '3.75rem' }}>
          {picture ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 animate-pulse">
                  <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <Image 
                src={picture} 
                alt={name} 
                width={60} 
                height={60} 
                className="object-cover"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-xl text-gray-700 dark:text-gray-300">
                {name.substring(0, 1).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}
      
      <div className="overflow-hidden">
        <span className="block truncate">
          {loading ? (
            <span className="inline-block w-24 h-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          ) : (
            name
          )}
        </span>
      </div>
    </div>
  )
} 