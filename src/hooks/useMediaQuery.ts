'use client'

import { useState, useEffect } from 'react'

/**
 * Custom hook that returns true if the current viewport matches the provided media query
 * @param query The media query to check
 * @returns Boolean indicating if the viewport matches the query
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with a default value based on server/client
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Create a media query list
    const media = window.matchMedia(query)
    
    // Set initial value
    setMatches(media.matches)
    
    // Define listener function
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }
    
    // Add listener
    media.addEventListener('change', listener)
    
    // Cleanup function
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query]) // Re-run if query changes
  
  return matches
} 