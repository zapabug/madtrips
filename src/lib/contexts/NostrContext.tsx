'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import NDK, { NDKEvent, NDKNip07Signer, NDKUser, NDKRelaySet, NDKRelay } from '@nostr-dev-kit/ndk';
import { shortenNpub } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';
import { DEFAULT_RELAYS, RELAYS, getAllRelays, createRelay } from '../../constants/relays';

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

  // Create and configure an NDK instance using the relays from constants
  const createNDKInstance = useCallback((): NDK => {
    // Use the DEFAULT_RELAYS from the constants
    const initialRelays = DEFAULT_RELAYS;

    const instance = new NDK({
      explicitRelayUrls: initialRelays,
      enableOutboxModel: false,
      autoConnectUserRelays: false,
    });

    return instance;
  }, []);

  // Optimized relay connection strategy
  const connectToRelays = useCallback(async (instance: NDK): Promise<boolean> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    // Clear the connected relays list
    connectedRelays.current = [];

    try {
      console.log('Connecting to Nostr relays...');
      
      // First, explicitly disconnect from any existing relays to reset connections
      instance.pool.relays.forEach((relay) => {
        try {
          relay.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      });
      
      // Wait for disconnections to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Connect to all configured relays
      await instance.connect();
      
      // Wait a moment for connections to establish - increase this time for better connection chances
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get connection statuses
      const connected: string[] = [];
      
      // Check each relay's connection status
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
      
      // If no relays connected, try with backup relays
      if (connected.length === 0) {
        console.log('No primary relays connected, trying backup relays');
        
        // Try to connect to backup relays
        for (const url of RELAYS.BACKUP) {
          if (instance.pool.getRelay(url)) {
            // Relay exists but disconnected, try reconnecting
          try {
            const relay = instance.pool.getRelay(url);
            if (relay) {
              await relay.connect();
              }
            } catch (e) {
              console.warn(`Failed to reconnect to relay ${url}:`, e);
            }
            } else {
            // Create a new relay object and add it to the pool
            try {
              const relayObj = createRelay(url);
              await instance.pool.addRelay(relayObj);
            } catch (e) {
              console.warn(`Failed to add backup relay ${url}:`, e);
            }
          }
        }
        
        // Add community relays as well for better connectivity
        for (const url of RELAYS.COMMUNITY) {
          if (!instance.pool.getRelay(url)) {
            try {
              const relayObj = createRelay(url);
              await instance.pool.addRelay(relayObj);
          } catch (e) {
              // Ignore errors for community relays
            }
          }
        }
        
        // Wait a bit longer for these connections to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get updated connection status
        const backupConnected: string[] = [];
        instance.pool.relays.forEach((relay, url) => {
          if (relay.status === 1) {
            backupConnected.push(url);
          }
        });
            
        connectedRelays.current = backupConnected;
        
        if (backupConnected.length > 0) {
          console.log(`Connected to ${backupConnected.length} backup relays:`, backupConnected);
          return true;
        }
        
        // Last resort: try ALL available relays
        if (backupConnected.length === 0) {
          console.log('No backup relays connected, trying all available relays as last resort');
          
          const allRelays = getAllRelays();
          
          // Try to connect to any available relay
          for (const url of allRelays) {
            if (instance.pool.getRelay(url)) continue; // Skip if already in pool
            
            try {
                // Create a relay object and add it to the pool
                const relayObj = createRelay(url);
                await instance.pool.addRelay(relayObj);
            } catch (e) {
              // Don't log errors for last resort attempts
            }
          }
          
          // Final wait for connections
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const finalConnected: string[] = [];
          instance.pool.relays.forEach((relay, url) => {
            if (relay.status === 1) {
              finalConnected.push(url);
            }
          });
              
          connectedRelays.current = finalConnected;
          
          if (finalConnected.length > 0) {
            console.log(`Connected to ${finalConnected.length} relays (last resort):`, finalConnected);
            return true;
          }
        }
      }
      
      return connectedRelays.current.length > 0;
    } catch (error) {
      console.error('Error connecting to relays:', error);
      return connectedRelays.current.length > 0;
    }
  }, []);

  // Function to reconnect to relays - can be called by components when needed
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (!ndkInstance.current) {
      console.warn('NDK not initialized, cannot reconnect');
      // Try to create a new instance as a recovery mechanism
      try {
        const newInstance = createNDKInstance();
        ndkInstance.current = newInstance;
        setNdk(newInstance);
        const connected = await connectToRelays(newInstance);
        setNdkReady(connected);
        return connected;
      } catch (e) {
        console.error('Failed to create new NDK instance during reconnect:', e);
      return false;
      }
    }
    
    console.log('Attempting to reconnect to Nostr relays...');
    const instance = ndkInstance.current;
    
    try {
      // Close existing connections first
      instance.pool.relays.forEach(relay => {
        try {
          relay.disconnect();
        } catch (e) {
          // Ignore errors when closing
        }
      });
      
      // Wait a moment for connections to close
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connect again with extended timeout
      const connected = await Promise.race([
        connectToRelays(instance),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 10000))
      ]);
      
      setNdkReady(connected);
      return connected;
    } catch (error) {
      console.error('Reconnection failed:', error);
      return false;
    }
  }, [connectToRelays, createNDKInstance]);

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

        // Add connection event listeners for debugging
        instance.pool.on('relay:connect', (relay) => {
          console.log(`Connected to relay: ${relay.url}`);
        });
        
        instance.pool.on('relay:disconnect', (relay) => {
          console.log(`Disconnected from relay: ${relay.url}`);
        });
        
        // Using compatible event listener API 
        instance.pool.on('connect', () => {
          console.log('Pool connection established');
        });
        
        // Connect to relays with exponential backoff retry
        let connected = false;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        while (!connected && retryCount < MAX_RETRIES) {
          try {
            connected = await connectToRelays(instance);
            if (!connected) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
              console.log(`Relay connection failed, retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (err) {
            console.error('Connection attempt failed:', err);
            retryCount++;
          }
        }
        
        // Always set NDK instance and mark as ready, even if we couldn't connect to relays
        // This allows components to use the NDK instance and implement their own retry logic
        setNdk(instance);
        setNdkReady(true);
        
        if (connected) {
          console.log('Successfully connected to Nostr relays');
          
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
          // Still mark as ready to allow components to implement their own retry logic
          setNdkReady(true);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize NDK:', error);
        // Still set NDK as ready even if initialization had issues
        // Components can implement their own retry mechanisms
        setNdkReady(true);
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