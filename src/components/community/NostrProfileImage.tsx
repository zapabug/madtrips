'use client'

import Image from 'next/image'
import { useProfileImage } from '@/lib/hooks/useProfileImage'

// Known profile pictures for specific npubs
const KNOWN_PROFILES: Record<string, string> = {
  'npub1freemadeir39t3zlklv2yq2espvmhqnntwlvf34jp9xy2k79gqmqrg9g7w': 'https://freemadeira.com/wp-content/uploads/2023/03/freemadeira-logo-01.png'
}

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