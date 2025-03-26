import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { CORE_NPUBS } from '../../constants/nostr';

/**
 * Test function for Nostr integration
 * This function tests connecting to relays and fetching profiles
 */
export async function testNostrConnection(): Promise<{
  success: boolean;
  message: string;
  relays?: string[];
  profiles?: any[];
}> {
  try {
    // Create NDK instance with default relays
    const ndk = new NDK({
      explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.current.fyi',
      ]
    });

    // Connect to relays
    await ndk.connect();
    
    // Check connected relays
    const connectedRelays = Array.from(ndk.pool.relays.values())
      .filter(relay => relay.status === 1) // 1 = connected
      .map(relay => relay.url);
    
    if (connectedRelays.length === 0) {
      return {
        success: false,
        message: 'Failed to connect to any relays'
      };
    }
    
    // Try to fetch profiles for core npubs
    const profiles = [];
    
    for (const npub of CORE_NPUBS.slice(0, 2)) { // Limit to first 2 for quick testing
      try {
        const user = ndk.getUser({ npub });
        
        // Fetch user metadata
        await user.fetchProfile();
        
        if (user.profile) {
          profiles.push({
            npub,
            name: user.profile.name || user.profile.displayName,
            picture: user.profile.image || user.profile.picture
          });
        }
      } catch (e) {
        // Skip errors for individual profiles
      }
    }
    
    return {
      success: true,
      message: `Connected to ${connectedRelays.length} relays and fetched ${profiles.length} profiles`,
      relays: connectedRelays,
      profiles
    };
  } catch (error) {
    console.error('Error testing Nostr connection:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error testing Nostr connection'
    };
  }
}

/**
 * Post a test event to Nostr
 */
export async function postTestEvent(content: string): Promise<{
  success: boolean;
  message: string;
  eventId?: string;
}> {
  try {
    // This is only a stub - in a real application, you would need
    // user's private key or NIP-07 extension to sign an event
    return {
      success: false,
      message: 'Cannot post events without user credentials'
    };
  } catch (error) {
    console.error('Error posting test event:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error posting test event'
    };
  }
} 