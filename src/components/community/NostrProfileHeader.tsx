'use client'

import { useState, useEffect } from 'react'
import { SimplePool, nip19 } from 'nostr-tools'
import Image from 'next/image'

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

  useEffect(() => {
    if (!npub || !npub.startsWith('npub1')) {
      setLoading(false)
      setError(true)
      return
    }

    const fetchProfile = async () => {
      setLoading(true)
      setError(false)
      
      try {
        // Create a connection pool
        const pool = new SimplePool()
        
        // Decode the npub to get the hex pubkey
        const pubkey = nip19.decode(npub).data as string
        
        // Define relays to use
        const relays = [
          'wss://relay.damus.io',
          'wss://relay.primal.net',
          'wss://nos.lol',
          'wss://nostr.wine'
        ]
        
        // Create a timeout to abort if it takes too long
        const timeout = setTimeout(() => {
          pool.close(relays)
          setLoading(false)
          setError(true)
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
                if (profile.display_name || profile.name) {
                  setName(profile.display_name || profile.name)
                }
                
                // Update profile picture if available
                if (profile.picture) {
                  setPicture(profile.picture)
                  setImageLoading(true)
                }
                
                setLoading(false)
                clearTimeout(timeout)
              } catch (e) {
                console.error('Error parsing profile:', e)
              }
            },
            oneose() {
              // End of stored events reached
              setTimeout(() => {
                pool.close(relays)
                setLoading(false)
              }, 1000)
            }
          }
        )
        
        return () => {
          clearTimeout(timeout)
          pool.close(relays)
        }
      } catch (e) {
        console.error('Error fetching profile:', e)
        setLoading(false)
        setError(true)
      }
    }
    
    fetchProfile()
  }, [npub])

  return (
    <div className={`flex items-center font-bold transition-colors ${className}`}>
      {showImage && picture && (
        <div className="relative rounded-full overflow-hidden mr-3" style={{ width: '3.5rem', height: '3.5rem' }}>
          <Image 
            src={picture} 
            alt={name} 
            fill
            sizes="56px"
            quality={95}
            className="object-cover"
            onError={() => setPicture(null)}
            priority
            unoptimized={false}
          />
        </div>
      )}
      <span className="truncate max-w-[120px] md:max-w-none">{loading ? 'Loading...' : error ? 'MadTrips' : name}</span>
    </div>
  )
} 