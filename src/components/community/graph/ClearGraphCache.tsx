'use client'

import React from 'react'
import useCache from '../../../hooks/useCache'

interface ClearGraphCacheProps {
  buttonText?: string
  onClear?: () => void
  className?: string
}

export const ClearGraphCache: React.FC<ClearGraphCacheProps> = ({
  buttonText = 'Clear Graph Cache',
  onClear,
  className = ''
}) => {
  const cache = useCache();
  
  const handleClick = () => {
    // Use the provided onClear callback if available
    if (onClear) {
      onClear()
    } else {
      // Fallback to the default behavior
      cache.clearGraphCache();
      cache.clearImageCache();
      console.log('Graph caches have been cleared');
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 bg-forest text-white rounded-md text-sm hover:bg-opacity-90 transition-colors ${className}`}
    >
      {buttonText}
    </button>
  )
}

export default ClearGraphCache 