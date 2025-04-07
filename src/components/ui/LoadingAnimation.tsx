'use client';

import React, { useEffect, useState } from 'react';
import { getRandomLoadingMessage } from '../../constants/loadingMessages';

interface LoadingAnimationProps {
  category?: 'GRAPH' | 'FEED';
  showText?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * LoadingAnimation component that displays a spinner with a rotating message from loadingMessages
 */
const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  category = 'FEED',
  showText = true,
  className = '',
  size = 'medium'
}) => {
  // Use a consistent initial message to prevent hydration errors
  const initialMessage = category === 'FEED' 
    ? 'Connecting to Nostr relays...' 
    : 'Building the graph...';
    
  const [message, setMessage] = useState<string>(initialMessage);
  const [isClientSide, setIsClientSide] = useState(false);
  
  // Only start changing messages after hydration is complete
  useEffect(() => {
    setIsClientSide(true);
    setMessage(getRandomLoadingMessage(category));
    
    const interval = setInterval(() => {
      setMessage(getRandomLoadingMessage(category));
    }, 3000);
    
    return () => clearInterval(interval);
  }, [category]);
  
  // Determine size classes
  const sizeClasses = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Spinner */}
      <div className="relative">
        <div 
          className={`${sizeClasses[size]} border-4 border-gray-200 dark:border-gray-700 border-t-orange-500 rounded-full animate-spin`} 
        />
      </div>
      
      {/* Loading message */}
      {showText && (
        <p className="mt-3 text-gray-600 dark:text-gray-300 text-center animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation; 