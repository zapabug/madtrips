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
  getConnectedRelays: () => string[];
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
  getConnectedRelays: () => [],
};

// Create the context
const NostrContext = createContext<NostrContextType>(defaultContextValue);

// Custom hook for using the Nostr context
export const useNostr = () => useContext(NostrContext);

// Enhanced profile cache with structured storage and TTL management
class ProfileCache {
  private cache = new Map<string, { profile: UserProfile; timestamp: number }>();
  private readonly TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_SIZE = 100;

  get(key: string): UserProfile | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if item is expired
    if (Date.now() - item.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return item.profile;
  }
  
  set(key: string, profile: UserProfile): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.MAX_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 20% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.2));
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, { profile, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  prune(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Initialize profile cache
const profileCache = new ProfileCache();

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
  const lastReconnectAttempt = useRef<number>(0);
  const reconnectCooldown = 5000; // 5 seconds between reconnect attempts

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
      
      // Wait a moment for connections to establish
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
      return false;
    }
  }, []);

  // Get connected relays
  const getConnectedRelays = useCallback((): string[] => {
    return [...connectedRelays.current];
  }, []);

  // Reconnect to relays
  const reconnect = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    
    // Check if we're already connecting or if we're in a cooldown period
    if (isConnecting.current || (now - lastReconnectAttempt.current < reconnectCooldown)) {
      return ndkReady;
    }
    
    isConnecting.current = true;
    lastReconnectAttempt.current = now;
    
    try {
      let instance = ndkInstance.current;
      
      if (!instance) {
        instance = createNDKInstance();
        ndkInstance.current = instance;
      }
      
      const connected = await connectToRelays(instance);
      
      if (connected) {
        setNdk(instance);
        setNdkReady(true);
      } else {
        setNdkReady(false);
      }
      
      return connected;
    } catch (error) {
      console.error('Error during reconnect:', error);
      setNdkReady(false);
      return false;
    } finally {
      isConnecting.current = false;
    }
  }, [createNDKInstance, connectToRelays, ndkReady]);

  // Initialize NDK on component mount
  useEffect(() => {
    if (initialized) return;
    
    const initializeNDK = async () => {
      try {
        const instance = createNDKInstance();
        ndkInstance.current = instance;
        
        const connected = await connectToRelays(instance);
        
        if (connected) {
          setNdk(instance);
          setNdkReady(true);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing NDK:', error);
        setInitialized(true);
      }
    };
    
    initializeNDK();
    
    // Clean up on unmount
    return () => {
      if (ndkInstance.current) {
        try {
          ndkInstance.current.pool.relays.forEach(relay => {
            relay.disconnect();
          });
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, [initialized, createNDKInstance, connectToRelays]);

  // Fetch user profile
  const getUserProfile = useCallback(async (npub: string): Promise<UserProfile | null> => {
    if (!ndk) {
      return null;
    }
    
    try {
      // Check cache first
      const cachedProfile = profileCache.get(npub);
      if (cachedProfile) {
        return cachedProfile;
      }
      
      // Special handling for npubs
      let pubkey: string;
      if (npub.startsWith('npub')) {
        try {
          const decoded = nip19.decode(npub);
          pubkey = decoded.data as string;
        } catch (e) {
          console.error('Invalid npub:', npub, e);
          return null;
        }
      } else {
        pubkey = npub;
      }
      
      // Use NDK to fetch user profile
      const user = ndk.getUser({ pubkey });
      await user.fetchProfile();
      
      if (user.profile) {
        const profile: UserProfile = {
          name: user.profile.name,
          displayName: user.profile.displayName,
          website: user.profile.website,
          about: user.profile.about,
          picture: user.profile.image,
          banner: user.profile.banner,
          nip05: user.profile.nip05,
          lud16: user.profile.lud16,
          lud06: user.profile.lud06,
        };
        
        // Cache the profile
        profileCache.set(npub, profile);
        
        return profile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    
    return null;
  }, [ndk]);

  // Login
  const login = useCallback(async (): Promise<void> => {
    if (!ndk) {
      await reconnect();
      if (!ndk) return;
    }
    
    try {
      // Use NIP-07 signer
      const signer = new NDKNip07Signer();
      ndk.signer = signer;
      
      try {
        await signer.blockUntilReady();
        
        // Get user
        const user = await signer.user();
        if (!user) {
          throw new Error('Failed to get user from signer');
        }
        
        setUser(user);
        setIsLoggedIn(true);
        
        const npubKey = nip19.npubEncode(user.pubkey);
        
        // Fetch user profile
        const profile = await getUserProfile(npubKey);
        setUserProfile(profile);
      } catch (e) {
        // iOS Safari and other browsers might have issues with the signer
        console.error('Error with NIP-07 signer:', e);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [ndk, reconnect, getUserProfile]);

  // Logout
  const logout = useCallback((): void => {
    if (ndk) {
      ndk.signer = undefined;
    }
    
    setUser(null);
    setUserProfile(null);
    setIsLoggedIn(false);
  }, [ndk]);

  // Refetch user profile
  const refetchUserProfile = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      const npubKey = nip19.npubEncode(user.pubkey);
      // Force a refresh by not using the cache
      profileCache.clear();
      const profile = await getUserProfile(npubKey);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error refetching user profile:', error);
    }
  }, [user, getUserProfile]);

  // Derived values
  const npub = user ? nip19.npubEncode(user.pubkey) : null;
  const userName = userProfile?.displayName || userProfile?.name || null;
  const userProfilePicture = userProfile?.picture || null;

  // Run periodic tasks
  useEffect(() => {
    // Prune profile cache every 5 minutes
    const pruneInterval = setInterval(() => {
      profileCache.prune();
    }, 5 * 60 * 1000);
    
    // Monitor relay connections every 30 seconds
    const monitorInterval = setInterval(() => {
      if (ndk) {
        const connected: string[] = [];
        ndk.pool.relays.forEach((relay, url) => {
          if (relay.status === 1) {
            connected.push(url);
          }
        });
        
        connectedRelays.current = connected;
        
        // If we have no connected relays, try to reconnect
        if (connected.length === 0 && !isConnecting.current) {
          reconnect();
        }
      }
    }, 30 * 1000);
    
    return () => {
      clearInterval(pruneInterval);
      clearInterval(monitorInterval);
    };
  }, [ndk, reconnect]);

  const contextValue: NostrContextType = {
    ndk,
    user,
    isLoggedIn,
    login,
    logout,
    getUserProfile,
    shortenNpub,
    refetchUserProfile,
    npub,
    userName,
    userProfilePicture,
    ndkReady,
    reconnect,
    getConnectedRelays,
  };

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
}; 