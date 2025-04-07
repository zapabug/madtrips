'use client';
import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import Image from 'next/image';
import RelayService from '../lib/services/RelayService';

// Memoize the component to reduce unnecessary rerenders
const NostrLoginButton: React.FC = memo(() => {
  const { user, login, logout, userProfilePicture, ndkReady, reconnect } = useNostr();
  const [profileImage, setProfileImage] = useState<string>("/assets/nostrloginicon.gif");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const initAttempted = useRef<boolean>(false);
  const authController = useRef<AbortController | null>(null);
  const loginInProgress = useRef<boolean>(false);

  // Initialize nostr-login on client side only - with error handling
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized || typeof window === 'undefined') return; 

    let timeoutId: NodeJS.Timeout | null = null;

    const initialize = async () => {
      if (initAttempted.current) return;
      initAttempted.current = true;
      
      try {
        console.log("Initializing nostr-login...");
        
        // Make sure we have window object and can access it safely
        if (typeof window === 'undefined') return;
        
        // Clear any existing instances
        if (window.nostrLogin && window.nostrLogin.__nlInitialized) {
          document.dispatchEvent(new Event("nlLogout"));
        }
        
        const { init } = await import('nostr-login');
        
        init({
          theme: 'ocean',
          bunkers: 'nsec.app,highlighter.com',
          perms: 'sign_event:1,nip04_encrypt',
          darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
          noBanner: true,
          methods: 'connect,extension,readOnly',
          onAuth: (npub: string) => {
            console.log("nostr-login auth event received for:", npub.substring(0, 10) + "...");
            setLoginError(null);
          }
        });
        
        setIsInitialized(true);
        console.log("nostr-login initialized successfully");
        
        // Add event listener for auth events
        const handleAuth = (e: any) => {
          console.log("nostr-login auth event triggered");
          setLoginError(null);
          
          if (timeoutId) clearTimeout(timeoutId);
          
          timeoutId = setTimeout(() => {
            if (window.nostr && ndkReady && !loginInProgress.current) {
              loginInProgress.current = true;
              setIsLoggingIn(true);
              
              console.log("Attempting login with NDK...");
              login()
                .then(() => {
                  console.log("Login successful");
                  setLoginError(null);
                })
                .catch((err) => {
                  console.error("Login failed:", err);
                  setLoginError('Login failed. Please try again.');
                })
                .finally(() => {
                  loginInProgress.current = false;
                  setIsLoggingIn(false);
                });
            } else {
              console.warn("Cannot login: window.nostr or NDK not ready");
              if (!window.nostr) {
                console.warn("window.nostr is not available");
              }
              if (!ndkReady) {
                console.warn("NDK is not ready");
                RelayService.reconnect().catch(err => {
                  console.error("Failed to reconnect relays:", err);
                });
              }
            }
          }, 500);
        };
        
        document.addEventListener('nlAuth', handleAuth);
        
        return () => {
          document.removeEventListener('nlAuth', handleAuth);
          if (timeoutId) clearTimeout(timeoutId);
        };
      } catch (error) {
        console.error('Failed to load nostr-login:', error);
        initAttempted.current = false; // Allow retry
        
        // Allow retry after 2 seconds if initialization failed
        setTimeout(() => {
          setIsInitialized(false);
        }, 2000);
      }
    };

    initialize();
  }, [isInitialized, ndkReady, login, reconnect]);

  // Update profile image based on user state
  useEffect(() => {
    if (user && userProfilePicture) {
      setProfileImage(userProfilePicture);
    } else {
      setProfileImage("/assets/nostrloginicon.gif");
    }
  }, [user, userProfilePicture]);

  // Try to reconnect relays if necessary
  useEffect(() => {
    if (!ndkReady && !loginInProgress.current) {
      RelayService.reconnect().catch(err => {
        console.warn('Relay reconnect failed:', err);
      });
    }
  }, [ndkReady, reconnect]);

  // Memoize the handler to prevent recreating it on every render
  const handleLogin = useCallback(async () => {
    if (loginInProgress.current || isLoggingIn) {
      return;
    }
    
    setLoginError(null);
    
    // Abort any existing auth flow
    if (authController.current) {
      authController.current.abort();
      authController.current = null;
    }

    try {
      if (user) {
        // If already logged in, log out
        document.dispatchEvent(new Event("nlLogout"));
        logout();
      } else {
        // Create new abort controller for this auth session
        authController.current = new AbortController();
        
        if (!isInitialized) {
          console.warn('Nostr login not initialized yet');
          // Clean up any existing instance
          if (typeof window !== 'undefined' && window.nostrLogin && window.nostrLogin.__nlInitialized) {
            document.dispatchEvent(new Event("nlLogout"));
          }
            
          // Dynamically import and initialize if needed
          const { init, launch } = await import('nostr-login');
          
          init({
            theme: 'ocean',
            bunkers: 'nsec.app,highlighter.com',
            perms: 'sign_event:1,nip04_encrypt',
            darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
            noBanner: true,
            methods: 'connect,extension,readOnly',
          });
          
          setIsInitialized(true);
          
          // Try reconnecting relays if needed
          if (!ndkReady) {
            await RelayService.reconnect();
          }
          
          // Launch after initialization
          launch({ startScreen: 'welcome' });
        } else {
          // Try reconnecting relays if needed
          if (!ndkReady) {
            await RelayService.reconnect();
          }
          
          // Import dynamically to avoid SSR issues
          const { launch } = await import('nostr-login');
          // Launch the nostr-login UI
          launch({ startScreen: 'welcome' });
        }
        
        // Set loading state
        setIsLoggingIn(true);
        loginInProgress.current = true;
        
        // One-time check if window.nostr is populated after a delay
        setTimeout(() => {
          if (authController.current?.signal.aborted) {
            setIsLoggingIn(false);
            loginInProgress.current = false;
            return;
          }
          
          if (typeof window !== 'undefined' && window.nostr && ndkReady) {
            login()
              .then(() => {
                setLoginError(null);
              })
              .catch(() => {
                setLoginError('Login failed. Please try again.');
              })
              .finally(() => {
                setIsLoggingIn(false);
                loginInProgress.current = false;
                authController.current = null;
              });
          } else {
            // If window.nostr isn't available after timeout, reset loading state
            setIsLoggingIn(false);
            loginInProgress.current = false;
          }
        }, 1000);
      }
    } catch (error) {
      setIsLoggingIn(false);
      loginInProgress.current = false;
      authController.current = null;
      setLoginError('Login failed');
    }
  }, [user, logout, isInitialized, ndkReady, login, reconnect, isLoggingIn]);

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      if (authController.current) {
        authController.current.abort();
        authController.current = null;
      }
      
      loginInProgress.current = false;
      setIsLoggingIn(false);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {loginError && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-red-500 text-white text-xs rounded shadow">
          {loginError}
        </div>
      )}
      <button 
        onClick={handleLogin}
        className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
        title={user ? "Logged in - Click to logout" : "Login with Nostr"}
        disabled={isLoggingIn || loginInProgress.current}
      >
        <div className="relative">
          <Image 
            src={profileImage} 
            alt={user ? "Your profile" : "Login with Nostr"}
            width={70}
            height={70}
            className={`rounded-lg ${(isLoggingIn || loginInProgress.current) ? 'opacity-70' : ''}`}
          />
          {(isLoggingIn || loginInProgress.current) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </button>
    </div>
  );
});

// Explicitly set displayName for the memoized component
NostrLoginButton.displayName = 'NostrLoginButton';

// Export memoized component
export { NostrLoginButton }; 