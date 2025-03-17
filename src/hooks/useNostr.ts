import { useEffect, useState } from 'react';

interface NostrUser {
  npub: string;
  pubkey: string;
}

interface NostrWindow extends Window {
  nostr?: {
    getPublicKey: () => Promise<string>;
    signEvent: (event: any) => Promise<any>;
  };
}

declare const window: NostrWindow;

export function useNostr() {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkNostr() {
      try {
        if (!window.nostr) {
          console.log('Nostr extension not found');
          setLoading(false);
          return;
        }

        const pubkey = await window.nostr.getPublicKey();
        if (!pubkey) {
          console.log('No public key available');
          setLoading(false);
          return;
        }

        // Convert pubkey to npub format (you might want to use a proper conversion function)
        const npub = `npub1${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
        
        setUser({ npub, pubkey });
      } catch (error) {
        console.error('Error checking Nostr:', error);
      } finally {
        setLoading(false);
      }
    }

    checkNostr();
  }, []);

  const signEvent = async (event: any) => {
    if (!window.nostr || !user) {
      throw new Error('Nostr extension not available');
    }

    try {
      return await window.nostr.signEvent(event);
    } catch (error) {
      console.error('Error signing event:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    signEvent
  };
} 