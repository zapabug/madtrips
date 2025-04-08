'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { initNostrLogin } from '../lib/services/NostrLoginService';

// Remove the global declaration as it's likely conflicting with 
// definitions from other libraries or types
// The nostr-login library will extend the Window interface itself

export const NostrLoginButton: React.FC = () => {
  const { login, logout, ndkReady, isLoggedIn } = useNostr();
  const initialized = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ndkReady || initialized.current) return;

    const setupNostrLogin = async () => {
      try {
        console.log("Initializing nostr-login...");
        const success = await initNostrLogin();
        
        if (success) {
          console.log("nostr-login initialized");
          initialized.current = true;
          
          // Setup global callback for nostr-login
          window.nostrLogin = window.nostrLogin || {};
          window.nostrLogin.onAuth = async (npub: string) => {
            console.log("Auth received for:", npub.slice(0, 10) + "...");
            const loginSuccess = await login(npub);
            console.log(loginSuccess ? "Login successful" : "Login failed");
            
            if (!loginSuccess) {
              setError("Login failed. Please try again.");
            }
          };
        } else {
          setError("Failed to initialize Nostr login");
        }
      } catch (error) {
        console.error("Error initializing nostr-login:", error);
        setError("Failed to initialize Nostr login. Please check your connection.");
      }
    };

    setupNostrLogin();
  }, [ndkReady, login]);

  // Launch the login modal when button is clicked
  const handleLogin = async () => {
    try {
      setError(null);
      const { launch } = await import('nostr-login');
      launch();
    } catch (err) {
      console.error("Error launching nostr-login:", err);
      setError("Failed to launch login. Please try again.");
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      
      {isLoggedIn ? (
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      ) : (
        <button 
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Login with Nostr
        </button>
      )}
    </div>
  );
};