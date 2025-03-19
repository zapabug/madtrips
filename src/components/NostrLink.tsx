'use client'

import Image from 'next/image'
import { useCallback, useState } from 'react'

export const NostrLink = () => {
  const npub = "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh"
  const [clickTime, setClickTime] = useState<number | null>(null)
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault() // Prevent the default link behavior
    
    // Record click time
    const now = Date.now()
    setClickTime(now)
    
    // Try to open the nostr protocol
    window.location.href = `nostr:${npub}`
    
    // Set up fallback with a longer timeout (300ms instead of 100ms)
    const timeoutId = setTimeout(() => {
      // Only redirect if this is still the most recent click
      if (clickTime === now) {
        window.location.href = `https://nipjump.com/${npub}`
      }
    }, 300)
    
    // Alternative way to detect if the protocol was handled
    window.addEventListener('blur', () => {
      clearTimeout(timeoutId)
    }, { once: true })
    
    // Also clear the timeout if we navigate away (backup)
    window.addEventListener('beforeunload', () => {
      clearTimeout(timeoutId)
    }, { once: true })
  }, [clickTime, npub])
  
  return (
    <a 
      href={`nostr:${npub}`}
      onClick={handleClick}
      className="text-sand hover:text-purple-500 transition-colors" 
      aria-label="Nostr"
    >
      <Image 
        src="/assets/nostr-icon-purple-transparent-256x256.png" 
        alt="Nostr" 
        width={256} 
        height={256} 
        className="w-20 h-20 object-contain" 
      />
    </a>
  )
} 