import NDK, { NDKRelay, NDKRelayStatus, NDKFilter, NDKUser } from '@nostr-dev-kit/ndk';
import { RELAYS, DEFAULT_RELAYS, createRelay } from '../../constants/relays';

interface RelayStatus {
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  ping?: number; // Response time in ms
  lastChecked?: number;
}

/**
 * Relay Service - Centralized management of Nostr relay connections
 * 
 * This service handles:
 * - Relay connections and disconnections
 * - Connection health monitoring
 * - Relay status tracking
 * - Optimized relay selection
 * - Automatic reconnection
 */
class RelayService {
  private static instance: RelayService;
  
  private ndk: NDK | null = null;
  private relayStatus = new Map<string, RelayStatus>();
  private connectedRelays: string[] = [];
  private lastReconnectAttempt = 0;
  private reconnectCooldown = 5000; // 5 seconds between reconnect attempts
  private monitorInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  
  // Callbacks for status updates
  private statusUpdateCallbacks: ((relays: string[]) => void)[] = [];
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // This will be initialized when initialize is called
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): RelayService {
    if (!RelayService.instance) {
      RelayService.instance = new RelayService();
    }
    return RelayService.instance;
  }
  
  /**
   * Get the NDK instance - safer accessor that ensures we have an instance
   */
  public static getNDK(): NDK | null {
    const instance = RelayService.getInstance();
    return instance.ndk;
  }
  
  /**
   * Initialize NDK once and return the instance
   * This is the recommended way to initialize NDK from anywhere in the app
   */
  public static async initializeOnce(): Promise<NDK> {
    return RelayService.getInstance().initialize();
  }
  
  /**
   * Initialize the relay service with an NDK instance
   * @param existingNdk Optional existing NDK instance to use
   * @returns The initialized NDK instance
   */
  public async initialize(existingNdk?: NDK): Promise<NDK> {
    // If already initialized and ready, return the existing instance
    if (this.ndk && this.isReady()) {
      return this.ndk;
    }
    
    try {
      // Clean up any existing NDK instance before creating a new one
      if (this.ndk) {
        this.cleanup();
      }
      
      // Use existing NDK or create a new one
      if (existingNdk) {
        this.ndk = existingNdk;
      } else {
        // Use a balanced set of relays for better reliability
        const initialRelays = [
          ...DEFAULT_RELAYS.slice(0, 2) // Use first two default relays
        ];
  
        this.ndk = new NDK({
          explicitRelayUrls: initialRelays,
          enableOutboxModel: false,
          autoConnectUserRelays: false,
          debug: false // Disable debug mode in production
        });
      }
      
      // Reset state
      this.connectedRelays = [];
      this.statusUpdateCallbacks = [];
      this.relayStatus.clear();
      
      // Connect to relays
      await this.connect();
      
      // Start relay monitoring
      this.startMonitoring();
      
      return this.ndk;
    } catch (error) {
      console.error('Failed to initialize NDK in RelayService:', error);
      this.cleanup(); // Clean up on error
      throw error;
    }
  }
  
  /**
   * Check if the service is ready (has a connected NDK instance)
   */
  public isReady(): boolean {
    if (!this.ndk) return false;
    
    // Check if we have any connected relays
    const hasConnectedRelays = 
      this.ndk.pool?.relays.size > 0 && 
      Array.from(this.ndk.pool.relays.values()).some(relay => 
        relay.status === NDKRelayStatus.CONNECTED
      );
      
    return hasConnectedRelays;
  }
  
  /**
   * Safely create a relay object compatible with NDK
   * Avoids the 'relay.off is not a function' error by ensuring proper relay object structure
   */
  private createSafeRelay(url: string): NDKRelay {
    // Create a basic relay object with the minimum required properties
    const relay: Partial<NDKRelay> = { 
      url,
      status: NDKRelayStatus.DISCONNECTED,
      connect: async function() { return Promise.resolve(); }, // Async function returning a Promise
      disconnect: function() { /* Will be replaced by NDK */ }
    };
    
    // Return as NDKRelay (NDK will set up the remaining properties when it's added to the pool)
    return relay as NDKRelay;
  }
  
  /**
   * Safely add a relay to the NDK pool
   */
  private addRelayToPool(url: string): boolean {
    if (!this.ndk || !this.ndk.pool) return false;
    
    try {
      // Check if relay already exists
      if (this.ndk.pool.relays.has(url)) {
        return true; // Already exists, consider this a success
      }
      
      // Create a safe relay object
      const relay = this.createSafeRelay(url);
      
      // Add to the pool using the set method (safer than addRelay)
      this.ndk.pool.relays.set(url, relay);
      console.log(`Added relay to pool: ${url}`);
      return true;
    } catch (error) {
      console.error(`Failed to add relay ${url}:`, error);
      return false;
    }
  }
  
  /**
   * Connect to relays with structured retry logic
   * @param attemptsLeft Number of connection attempts to make
   * @param timeout Connection timeout in milliseconds
   * @returns Promise resolving to a boolean indicating success
   */
  private async connectWithRetry(attemptsLeft = 3, timeout = 15000): Promise<boolean> {
    if (!this.ndk) {
      console.warn('Cannot connect: NDK not initialized');
      return false;
    }
    
    if (attemptsLeft <= 0) {
      console.error('Maximum connection attempts reached');
      return false;
    }

    try {
      console.log(`Connection attempt ${4 - attemptsLeft}/3 with ${timeout}ms timeout...`);
      
      // Connect with timeout
      const connectPromise = this.ndk.connect();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), timeout);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Check if we actually have connected relays
      const hasConnectedRelays = this.isReady();
      
      if (!hasConnectedRelays) {
        throw new Error('Connected but no relays are actually connected');
      }
      
      console.log('Successfully connected to Nostr relays');
      return true;
    } catch (error) {
      console.warn(`Connection attempt ${4 - attemptsLeft} failed:`, error);
      
      if (attemptsLeft > 1) {
        // Add additional fallback relays for the next attempt
        const fallbackRelays = [
          "wss://relay.damus.io",
          "wss://nos.lol", 
          "wss://relay.nostr.band",
          "wss://relay.primal.net",
          "wss://relay.current.fyi", 
          "wss://nostr-pub.wellorder.net",
          "wss://relay.nostr.info",
          "wss://nostr.wine"
        ];
        
        // Shuffle the array to get different relays each time
        const shuffled = [...fallbackRelays].sort(() => 0.5 - Math.random());
        
        // Add 2 new relays each retry
        let addedCount = 0;
        for (let i = 0; i < 3; i++) {
          if (shuffled[i]) {
            if (this.addRelayToPool(shuffled[i])) {
              addedCount++;
              if (addedCount >= 2) break;
            }
          }
        }
        
        // Delay before retry
        await new Promise(r => setTimeout(r, 1000));
        return this.connectWithRetry(attemptsLeft - 1, timeout + 5000);
      }
      
      return false;
    }
  }
  
  /**
   * Connect to relays
   */
  public async connect(): Promise<boolean> {
    if (!this.ndk) {
      console.warn('Cannot connect: NDK not initialized');
      return false;
    }
    
    // Prevent concurrent connection attempts
    if (this.isConnecting) {
      console.log('Connection already in progress');
      return false;
    }
    
    this.isConnecting = true;
    
    try {
      // Use the connectWithRetry method for structured retry logic
      const connected = await this.connectWithRetry();
      
      // Update relay status after connection
      this.updateRelayStatus();
      
      return connected;
    } catch (error) {
      console.error('Error connecting to relays:', error);
      this.updateRelayStatus();
      return false;
    } finally {
      this.isConnecting = false;
    }
  }
  
  /**
   * Reconnect to relays with cooldown protection
   */
  public async reconnect(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastReconnectAttempt < this.reconnectCooldown) {
      const waitTime = Math.ceil((this.reconnectCooldown - (now - this.lastReconnectAttempt)) / 1000);
      console.log(`Reconnect attempt too soon, waiting ${waitTime}s`);
      await new Promise(resolve => setTimeout(resolve, this.reconnectCooldown));
    }
    
    this.lastReconnectAttempt = Date.now();
    
    try {
      if (this.isConnecting) {
        console.log("Already attempting to connect");
        return false;
      }
      
      this.isConnecting = true;
      console.log("Starting reconnection process");
      
      // Clean up existing connections
      this.disconnectAll();
      
      // Add a fresh set of relays from various reliable sources
      const reliableRelays = [
        "wss://relay.damus.io",
        "wss://nos.lol", 
        "wss://relay.nostr.band",
        "wss://relay.primal.net",
        "wss://relay.current.fyi",
        "wss://purplepag.es",
        "wss://nostr-pub.wellorder.net"
      ];
      
      // Shuffle the relays to avoid always hitting the same ones first
      const shuffledRelays = [...reliableRelays].sort(() => 0.5 - Math.random());
      
      // Take the first 4 relays
      const selectedRelays = shuffledRelays.slice(0, 4);
      console.log("Selected relays for reconnection:", selectedRelays);
      
      // If we have an existing NDK instance
      if (this.ndk) {
        // Add the selected relays to the pool
        for (const relay of selectedRelays) {
          this.addRelayToPool(relay);
        }
        
        // Use connectWithRetry for structured retry logic
        const connected = await this.connectWithRetry();
        
        if (connected) {
          this.startMonitoring();
          return true;
        }
        
        // If still not connected, try with a new NDK instance as a last resort
        console.log("Trying with new NDK instance...");
        this.cleanup();
        
        this.ndk = new NDK({
          explicitRelayUrls: [...selectedRelays, ...DEFAULT_RELAYS.slice(0, 2)],
          enableOutboxModel: false,
          autoConnectUserRelays: false,
          debug: false
        });
        
        const finalAttempt = await this.connectWithRetry();
        
        if (finalAttempt) {
          this.startMonitoring();
        }
        
        return finalAttempt;
      } else {
        // No existing NDK instance, create a new one
        console.log("No existing NDK instance, creating new one...");
        this.ndk = new NDK({
          explicitRelayUrls: [...selectedRelays, ...DEFAULT_RELAYS.slice(0, 2)],
          enableOutboxModel: false,
          autoConnectUserRelays: false,
          debug: false
        });
        
        const result = await this.connectWithRetry();
        
        if (result) {
          this.startMonitoring();
        }
        
        return result;
      }
    } catch (error) {
      console.error("Failed to reconnect:", error);
      return false;
    } finally {
      this.isConnecting = false;
    }
  }
  
  /**
   * Update the status of all relays
   */
  private updateRelayStatus(): void {
    if (!this.ndk || !this.ndk.pool) {
      this.connectedRelays = [];
      return;
    }
    
    try {
      const connectedRelays: string[] = [];
      
      for (const [url, relay] of this.ndk.pool.relays.entries()) {
        let status: RelayStatus['status'] = 'disconnected';
        
        switch (relay.status) {
          case NDKRelayStatus.CONNECTED:
            status = 'connected';
            connectedRelays.push(url);
            break;
          case NDKRelayStatus.CONNECTING:
            status = 'connecting';
            break;
          case NDKRelayStatus.DISCONNECTED:
            status = 'disconnected';
            break;
          default:
            // Handle any other status as error
            status = 'error';
            break;
        }
        
        this.relayStatus.set(url, {
          url,
          status,
          lastChecked: Date.now()
        });
      }
      
      // Update the list of connected relays
      this.connectedRelays = connectedRelays;
      
      // Notify all callbacks about the change
      this.notifyStatusUpdateCallbacks();
    } catch (error) {
      console.error('Error updating relay status:', error);
    }
  }
  
  /**
   * Start monitoring relays
   */
  private startMonitoring(): void {
    // Stop existing monitoring if any
    this.stopMonitoring();
    
    // Check relay status periodically
    this.monitorInterval = setInterval(() => {
      this.updateRelayStatus();
    }, 10000); // Check every 10 seconds
    
    // Initial check
    this.updateRelayStatus();
  }
  
  /**
   * Notify all callbacks about relay status changes
   */
  private notifyStatusUpdateCallbacks(): void {
    for (const callback of this.statusUpdateCallbacks) {
      try {
        callback([...this.connectedRelays]);
      } catch (error) {
        console.error('Error in relay status update callback:', error);
      }
    }
  }
  
  /**
   * Register a callback for relay status updates
   */
  public onStatusUpdate(callback: (relays: string[]) => void): () => void {
    this.statusUpdateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusUpdateCallbacks.indexOf(callback);
      if (index !== -1) {
        this.statusUpdateCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Disconnect from all relays
   */
  private disconnectAll(): void {
    if (this.ndk && this.ndk.pool) {
      try {
        // Disconnect from all relays by iterating through them
        for (const relay of this.ndk.pool.relays.values()) {
          try {
            relay.disconnect();
          } catch (e) {
            console.error('Error disconnecting relay:', e);
          }
        }
        
        // Clear the relays collection
        this.ndk.pool.relays.clear();
      } catch (error) {
        console.error('Error disconnecting from relays:', error);
      }
    }
    this.connectedRelays = [];
    this.relayStatus.clear();
  }
  
  /**
   * Stop relay monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
  
  /**
   * Get a list of currently connected relays
   */
  public getConnectedRelays(): string[] {
    try {
      // Safety check for array length and validity
      if (!Array.isArray(this.connectedRelays) || this.connectedRelays.length > 10) {
        return [];
      }
      return [...this.connectedRelays]; // Return a copy to avoid mutations
    } catch (error) {
      console.error('Error getting connected relays:', error);
      return [];
    }
  }
  
  /**
   * Get status of all relays
   */
  public getAllRelayStatus(): RelayStatus[] {
    return Array.from(this.relayStatus.values());
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.disconnectAll();
    this.ndk = null;
  }
  
  /**
   * Static method to easily reconnect relays without needing the instance directly
   */
  public static async reconnect(): Promise<boolean> {
    return RelayService.getInstance().reconnect();
  }
}

// Export the singleton instance
export default RelayService.getInstance(); 