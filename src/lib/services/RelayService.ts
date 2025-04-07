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
      // Set a timeout to prevent hanging connections
      const connectPromise = this.ndk.connect();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });
      
      // Use Promise.race to implement timeout
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Update relay status after connection
      this.updateRelayStatus();
      
      return this.isReady();
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
    // Implement cooldown to prevent rapid reconnection attempts
    const now = Date.now();
    if (now - this.lastReconnectAttempt < this.reconnectCooldown) {
      console.log(`Reconnect attempt too soon, waiting ${(this.reconnectCooldown - (now - this.lastReconnectAttempt))/1000}s`);
      return false;
    }
    
    this.lastReconnectAttempt = now;
    
    if (!this.ndk) {
      await this.initialize();
      return this.isReady();
    }
    
    return await this.connect();
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
   * Get NDK instance
   */
  public getNDK(): NDK | null {
    return this.ndk;
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.disconnectAll();
    this.ndk = null;
  }
}

// Export the singleton instance
export default RelayService.getInstance(); 