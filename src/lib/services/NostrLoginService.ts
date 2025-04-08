import { getNDKInstance } from '../nostr/ndk';
import { NDKUser, NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk';

let loggedInUser: NDKUser | null = null;

/**
 * Initialize Nostr login
 * @returns Boolean indicating success
 */
export async function initNostrLogin(): Promise<boolean> {
  try {
    const { init } = await import('nostr-login');
    
    init({
      theme: 'ocean',
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      methods: 'extension,readOnly',
      noBanner: false
      // We don't set onAuth here as we'll handle that in our login component
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize nostr-login:', error);
    return false;
  }
}

/**
 * Login with Nostr using nostr-login
 * @param npub User's npub or null to show login modal
 * @returns NDKUser if login successful, null otherwise
 */
export async function loginWithNostr(npub?: string): Promise<NDKUser | null> {
  try {
    // Get NDK instance
    const ndk = await getNDKInstance();
    if (!ndk) {
      console.error('NDK not initialized');
      return null;
    }
    
    // If npub is provided, use it for read-only login
    if (npub) {
      const user = new NDKUser({ npub });
      ndk.activeUser = user;
      loggedInUser = user;
      return user;
    }
    
    // Otherwise, show login modal
    const { launch } = await import('nostr-login');
    const loginModal = launch();
    
    // The result will be handled by onAuth callback in the NostrLoginButton
    return null;
  } catch (error) {
    console.error('Error logging in with Nostr:', error);
    return null;
  }
}

/**
 * Check if user is logged in
 * @returns Boolean indicating login status
 */
export function isLoggedInWithNostr(): boolean {
  return loggedInUser !== null;
}

/**
 * Get the current logged in user
 * @returns NDKUser if logged in, null otherwise
 */
export function getLoggedInUser(): NDKUser | null {
  return loggedInUser;
}

/**
 * Logout the current user
 */
export function logoutNostrUser(): void {
  loggedInUser = null;
} 