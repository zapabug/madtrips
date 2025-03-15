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
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for auth event
    const handleNostrAuth = (event: CustomEvent) => {
      if (event.detail.type === 'login' || event.detail.type === 'signup') {
        const userNpub = event.detail.npub;
        setNpub(userNpub);
        setIsLoading(false);
        if (onLogin) onLogin(userNpub);
        console.log('User logged in with npub:', userNpub);
      } else if (event.detail.type === 'logout') {
        setNpub(null);
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
      setIsOpen(false); // Close the menu
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl focus:outline-none transform transition-transform hover:scale-110 active:scale-95"
          aria-label="Nostr Login"
        >
          <img 
            src="https://camo.githubusercontent.com/8fc030d170b472876019dc1ff3b0b67d925034c8d441e6709bbb0a0631904b5b/68747470733a2f2f6e6f7374722e6275696c642f692f6e6f7374722e6275696c645f633538646131626162343238653766313835393664376562383062303536633530666239623939383535326261336230373764656532613163316538373066642e676966" 
            alt="Nostr" 
            className="h-full w-full rounded-full" 
          />
        </button>
        
        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-48 border border-gray-200 dark:border-gray-700">
            {npub ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Logged in as:</span>
                  <div className="mt-1 font-mono text-xs truncate text-bitcoin">
                    {npub.substring(0, 8)}...{npub.substring(npub.length - 4)}
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