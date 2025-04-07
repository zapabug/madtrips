'use client';

import React, { useEffect, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';

// Remove the global declaration as it's likely conflicting with 
// definitions from other libraries or types
// The nostr-login library will extend the Window interface itself

export const NostrLoginButton: React.FC = () => {
  const { login, logout, ndkReady } = useNostr();
  const initialized = useRef(false);

  useEffect(() => {
    if (!ndkReady || initialized.current) return;

    const initNostrLogin = async () => {
      try {
        console.log("Initializing nostr-login...");
        const { init } = await import('nostr-login');
        init({
          theme: 'ocean',
          darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
          methods: 'extension,readOnly',
          noBanner: false,
          onAuth: async (npub: string) => {
            console.log("Auth received for:", npub.slice(0, 10) + "...");
            const success = await login(npub);
            console.log(success ? "Login successful" : "Login failed");
          }
          // Remove onLogout as it's not supported
        });
        initialized.current = true;
        console.log("nostr-login initialized");
      } catch (error) {
        console.error("Error initializing nostr-login:", error);
      }
    };

    initNostrLogin();
  }, [ndkReady, login, logout]);

  return null;
};