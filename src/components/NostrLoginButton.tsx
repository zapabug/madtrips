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
  // Initialize state from localStorage if available
  const [npub, setNpub] = useState<string | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Handle localStorage in useEffect to avoid hydration mismatch
  useEffect(() => {
    // This will only run on the client side after hydration
    const storedNpub = localStorage.getItem('nostr_npub');
    const storedProfilePic = localStorage.getItem('nostr_profile_pic');
    
    if (storedNpub) {
      setNpub(storedNpub);
    }
    
    if (storedProfilePic) {
      setProfilePic(storedProfilePic);
    }
  }, []);
  
  // Remove these separate localStorage update effects and combine them
  useEffect(() => {
    // Skip during SSR or if no changes
    if (typeof window === 'undefined') return;
    
    // Update localStorage when npub or profilePic changes
    if (npub) {
      localStorage.setItem('nostr_npub', npub);
    } else {
      localStorage.removeItem('nostr_npub');
    }
    
    if (profilePic) {
      localStorage.setItem('nostr_profile_pic', profilePic);
    } else {
      localStorage.removeItem('nostr_profile_pic');
    }
  }, [npub, profilePic]);

  // Generate default profile picture based on npub
  const getDefaultProfilePic = (npub: string) => {
    // Generate a color based on the npub hash
    const hash = npub.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const h = Math.abs(hash) % 360;
    const s = 70;
    const l = 60;
    
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
      ctx.fillText((npub.replace('npub1', '').charAt(0) || 'N').toUpperCase(), 20, 20);
      
      // Return data URL
      return canvas.toDataURL('image/png');
    }
    
    // Fallback to a solid color if canvas isn't supported
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='hsl(${h}, ${s}%25, ${l}%25)'/%3E%3Ctext x='20' y='25' font-family='Arial' font-size='16' fill='white' text-anchor='middle'%3E${(npub.replace('npub1', '').charAt(0) || 'N').toUpperCase()}%3C/text%3E%3C/svg%3E`;
  };

  // Try to get profile picture using various methods
  const getProfilePic = async (npub: string): Promise<string> => {
    try {
      // Try multiple sources in sequence with fallbacks
      
      // 1. First try avatar.nostr.build with proper error handling
      try {
        const avatarUrl = `https://avatar.nostr.build/${npub}.png`;
        const avatarExists = await new Promise<boolean>((resolve) => {
          const img = document.createElement('img');
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          // Set crossOrigin to anonymous to prevent CORS issues
          img.crossOrigin = 'anonymous';
          // Set timeout to avoid waiting forever
          setTimeout(() => resolve(false), 3000);
          img.src = avatarUrl;
        });
        
        if (avatarExists) {
          console.log('Found profile picture at avatar.nostr.build');
          return avatarUrl;
        }
      } catch (error) {
        console.warn('Error checking avatar.nostr.build:', error);
        // Continue to next source
      }
      
      // 2. Try Iris API as a fallback
      try {
        const irisUrl = `https://iris.to/api/pfp/${npub}`;
        const irisExists = await new Promise<boolean>((resolve) => {
          const img = document.createElement('img');
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.crossOrigin = 'anonymous';
          setTimeout(() => resolve(false), 3000);
          img.src = irisUrl;
        });
        
        if (irisExists) {
          console.log('Found profile picture at iris.to');
          return irisUrl;
        }
      } catch (error) {
        console.warn('Error checking iris.to:', error);
        // Continue to next source
      }
      
      // 3. As a last option, try robohash.org to generate a unique avatar
      // This is a different approach than the previous default that doesn't depend on canvas
      const robohashUrl = `https://robohash.org/${npub}?set=set4`;
      console.log('Using robohash as fallback avatar');
      return robohashUrl;
      
    } catch (error) {
      console.error('All profile picture sources failed:', error);
      return getDefaultProfilePic(npub);
    }
  };

  // Update localStorage when npub or profilePic changes
  useEffect(() => {
    // Listen for auth event
    const handleNostrAuth = (event: CustomEvent) => {
      if (event.detail.type === 'login' || event.detail.type === 'signup') {
        const userNpub = event.detail.npub;
        setNpub(userNpub);
        
        // Try to get profile picture from event details
        let foundPicture = false;
        
        // Check various possible locations for the profile picture
        if (event.detail.profile && event.detail.profile.picture) {
          setProfilePic(event.detail.profile.picture);
          foundPicture = true;
        } else if (event.detail.picture) {
          setProfilePic(event.detail.picture);
          foundPicture = true;
        } else if (event.detail.metadata && event.detail.metadata.picture) {
          // Some clients might use metadata.picture
          setProfilePic(event.detail.metadata.picture);
          foundPicture = true;
        } else if (event.detail.user && event.detail.user.picture) {
          // Primal might use user.picture
          setProfilePic(event.detail.user.picture);
          foundPicture = true;
        } else if (event.detail.user && event.detail.user.profile && event.detail.user.profile.picture) {
          // Another possible structure
          setProfilePic(event.detail.user.profile.picture);
          foundPicture = true;
        }
        
        // If no profile picture is found, try to get it with our helper function
        if (!foundPicture && userNpub) {
          // Use avatar service or generate a default
          getProfilePic(userNpub)
            .then(picUrl => {
              setProfilePic(picUrl);
            })
            .catch(() => {
              setProfilePic(getDefaultProfilePic(userNpub));
            });
        }
        
        setIsLoading(false);
        if (onLogin) onLogin(userNpub);
        console.log('User logged in with npub:', userNpub);
      } else if (event.detail.type === 'logout') {
        setNpub(null);
        setProfilePic(null);
        // Also clear localStorage
        localStorage.removeItem('nostr_npub');
        localStorage.removeItem('nostr_profile_pic');
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

    // Check if user is already logged in with window.nostr or validate stored session
    const checkExistingSession = () => {
      // Skip during SSR
      if (typeof window === 'undefined') return;
      
      // First check if we already have a stored session
      const storedNpub = localStorage.getItem('nostr_npub');
      if (storedNpub) {
        console.log('Found stored Nostr session, validating...');
        // Validate the stored session by checking if we can get the pubkey
        if (window.nostr) {
          window.nostr.getPublicKey().then((publicKey: string) => {
            // If the pubkey matches the stored one, session is valid
            if (publicKey === storedNpub) {
              console.log('Stored Nostr session is valid');
              // Profile pic should already be set from localStorage initialization
            } else {
              console.log('Stored Nostr session pubkey doesn\'t match, clearing');
              // Clear localStorage if the pubkey doesn't match
              localStorage.removeItem('nostr_npub');
              localStorage.removeItem('nostr_profile_pic');
              setNpub(null);
              setProfilePic(null);
            }
          }).catch((e) => {
            console.log('Error validating stored Nostr session:', e);
            // Don't clear localStorage here, it might be a temporary error
          });
        } else {
          // No window.nostr, but we'll keep the stored session anyway
          // The user might be using a different extension/client
          console.log('No window.nostr available, but keeping stored session');
        }
      } else if (window.nostr) {
        // Try to get the pubkey from window.nostr if no stored session
        try {
          window.nostr.getPublicKey().then((publicKey: string) => {
            if (publicKey) {
              const npub = publicKey; // In a real app, you might need to encode this to npub
              setNpub(npub);
              localStorage.setItem('nostr_npub', npub);
              // No profile pic available from this method, use default
              const defaultPic = getDefaultProfilePic(npub);
              setProfilePic(defaultPic);
              localStorage.setItem('nostr_profile_pic', defaultPic);
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
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    setIsLoading(true);
    
    // Dispatch the nlLaunch event to show all login options directly
    document.dispatchEvent(new CustomEvent('nlLaunch', { detail: 'welcome-login' }));
    
    setIsOpen(false); // Close the menu
  };

  const handleLogout = () => {
    // Skip during SSR
    if (typeof window === 'undefined') return;
    
    // Dispatch logout event
    document.dispatchEvent(new Event('nlLogout'));
    setNpub(null);
    setProfilePic(null);
    // Clear localStorage
    localStorage.removeItem('nostr_npub');
    localStorage.removeItem('nostr_profile_pic');
    setIsOpen(false); // Close the menu
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50" id="custom-nostr-login">
        <button 
          onClick={() => {
            if (npub) {
              // If logged in, show dropdown
              setIsOpen(!isOpen);
            } else {
              // If not logged in, directly launch login dialog
              setIsLoading(true);
              document.dispatchEvent(new CustomEvent('nlLaunch', { detail: 'welcome-login' }));
            }
          }}
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
            <div className={`h-full w-full rounded-full relative ${isLoading ? 'opacity-60' : ''}`}>
              <img 
                src="https://camo.githubusercontent.com/8fc030d170b472876019dc1ff3b0b67d925034c8d441e6709bbb0a0631904b5b/68747470733a2f2f6e6f7374722e6275696c642f692f6e6f7374722e6275696c645f633538646131626162343238653766313835393664376562383062303536633530666239623939383535326261336230373764656532613163316538373066642e676966" 
                alt="Nostr" 
                className="h-full w-full rounded-full" 
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          )}
        </button>
        
        {/* Dropdown menu - only show when logged in */}
        {isOpen && npub && (
          <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-48 border border-gray-200 dark:border-gray-700">
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