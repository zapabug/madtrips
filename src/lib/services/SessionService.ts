/**
 * SessionService - Centralized management of user sessions
 * 
 * This service handles:
 * - User authentication state
 * - Login/logout functionality
 * - Session persistence
 * - Integration with NDK signers
 */

import { NDKUser, NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import RelayService from './RelayService';
import CacheService from './CacheService';
import { UserProfile } from '../contexts/NostrContext';

type LoginCallback = (pubkey: string) => void;
type LogoutCallback = () => void;

interface SessionOptions {
  storageKey?: string;
  autoReconnect?: boolean;
}

/**
 * SessionService - Centralized session management
 */
class SessionService {
  private static instance: SessionService;
  
  private currentUser: NDKUser | null = null;
  private isAuthenticated: boolean = false;
  private loginCallbacks: Set<LoginCallback> = new Set();
  private logoutCallbacks: Set<LogoutCallback> = new Set();
  private loginInProgress: boolean = false;
  private storageKey: string = 'madtrips-session';
  private autoReconnect: boolean = true;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor(options?: SessionOptions) {
    if (options?.storageKey) {
      this.storageKey = options.storageKey;
    }
    
    if (options?.autoReconnect !== undefined) {
      this.autoReconnect = options.autoReconnect;
    }
    
    // Attempt to restore session on initialization
    this.tryRestoreSession();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(options?: SessionOptions): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService(options);
    }
    return SessionService.instance;
  }
  
  /**
   * Try to restore a saved session
   */
  private tryRestoreSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      if (session?.pubkey) {
        // We have a saved pubkey, but we can't restore the full session
        // without a signer. Just store the pubkey for reference.
        this.currentUser = new NDKUser({ pubkey: session.pubkey });
        console.log(`Session data found for ${session.pubkey.substring(0, 8)}...`);
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }
  
  /**
   * Save the current session
   */
  private saveSession(): void {
    if (typeof window === 'undefined' || !this.currentUser) return;
    
    try {
      const sessionData = {
        pubkey: this.currentUser.pubkey,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }
  
  /**
   * Clear the saved session
   */
  private clearSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }
  
  /**
   * Login with a NIP-07 browser extension
   */
  public async loginWithExtension(): Promise<NDKUser | null> {
    if (this.loginInProgress) {
      console.log("Login already in progress");
      return null;
    }
    
    this.loginInProgress = true;
    
    try {
      // Use the static initialization method
      const ndk = await RelayService.initializeOnce();
      
      // Create a new signer
      const signer = new NDKNip07Signer();
      ndk.signer = signer;
      
      // Attempt to get user
      const user = await signer.user();
      
      if (user) {
        this.currentUser = user;
        this.isAuthenticated = true;
        this.saveSession();
        
        // Notify all listeners
        this.loginCallbacks.forEach(callback => {
          try {
            callback(user.pubkey);
          } catch (e) {
            console.error('Error in login callback:', e);
          }
        });
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error logging in with NIP-07:', error);
      return null;
    } finally {
      this.loginInProgress = false;
    }
  }
  
  /**
   * Login with a private key (nsec)
   */
  public async loginWithPrivateKey(nsec: string): Promise<NDKUser | null> {
    if (this.loginInProgress) {
      console.log("Login already in progress");
      return null;
    }
    
    this.loginInProgress = true;
    
    try {
      // Validate the nsec
      if (!nsec.startsWith('nsec1')) {
        throw new Error('Invalid nsec format');
      }
      
      // Use the static initialization method
      const ndk = await RelayService.initializeOnce();
      
      // Create a new signer
      const signer = new NDKPrivateKeySigner(nsec);
      ndk.signer = signer;
      
      // Attempt to get user
      const user = await signer.user();
      
      if (user) {
        this.currentUser = user;
        this.isAuthenticated = true;
        this.saveSession();
        
        // Notify all listeners
        this.loginCallbacks.forEach(callback => {
          try {
            callback(user.pubkey);
          } catch (e) {
            console.error('Error in login callback:', e);
          }
        });
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error logging in with private key:', error);
      return null;
    } finally {
      this.loginInProgress = false;
    }
  }
  
  /**
   * Logout the current user
   */
  public logout(): void {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.clearSession();
    
    // Notify all listeners
    this.logoutCallbacks.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Error in logout callback:', e);
      }
    });
    
    // Don't clear the NDK instance or signer, as we still want to use it for non-authenticated operations
  }
  
  /**
   * Get the current user
   */
  public getCurrentUser(): NDKUser | null {
    return this.currentUser;
  }
  
  /**
   * Check if a user is logged in
   */
  public isLoggedIn(): boolean {
    return this.isAuthenticated && this.currentUser !== null;
  }
  
  /**
   * Add a callback to be notified on login
   */
  public onLogin(callback: LoginCallback): () => void {
    this.loginCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.loginCallbacks.delete(callback);
    };
  }
  
  /**
   * Add a callback to be notified on logout
   */
  public onLogout(callback: LogoutCallback): () => void {
    this.logoutCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.logoutCallbacks.delete(callback);
    };
  }
  
  /**
   * Get the user's profile from cache or network
   */
  public async getUserProfile(npubOrPubkey: string): Promise<UserProfile | null> {
    // Check cache first
    const cached = CacheService.profileCache.get(npubOrPubkey);
    if (cached) {
      return cached;
    }
    
    // If we have an NDK instance, try to fetch the profile
    const ndk = RelayService.getNDK();
    if (!ndk) {
      return null;
    }
    
    try {
      // Convert to hex pubkey if necessary
      let pubkey: string;
      if (npubOrPubkey.startsWith('npub1')) {
        const result = nip19.decode(npubOrPubkey);
        pubkey = result.data as string;
      } else {
        pubkey = npubOrPubkey;
      }
      
      // Create NDK user
      const ndkUser = new NDKUser({ pubkey });
      
      // Fetch profile
      const profile = await ndkUser.fetchProfile();
      
      if (profile) {
        const userProfile: UserProfile = {
          name: profile.name || 'Unknown',
          displayName: profile.displayName || profile.name || 'Unknown',
          picture: profile.image || undefined,
          banner: profile.banner || undefined,
          website: profile.website || undefined,
          about: profile.about || undefined,
          nip05: profile.nip05 || undefined,
          lud16: profile.lud16 || undefined,
          lud06: profile.lud06 || undefined
        };
        
        // Cache the profile
        CacheService.profileCache.set(npubOrPubkey, userProfile);
        
        return userProfile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    
    return null;
  }
}

// Export a singleton instance
export default SessionService.getInstance(); 