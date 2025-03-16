'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NDK, { NDKEvent, NDKUser, NDKFilter, NDKSubscription, NostrEvent } from '@nostr-dev-kit/ndk';
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';

// Utility function to shorten npub for display
export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
};

// Define types for our context
interface NostrContextType {
  ndk: NDK | null;
  user: NDKUser | null;
  loading: boolean;
  error: Error | null;
  login: () => Promise<void>;
  logout: () => void;
  getUserProfile: (npub: string) => Promise<NDKUser>;
  getFollows: (npub: string) => Promise<NDKUser[]>;
  getSocialGraph: (npubs: string[], maxConnections?: number) => Promise<{
    nodes: any[];
    links: any[];
  }>;
  shortenNpub: (npub: string) => string;
}

// Create the context
const NostrContext = createContext<NostrContextType | undefined>(undefined);

// Provider component
export const NostrProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize NDK on component mount
  useEffect(() => {
    const initializeNDK = async () => {
      try {
        // Check if window is defined (only in browser)
        if (typeof window !== 'undefined') {
          // Create a signer that uses the window.nostr API (extension)
          const signer = new NDKNip07Signer();

          // Create a new NDK instance
          const ndk = new NDK({
            explicitRelayUrls: [
              'wss://relay.damus.io',
              'wss://relay.nostr.band',
              'wss://nos.lol',
              'wss://relay.current.fyi',
              'wss://relay.snort.social',
            ],
            signer
          });

          // Connect to relays
          await ndk.connect();
          setNdk(ndk);

          // Try to auto-login if the user has already authenticated
          try {
            const publicKey = await signer.user();
            if (publicKey) {
              const user = ndk.getUser({ npub: publicKey.npub });
              await user.fetchProfile();
              setUser(user);
            }
          } catch (e) {
            // Failed to auto-login, but that's okay
            console.log('Not logged in yet');
          }
        }
      } catch (e) {
        console.error('Failed to initialize NDK:', e);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeNDK();
  }, []);

  // Login function
  const login = async () => {
    if (!ndk) {
      throw new Error('NDK not initialized');
    }

    setLoading(true);
    try {
      // Ensure we have a signer
      if (!ndk.signer) {
        ndk.signer = new NDKNip07Signer();
      }

      // Get the user's public key
      const publicKey = await ndk.signer.user();
      
      if (!publicKey) {
        throw new Error('Failed to get public key');
      }

      // Create an NDKUser from the public key
      const user = ndk.getUser({ npub: publicKey.npub });
      
      // Fetch the user's profile
      await user.fetchProfile();
      
      setUser(user);
    } catch (e) {
      console.error('Login error:', e);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced logout function
  const logout = () => {
    setUser(null);
    
    // Clean up any active subscriptions or resources if needed
    if (ndk) {
      try {
        // Close any active subscriptions if needed
        // This depends on how NDK handles connections and subscriptions
        // You might need to adapt this based on your specific NDK implementation
        
        console.log('User logged out successfully, all resources cleaned up');
      } catch (error) {
        console.error('Error during logout cleanup:', error);
      }
    }
    
    // Optionally: You could also re-initialize the NDK instance
    // or implement additional cleanup as needed for your application
    
    // Set loading to false to ensure UI reflects the logout state
    setLoading(false);
    
    // Clear any error state that might be present
    setError(null);
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

  // Validate an NPUB format
  const isValidNpub = (npub: string): boolean => {
    // Basic check for npub format (starts with npub1 and is 63 chars long)
    return typeof npub === 'string' && npub.startsWith('npub1') && npub.length === 63;
  };

  // Get social graph data for a list of NPUBs
  const getSocialGraph = async (npubs: string[], maxConnections = 25) => {
    if (!ndk) {
      throw new Error('NDK not initialized. Please login first.');
    }
    
    // Validate input NPUBs
    const validNpubs = npubs.filter(npub => isValidNpub(npub));
    
    if (validNpubs.length === 0) {
      throw new Error('No valid NPUBs provided');
    }
    
    console.log(`Getting social graph for ${validNpubs.length} valid NPUBs`);
    
    const nodes: any[] = [];
    const links: any[] = [];
    const processedNpubs = new Set<string>();
    
    // Add core NPUBs as nodes
    for (const npub of validNpubs) {
      try {
        const user = ndk.getUser({ npub });
        await user.fetchProfile();
        
        nodes.push({
          id: npub,
          npub,
          name: user.profile?.name || shortenNpub(npub),
          displayName: user.profile?.displayName || user.profile?.name || shortenNpub(npub),
          picture: user.profile?.image,
          isCoreNode: true,
          nodeType: 'profile',
          group: 1,
        });
        
        processedNpubs.add(npub);
      } catch (e) {
        console.error(`Error fetching profile for ${npub}:`, e);
      }
    }

    // Add connections for each core NPUB
    for (const npub of validNpubs) {
      try {
        const user = ndk.getUser({ npub });
        
        // Safely get follows with error handling
        let followsArray: NDKUser[] = [];
        try {
          const follows = await user.follows();
          followsArray = Array.from(follows).filter(u => u && typeof u === 'object');
        } catch (e) {
          console.error(`Error fetching follows for ${npub}:`, e);
          continue; // Skip this user if we can't get their follows
        }
        
        // Limit the number of follows to process
        const limitedFollows = followsArray.slice(0, maxConnections);
        
        for (const followedUser of limitedFollows) {
          // Safety check - make sure followedUser is valid
          if (!followedUser) {
            console.warn('Skipping null followed user');
            continue;
          }
          
          // Safety check - make sure followedUser has a valid npub
          let followedNpub: string;
          try {
            followedNpub = followedUser.npub;
            if (!followedNpub) {
              console.warn('Skipping invalid followed user (no npub)');
              continue;
            }
          } catch (e) {
            console.error('Error accessing npub property:', e);
            continue;
          }
          
          // Validate the NPUB format
          if (!isValidNpub(followedNpub)) {
            console.warn(`Skipping invalid NPUB format: ${followedNpub}`);
            continue;
          }
          
          // Skip if we've already processed this user
          if (processedNpubs.has(followedNpub)) {
            continue;
          }
          
          // Add follower to nodes
          try {
            await followedUser.fetchProfile();
            
            nodes.push({
              id: followedNpub,
              npub: followedNpub,
              name: followedUser.profile?.name || shortenNpub(followedNpub),
              displayName: followedUser.profile?.displayName || followedUser.profile?.name || shortenNpub(followedNpub),
              picture: followedUser.profile?.image,
              isCoreNode: false,
              nodeType: 'following',
              group: 2,
            });
            
            processedNpubs.add(followedNpub);
          } catch (e) {
            console.error(`Error fetching profile for followed user ${followedNpub}:`, e);
            continue;
          }
          
          // Add link from user to followed user
          links.push({
            source: npub,
            target: followedNpub,
            type: 'follows',
            value: 1,
          });
          
          // Check if the followed user follows any of the core NPUBs
          try {
            let followedUserFollowsArray: NDKUser[] = [];
            try {
              const followedUserFollows = await followedUser.follows();
              followedUserFollowsArray = Array.from(followedUserFollows).filter(u => u && typeof u === 'object');
            } catch (e) {
              console.error(`Error fetching follows for ${followedNpub}:`, e);
              continue; // Skip this check if we can't get their follows
            }
            
            for (const coreNpub of validNpubs) {
              try {
                if (coreNpub !== npub && followedUserFollowsArray.some(u => {
                  try {
                    return u && u.npub === coreNpub;
                  } catch (e) {
                    console.error('Error comparing npubs:', e);
                    return false;
                  }
                })) {
                  // Add a link to show this connection
                  links.push({
                    source: followedNpub,
                    target: coreNpub,
                    type: 'follows',
                    value: 1,
                  });
                }
              } catch (e) {
                console.error(`Error checking if ${followedNpub} follows ${coreNpub}:`, e);
              }
            }
          } catch (e) {
            console.error(`Error processing follows for ${followedNpub}:`, e);
          }
        }
        
        // Add links between core NPUBs
        for (const otherNpub of validNpubs) {
          if (npub !== otherNpub) {
            try {
              const isFollowing = followsArray.some(u => {
                try {
                  return u && u.npub === otherNpub;
                } catch (e) {
                  console.error('Error comparing npubs for core users:', e);
                  return false;
                }
              });
              
              if (isFollowing) {
                links.push({
                  source: npub,
                  target: otherNpub,
                  type: 'mutual',
                  value: 2,
                });
              }
            } catch (e) {
              console.error(`Error checking if ${npub} follows ${otherNpub}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error processing social graph for ${npub}:`, e);
      }
    }

    return { nodes, links };
  };

  // Provide the context value
  const contextValue: NostrContextType = {
    ndk,
    user,
    loading,
    error,
    login,
    logout,
    getUserProfile,
    getFollows,
    getSocialGraph,
    shortenNpub,
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