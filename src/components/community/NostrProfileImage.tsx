'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useNostr } from '../../lib/contexts/NostrContext'

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
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { ndk, getUserProfile } = useNostr()

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!ndk || !npub) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Use the getUserProfile function from NostrContext
        const user = await getUserProfile(npub)
        
        if (user && user.profile?.picture) {
          setProfilePic(user.profile.picture)
        } else {
          // If no profile picture is found, use bitcoin image as fallback
          setProfilePic('/assets/bitcoin.png')
        }
      } catch (err) {
        console.error(`Failed to fetch profile for ${npub}:`, err)
        setError('Failed to load profile')
        setProfilePic('/assets/bitcoin.png')
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [ndk, npub, getUserProfile])

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