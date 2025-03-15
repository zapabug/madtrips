'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { SimplePool, nip19 } from 'nostr-tools'
import type { Event } from 'nostr-tools'

// Default placeholder image if profile picture can't be loaded
const DEFAULT_PROFILE_IMAGE = '/assets/bitcoin.png'

// Common Nostr relays to fetch profile data from
const RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol'
]

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
  const [profileImage, setProfileImage] = useState<string>(DEFAULT_PROFILE_IMAGE)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'known' | 'primal' | 'iris' | 'relay' | 'default'>('default')
  
  useEffect(() => {
    if (!npub) {
      setLoading(false)
      return
    }
    
    // Load the profile image
    loadProfileImage(npub)
  }, [npub])

  // Main function to load profile image in priority order
  const loadProfileImage = async (userNpub: string) => {
    // 1. First check if we have a known profile image
    if (KNOWN_PROFILES[userNpub]) {
      setProfileImage(KNOWN_PROFILES[userNpub])
      setSource('known')
      setLoading(false)
      return
    }

    // 2. Try Primal API directly (fastest option)
    const primalUrl = `https://api.primal.net/v1/profile/picture/${userNpub}`
    setProfileImage(primalUrl)
    setSource('primal')
    setLoading(false)
    
    // 3. In parallel, try relay and iris as potential backup options
    fetchFromRelays(userNpub)
  }
  
  // Backup: Try to fetch from relays
  const fetchFromRelays = async (userNpub: string) => {
    const pubkey = tryDecodeNpub(userNpub)
    if (!pubkey) return
    
    try {
      const pool = new SimplePool()
      const subscription = pool.subscribeMany(RELAYS, [
        { kinds: [0], authors: [pubkey], limit: 1 }
      ], {
        onevent(event: Event) {
          try {
            const profile = JSON.parse(event.content)
            if (profile.picture && profile.picture.startsWith('http')) {
              // Only update if we aren't using a known profile
              if (source !== 'known') {
                setProfileImage(profile.picture)
                setSource('relay')
              }
            }
          } catch (e) {
            console.error('Failed to parse profile:', e)
          }
        }
      })
      
      // Auto-close the subscription after 3 seconds
      setTimeout(() => {
        subscription.close()
        pool.close(RELAYS)
      }, 3000)
    } catch (error) {
      console.error('Error fetching from relays:', error)
    }
  }
  
  // Helper: Convert npub to hex pubkey
  const tryDecodeNpub = (userNpub: string): string | null => {
    if (!userNpub || !userNpub.startsWith('npub1')) return null
    
    try {
      const result = nip19.decode(userNpub)
      return result.type === 'npub' ? result.data : null
    } catch (error) {
      console.error('Failed to decode npub:', error)
      return null
    }
  }

  // Handle image loading errors
  const handleImageError = () => {
    // Handle errors based on current source
    switch (source) {
      case 'primal':
        // If Primal failed, try Iris
        tryIrisApi(npub)
        break
      case 'iris':
        // If Iris failed, use default
        setProfileImage(DEFAULT_PROFILE_IMAGE)
        setSource('default')
        break
      case 'relay':
        // If relay failed, try Iris
        tryIrisApi(npub)
        break
      case 'known':
        // If a known profile image failed, try Primal
        const primalUrl = `https://api.primal.net/v1/profile/picture/${npub}`
        setProfileImage(primalUrl)
        setSource('primal')
        break
      default:
        // Just make sure we're using the default
        setProfileImage(DEFAULT_PROFILE_IMAGE)
        setSource('default')
    }
  }
  
  // Helper: Try Iris API as a fallback
  const tryIrisApi = (userNpub: string) => {
    const irisUrl = `https://iris.to/api/pfp/${userNpub}`
    setProfileImage(irisUrl)
    setSource('iris')
  }

  return (
    <div className={`relative ${className}`}>
      {loading ? (
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full" style={{ width, height }} />
      ) : (
        <div className="rounded-full overflow-hidden" style={{ width, height }}>
          <Image
            src={profileImage}
            alt={alt}
            width={width}
            height={height} 
            className="object-cover w-full h-full"
            onError={handleImageError}
            priority
            unoptimized
          />
        </div>
      )}
    </div>
  )
} 