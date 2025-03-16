'use client';

import React, { useState, useEffect } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import Image from 'next/image';
import Link from 'next/link';

// No global declarations needed, they're now in types/nostr.d.ts

export const NostrLoginButton: React.FC = () => {
  const { user, loading, login, logout, shortenNpub, loginMethod, viewOnlyProfile, availableProfiles } = useNostr();
  const [showDetails, setShowDetails] = useState(false);
  const [showLoginOptions, setShowLoginOptions] = useState(false);
  const [profileImage, setProfileImage] = useState<string>("/assets/nostrloginicon.gif");
  const [imageError, setImageError] = useState(false);
  
  // Force reset when user changes
  useEffect(() => {
    console.log("User state changed:", user ? "Logged in" : "Logged out");
    
    if (user && user.profile?.image && !imageError) {
      // User is logged in and has a profile image
      setProfileImage(user.profile.image);
      console.log("Setting profile image to:", user.profile.image);
    } else if (viewOnlyProfile?.picture && !imageError) {
      // Using view-only mode with a predefined profile picture
      setProfileImage(viewOnlyProfile.picture);
      console.log("Setting profile image to view-only picture:", viewOnlyProfile.picture);
    } else {
      // User is logged out or has no profile image
      setProfileImage("/assets/nostrloginicon.gif");
      console.log("Setting profile image to default GIF");
    }
  }, [user, viewOnlyProfile, imageError]);

  // Reset image error state when user changes
  useEffect(() => {
    setImageError(false);
  }, [user, viewOnlyProfile]);
  
  // Also show login options after logging out from view-only mode
  useEffect(() => {
    if (!user && !loading && loginMethod === null && viewOnlyProfile === null) {
      // This likely means we just logged out
      setShowLoginOptions(true);
    }
  }, [user, loading, loginMethod, viewOnlyProfile]);
  
  const handleNIP07Login = async () => {
    try {
      await login('nip07');
      setShowLoginOptions(false);
    } catch (error) {
      console.error("Failed to login with NIP-07:", error);
      alert("NIP-07 login failed. Please make sure you have a compatible browser extension installed (like Alby or nos2x).");
    }
  };
  
  const handleNIP47Login = async () => {
    try {
      // This should be replaced with a proper UI to get the target URL
      const target = prompt("Enter your NIP-47 signer URL (e.g., nsecbunker endpoint):", "");
      if (!target) return; // User cancelled
      
      await login('nip47', { target });
      setShowLoginOptions(false);
    } catch (error) {
      console.error("Failed to login with NIP-47:", error);
      alert("NIP-47 login failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  const handleViewOnlyLogin = async (profile: any) => {
    try {
      await login('viewonly', { profile });
      setShowLoginOptions(false);
    } catch (error) {
      console.error("Failed to login with view-only mode:", error);
      alert("View-only login failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  // Handle switching from view-only to another login method
  const handleSwitchFromViewOnly = () => {
    setShowLoginOptions(true);
    setShowDetails(false);
  };

  // Handle signup with nsec.app
  const handleSignup = () => {
    // Open nsec.app in a new tab for easy signup
    window.open('https://nsec.app', '_blank');
    
    // Let user know what to do after creating an account
    setTimeout(() => {
      alert('After creating your account on nsec.app, you can log in here using a browser extension (NIP-07) like Alby or nos2x, or connect using your nsec.app profile (NIP-47).');
    }, 1000);
  };
  
  const handleLogout = () => {
    console.log("Logout initiated");
    
    // Close the details panel first
    setShowDetails(false);
    
    // Force reset to default image immediately
    setProfileImage("/assets/nostrloginicon.gif");
    
    // Reset error state
    setImageError(false);
    
    // Call the logout function from context with a small delay
    // to ensure UI updates happen first
    setTimeout(() => {
      logout();
      console.log("Logout completed");
      
      // Force image update again after logout
      setProfileImage("/assets/nostrloginicon.gif");
    }, 10);
  };

  const handleButtonClick = () => {
    // If user is not logged in, show login options
    if (!user) {
      setShowLoginOptions(prev => !prev);
    } else {
      // Otherwise toggle the details panel
      setShowDetails(prev => !prev);
    }
  };

  const handleImageError = () => {
    console.log("Image error occurred, falling back to default GIF");
    setImageError(true);
    setProfileImage("/assets/nostrloginicon.gif");
  };
  
  // Close panels when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the login component
      const nostrLoginButton = document.querySelector('#nostr-login-container');
      if (nostrLoginButton && !nostrLoginButton.contains(event.target as Node)) {
        setShowLoginOptions(false);
        setShowDetails(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  return (
    <div id="nostr-login-container" className="fixed bottom-4 right-4 z-50">
      {/* Main button - rounded square with no border or shadow */}
      <button 
        onClick={handleButtonClick}
        className="w-12 h-12 rounded-lg overflow-hidden transition-all transform hover:scale-105"
        aria-label={user ? "Your Nostr profile" : "Login with Nostr"}
        disabled={loading}
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <Image 
            src={profileImage} 
            alt={user ? "Your profile" : "Login with Nostr"}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            onError={handleImageError}
            key={`profile-image-${user?.npub || 'none'}-${profileImage}`} // Force re-render with reliable key
            priority
            unoptimized
          />
        )}
      </button>

      {/* Login options panel - only show when not logged in */}
      {!user && showLoginOptions && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 border border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-medium mb-3 text-center dark:text-white">Login Options</h3>
          
          <div className="space-y-3">
            {/* NIP-07 Browser Extension Login */}
            <button 
              onClick={handleNIP07Login}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"></path>
                </svg>
              </span>
              Browser Extension (NIP-07)
            </button>
            
            {/* NIP-47 Remote Signer Login */}
            <button 
              onClick={handleNIP47Login}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1H4v8a1 1 0 001 1h10a1 1 0 001-1V6zM4 4a1 1 0 011-1h10a1 1 0 011 1v1H4V4z" clipRule="evenodd"></path>
                </svg>
              </span>
              Remote Signer (NIP-47)
            </button>
            
            {/* Signup with nsec.app */}
            <button 
              onClick={handleSignup}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                </svg>
              </span>
              Signup with nsec.app
            </button>
            
            {/* View-only Options */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or browse as:</p>
              <div className="space-y-2">
                {availableProfiles.map((profile) => (
                  <button 
                    key={profile.npub}
                    onClick={() => handleViewOnlyLogin(profile)}
                    className="w-full px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium flex items-center text-left"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0">
                      {profile.picture ? (
                        <Image 
                          src={profile.picture} 
                          alt={profile.displayName || profile.name || "Profile"}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                          {(profile.name || shortenNpub(profile.npub))[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="truncate">{profile.displayName || profile.name || shortenNpub(profile.npub)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup details panel - only show for logged in users */}
      {user && showDetails && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-lg overflow-hidden mb-3">
              {user.profile?.image && !imageError ? (
                <Image 
                  src={user.profile.image} 
                  alt={user.profile?.displayName || user.profile?.name || "User"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  key={`detail-image-${user.npub}-${user.profile.image}`}
                  priority
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                  {(user.profile?.name || shortenNpub(user.npub) || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            
            <p className="font-medium text-center dark:text-white">
              {user.profile?.displayName || user.profile?.name || shortenNpub(user.npub)}
            </p>
            
            {user.profile?.displayName && user.profile?.name && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 text-center">@{user.profile.name}</p>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">
              {shortenNpub(user.npub)}
            </p>
            
            {loginMethod === 'viewonly' ? (
              <div className="flex flex-col w-full space-y-2">
                <p className="text-xs text-center text-amber-600 dark:text-amber-400 mb-1">
                  You are browsing in view-only mode
                </p>
                <button 
                  onClick={handleSwitchFromViewOnly}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
                >
                  Switch Account
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium"
                >
                  Exit View-Only Mode
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 