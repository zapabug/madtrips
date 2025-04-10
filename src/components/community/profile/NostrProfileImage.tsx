'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useLiteProfiles } from '../../../hooks/useLiteProfiles'

interface NostrProfileImageProps {
  npub: string
  width?: number
  height?: number
  className?: string
  alt?: string
}

export function NostrProfileImage({ 
  npub, 
  width = 64, 
  height = 64, 
  className = '', 
  alt = 'Nostr Profile' 
}: NostrProfileImageProps) {
  const { profiles, loading } = useLiteProfiles({ 
    npubs: [npub],
    batchSize: 1 // Only fetching one
  });

  const profile = profiles.get(npub);
  const profilePic = profile?.picture || '/assets/bitcoin.png';

  // Check if the profilePic URL is from a problematic domain
  const shouldUseProxy = profilePic.startsWith('https://cdn.satlantis.io/');

  // Use the proxy route if necessary
  const imageSrc = shouldUseProxy ? `/api/image-proxy?url=${encodeURIComponent(profilePic)}` : profilePic;

  return (
    <div className={`relative ${className}`}>
      {loading ? (
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full" style={{ width, height }} />
      ) : (
        <div className="rounded-full overflow-hidden" style={{ width, height }}>
          <Image
            src={imageSrc}
            alt={alt}
            width={width}
            height={height} 
            className="object-cover w-full h-full"
            priority
            unoptimized
            onError={() => {
              // Fallback silently when image fails to load
              // (profilePic will already fall back to default when needed)
            }}
          />
        </div>
      )}
    </div>
  )
} 