'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import NDK, { NDKEvent, NDKNip07Signer, NDKUser, NDKRelaySet, NDKFilter, NDKRelay, NDKRelayStatus, NDKSubscription, NDKKind } from '@nostr-dev-kit/ndk';
import { shortenNpub } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';
import { DEFAULT_RELAYS } from '../../constants/relays';
// Import the RelayService
import RelayService from '../services/RelayService';
// Import CacheService for centralized caching
import CacheService from '../services/CacheService';
import useCache from '../../hooks/useCache';

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
  login: (npub: string) => Promise<boolean>;
  logout: () => void;
  getUserProfile: (pubkeyOrNpub: string) => Promise<UserProfile | null>;
  shortenNpub: (npub: string) => string;
  refetchUserProfile: () => Promise<void>;
  npub: string | null;
  userName: string | null;
  userProfilePicture: string | null;
  ndkReady: boolean;
  reconnect: () => Promise<boolean>;
  getConnectedRelays: () => NDKRelay[];
  publishEvent: (kind: number, content: string, tags?: string[][]) => Promise<NDKEvent | null>;
  subscribeToEvents: (filter: NDKFilter, onEvent: (event: NDKEvent) => void) => Promise<NDKSubscription | null>;
  relayCount: number;
  relayStatus: { connected: number; total: number };
}

// Default context value
const defaultContextValue: NostrContextType = {
  ndk: null,
  user: null,
  isLoggedIn: false,
  login: async () => false,
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
  publishEvent: async () => null,
  subscribeToEvents: async () => null,
  relayCount: 0,
  relayStatus: { connected: 0, total: 0 }
};

// Create the context
const NostrContext = createContext<NostrContextType>(defaultContextValue);

// Custom hook for using the Nostr context
export const useNostr = () => useContext(NostrContext);

/**
 * NostrProvider component
 */
export const NostrProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ndkReady, setNdkReady] = useState<boolean>(false);
  const [relayCount, setRelayCount] = useState(0);
  const [relayStatus, setRelayStatus] = useState({ connected: 0, total: 0 });
  
  const ndkInitialized = useRef(false);
  const cache = useCache();
  
  // Enhanced relay status tracking function
  const trackRelayStatus = useCallback((ndkInstance: NDK) => {
    if (!ndkInstance || !ndkInstance.pool) return;
    
    // Update connection status
    const updateStatus = () => {
      const relays = ndkInstance.pool.relays;
      const relayArray = Array.from(relays.values()) as NDKRelay[];
      const connected = relayArray.filter(
        (relay: any) => relay && relay.status === NDKRelayStatus.CONNECTED
      ).length;
      
      setRelayCount(connected);
      setRelayStatus({
        connected,
        total: relays.size
      });
      
      // Update NDK ready state based on connection status
      setNdkReady(connected > 0);
    };
    
    // Set up event listeners for relay connection events
    ndkInstance.pool.on('relay:connect', updateStatus);
    ndkInstance.pool.on('relay:disconnect', updateStatus);
    
    // @ts-ignore - NDK types don't include the 'relay:error' event
    ndkInstance.pool.on('relay:error', (relayObj: { url: string }, error: Error) => {
      console.error(`Relay error on ${relayObj.url}:`, error);
      updateStatus();
    });
    
    // Do initial update
    updateStatus();
    
    // Return cleanup function
    return () => {
      ndkInstance.pool.removeListener('relay:connect', updateStatus);
      ndkInstance.pool.removeListener('relay:disconnect', updateStatus);
    };
  }, []);
  
  // Initialize NDK using RelayService
  useEffect(() => {
    if (ndkInitialized.current) return;
    ndkInitialized.current = true;
    
    const initNDK = async () => {
      try {
        // Use RelayService singleton to initialize NDK
        // This will handle connection retries and relay management
        const ndkInstance = await RelayService.initialize();
        
        // Set up relay tracking
        const cleanupTracker = trackRelayStatus(ndkInstance);
        
        // Update context state
        setNdk(ndkInstance);
        
        // Try to restore user from localStorage
        const savedUserNpub = localStorage.getItem('nostr-user-npub');
        if (savedUserNpub) {
          try {
            const userObj = ndkInstance.getUser({ npub: savedUserNpub });
            setUser(userObj);
            setIsLoggedIn(true);
            
            // Fetch user profile
            getUserProfile(userObj.pubkey);
          } catch (e) {
            console.error('Error restoring user session:', e);
            localStorage.removeItem('nostr-user-npub');
          }
        }
        
        return () => {
          if (cleanupTracker) cleanupTracker();
        };
      } catch (error) {
        console.error('Failed to initialize NDK:', error);
        setNdkReady(false);
      }
    };
    
    initNDK();
  }, [trackRelayStatus]);
  
  // Login with npub
  const login = async (npub: string): Promise<boolean> => {
    if (!ndk) return false;
    
    try {
      const userObj = ndk.getUser({ npub });
      setUser(userObj);
      setIsLoggedIn(true);
      localStorage.setItem('nostr-user-npub', npub);
      
      // Fetch user profile
      await getUserProfile(userObj.pubkey);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };
  
  // Logout
  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('nostr-user-npub');
  };
  
  // Publish event
  const publishEvent = async (kind: number, content: string, tags: string[][] = []): Promise<NDKEvent | null> => {
    if (!ndk || !isLoggedIn || !user) return null;
    
    try {
      const event = new NDKEvent(ndk);
      event.kind = kind;
      event.content = content;
      event.tags = tags;
      
      // If not connected, try to reconnect first
      if (relayStatus.connected === 0) {
        // Use RelayService singleton for reconnection
        await RelayService.reconnect();
        
        // If still not connected, fail
        if (relayStatus.connected === 0) {
          throw new Error('No connected relays available to publish event');
        }
      }
      
      // Use the NDK directly to sign and publish instead of event methods
      await ndk.publish(event);
      
      return event;
    } catch (error) {
      console.error('Error publishing event:', error);
      return null;
    }
  };
  
  // Subscribe to events with improved reliability
  const subscribeToEvents = async (filter: NDKFilter, onEvent: (event: NDKEvent) => void): Promise<NDKSubscription | null> => {
    if (!ndk) return null;
    
    // If no connected relays, try to reconnect first
    if (relayStatus.connected === 0) {
      // Use RelayService singleton for reconnection
      await RelayService.reconnect();
      
      // If still no connected relays, fail gracefully
      if (relayStatus.connected === 0) {
        console.error('No connected relays, cannot subscribe');
        return null;
      }
    }
    
    try {
      // Validate filter to avoid "No filters to merge" error
      if (!validateFilter(filter)) {
        // Use a safe default filter if none provided
        filter = { kinds: [1], limit: 20 };
      }
      
      // Use closeOnEose: false for persistent subscriptions
      const subscription = ndk.subscribe(filter, { closeOnEose: false });
      
      // Set up event handler
      subscription.on('event', onEvent);
      
      return subscription;
    } catch (error) {
      console.error('Error subscribing to events:', error);
      return null;
    }
  };
  
  // Helper function to validate filters to avoid "No filters to merge" error
  const validateFilter = (filter: NDKFilter): boolean => {
    if (!filter) return false;
    
    // Check if filter is empty
    if (Object.keys(filter).length === 0) return false;
    
    // Check if filter has valid properties
    return Object.entries(filter).some(([key, value]) => {
      // Check if the property has a valid value
      if (Array.isArray(value) && value.length === 0) return false;
      if (value === null || value === undefined) return false;
      return true;
    });
  };
  
  // Convert npub to hex pubkey
  const npubToPubkey = (npub: string): string => {
    try {
      const { data } = nip19.decode(npub);
      return data as string;
    } catch (error) {
      console.error('Error decoding npub:', error);
      return '';
    }
  };
  
  // Get user profile with caching
  const getUserProfile = async (pubkeyOrNpub: string): Promise<UserProfile | null> => {
    if (!ndk) return null;
    
    let pubkey = pubkeyOrNpub;
    
    // Convert npub to pubkey if needed
    if (pubkeyOrNpub.startsWith('npub')) {
      pubkey = npubToPubkey(pubkeyOrNpub);
      if (!pubkey) return null;
    }
    
    // Check persistent cache
    const cachedProfile = cache.getCachedProfile(pubkey);
    if (cachedProfile) {
      return cachedProfile;
    }
    
    // Fetch from network
    try {
      // Check if we have connected relays before trying to fetch
      if (relayStatus.connected === 0) {
        // Use RelayService singleton for reconnection
        await RelayService.reconnect();
        
        // If still no connected relays after reconnect, fail gracefully
        if (relayStatus.connected === 0) {
          return cachedProfile || null;
        }
      }
      
      const user = ndk.getUser({ pubkey });
      await user.fetchProfile();
      
      if (user.profile) {
        const profile: UserProfile = {
          name: user.profile.name || '',
          displayName: user.profile.displayName || user.profile.name || '',
          picture: user.profile.image || '',
          about: user.profile.about || '',
          nip05: user.profile.nip05 || '',
          website: user.profile.website || '',
          banner: user.profile.banner || '',
          lud06: user.profile.lud06 || '',
          lud16: user.profile.lud16 || ''
        };
        
        // Update cache
        cache.setCachedProfile(pubkey, profile);
        
        return profile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    
    return null;
  };
  
  // Get connected relays
  const getConnectedRelays = useCallback((): NDKRelay[] => {
    if (!ndk || !ndk.pool) return [];
    
    const relays = ndk.pool.relays;
    const relayArray = Array.from(relays.values()) as NDKRelay[];
    return relayArray.filter((relay: NDKRelay) => relay.status === NDKRelayStatus.CONNECTED);
  }, [ndk]);
  
  // Reconnect to relays using RelayService
  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      // Use RelayService singleton for reconnection
      return await RelayService.reconnect();
    } catch (error) {
      console.error('Error reconnecting:', error);
      return false;
    }
  }, []);

  // Refetch user profile
  const refetchUserProfile = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      const npubKey = nip19.npubEncode(user.pubkey);
      // Just fetch a fresh profile without using the cache
      const profile = await getUserProfile(npubKey);
      setUserProfile(profile);
      
      // Update cache with the fresh profile if found
      if (profile) {
        cache.setCachedProfile(user.pubkey, profile);
      }
    } catch (error) {
      console.error('Error refetching user profile:', error);
    }
  }, [user, getUserProfile]);

  // Derived values
  const npub = user ? nip19.npubEncode(user.pubkey) : null;
  const userName = userProfile?.displayName || userProfile?.name || null;
  const userProfilePicture = userProfile?.picture || null;

  const contextValue: NostrContextType = useMemo(() => ({
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
    publishEvent,
    subscribeToEvents,
    relayCount,
    relayStatus
  }), [ndk, user, isLoggedIn, login, logout, getUserProfile, shortenNpub, refetchUserProfile, npub, userName, userProfilePicture, ndkReady, reconnect, getConnectedRelays, publishEvent, subscribeToEvents, relayCount, relayStatus]);

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
}; 