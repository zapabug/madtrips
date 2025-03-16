'use client';

import React, { useState, useEffect } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import Image from 'next/image';

// Add TypeScript declaration for window.nostr
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: any) => Promise<any>;
      // Add other nostr methods as needed
    };
  }
}

export const NostrLoginButton: React.FC = () => {
  const { user, loading, login, logout, shortenNpub } = useNostr();
  const [showDetails, setShowDetails] = useState(false);
  const [profileImage, setProfileImage] = useState<string>("/nostrloginicon.gif");
  
  // Update profile image when user changes
  useEffect(() => {
    if (user && user.profile?.image) {
      setProfileImage(user.profile.image);
    } else {
      setProfileImage("/nostrloginicon.gif");
    }
  }, [user]);
  
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Failed to login with Nostr extension:", error);
      alert("Please make sure you have a Nostr extension installed (like Alby or nos2x)");
    }
  };
  
  const handleLogout = () => {
    logout();
    setShowDetails(false);
    setProfileImage("/nostrloginicon.gif");
    console.log("User logged out successfully");
  };

  const handleButtonClick = () => {
    // If user is not logged in, directly go to login flow
    if (!user) {
      handleLogin();
    } else {
      // Otherwise toggle the details panel as before
      setShowDetails(prev => !prev);
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main button */}
      <button 
        onClick={handleButtonClick}
        className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-600 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        aria-label={user ? "Your Nostr profile" : "Login with Nostr"}
      >
        <Image 
          src={profileImage} 
          alt={user ? "Your profile" : "Login with Nostr"}
          width={48}
          height={48}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to default image on error
            (e.target as HTMLImageElement).src = "/nostrloginicon.gif";
            setProfileImage("/nostrloginicon.gif");
          }}
        />
      </button>

      {/* Popup details panel - only show for logged in users */}
      {user && showDetails && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mb-3">
              {user.profile?.image ? (
                <Image 
                  src={user.profile.image} 
                  alt={user.profile?.displayName || user.profile?.name || "User"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/nostrloginicon.gif";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-purple-200 flex items-center justify-center text-purple-800 font-bold">
                  {(user.profile?.name || shortenNpub(user.npub) || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            
            <p className="font-medium text-center">
              {user.profile?.displayName || user.profile?.name || shortenNpub(user.npub)}
            </p>
            
            {user.profile?.displayName && user.profile?.name && (
              <p className="text-sm text-gray-500 mb-1 text-center">@{user.profile.name}</p>
            )}
            
            <p className="text-xs text-gray-500 mb-3 text-center">
              {shortenNpub(user.npub)}
            </p>
            
            <button 
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 