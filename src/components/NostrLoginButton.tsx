'use client';
import React, { useEffect, useState } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import Image from 'next/image';

export const NostrLoginButton: React.FC = () => {
  const { user, login, logout, loginMethod } = useNostr();
  const [profileImage, setProfileImage] = useState<string>("/assets/nostrloginicon.gif");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize nostr-login on client side only
  useEffect(() => {
    // Dynamically import nostr-login to avoid SSR issues
    import('nostr-login')
      .then(({ init }) => {
        init({
          theme: 'ocean',
          bunkers: 'nsec.app,highlighter.com',
          perms: 'sign_event:1,nip04_encrypt',
          darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
          noBanner: true,
          methods: 'connect,extension,readOnly',
          onAuth: (npub, options) => {
            console.log('Auth successful:', npub);
            // NostrContext will detect window.nostr automatically
          }
        });
        
        setIsInitialized(true);
        
        // Add event listener for auth events
        const handleAuth = (e: any) => {
          console.log('Auth event:', e.detail);
          // No need to call our login() as NostrContext will detect window.nostr
        };
        
        document.addEventListener('nlAuth', handleAuth);
        
        return () => {
          document.removeEventListener('nlAuth', handleAuth);
        };
      })
      .catch(error => console.error('Failed to load nostr-login:', error));
  }, []);

  // Update profile image based on user state
  useEffect(() => {
    if (user && user.profile?.picture) {
      setProfileImage(user.profile.picture);
    } else {
      setProfileImage("/assets/nostrloginicon.gif");
    }
  }, [user]);

  const handleLogin = async () => {
    if (!isInitialized) {
      console.warn('Nostr login not initialized yet');
      return;
    }
    
    try {
      if (user) {
        // If already logged in, log out
        document.dispatchEvent(new Event("nlLogout"));
        logout();
      } else {
        // Import dynamically to avoid SSR issues
        const { launch } = await import('nostr-login');
        // Launch the nostr-login UI
        launch({ startScreen: 'welcome' });
      }
    } catch (error) {
      console.error('Login action failed:', error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={handleLogin}
        className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
        title={user ? "Logged in - Click to logout" : "Login with Nostr"}
      >
        <Image 
          src={profileImage} 
          alt={user ? "Your profile" : "Login with Nostr"}
          width={70}
          height={70}
          className="rounded-lg"
        />
      </button>
    </div>
  );
}; 