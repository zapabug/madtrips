'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useNostrProfile } from '../../../hooks/useNostrProfile'

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
  const { profile, loading, error } = useNostrProfile(npub);
  const profilePic = profile?.picture || '/assets/bitcoin.png';

  return (
    <div className={`relative ${className}`}>
      {loading ? (
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full" style={{ width, height }} />
      ) : (
        <div className="rounded-full overflow-hidden" style={{ width, height }}>
          <Image
            src={profilePic}
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