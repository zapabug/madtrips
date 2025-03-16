'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NDK, { NDKEvent, NDKUser, NDKFilter, NDKSubscription, NostrEvent } from '@nostr-dev-kit/ndk';
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { NIP47Client } from '@/lib/nostr/nip47';
import { NIP47PaymentClient } from '@/lib/nostr/nip47-payments';
import { NDKNip46Signer } from '@nostr-dev-kit/ndk';

// Utility function to shorten npub for display
export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
};

// List of predefined profiles for view only mode
export const PREDEFINED_PROFILES: ViewOnlyProfile[] = [
  {
    // MadTrips official profile
    pubkey: '9a0a16254ff0dd29bbe45aeea9b8d80c0b9537d879a93f2589bbacedc4db166e', 
    npub: 'npub14jrvanj69ulfxc92pqsunvv220xhwtn6pukpmgpqzg6xl6wmaflqnx6nvs',
    name: 'MadTrips_Official',
    displayName: 'MadTrips (View Only)',
    picture: '/assets/nostr-icon-purple-transparent-256x256.png'
  }
];

// Define types for our context
interface ViewOnlyProfile {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

type LoginMethod = 'nip07' | 'nip47' | 'viewonly';

interface NostrContextType {
  ndk: NDK | null;
  user: NDKUser | null;
  loading: boolean;
  error: Error | null;
  loginMethod: LoginMethod | null;
  viewOnlyProfile: ViewOnlyProfile | null;
  availableProfiles: ViewOnlyProfile[];
  login: (method: LoginMethod, options?: any) => Promise<void>;
  logout: () => void;
  getUserProfile: (npub: string) => Promise<NDKUser>;
  getFollows: (npub: string) => Promise<NDKUser[]>;
  shortenNpub: (npub: string) => string;
  payInvoice?: (invoice: string) => Promise<any>;
  canMakePayments: boolean;
}

// Create the context
const NostrContext = createContext<NostrContextType | undefined>(undefined);

// Provider component
export const NostrProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod | null>(null);
  const [viewOnlyProfile, setViewOnlyProfile] = useState<ViewOnlyProfile | null>(null);
  const [nip47Client, setNip47Client] = useState<NIP47Client | null>(null);
  const [paymentClient, setPaymentClient] = useState<NIP47PaymentClient | null>(null);
  const [canMakePayments, setCanMakePayments] = useState(false);

  // Initialize NDK on component mount
  useEffect(() => {
    const initializeNDK = async () => {
      try {
        // Check if window is defined (only in browser)
        if (typeof window !== 'undefined') {
          // Create a new NDK instance without a signer initially
          const ndk = new NDK({
            explicitRelayUrls: [
              'wss://relay.damus.io',
              'wss://relay.nostr.band',
              'wss://nos.lol',
              'wss://relay.current.fyi',
              'wss://relay.snort.social',
            ]
          });

          // Connect to relays
          await ndk.connect();
          setNdk(ndk);
          console.log('NDK initialized without signer');
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to initialize NDK:', e);
        setError(e as Error);
        setLoading(false);
      }
    };

    initializeNDK();
  }, []);

  // Login function that handles different methods
  const login = async (method: LoginMethod, options?: any) => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    setLoading(true);
    setError(null);
    
    try {
      switch (method) {
        case 'nip07': {
          // Browser extension login (NIP-07)
          if (typeof window === 'undefined' || !window.nostr) {
            throw new Error('No NIP-07 compatible browser extension found');
          }
          
          // Create a signer that uses the window.nostr API (extension)
          ndk.signer = new NDKNip07Signer();
          
          // Get the user's public key
          const publicKey = await ndk.signer.user();
          
          if (!publicKey) {
            throw new Error('Failed to get public key from extension');
          }
          
          // Create an NDKUser from the public key
          const user = ndk.getUser({ npub: publicKey.npub });
          
          // Fetch the user's profile
          await user.fetchProfile();
          
          setUser(user);
          setLoginMethod('nip07');
          setViewOnlyProfile(null);
          console.log('NIP-07 login successful:', user.npub);
          setCanMakePayments(false); // NIP-07 can't make payments by default
          break;
        }
        
        case 'nip47': {
          // Remote signer login (NIP-47)
          if (!options || !options.target) {
            throw new Error('NIP-47 connection requires a target URL');
          }

          console.log('NIP-47 login requested to:', options.target);
          
          // For future implementation, we've created a NIP-47 client in @/lib/nostr/nip47.ts
          // but are providing a simplified implementation here for now
          
          try {
            // For demo purposes, we'll create a read-only profile from the target
            let npub = options.target;
            
            // If the target is a nostrconnect:// URL, extract the npub
            if (npub.startsWith('nostrconnect://')) {
              const url = new URL(npub);
              npub = url.pathname.substring(1); // Remove leading slash
              if (npub.startsWith('npub1')) {
                // Use as is
              } else {
                // Convert hex to npub if needed
                npub = nip19.npubEncode(npub);
              }
            } else if (!npub.startsWith('npub1')) {
              // If it's a hex key, convert to npub
              npub = nip19.npubEncode(npub);
            }
            
            // Create an NDKUser from the pubkey
            const user = ndk.getUser({ npub });
            
            // Create NIP-47 client
            const client = new NIP47Client(options.target);
            
            // Connect to the remote signer
            await client.connect();
            
            // Get the public key
            const remotePubkey = await client.getPublicKey();
            
            // Create the payment client
            const payments = new NIP47PaymentClient(client);
            
            // Check if payments are supported
            const paymentStatus = await payments.checkPaymentCapability();
            
            // Store the clients for later use
            setNip47Client(client);
            setPaymentClient(payments);
            setCanMakePayments(paymentStatus.canPay);
            
            // Attempt to fetch profile data
            try {
              await user.fetchProfile();
            } catch (e) {
              console.warn('Could not fetch profile for remote signer:', e);
            }
            
            setUser(user);
            setLoginMethod('nip47');
            setViewOnlyProfile(null);
            
            console.log('NIP-47 login successful:', user.npub);
            console.log('Payment capability:', paymentStatus.canPay ? 'Enabled' : 'Disabled');
            
            if (!paymentStatus.canPay) {
              console.warn('Payment not available:', paymentStatus.reason);
            }
          } catch (error) {
            console.error('NIP-47 login error:', error);
            throw new Error(`NIP-47 login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          break;
        }
        
        case 'viewonly': {
          // View-only login with a predefined profile
          if (!options || !options.profile) {
            throw new Error('View-only login requires a profile');
          }
          
          const profile = options.profile as ViewOnlyProfile;
          
          // Create an NDKUser from the public key
          const user = ndk.getUser({ npub: profile.npub });
          
          // For view-only, we can still fetch their profile data
          try {
            await user.fetchProfile();
          } catch (e) {
            console.warn('Could not fetch profile for view-only user, using predefined data');
            // Use the predefined profile data
            user.profile = {
              name: profile.name,
              displayName: profile.displayName,
              image: profile.picture
            };
          }
          
          setUser(user);
          setLoginMethod('viewonly');
          setViewOnlyProfile(profile);
          console.log('View-only login successful:', profile.npub);
          setNip47Client(null);
          setPaymentClient(null);
          setCanMakePayments(false);
          break;
        }
        
        default:
          throw new Error(`Unsupported login method: ${method}`);
      }
    } catch (e) {
      console.error(`Login error (${method}):`, e);
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  // Enhanced logout function
  const logout = () => {
    console.log('NostrContext: Logout initiated');
    
    // Clean up any active subscriptions or resources if needed
    if (ndk) {
      try {
        // If we have a signer, we should reset it
        if (ndk.signer) {
          console.log('Resetting NDK signer');
          ndk.signer = undefined;
        }
        
        console.log('User resources cleaned up');
      } catch (error) {
        console.error('Error during logout cleanup:', error);
      }
    }
    
    // Clean up NIP-47 client if it exists
    if (nip47Client) {
      try {
        nip47Client.disconnect();
      } catch (e) {
        console.error('Error disconnecting NIP-47 client:', e);
      }
      setNip47Client(null);
    }
    
    // Clean up payment client
    setPaymentClient(null);
    setCanMakePayments(false);
    
    // Reset all state
    setLoginMethod(null);
    setViewOnlyProfile(null);
    setUser(null);
    setError(null);
    setLoading(false);
    
    console.log('NostrContext: Logout completed');
  };

  // Get a user's profile
  const getUserProfile = async (npub: string): Promise<NDKUser> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    const user = ndk.getUser({ npub });
    await user.fetchProfile();
    return user;
  };

  // Get users that a user follows
  const getFollows = async (npub: string): Promise<NDKUser[]> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    const user = ndk.getUser({ npub });
    const follows = await user.follows();
    return Array.from(follows);
  };

  // Pay a Lightning invoice
  const payInvoice = async (invoice: string): Promise<any> => {
    if (!paymentClient) {
      throw new Error('Payment client not initialized');
    }
    
    if (!canMakePayments) {
      throw new Error('Payments not supported with current login method');
    }
    
    try {
      const response = await paymentClient.payInvoice(invoice);
      
      if (response.error) {
        throw new Error(`Payment failed: ${response.error.message}`);
      }
      
      return response.result;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  };

  // Provide the context value
  const contextValue: NostrContextType = {
    ndk,
    user,
    loading,
    error,
    loginMethod,
    viewOnlyProfile,
    availableProfiles: PREDEFINED_PROFILES,
    login,
    logout,
    getUserProfile,
    getFollows,
    shortenNpub,
    payInvoice: canMakePayments ? payInvoice : undefined,
    canMakePayments,
  };

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
};

// Hook to use the Nostr context
export const useNostr = () => {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}; 