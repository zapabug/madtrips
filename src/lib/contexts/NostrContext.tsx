'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import NDK, { NDKEvent, NDKNip07Signer, NDKUser, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { shortenNpub } from '../../utils/profileUtils';
import { nip19 } from 'nostr-tools';
import { DEFAULT_RELAYS } from '../../constants/relays';
// Import the RelayService
import RelayService from '../services/RelayService';
// Import CacheService for centralized caching
import CacheService from '../services/CacheService';

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
  loginMethod: string | null;
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
  loginMethod: null,
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
  const [initialized, setInitialized] = useState<boolean>(false);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  
  // Refs for tracking async operations
  const loginInProgress = useRef<boolean>(false);
  const profileSubscriptions = useRef<Map<string, () => void>>(new Map());
  
  // Login method using NIP-07 signer
  const login = useCallback(async (): Promise<void> => {
    if (loginInProgress.current) {
      console.log("Login already in progress");
      return;
    }
    
    loginInProgress.current = true;
    
    try {
      // Use the centralized initialization method
      const ndkInstance = await RelayService.initializeOnce();
      
      // Create a new signer
      const signer = new NDKNip07Signer();
      ndkInstance.signer = signer;
      
      // Attempt to get user
      try {
        const user = await signer.user();
        if (user) {
          setUser(user);
          setIsLoggedIn(true);
          
          try {
            const npubKey = nip19.npubEncode(user.pubkey);
            const profile = await getUserProfile(npubKey);
            setUserProfile(profile);
          } catch (error) {
            console.error('Error getting user profile:', error);
          }
          
          setLoginMethod('NIP-07');
        }
      } catch (error) {
        console.error('Error getting user from signer:', error);
        throw error;
      }
      
      setNdk(ndkInstance);
      setNdkReady(true);
    } catch (error) {
      console.error('Error logging in with NIP-07:', error);
      throw error;
    } finally {
      loginInProgress.current = false;
    }
  }, []);
  
  // Logout method
  const logout = useCallback((): void => {
    setUser(null);
    setIsLoggedIn(false);
    setUserProfile(null);
    setLoginMethod(null);
    // We don't reset NDK here as we still want to use it for non-authenticated operations
  }, []);
  
  // Get user profile with minimal relay usage
  const getUserProfile = useCallback(async (npub: string): Promise<UserProfile | null> => {
    try {
      // Check cache first
      const cachedProfile = CacheService.profileCache.get(npub);
      if (cachedProfile) {
        return cachedProfile;
      }
      
      const ndkInstance = RelayService.getNDK();
      if (!ndkInstance) {
        throw new Error('NDK not initialized');
      }
      
      // Convert npub to hex pubkey
      let pubkey: string;
      try {
        if (npub.startsWith('npub1')) {
          const result = nip19.decode(npub);
          pubkey = result.data as string;
        } else {
          pubkey = npub;
        }
      } catch (error) {
        console.error('Error decoding npub:', error);
        return null;
      }
      
      // Create NDK user and fetch profile with timeout
      const ndkUser = new NDKUser({ pubkey });
      
      return new Promise<UserProfile | null>((resolve) => {
        let hasResolved = false;
        let timeout: NodeJS.Timeout;
        
        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          hasResolved = true;
        };
        
        // Set timeout
        timeout = setTimeout(() => {
          if (!hasResolved) {
            cleanup();
            resolve(null);
          }
        }, 3000);
        
        // Fetch profile with optimized relay handling
        let sub: any = null;
        
        const fetchProfile = async () => {
          try {
            // Ensure we have a connection
            await ndkInstance.connect();
            
            // Create subscription and properly track it
            sub = ndkInstance.subscribe(
              {
                kinds: [0], // Metadata event
                authors: [pubkey],
                limit: 1
              },
              {
                closeOnEose: true,
                groupable: false
              }
            );
            
            // Add to subscription tracker
            const subscriptionId = `profile:${npub}`;
            const unsubscribe = () => {
              if (sub) {
                try {
                  sub.stop();
                  sub = null;
                } catch (e) {
                  console.error('Error stopping subscription:', e);
                }
              }
            };
            
            // Store the unsubscribe function for later cleanup
            profileSubscriptions.current.set(subscriptionId, unsubscribe);
            
            sub.on('event', (event: NDKEvent) => {
              if (hasResolved) return;
              cleanup();
              
              try {
                const content = JSON.parse(event.content);
                const profile = {
                  name: content.name || 'Unknown',
                  displayName: content.display_name || content.name || 'Unknown',
                  picture: content.picture || undefined,
                  banner: content.banner || undefined,
                  website: content.website || undefined,
                  about: content.about || undefined,
                  nip05: content.nip05 || undefined,
                  lud16: content.lud16 || undefined,
                  lud06: content.lud06 || undefined
                };
                
                // Cache the profile
                CacheService.profileCache.set(npub, profile);
                
                // Unsubscribe since we got the data
                unsubscribe();
                profileSubscriptions.current.delete(subscriptionId);
                
                resolve(profile);
              } catch (e) {
                console.error('Error parsing profile:', e);
                resolve(null);
              }
            });
            
            sub.on('eose', () => {
              if (!hasResolved) {
                cleanup();
                
                // Unsubscribe since we're done
                unsubscribe();
                profileSubscriptions.current.delete(subscriptionId);
                
                resolve(null);
              }
            });
          } catch (e) {
            console.error('Error fetching profile:', e);
            cleanup();
            resolve(null);
          }
        };
        
        fetchProfile();
      });
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, []);
  
  // Get connected relays (delegated to RelayService)
  const getConnectedRelays = useCallback((): string[] => {
    return RelayService.getConnectedRelays();
  }, []);
  
  // Reconnect to relays (delegated to RelayService)
  const reconnect = useCallback(async (): Promise<boolean> => {
    return await RelayService.reconnect();
  }, []);
  
  // Initialize NDK on component mount
  useEffect(() => {
    if (initialized) return;
    
    const initializeNDK = async () => {
      try {
        // Clean up any existing state
        RelayService.cleanup();
        
        // Initialize with minimal configuration
        const ndkInstance = await RelayService.initialize();
        if (!ndkInstance) {
          throw new Error('Failed to initialize NDK');
        }
        
        setNdk(ndkInstance);
        setNdkReady(false); // Start with NDK not ready
        
        // Listen for relay status updates
        const unsubscribe = RelayService.onStatusUpdate((relays) => {
          setNdkReady(relays.length > 0);
        });
        
        setInitialized(true);
        
        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing NDK:', error);
        setInitialized(true);
        setNdkReady(false);
      }
    };
    
    initializeNDK();
  }, [initialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all profile subscriptions
      profileSubscriptions.current.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (e) {
          console.error('Error unsubscribing from profile:', e);
        }
      });
      profileSubscriptions.current.clear();
    };
  }, []);

  // Refetch user profile
  const refetchUserProfile = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      const npubKey = nip19.npubEncode(user.pubkey);
      // Clear the specific cache entry for this profile
      CacheService.profileCache.delete(npubKey);
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
    loginMethod,
  };

  return (
    <NostrContext.Provider value={contextValue}>
      {children}
    </NostrContext.Provider>
  );
}; 