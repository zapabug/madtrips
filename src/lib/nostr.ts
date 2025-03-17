'use client';

import { useState, useEffect } from 'react';
import crypto from 'crypto';

// Define Nostr login options type
interface NostrLoginOptions {
  perms?: string;
  theme?: 'ocean' | 'dark' | 'light';
  relayUrls?: string[];
}

// Types
export interface NostrMessageResponse {
  success: boolean;
  eventId?: string;
  timestamp?: string;
  client?: string;
  error?: string;
}

export interface NostrProof {
  bookingId: string;
  timestamp: string;
  pubkey: string;
  signature: string;
}

// For a real implementation, this would be securely managed
const APP_PRIVATE_KEY = process.env.NOSTR_PRIVATE_KEY || crypto.randomBytes(32).toString('hex');

// Convert hex private key to public key (simplified for demo)
const getPublicKey = (privateKey: string): string => {
  // In a real implementation, this would use proper cryptography
  // For demo, we'll just hash the private key
  return crypto.createHash('sha256').update(privateKey).digest('hex');
};

const APP_PUBLIC_KEY = getPublicKey(APP_PRIVATE_KEY);

// Helper to convert npub to hex format if needed
export const normalizeNostrPubkey = (pubkey: string): string => {
  // Check if this is an npub prefix
  if (pubkey.startsWith('npub')) {
    console.log(`Converting npub to hex: ${pubkey.substring(0, 12)}...`);
    // In a real implementation, you would use proper bech32 conversion
    // For demo, we'll just return a known hex value for npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc
    if (pubkey === 'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc') {
      return '36f11d533238584db19a528377cb622c3e58e3066057651a82a84f1f3dd618e8';
    }
    // For other npubs, just hash them for demo
    return crypto.createHash('sha256').update(pubkey).digest('hex');
  }
  
  // Already a hex pubkey
  return pubkey;
};

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
      const hexPubkey = normalizeNostrPubkey(DEFAULT_PRIMAL_PUBKEY);
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

// Send a direct message to a user
export const sendDirectMessage = async (
  recipientPubkey: string, 
  message: string
): Promise<NostrMessageResponse> => {
  try {
    // Normalize the pubkey (convert from npub if needed)
    const normalizedPubkey = normalizeNostrPubkey(recipientPubkey);
    
    console.log(`Sending Nostr DM to ${normalizedPubkey.substring(0, 8)}...`);
    console.log('Message content:', message);
    
    // In a real implementation, this would create and publish a Nostr event
    // For demo purposes, we'll just log the message
    
    // Check if this is a Primal pubkey and handle accordingly
    const isPrimal = recipientPubkey.startsWith('npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc');
    if (isPrimal) {
      console.log('Using Primal-specific DM protocol...');
    }
    
    // Simulate a successful message send
    return {
      success: true,
      eventId: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date().toISOString(),
      client: isPrimal ? 'primal' : 'standard'
    };
  } catch (error: any) {
    console.error('Error sending Nostr DM:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export interface BookingDetails {
  id: string;
  nostrPubkey: string;
  packageTitle: string;
  createdAt: string;
}

export interface PaymentDetails {
  amount: number;
}

// Send a booking confirmation message
export const sendBookingConfirmation = async (
  booking: BookingDetails, 
  payment: PaymentDetails
): Promise<NostrMessageResponse> => {
  if (!booking.nostrPubkey) {
    console.warn('Cannot send booking confirmation: No Nostr pubkey provided');
    return { success: false, error: 'No Nostr pubkey provided' };
  }
  
  // Check if this is a Primal pubkey
  const isPrimal = booking.nostrPubkey.includes('npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc');
  
  // Create a message with appropriate format for the client
  const confirmationMessage = `
🎉 Your MadTrips booking is confirmed!

📦 Package: ${booking.packageTitle}
🔑 Booking ID: ${booking.id}
💰 Amount: ${payment.amount} sats
📅 Date: ${new Date(booking.createdAt).toLocaleString()}

Thank you for booking with MadTrips! Your adventure awaits.

${isPrimal ? '📱 Confirmation sent via Primal' : 'This is a secure message sent via Nostr.'}
`;

  return await sendDirectMessage(booking.nostrPubkey, confirmationMessage);
};

// For demo purposes only - in a real app, you would use proper Nostr libraries
export const generateNostrProof = (bookingId: string): NostrProof => {
  // Create a simple proof of booking that could be verified
  const signature = crypto.createHmac('sha256', APP_PRIVATE_KEY)
    .update(bookingId)
    .digest('hex');
    
  return {
    bookingId,
    timestamp: new Date().toISOString(),
    pubkey: APP_PUBLIC_KEY,
    signature
  };
}; 