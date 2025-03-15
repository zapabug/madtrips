'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useNostrAuth, TrustLevel } from '@/lib/nostr/NostrAuthProvider';

interface NostrLoginButtonProps {
  className?: string;
}

export const NostrLoginButton: React.FC<NostrLoginButtonProps> = ({ className = '' }) => {
  const { isConnected, user, login, logout, checkTrustLevel } = useNostrAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (isConnected) {
      logout();
    } else {
      try {
        setIsLoading(true);
        await login();
      } catch (error) {
        console.error('Login failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {isConnected && user ? (
        <div className="flex items-center space-x-2">
          <NostrUserProfile user={user} />
          <button
            onClick={handleAuth}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleAuth}
          disabled={isLoading}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-md ${
            isLoading 
              ? 'bg-gray-200 cursor-wait' 
              : 'bg-[#F7931A] hover:bg-[#F7931A]/90'
          } text-white transition-colors`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          )}
          <span className="text-sm font-medium">
            {isLoading ? 'Connecting...' : 'Connect with Nostr'}
          </span>
        </button>
      )}
    </div>
  );
};

interface NostrUserProfileProps {
  user: {
    pubkey: string;
    npub: string;
    name?: string;
    profileImage?: string;
  };
}

export const NostrUserProfile: React.FC<NostrUserProfileProps> = ({ user }) => {
  const { checkTrustLevel } = useNostrAuth();
  const trustLevel = checkTrustLevel(user.npub);
  
  // Shorten npub for display
  const shortenNpub = (npub: string) => {
    if (!npub) return "";
    return npub.substring(0, 6) + "..." + npub.substring(npub.length - 4);
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <Image
          src={user.profileImage || getDefaultProfileImage(user.npub)}
          alt={user.name || 'Nostr user'}
          width={28}
          height={28}
          className="rounded-full"
        />
        <div className="absolute -bottom-1 -right-1">
          <TrustBadge npub={user.npub} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium dark:text-white">
          {user.name || shortenNpub(user.npub)}
        </p>
      </div>
    </div>
  );
};

interface TrustBadgeProps {
  npub: string;
  size?: 'sm' | 'md';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ npub, size = 'sm' }) => {
  const { checkTrustLevel, isConnected } = useNostrAuth();
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(TrustLevel.UNKNOWN);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const getTrustLevel = async () => {
      if (!isConnected || !npub) return;
      
      try {
        const level = await checkTrustLevel(npub);
        setTrustLevel(level);
      } catch (err) {
        console.error('Error checking trust level:', err);
      } finally {
        setLoading(false);
      }
    };
    
    getTrustLevel();
  }, [npub, checkTrustLevel, isConnected]);
  
  if (!isConnected || loading) return null;
  
  if (trustLevel === TrustLevel.UNKNOWN) return null;
  
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  
  let badgeColor = '';
  let tooltip = '';
  
  switch (trustLevel) {
    case TrustLevel.VERIFIED:
      badgeColor = 'bg-purple-500';
      tooltip = 'Core Community Member';
      break;
    case TrustLevel.HIGH:
      badgeColor = 'bg-green-500';
      tooltip = 'Directly Connected';
      break;
    case TrustLevel.MEDIUM:
      badgeColor = 'bg-blue-500';
      tooltip = 'Indirectly Connected';
      break;
    case TrustLevel.LOW:
      badgeColor = 'bg-yellow-500';
      tooltip = 'Weakly Connected';
      break;
    default:
      return null;
  }
  
  return (
    <div className="relative group">
      <div className={`${sizeClass} ${badgeColor} rounded-full border border-white`}></div>
      <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap">
        {tooltip}
      </div>
    </div>
  );
};

// Helper function to generate default profile image
function getDefaultProfileImage(npub: string): string {
  // Generate a color based on the npub hash
  const hash = npub.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const color = `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
  
  // Create a data URI for a colored circle with the first letter
  const firstLetter = (npub.replace('npub1', '') || 'N').charAt(0).toUpperCase();
  
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="25" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${firstLetter}</text></svg>`;
} 