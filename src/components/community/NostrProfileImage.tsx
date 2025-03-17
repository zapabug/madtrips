'use client'

import Image from 'next/image'
import { useProfileImage } from '@/lib/hooks/useProfileImage'
import { KNOWN_PROFILES } from '../../utils/profileUtils'

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
  // Use our new hook instead of the previous implementation
  const { profilePic, loading, source, error } = useProfileImage(
    npub,
    KNOWN_PROFILES[npub] || null
  )

  return (
    <div className={`relative ${className}`}>
      {loading ? (
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full" style={{ width, height }} />
      ) : (
        <div className="rounded-full overflow-hidden" style={{ width, height }}>
          <Image
            src={profilePic || '/assets/bitcoin.png'} // Fallback to bitcoin image if no profile pic
            alt={alt}
            width={width}
            height={height} 
            className="object-cover w-full h-full"
            priority
            unoptimized
          />
        </div>
      )}
    </div>
  )
} 