'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import NDK, { NDKEvent, NDKNip07Signer, NDKUser, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { shortenNpub } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';

// Define the relays to use, prioritized by reliability
const PRIMARY_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nostr-pub.wellorder.net',
];

const FALLBACK_RELAYS = [
  'wss://relay.nostr.band',
  'wss://nostr.mutinywallet.com',
  'wss://relay.snort.social',
  'wss://purplepag.es',
];

/**
 * Interface for the user profile data
 */
export interface UserProfile {
  name?: string;
  displayName?: string;
  website?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string; // Lightning address
  lud06?: string; // LNURL
}

/**
 * Interface for the Nostr context
 */
export interface NostrContextType {
  ndk: NDK | null;
  user: NDKUser | null;
  isLoggedIn: boolean;
  login: () => Promise<void>;
  logout: () => void;
  getUserProfile: (npub: string) => Promise<UserProfile | null>;
  shortenNpub: (npub: string) => string;
  refetchUserProfile: () => Promise<void>;
  npub: string | null;
  userName: string | null;
  userProfilePicture: string | null;
  ndkReady: boolean;
  reconnect: () => Promise<boolean>;
}

// Default context value
const defaultContextValue: NostrContextType = {
  ndk: null,
  user: null,
  isLoggedIn: false,
  login: async () => {},
  logout: () => {},
  getUserProfile: async () => null,
  shortenNpub: (npub: string) => npub,
  refetchUserProfile: async () => {},
  npub: null,
  userName: null,
  userProfilePicture: null,
  ndkReady: false,
  reconnect: async () => false,
};

// Create the context
const NostrContext = createContext<NostrContextType>(defaultContextValue);

// Custom hook for using the Nostr context
export const useNostr = () => useContext(NostrContext);

// Cache for user profiles to avoid repeated fetches
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Debounce helper function
const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    clearTimeout(timeout);
    return new Promise(resolve => {
      timeout = setTimeout(() => resolve(func(...args)), wait);
    });
  };
};

/**
 * NostrProvider component
 */
export const NostrProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ndkReady, setNdkReady] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  const isConnecting = useRef<boolean>(false);
  const ndkInstance = useRef<NDK | null>(null);
  const connectedRelays = useRef<string[]>([]);

  // Create and configure an NDK instance
  const createNDKInstance = useCallback((): NDK => {
    // Start with primary relays first
    const allRelays = [...PRIMARY_RELAYS, ...FALLBACK_RELAYS];

    const instance = new NDK({
      explicitRelayUrls: allRelays,
      enableOutboxModel: false, // Disable outbox to reduce complexity
    });

    // Configure relay connection options - removed invalid properties

    return instance;
  }, []);

  // Optimized relay connection strategy that records successful relays
  const connectToRelays = useCallback(async (instance: NDK): Promise<boolean> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 500;
    
    // Clear the connected relays list
    connectedRelays.current = [];

    try {
      // Connect to all configured relays
      await instance.connect();
      
      // Wait a moment for connections to establish
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get connection statuses - fix for Map structure
      const connected: string[] = [];
      instance.pool.relays.forEach((relay, url) => {
        if (relay.status === 1) { // 1 = connected
          connected.push(url);
        }
      });
      
      connectedRelays.current = connected;
      
      if (connected.length > 0) {
        console.log(`Connected to ${connected.length} Nostr relays:`, connected);
        return true;
      }
      
      // If no primary relays connected, try fallbacks explicitly
      if (connected.length === 0) {
        let anyConnected = false;
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          console.log(`Retry attempt ${attempt + 1} for relays`);
          
          // Attempt connect to all relays again
          await instance.connect();
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
          
          // Check connections after retry - fix for Map structure
          const retryConnected: string[] = [];
          instance.pool.relays.forEach((relay, url) => {
            if (relay.status === 1) {
              retryConnected.push(url);
            }
          });
            
          connectedRelays.current = retryConnected;
          
          if (retryConnected.length > 0) {
            console.log(`Connected to ${retryConnected.length} relays on retry`);
            anyConnected = true;
            break;
          }
        }
        
        return anyConnected;
      }
      
      return connected.length > 0;
    } catch (error) {
      console.error('Error connecting to relays:', error);
      return connectedRelays.current.length > 0;
    }
  }, []);

  // Function to reconnect to relays - can be called by components when needed
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (!ndkInstance.current) {
      console.warn('NDK not initialized, cannot reconnect');
      return false;
    }
    
    console.log('Attempting to reconnect to Nostr relays...');
    const instance = ndkInstance.current;
    
    try {
      // Close existing connections first - fix for Map structure
      instance.pool.relays.forEach(relay => {
        try {
          relay.disconnect();
        } catch (e) {
          // Ignore errors when closing
        }
      });
      
      // Wait a moment for connections to close
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Connect again
      const connected = await connectToRelays(instance);
      setNdkReady(connected);
      return connected;
    } catch (error) {
      console.error('Reconnection failed:', error);
      return false;
    }
  }, [connectToRelays]);

  // Initialize NDK instance
  useEffect(() => {
    // Prevent multiple initializations
    if (initialized || isConnecting.current) return;
    
    const initializeNdk = async () => {
      isConnecting.current = true;
      
      try {
        // Create a new NDK instance
        const instance = createNDKInstance();
        ndkInstance.current = instance;

        // Connect to relays
        const connected = await connectToRelays(instance);
        
        if (connected) {
          setNdk(instance);
          setNdkReady(true);

          // Check if user was previously logged in
          const savedNpub = localStorage.getItem('nostr_npub');
          if (savedNpub) {
            try {
              // Create user from npub
              const { data } = nip19.decode(savedNpub);
              const ndkUser = new NDKUser({ pubkey: data as string });
              ndkUser.ndk = instance;
              
              setUser(ndkUser);
              setIsLoggedIn(true);
              
              // Fetch user profile
              const profile = await fetchUserProfile(instance, ndkUser);
              if (profile) {
                setUserProfile(profile);
              }
              
              console.log('Restored Nostr user from local storage');
            } catch (error) {
              console.error('Failed to restore Nostr user:', error);
              localStorage.removeItem('nostr_npub');
            }
          }
        } else {
          // If we couldn't connect, still set initialized to prevent infinite retries
          console.warn('Could not connect to any relays, using NDK in offline mode');
          setNdkReady(false);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize NDK:', error);
        setNdkReady(false);
        setInitialized(true); // Mark as initialized even on error to prevent retries
      } finally {
        isConnecting.current = false;
      }
    };

    initializeNdk();

    // Cleanup function to disconnect from relays
    return () => {
      const instance = ndkInstance.current;
      if (instance) {
        console.log('Disconnecting from Nostr relays');
        try {
          instance.pool.relays.forEach(relay => {
            try {
              relay.disconnect();
            } catch (e) {
              // Ignore errors when closing
            }
          });
        } catch (e) {
          // Ignore cleanup errors
        }
        setNdkReady(false);
        ndkInstance.current = null;
      }
    };
  }, [initialized, connectToRelays, createNDKInstance]);

  /**
   * Fetch user profile from NDK with error handling and caching
   */
  const fetchUserProfile = async (ndkInstance: NDK, user: NDKUser): Promise<UserProfile | null> => {
    if (!ndkInstance || !user) return null;

    try {
      // Check cache first
      const npub = nip19.npubEncode(user.pubkey);
      const cachedData = profileCache.get(npub);
      
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        return cachedData.profile;
      }

      // Fetch profile with timeout
      let profileData;
      try {
        const fetchPromise = user.fetchProfile();
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
        );
        
        profileData = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (error) {
        console.warn('Profile fetch timeout or error:', error);
        // Return cache even if expired rather than null on timeout
        if (cachedData) {
          console.log('Using expired cache for', npub);
          return cachedData.profile;
        }
        return null;
      }
      
      // Convert to our UserProfile format
      const profile: UserProfile = {
        name: profileData?.name,
        displayName: profileData?.displayName,
        website: profileData?.website,
        about: profileData?.about,
        picture: profileData?.picture,
        banner: profileData?.banner,
        nip05: profileData?.nip05,
        lud16: profileData?.lud16,
        lud06: profileData?.lud06,
      };

      // Cache the result
      profileCache.set(npub, { profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Debounced version of getUserProfile to prevent excessive profile fetches
  const debouncedGetUserProfile = useCallback(
    debounce(async (npub: string): Promise<UserProfile | null> => {
      if (!ndk || !npub) return null;

      try {
        // Check cache first
        const cachedData = profileCache.get(npub);
        
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
          return cachedData.profile;
        }

        // Create user from npub
        const { type, data } = nip19.decode(npub);
        if (type !== 'npub') {
          throw new Error('Invalid npub format');
        }
        
        const targetUser = new NDKUser({ pubkey: data as string });
        targetUser.ndk = ndk;
        
        // Fetch profile with timeout
        let profileData;
        try {
          const fetchPromise = targetUser.fetchProfile();
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          profileData = await Promise.race([fetchPromise, timeoutPromise]);
        } catch (error) {
          console.warn(`Profile fetch timeout for ${npub}:`, error);
          // Return cache even if expired rather than null on timeout
          if (cachedData) {
            return cachedData.profile;
          }
          return null;
        }
        
        if (!profileData) return null;
        
        // Convert to our UserProfile format
        const profile: UserProfile = {
          name: profileData?.name,
          displayName: profileData?.displayName,
          website: profileData?.website,
          about: profileData?.about,
          picture: profileData?.picture,
          banner: profileData?.banner,
          nip05: profileData?.nip05,
          lud16: profileData?.lud16,
          lud06: profileData?.lud06,
        };

        // Cache the result
        profileCache.set(npub, { profile, timestamp: Date.now() });
        
        return profile;
      } catch (error) {
        console.error(`Error fetching profile for ${npub}:`, error);
        return null;
      }
    }, 100), // 100ms debounce
    [ndk]
  );

  /**
   * Get profile for any Nostr user by npub
   */
  const getUserProfile = useCallback(async (npub: string): Promise<UserProfile | null> => {
    return debouncedGetUserProfile(npub);
  }, [debouncedGetUserProfile]);

  /**
   * Login with Nostr extension
   */
  const login = useCallback(async () => {
    if (!ndk) {
      console.error('NDK not initialized');
      return;
    }

    try {
      // Create a new NIP-07 signer
      const signer = new NDKNip07Signer();
      
      // Set the signer on our NDK instance
      ndk.signer = signer;
      
      // Get the user's public key
      const user = await signer.user();
      
      if (!user) {
        throw new Error('Failed to get user from signer');
      }
      
      // Save the user
      setUser(user);
      setIsLoggedIn(true);
      
      // Save npub to local storage for persistence
      const npub = nip19.npubEncode(user.pubkey);
      localStorage.setItem('nostr_npub', npub);
      
      // Fetch user profile
      const profile = await fetchUserProfile(ndk, user);
      if (profile) {
        setUserProfile(profile);
      }
      
      console.log('Logged in to Nostr as:', npub);
    } catch (error) {
      console.error('Nostr login failed:', error);
      throw error;
    }
  }, [ndk, fetchUserProfile]);

  /**
   * Logout from Nostr
   */
  const logout = useCallback(() => {
    setUser(null);
    setIsLoggedIn(false);
    setUserProfile(null);
    localStorage.removeItem('nostr_npub');
    
    // Create a new NDK instance without signer
    if (ndk) {
      ndk.signer = undefined;
    }
    
    console.log('Logged out from Nostr');
  }, [ndk]);

  /**
   * Refetch the user's profile
   */
  const refetchUserProfile = useCallback(async () => {
    if (!ndk || !user) return;
    
    try {
      // Remove from cache
      const npub = nip19.npubEncode(user.pubkey);
      profileCache.delete(npub);
      
      // Fetch fresh profile
      const profile = await fetchUserProfile(ndk, user);
      if (profile) {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to refetch user profile:', error);
    }
  }, [ndk, user, fetchUserProfile]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    ndk,
    user,
    isLoggedIn,
    login,
    logout,
    getUserProfile,
    shortenNpub,
    refetchUserProfile,
    npub: user ? nip19.npubEncode(user.pubkey) : null,
    userName: userProfile?.displayName || userProfile?.name || null,
    userProfilePicture: userProfile?.picture || null,
    ndkReady,
    reconnect,
  }), [
    ndk, 
    user, 
    isLoggedIn, 
    login, 
    logout, 
    getUserProfile, 
    refetchUserProfile, 
    userProfile, 
    ndkReady,
    reconnect
  ]);

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
}; 