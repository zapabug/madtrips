'use client'

import { useState, useEffect, useCallback } from 'react'
import { SimplePool, nip19 } from 'nostr-tools'
import Image from 'next/image'

// Simple in-memory cache for profile data
const profileCache = new Map<string, {
  name: string;
  picture: string | null;
  timestamp: number;
}>()

// Cache expiration time: 10 minutes
const CACHE_EXPIRY = 10 * 60 * 1000

interface NostrProfileHeaderProps {
  npub: string
  className?: string
  showImage?: boolean
}

export function NostrProfileHeader({ npub, className = '', showImage = false }: NostrProfileHeaderProps) {
  const [name, setName] = useState<string>('MadTrips') 
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [picture, setPicture] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState<boolean>(true)

  // Function to fetch profile information
  const fetchProfile = useCallback(() => {
    if (!npub || !npub.startsWith('npub1')) {
      setLoading(false)
      setError(true)
      return
    }
    
    // Check cache first
    const cachedProfile = profileCache.get(npub)
    if (cachedProfile && (Date.now() - cachedProfile.timestamp) < CACHE_EXPIRY) {
      setName(cachedProfile.name)
      setPicture(cachedProfile.picture)
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(false)
    
    // Create a connection pool
    const pool = new SimplePool()
    
    // Define relays to use
    const relays = [
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
      'wss://nostr.wine'
    ]
    
    try {
      // Decode the npub to get the hex pubkey
      const pubkey = nip19.decode(npub).data as string
      
      // Create a timeout to abort if it takes too long
      const timeoutId = setTimeout(() => {
        setLoading(false)
        setError(true)
        pool.close(relays)
      }, 5000)
      
      // Subscribe to profile metadata events (kind 0)
      const sub = pool.subscribeMany(
        relays,
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        {
          onevent(event) {
            try {
              // Parse the profile content
              const profile = JSON.parse(event.content)
              
              // Update state with profile name
              const displayName = profile.display_name || profile.name || 'MadTrips'
              setName(displayName)
              
              // Update profile picture if available
              const profilePicture = profile.picture || null
              setPicture(profilePicture)
              setImageLoading(!!profilePicture)
              
              // Store in cache
              profileCache.set(npub, {
                name: displayName,
                picture: profilePicture,
                timestamp: Date.now()
              })
              
              setLoading(false)
              clearTimeout(timeoutId)
            } catch (e) {
              console.error('Error parsing profile:', e)
            }
          },
          oneose() {
            // End of stored events reached
            setTimeout(() => {
              setLoading(false)
              pool.close(relays)
            }, 1000)
          }
        }
      )
      
      // Return cleanup function
      return function cleanup() {
        clearTimeout(timeoutId)
        if (sub) sub.close()
        pool.close(relays)
      }
    } catch (e) {
      console.error('Error fetching profile:', e)
      setLoading(false)
      setError(true)
      pool.close(relays)
      return undefined
    }
  }, [npub])

  useEffect(() => {
    // Execute the fetch function and store the cleanup
    const cleanup = fetchProfile()
    
    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [fetchProfile])

  return (
    <div className={`flex items-center font-bold transition-colors ${className}`}>
      {showImage && (
        <div className="relative rounded-full overflow-hidden mr-3" style={{ width: '3.75rem', height: '3.75rem' }}>
          {picture ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  <svg className="animate-spin h-5 w-5 text-bitcoin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              <Image 
                src={picture} 
                alt={name} 
                fill
                sizes="60px"
                quality={95}
                className="object-cover"
                onError={() => setPicture(null)}
                onLoad={() => setImageLoading(false)}
                priority
                unoptimized={false}
              />
            </>
          ) : (
            <div className="w-full h-full bg-ocean/20 dark:bg-bitcoin/20 flex items-center justify-center">
              <span className="text-xl font-bold text-ocean dark:text-bitcoin">
                {name.substring(0, 1).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}
      <span className="truncate max-w-[120px] md:max-w-none">{loading ? 'Loading...' : error ? 'MadTrips' : name}</span>
    </div>
  )
} 