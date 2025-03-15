'use client';

import { useState, useEffect } from 'react';
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

interface NostrLoginButtonProps {
  onLogin?: (npub: string) => void;
}

export const NostrLoginButton: React.FC<NostrLoginButtonProps> = ({ 
  onLogin,
}) => {
  const [npub, setNpub] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Generate default profile picture based on npub
  const getDefaultProfilePic = (npub: string) => {
    // Generate a color based on the npub hash
    const hash = npub.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const h = Math.abs(hash) % 360;
    const s = 70;
    const l = 60;
    
    // Create a div element instead of using an SVG data URI
    // This approach ensures proper rendering across browsers
    const firstLetter = (npub.replace('npub1', '') || 'N').charAt(0).toUpperCase();
    
    // Create canvas to generate image
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw circle background
      ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
      ctx.beginPath();
      ctx.arc(20, 20, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw text
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(firstLetter, 20, 20);
      
      // Return data URL
      return canvas.toDataURL('image/png');
    }
    
    // Fallback to a solid color if canvas isn't supported
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='hsl(${h}, ${s}%25, ${l}%25)'/%3E%3Ctext x='20' y='25' font-family='Arial' font-size='16' fill='white' text-anchor='middle'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
  };

  useEffect(() => {
    // Listen for auth event
    const handleNostrAuth = (event: CustomEvent) => {
      if (event.detail.type === 'login' || event.detail.type === 'signup') {
        const userNpub = event.detail.npub;
        setNpub(userNpub);
        
        // Try to get profile picture from event details
        if (event.detail.profile && event.detail.profile.picture) {
          setProfilePic(event.detail.profile.picture);
        } else if (event.detail.picture) {
          setProfilePic(event.detail.picture);
        } else {
          // If no profile picture is available, use a default one
          setProfilePic(getDefaultProfilePic(userNpub));
        }
        
        setIsLoading(false);
        if (onLogin) onLogin(userNpub);
        console.log('User logged in with npub:', userNpub);
      } else if (event.detail.type === 'logout') {
        setNpub(null);
        setProfilePic(null);
      }
    };

    // Listen for login failures
    const handleNostrLoginFail = () => {
      setIsLoading(false);
      console.log('Nostr login failed or was canceled');
    };

    // Add event listeners
    document.addEventListener('nlAuth' as any, handleNostrAuth);
    document.addEventListener('nlFail' as any, handleNostrLoginFail);

    // Check if user is already logged in with window.nostr
    const checkExistingSession = () => {
      if (typeof window !== 'undefined' && window.nostr) {
        try {
          window.nostr.getPublicKey().then((publicKey: string) => {
            if (publicKey) {
              const npub = publicKey; // In a real app, you might need to encode this to npub
              setNpub(npub);
              // No profile pic available from this method, use default
              setProfilePic(getDefaultProfilePic(npub));
            }
          }).catch(() => {
            // Not logged in or getPublicKey isn't available
          });
        } catch (e) {
          // nostr object exists but getPublicKey isn't a function
        }
      }
    };

    checkExistingSession();

    // Remove event listeners on cleanup
    return () => {
      document.removeEventListener('nlAuth' as any, handleNostrAuth);
      document.removeEventListener('nlFail' as any, handleNostrLoginFail);
    };
  }, [onLogin]);

  const handleLogin = () => {
    if (typeof window !== 'undefined') {
      setIsLoading(true);
      
      // Dispatch the nlLaunch event to trigger the login flow
      document.dispatchEvent(new CustomEvent('nlLaunch', { detail: 'welcome' }));
      
      setIsOpen(false); // Close the menu
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      // Dispatch logout event
      document.dispatchEvent(new Event('nlLogout'));
      setNpub(null);
      setProfilePic(null);
      setIsOpen(false); // Close the menu
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50" id="custom-nostr-login">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl focus:outline-none transform transition-transform hover:scale-110 active:scale-95 overflow-hidden"
          aria-label="Nostr Login"
          id="nl-custom-trigger"
        >
          {npub && profilePic ? (
            // Display user's profile picture when logged in
            <img 
              src={profilePic} 
              alt="User Profile" 
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to default profile pic if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = getDefaultProfilePic(npub);
              }}
            />
          ) : (
            // Display default Nostr logo when not logged in
            <img 
              src="https://camo.githubusercontent.com/8fc030d170b472876019dc1ff3b0b67d925034c8d441e6709bbb0a0631904b5b/68747470733a2f2f6e6f7374722e6275696c642f692f6e6f7374722e6275696c645f633538646131626162343238653766313835393664376562383062303536633530666239623939383535326261336230373764656532613163316538373066642e676966" 
              alt="Nostr" 
              className="h-full w-full rounded-full" 
            />
          )}
        </button>
        
        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-48 border border-gray-200 dark:border-gray-700">
            {npub ? (
              <div className="space-y-3">
                <div className="flex items-center mb-2">
                  {profilePic && (
                    <img 
                      src={profilePic} 
                      alt="User Profile" 
                      className="h-8 w-8 rounded-full mr-2 object-cover"
                      onError={(e) => {
                        // Fallback to default profile pic if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.src = getDefaultProfilePic(npub);
                      }}
                    />
                  )}
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Logged in as:</span>
                    <div className="font-mono text-xs truncate text-bitcoin">
                      {npub.substring(0, 8)}...{npub.substring(npub.length - 4)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full bg-[#F7931A] hover:bg-[#F7931A]/80 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-[#F7931A] hover:bg-[#F7931A]/80 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <span className="animate-pulse">Connecting...</span>
                ) : (
                  <span>Login with Nostr</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Click-away listener */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}; 