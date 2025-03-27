'use client'

import React from 'react'
import { clearAllGraphCaches } from './SocialGraph'

interface ClearGraphCacheProps {
  className?: string
  buttonText?: string
}

export const ClearGraphCache: React.FC<ClearGraphCacheProps> = ({
  className = '',
  buttonText = 'Reset Graph'
}) => {
  const [isClearing, setIsClearing] = React.useState(false)
  const [cleared, setCleared] = React.useState(false)

  const handleClearCache = () => {
    setIsClearing(true)
    
    // Clear all graph caches
    clearAllGraphCaches()
    
    // Also clear localStorage cache related to graph
    try {
      const storageKeys = Object.keys(localStorage)
      const graphKeys = storageKeys.filter(key => 
        key.includes('graph') || 
        key.includes('nostr') || 
        key.includes('profile-cache')
      )
      
      for (const key of graphKeys) {
        localStorage.removeItem(key)
      }
      
      console.log(`Cleared ${graphKeys.length} items from localStorage`)
    } catch (err) {
      console.error('Error clearing localStorage:', err)
    }
    
    // Show cleared message briefly
    setCleared(true)
    setTimeout(() => {
      setCleared(false)
      setIsClearing(false)
      
      // Reload the page to refresh the graph
      window.location.reload()
    }, 1500)
  }
  
  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={handleClearCache}
        disabled={isClearing}
        className="bg-forest hover:bg-forest-dark text-white px-3 py-1 text-sm rounded-md disabled:opacity-50"
      >
        {isClearing ? 'Clearing...' : cleared ? 'Cleared!' : buttonText}
      </button>
    </div>
  )
} 