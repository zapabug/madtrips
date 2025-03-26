import NDK from '@nostr-dev-kit/ndk';

// Cache NDK instance for reuse
let ndkInstance: NDK | null = null;

/**
 * Get or create an NDK instance with default relays
 * @returns NDK instance or null if initialization fails
 */
export async function getNDKInstance(): Promise<NDK | null> {
  if (ndkInstance) {
    // Check if we have any connected relays
    const hasConnectedRelays = 
      ndkInstance.pool?.relays.size > 0 && 
      Array.from(ndkInstance.pool.relays.values()).some(relay => 
        relay.status === 1 // 1 = connected
      );
    
    if (hasConnectedRelays) {
      return ndkInstance;
    }
  }
  
  try {
    // Default Nostr relays to connect to
    const relays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.current.fyi',
      'wss://relay.madtrips.net'
    ];
    
    // Create a new NDK instance
    const ndk = new NDK({
      explicitRelayUrls: relays
    });
    
    // Connect to relays
    await ndk.connect();
    
    // Cache the instance
    ndkInstance = ndk;
    
    return ndk;
  } catch (error) {
    console.error('Failed to initialize NDK:', error);
    return null;
  }
} 