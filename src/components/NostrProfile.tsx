'use client';

import React from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { NostrLoginButton } from './NostrLoginButton';

export const NostrProfile: React.FC = () => {
  const { 
    isLoggedIn, 
    user, 
    npub, 
    userName, 
    userProfilePicture, 
    relayStatus 
  } = useNostr();

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-bold mb-4">Nostr Profile</h2>
      
      <div className="mb-4">
        <NostrLoginButton />
      </div>
      
      {isLoggedIn && user ? (
        <div className="mt-4">
          <div className="flex items-center gap-4">
            {userProfilePicture && (
              <img 
                src={userProfilePicture} 
                alt={userName || 'Profile'} 
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <h3 className="text-lg font-semibold">{userName || 'Unnamed User'}</h3>
              {npub && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {npub.substring(0, 8)}...{npub.substring(npub.length - 8)}
                </p>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Connected to {relayStatus.connected} of {relayStatus.total} relays
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-gray-500 dark:text-gray-400">
          Please login to view your Nostr profile
        </div>
      )}
    </div>
  );
}; 