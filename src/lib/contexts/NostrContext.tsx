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
  getUserProfile: (npub: string) => Promise<NDKUser | null>;
  getFollows: (npub: string) => Promise<string[]>;
  shortenNpub: (npub: string) => string;
  payInvoice?: (invoice: string) => Promise<any>;
  canMakePayments: boolean;
  getSocialGraph: (npubs: string[], maxConnections?: number) => Promise<{nodes: any[], links: any[]}>;
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
  const getUserProfile = async (npub: string): Promise<NDKUser | null> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    const user = ndk.getUser({ npub });
    await user.fetchProfile();
    return user;
  };

  // Get users that a user follows
  const getFollows = async (npub: string): Promise<string[]> => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    const user = ndk.getUser({ npub });
    const follows = await user.follows();
    return Array.from(follows).map(follow => follow.npub);
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

  // Generate social graph data for the provided NPUBs
  const getSocialGraph = async (npubs: string[], maxConnections: number = 25) => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }
    
    // Check relay connections
    try {
      // Try to connect if not already connected
      await ndk.connect();
      
      // Log connected relays (if any)
      if (ndk.pool?.relays) {
        const relayCount = Object.keys(ndk.pool.relays).length;
        console.log(`Connected to ${relayCount} relays`);
        if (relayCount === 0) {
          console.warn('No relays connected. Results may be limited.');
        }
      } else {
        console.warn('No relay pool available');
      }
    } catch (error) {
      console.error('Relay connection error:', error);
      // Continue anyway, but log the error
    }
    
    console.log(`Fetching social graph for ${npubs.length} NPUBs with max ${maxConnections} connections`);
    
    // Real implementation using actual Nostr data
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeMap = new Map<string, boolean>();
    
    // Create a timeout promise
    const timeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    );
    
    // Add the core NPUBs as nodes
    for (const npub of npubs) {
      if (nodeMap.has(npub)) continue;
      
      try {
        // Get the actual user profile from Nostr with timeout
        const user = ndk.getUser({ npub });
        
        // Set timeout for profile fetching to avoid hanging
        const profilePromise = user.fetchProfile();
        await Promise.race([
          profilePromise,
          timeout(10000) // 10 second timeout
        ]);
        
        console.log(`Fetched profile for ${npub}: ${user.profile?.name || 'unnamed'}`);
        
        nodes.push({
          id: npub,
          npub,
          name: user.profile?.displayName || user.profile?.name || shortenNpub(npub),
          type: 'profile',
          picture: user.profile?.picture || '',
          isCoreNode: true,
          val: 10,
          group: 1
        });
        
        nodeMap.set(npub, true);
      } catch (e) {
        console.error(`Failed to fetch profile for ${npub}`, e);
        // Still add the node even if profile fetch fails
        nodes.push({
          id: npub,
          npub,
          name: shortenNpub(npub),
          type: 'profile',
          isCoreNode: true,
          val: 10,
          group: 1
        });
        
        nodeMap.set(npub, true);
      }
    }
    
    // Fetch real follows for each core NPUB
    for (const npub of npubs) {
      try {
        // Get the actual follows from Nostr with timeout
        const user = ndk.getUser({ npub });
        
        // Set timeout for follows fetching to avoid hanging
        const followsPromise = user.follows();
        const follows = await Promise.race([
          followsPromise,
          timeout(15000) // 15 second timeout
        ]) as Set<NDKUser>;
        
        console.log(`Fetched ${follows.size} follows for ${npub}`);
        
        // Limit to maxConnections if needed
        const followsList = Array.from(follows).slice(0, maxConnections);
        
        // Process each follow
        for (const followedUser of followsList) {
          if (!followedUser || typeof followedUser !== 'object') {
            console.warn('Invalid followed user:', followedUser);
            continue;
          }
          
          const followedNpub = (followedUser as NDKUser).npub;
          if (!followedNpub) {
            console.warn('User missing npub:', followedUser);
            continue;
          }
          
          // Skip if already processed
          if (nodeMap.has(followedNpub)) {
            // Still add connection if not already added
            links.push({
              source: npub,
              target: followedNpub,
              type: 'follows',
              value: 1
            });
            continue;
          }
          
          // Try to get profile information for the followed user
          try {
            // Set timeout for profile fetching
            const profilePromise = (followedUser as NDKUser).fetchProfile();
            await Promise.race([
              profilePromise,
              timeout(5000) // 5 second timeout for follows' profiles
            ]);
            
            nodes.push({
              id: followedNpub,
              npub: followedNpub,
              name: (followedUser as NDKUser).profile?.displayName || (followedUser as NDKUser).profile?.name || shortenNpub(followedNpub),
              type: 'connection',
              picture: (followedUser as NDKUser).profile?.picture || '',
              isCoreNode: false,
              val: 3,
              group: 2
            });
          } catch (e) {
            console.warn(`Failed to fetch profile for follow ${followedNpub}`, e);
            nodes.push({
              id: followedNpub,
              npub: followedNpub,
              name: shortenNpub(followedNpub),
              type: 'connection',
              isCoreNode: false,
              val: 3,
              group: 2
            });
          }
          
          nodeMap.set(followedNpub, true);
          
          // Add connection
          links.push({
            source: npub,
            target: followedNpub,
            type: 'follows',
            value: 1
          });
        }
        
        // Check for mutual follows between core NPUBs (real connections)
        const followedPubkeys = new Set(followsList.map(f => (f as NDKUser).npub));
        
        // For each other core NPUB, check if this NPUB follows it
        for (const otherNpub of npubs) {
          if (otherNpub !== npub && followedPubkeys.has(otherNpub)) {
            links.push({
              source: npub,
              target: otherNpub,
              type: 'mutual',
              value: 2
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch follows for ${npub}`, e);
      }
    }
    
    console.log(`Completed social graph with ${nodes.length} nodes and ${links.length} links`);
    
    return { nodes, links };
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
    getSocialGraph,
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