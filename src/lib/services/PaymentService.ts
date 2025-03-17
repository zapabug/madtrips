import { NIP47Client } from '@/lib/nostr/nip47';
import NDK, { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { Event as NostrEvent } from 'nostr-tools';

// Define a more accurate interface for payment responses
interface PaymentResponse {
  id: string;
  result?: {
    preimage: string;
    paymentHash: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * PaymentService - Service to handle Lightning payments using NIP-47
 * This service integrates with the NIP47Client to manage payment operations
 */
export class PaymentService {
  private ndk: NDK;
  private client: NIP47Client | null = null;
  private paymentSubscription: NDKSubscription | null = null;
  private pendingPayments: Map<string, { 
    resolve: (value: any) => void;
    reject: (error: any) => void;
    invoice: string;
  }> = new Map();

  /**
   * Create a new PaymentService
   * @param ndk The NDK instance to use for communication
   */
  constructor(ndk: NDK) {
    this.ndk = ndk;
  }

  /**
   * Connect to a remote signer
   * @param remoteUrl The NIP-47 compatible wallet URL or pubkey
   * @param relayUrl Optional specific relay to use for communication
   */
  async connect(remoteUrl: string, relayUrl?: string): Promise<void> {
    try {
      // Disconnect any existing client
      await this.disconnect();
      
      // Create a new client
      this.client = new NIP47Client(remoteUrl, relayUrl);
      
      // Connect to the remote signer
      await this.client.connect();
      
      // Set up subscription for payment responses
      await this.setupPaymentResponseSubscription();
      
      console.log('Payment service connected to wallet');
    } catch (error) {
      console.error('Failed to connect payment service:', error);
      this.client = null;
      throw error;
    }
  }

  /**
   * Set up subscription for payment responses
   */
  private async setupPaymentResponseSubscription(): Promise<void> {
    if (!this.client || !this.ndk) {
      throw new Error('Client or NDK not initialized');
    }
    
    // Get the remote signer's pubkey
    const remotePubkey = this.client.getPublicKey ? await this.client.getPublicKey() : '';
    
    // Create a filter for payment response events
    const filter: NDKFilter = {
      kinds: [24133], // NIP-47 response event kind
      '#p': [remotePubkey], // Events directed to our client
    };
    
    // Create a subscription
    this.paymentSubscription = this.ndk.subscribe(filter, {
      closeOnEose: false,
    });
    
    // Handle events
    this.paymentSubscription.on('event', async (event: NDKEvent) => {
      try {
        if (!this.client) return;
        
        // Get the raw event and ensure it has the required properties
        const rawEvent = event.rawEvent();
        if (!rawEvent || typeof rawEvent.kind !== 'number') {
          console.error('Invalid event received');
          return;
        }
        
        // Process the payment response
        const response = await this.client.processPaymentResponse(rawEvent as NostrEvent) as PaymentResponse;
        
        if (response && response.id && this.pendingPayments.has(response.id)) {
          const pendingPayment = this.pendingPayments.get(response.id)!;
          
          if (response.error) {
            pendingPayment.reject(new Error(`Payment error: ${response.error.message}`));
          } else if (response.result) {
            pendingPayment.resolve(response.result);
          } else {
            pendingPayment.reject(new Error('Invalid payment response'));
          }
          
          this.pendingPayments.delete(response.id);
        }
      } catch (error) {
        console.error('Failed to process payment response event:', error);
      }
    });
    
    console.log('Payment response subscription set up');
  }

  /**
   * Check if the service is connected to a wallet
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to a wallet');
    }
    
    return await this.client.getInfo();
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{ balance: number, currency: string }> {
    if (!this.client) {
      throw new Error('Not connected to a wallet');
    }
    
    return await this.client.getBalance();
  }

  /**
   * Pay a Lightning invoice
   * @param invoice BOLT11 Lightning invoice to pay
   * @returns Payment result including preimage and payment hash
   */
  async payInvoice(invoice: string): Promise<{ preimage: string, paymentHash: string }> {
    if (!this.client) {
      throw new Error('Not connected to a wallet');
    }
    
    // For demonstration purposes, we'll just call the client method directly
    // In a production app, you would use the event-based approach with proper
    // subscription handling
    return await this.client.payInvoice(invoice);
  }

  /**
   * Process a payment using the event-based approach
   * This is more complex but follows the correct NIP-47 flow
   * @param invoice BOLT11 Lightning invoice to pay
   */
  async processPaymentEvent(invoice: string): Promise<{ preimage: string, paymentHash: string }> {
    if (!this.client || !this.ndk) {
      throw new Error('Not connected to a wallet');
    }
    
    try {
      // Create a payment request event
      const event = await this.client.createPaymentRequestEvent(invoice);
      
      // Create a promise that will be resolved when the payment response is received
      const paymentPromise = new Promise<{ preimage: string, paymentHash: string }>((resolve, reject) => {
        if (!event.id) {
          reject(new Error('Invalid payment request event'));
          return;
        }
        
        // Store the pending payment
        this.pendingPayments.set(event.id, { resolve, reject, invoice });
        
        // Set a timeout for the payment
        setTimeout(() => {
          if (event.id && this.pendingPayments.has(event.id)) {
            this.pendingPayments.delete(event.id);
            reject(new Error('Payment timeout'));
          }
        }, 60000); // 60 second timeout
      });
      
      // Create an NDK event and publish it
      const ndkEvent = new NDKEvent(this.ndk);
      if (event.kind) ndkEvent.kind = event.kind;
      ndkEvent.tags = event.tags || [];
      ndkEvent.content = event.content || '';
      ndkEvent.created_at = event.created_at || Math.floor(Date.now() / 1000);
      
      // Publish the event
      await ndkEvent.publish();
      
      console.log('Payment request published, waiting for response...');
      
      // Wait for the payment response
      return await paymentPromise;
    } catch (error) {
      console.error('Failed to process payment:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    if (this.paymentSubscription) {
      this.paymentSubscription.stop();
      this.paymentSubscription = null;
    }
    
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    // Clear any pending payments
    for (const [id, { reject }] of this.pendingPayments) {
      reject(new Error('Disconnected from wallet'));
      this.pendingPayments.delete(id);
    }
    
    console.log('Payment service disconnected');
  }

  /**
   * Listen for incoming NutZaps targeting a specific pubkey
   * @param pubkey The public key to listen for payments to
   * @param onPaymentReceived Callback when a payment is received
   * @returns The subscription object that can be used to unsubscribe
   */
  listenForNutZaps(pubkey: string, onPaymentReceived: (amount: number, sender: string) => void): NDKSubscription {
    const filter: NDKFilter = {
      kinds: [9739 as any], // NutZap events with type cast
      '#p': [pubkey], // Payments targeting this pubkey
    };
    
    const subscription = this.ndk.subscribe(filter);
    
    subscription.on('event', (event: NDKEvent) => {
      // Process the incoming NutZap
      const amountTag = event.tags.find(tag => tag[0] === 'amount');
      const amount = amountTag ? parseInt(amountTag[1], 10) : 0;
      
      if (amount > 0) {
        onPaymentReceived(amount, event.pubkey);
      }
    });
    
    return subscription;
  }

  /**
   * Send a NutZap to a recipient
   * @param recipient The recipient's public key
   * @param amount Amount in sats
   * @param comment Optional comment to include with the payment
   * @returns Promise resolving to the event ID
   */
  async sendNutZap(recipient: string, amount: number, comment: string = ''): Promise<{ preimage: string }> {
    // Create a NutZap event (NIP-61)
    const event = new NDKEvent(this.ndk);
    event.kind = 9739 as any; // NutZap kind (casting to any to avoid TypeScript errors)
    
    event.tags = [
      ['p', recipient],
      ['amount', amount.toString()],
      ['description', comment]
    ];
    
    event.content = comment;
    
    // Sign and publish the event
    await event.publish();
    
    return {
      preimage: event.id
    };
  }

  /**
   * Check if a recipient supports NutZaps by checking their profile metadata
   * @param recipientPubkey The recipient's public key
   * @returns Promise resolving to whether the recipient supports NutZaps
   */
  async checkNutZapSupport(recipientPubkey: string): Promise<boolean> {
    try {
      // Create a filter for the recipient's profile metadata
      const filter: NDKFilter = {
        kinds: [0], // Profile metadata kind
        authors: [recipientPubkey],
        limit: 1
      };
      
      // Fetch the profile event
      const events = await this.ndk.fetchEvents(filter);
      if (!events.size) return false;
      
      const profileEvent = Array.from(events)[0];
      const content = JSON.parse(profileEvent.content || '{}');
      
      // Check for NutZap support in the profile
      return !!(
        content.supported_nip?.includes('61') || // NIP-61 is NutZaps
        content.nip61_supported ||
        content.nutzap_supported
      );
    } catch (error) {
      console.error('Error checking NutZap support:', error);
      return false;
    }
  }
}

// Create a singleton instance
let paymentServiceInstance: PaymentService | null = null;

/**
 * Get or create the payment service instance
 */
export const getPaymentService = (ndk: NDK): PaymentService => {
  if (!paymentServiceInstance) {
    paymentServiceInstance = new PaymentService(ndk);
  }
  return paymentServiceInstance;
}; 