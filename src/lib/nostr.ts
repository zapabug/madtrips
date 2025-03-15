import { useState, useEffect } from 'react';

// Define Nostr login options type
interface NostrLoginOptions {
  perms?: string;
  theme?: 'ocean' | 'dark' | 'light';
  relayUrls?: string[];
}

/**
 * Custom hook to interact with Nostr
 * Supports both NIP-07 extensions and Primal client
 */
export function useNostr() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isNostrConnected, setIsNostrConnected] = useState(false);
  const [preferredClient, setPreferredClient] = useState<'nip07' | 'primal'>('nip07');

  // Default login options
  const defaultLoginOptions: NostrLoginOptions = {
    perms: "sign_event:1,sign_event:0",
    theme: "ocean",
    relayUrls: [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://relay.snort.social"
    ]
  };

  // Default Primal public key for demonstration
  const DEFAULT_PRIMAL_PUBKEY = 'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc';
  
  // Convert npub to hex format
  const npubToHex = (npub: string): string => {
    // Simple conversion for demo purposes
    // In a real implementation, you'd use proper bech32 conversion
    if (npub.startsWith('npub')) {
      // This is a simplified approach - in production code,
      // you should use a proper Nostr library for conversion
      return '36f11d533238584db19a528377cb622c3e58e3066057651a82a84f1f3dd618e8';
    }
    return npub;
  };

  // Check for existing connection on load
  useEffect(() => {
    const checkConnection = async () => {
      // For the MVP, we'll check if window.nostr exists (NIP-07)
      if (typeof window !== 'undefined' && 'nostr' in window) {
        try {
          // @ts-ignore - window.nostr is from NIP-07 extension
          const pubkey = await window.nostr.getPublicKey();
          if (pubkey) {
            setPublicKey(pubkey);
            setIsNostrConnected(true);
            setPreferredClient('nip07');
          }
        } catch (error) {
          console.error('Error getting Nostr public key:', error);
        }
      }
    };

    // Add event listener for Primal login message
    const handlePrimalLogin = (event: MessageEvent) => {
      if (event.data && event.data.type === 'primal:login' && event.data.pubkey) {
        setPublicKey(event.data.pubkey);
        setIsNostrConnected(true);
        setPreferredClient('primal');
      }
    };

    checkConnection();
    
    // Listen for messages from Primal
    window.addEventListener('message', handlePrimalLogin);
    
    return () => {
      window.removeEventListener('message', handlePrimalLogin);
    };
  }, []);

  // Function to connect to Nostr
  const connectNostr = async (options?: NostrLoginOptions) => {
    const loginOptions = { ...defaultLoginOptions, ...options };
    
    if (typeof window !== 'undefined') {
      // Check if a NIP-07 extension is available
      if ('nostr' in window) {
        try {
          // @ts-ignore - window.nostr is from NIP-07 extension
          const pubkey = await window.nostr.getPublicKey();
          setPublicKey(pubkey);
          setIsNostrConnected(true);
          setPreferredClient('nip07');
          return true;
        } catch (error) {
          console.error('Error connecting to Nostr:', error);
          return false;
        }
      } else {
        console.error('No Nostr provider found. Please install a Nostr browser extension that implements NIP-07.');
        const usePrimal = window.confirm(
          'No Nostr extension found. Would you like to use Primal instead? (Recommended)'
        );
        
        if (usePrimal) {
          connectWithPrimal(loginOptions);
          return true;
        } else {
          alert('Please install a Nostr browser extension like nos2x or Alby, or use Primal.');
          return false;
        }
      }
    }
    return false;
  };

  // Function to connect with Primal
  const connectWithPrimal = (options?: NostrLoginOptions) => {
    const loginOptions = { ...defaultLoginOptions, ...options };
    
    try {
      // For demo purposes, we'll directly use the hardcoded public key
      const hexPubkey = npubToHex(DEFAULT_PRIMAL_PUBKEY);
      setPublicKey(hexPubkey);
      setIsNostrConnected(true);
      setPreferredClient('primal');
      
      // In a production app, you'd redirect to Primal's login page
      console.log('Connected with Primal client', loginOptions);
      
      // Simulate a successful login event
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'primal:login',
            pubkey: hexPubkey,
            success: true
          }
        })
      );
      
      return true;
    } catch (error) {
      console.error('Error connecting with Primal:', error);
      return false;
    }
  };

  // For MVP: Generate a random pubkey if no extension is available
  const generateRandomPubkey = () => {
    if (!publicKey) {
      // In a real app, we'd never do this - this is just for demo purposes
      const randomPubkey = '36f11d533238584db19a528377cb622c3e58e3066057651a82a84f1f3dd618e8';
      setPublicKey(randomPubkey);
      setIsNostrConnected(true);
    }
  };

  // Use Primal explicitly
  const usePrimal = (options?: NostrLoginOptions) => {
    connectWithPrimal(options);
  };

  return {
    publicKey,
    isNostrConnected,
    connectNostr,
    connectWithPrimal: usePrimal,
    preferredClient,
    // For demo purposes only
    generateRandomPubkey
  };
} 