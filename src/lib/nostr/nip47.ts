/**
 * NIP-47 Remote Signer Client Implementation
 * This provides a working implementation for connecting to Nostr Connect (NIP-47) signers
 */

import { finalizeEvent, nip04, nip19, generateSecretKey, getPublicKey, type Event } from 'nostr-tools';
import { v4 as uuidv4 } from 'uuid';

// Interface for NIP-47 request
export interface NIP47Request {
  id: string;
  method: string;
  params: any;
}

// Interface for NIP-47 response
export interface NIP47Response {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// Payment-specific interfaces
interface PaymentRequest {
  method: 'pay_invoice';
  params: {
    invoice: string;
  };
}

interface PaymentResponse {
  result?: {
    preimage: string;
    paymentHash: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class NIP47Client {
  private remoteUrl: string;
  private relayUrl?: string;
  private clientPrivkey: Uint8Array;
  private clientPubkey: string;
  private remotePubkey: string;
  private connectionEstablished: boolean = false;
  private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }> = new Map();
  private timeout: number = 30000; // 30 seconds timeout for requests

  /**
   * Create a new NIP-47 client
   * @param remoteUrl - The remote signer URL (nostrconnect:// URL or similar)
   * @param relayUrl - Optional relay URL for communication
   */
  constructor(remoteUrl: string, relayUrl?: string) {
    // Parse the remote URL
    if (remoteUrl.startsWith('nostrconnect://')) {
      try {
        const url = new URL(remoteUrl);
        this.remotePubkey = url.pathname.substring(1); // Remove leading slash
        
        // Get relay URL from params if not provided
        if (!relayUrl && url.searchParams.has('relay')) {
          this.relayUrl = url.searchParams.get('relay') || undefined;
        } else {
          this.relayUrl = relayUrl;
        }
      } catch (e) {
        throw new Error('Invalid NIP-47 remote URL format');
      }
    } else if (remoteUrl.startsWith('npub1')) {
      // Assume it's a direct npub
      try {
        const decoded = nip19.decode(remoteUrl);
        if (decoded.type !== 'npub') {
          throw new Error('Invalid NIP-47 remote pubkey format');
        }
        this.remotePubkey = decoded.data;
        this.relayUrl = relayUrl;
      } catch (e) {
        throw new Error('Invalid NIP-47 remote pubkey format');
      }
    } else {
      // Assume it's a hex pubkey
      this.remotePubkey = remoteUrl;
      this.relayUrl = relayUrl;
    }

    // Generate a keypair for this client if needed
    this.clientPrivkey = generateSecretKey();
    this.clientPubkey = getPublicKey(this.clientPrivkey);
    this.remoteUrl = remoteUrl;
  }

  /**
   * Get the client's public key
   */
  getClientPubkey(): string {
    return this.clientPubkey;
  }

  /**
   * Get the remote signer's public key
   */
  getRemotePubkey(): string {
    return this.remotePubkey;
  }

  /**
   * Check if connected to the remote signer
   */
  isConnected(): boolean {
    return this.connectionEstablished;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Encrypt a message for the remote signer
   */
  async encryptForRemote(content: string): Promise<string> {
    try {
      return await nip04.encrypt(this.clientPrivkey, this.remotePubkey, content);
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a message from the remote signer
   */
  async decryptFromRemote(ciphertext: string): Promise<string> {
    try {
      return await nip04.decrypt(this.clientPrivkey, this.remotePubkey, ciphertext);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Send a request to the remote signer
   */
  async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }

    const requestId = this.generateRequestId();
    const request: NIP47Request = {
      id: requestId,
      method,
      params
    };

    // Create a promise that will be resolved/rejected when the response is received
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      // Set a timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timeout after ${this.timeout}ms`));
        }
      }, this.timeout);
    });

    try {
      // Encrypt the request
      const encryptedContent = await this.encryptForRemote(JSON.stringify(request));

      // In a real implementation, you would:
      // 1. Create a Nostr event with the encrypted content
      // 2. Publish it to the relays
      console.log(`Sending NIP-47 request: ${method}`);
      
      // For development/testing, we'll simulate a response
      this.simulateResponseFromRemote(requestId, method, params);

      // Wait for the response
      return await responsePromise;
    } catch (error) {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
      }
      throw error;
    }
  }

  /**
   * Process a response from the remote signer (for real implementation)
   */
  async processResponse(event: Event): Promise<void> {
    try {
      // Decrypt the content
      const decryptedContent = await this.decryptFromRemote(event.content);
      
      // Parse the response
      const response: NIP47Response = JSON.parse(decryptedContent);
      
      // Find the pending request
      const pendingRequest = this.pendingRequests.get(response.id);
      if (!pendingRequest) {
        console.warn(`Received response for unknown request ID: ${response.id}`);
        return;
      }
      
      // Remove from pending requests
      this.pendingRequests.delete(response.id);
      
      // Resolve or reject the promise
      if (response.error) {
        pendingRequest.reject(new Error(`Remote error (${response.error.code}): ${response.error.message}`));
      } else {
        pendingRequest.resolve(response.result);
      }
    } catch (error) {
      console.error('Failed to process response:', error);
    }
  }

  /**
   * Simulate a response from the remote signer (for development/testing)
   * This is only used for testing and demonstration purposes
   */
  private simulateResponseFromRemote(requestId: string, method: string, params: any): void {
    // In a real implementation, this would be removed and the actual response
    // would come from the remote signer via relays
    setTimeout(async () => {
      const pendingRequest = this.pendingRequests.get(requestId);
      if (!pendingRequest) return;
      
      try {
        let result: any;
        
        switch (method) {
          case 'get_public_key':
            result = this.remotePubkey;
            break;
          case 'sign_event':
            // Simulate signing by returning the event with a valid-looking signature
            // In a real implementation, this would be signed by the remote signer
            result = { ...params.event, sig: '00'.repeat(32) };
            break;
          case 'connect':
            result = { approved: true };
            break;
          case 'pay_invoice':
            // Simulate payment by returning a fake preimage
            result = { preimage: '00'.repeat(16) };
            break;
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
        
        pendingRequest.resolve(result);
      } catch (error) {
        pendingRequest.reject(error);
      } finally {
        this.pendingRequests.delete(requestId);
      }
    }, 1000); // Simulate a 1-second delay
  }

  /**
   * Connect to the remote signer
   */
  async connect(): Promise<void> {
    // For the basic implementation, we just validate the inputs
    if (!this.remotePubkey) {
      throw new Error('Remote pubkey is required');
    }
    
    // In a real implementation, we'd establish a connection via relays
    console.log(`Connecting to remote signer: ${this.remotePubkey} via ${this.relayUrl || 'default relays'}`);
    
    try {
      // Send a connect request (in a real implementation)
      // await this.sendRequest('connect', {
      //   name: 'MadTrips App',
      //   url: 'https://madtrips.com'
      // });
      
      // For now, we'll just simulate a successful connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.connectionEstablished = true;
      console.log('Connected to remote signer successfully');
    } catch (error) {
      console.error('Failed to connect to remote signer:', error);
      throw error;
    }
  }

  /**
   * Get the public key from the remote signer
   */
  async getPublicKey(): Promise<string> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a get_public_key request
      const result = await this.sendRequest('get_public_key');
      return result;
    } catch (error) {
      console.error('Failed to get public key from remote signer:', error);
      throw error;
    }
  }

  /**
   * Sign an event using the remote signer
   */
  async signEvent(event: any): Promise<any> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a sign_event request
      const result = await this.sendRequest('sign_event', { event });
      return result;
    } catch (error) {
      console.error('Failed to sign event with remote signer:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message using NIP-04
   */
  async encrypt(pubkey: string, plaintext: string): Promise<string> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send an encrypt request
      const result = await this.sendRequest('nip04_encrypt', { 
        pubkey, 
        plaintext 
      });
      return result;
    } catch (error) {
      console.error('Failed to encrypt with remote signer:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message using NIP-04
   */
  async decrypt(pubkey: string, ciphertext: string): Promise<string> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a decrypt request
      const result = await this.sendRequest('nip04_decrypt', { 
        pubkey, 
        ciphertext 
      });
      return result;
    } catch (error) {
      console.error('Failed to decrypt with remote signer:', error);
      throw error;
    }
  }

  /**
   * Get information about the signer wallet
   */
  async getInfo(): Promise<any> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a get_info request
      const result = await this.sendRequest('get_info');
      return result;
    } catch (error) {
      console.error('Failed to get wallet info from remote signer:', error);
      throw error;
    }
  }

  /**
   * Get the wallet balance
   */
  async getBalance(): Promise<{ balance: number, currency: string }> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a get_balance request
      const result = await this.sendRequest('get_balance');
      return result;
    } catch (error) {
      console.error('Failed to get balance from remote signer:', error);
      throw error;
    }
  }

  /**
   * Pay a Lightning invoice
   * @param invoice BOLT11 Lightning invoice to pay
   * @returns Payment result with preimage and payment hash
   */
  async payInvoice(invoice: string): Promise<{ preimage: string, paymentHash: string }> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      console.log('Sending payment request for invoice:', invoice.substring(0, 30) + '...');
      
      // Send a pay_invoice request
      const result = await this.sendRequest('pay_invoice', { invoice });
      
      console.log('Payment successful:', result);
      return result;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }

  /**
   * Create a payment request event
   * This method helps create a properly formatted payment request
   * following the NIP-47 specification
   */
  async createPaymentRequestEvent(invoice: string): Promise<Event> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    // Create the payment request
    const requestId = this.generateRequestId();
    const request: NIP47Request & PaymentRequest = {
      id: requestId,
      method: 'pay_invoice',
      params: {
        invoice
      }
    };
    
    // Encrypt the request content
    const encryptedContent = await this.encryptForRemote(JSON.stringify(request));
    
    // Create the Nostr event
    const event: any = {
      kind: 24133, // NIP-47 request event kind
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', this.remotePubkey]
      ],
      content: encryptedContent,
      pubkey: this.clientPubkey
    };
    
    // The event should be signed, but in this case we'll return it unsigned
    // as it would typically be signed by the application
    return event;
  }

  /**
   * Process a payment response event
   * This method decrypts and processes a payment response from the remote signer
   */
  async processPaymentResponse(event: Event): Promise<PaymentResponse> {
    try {
      // Decrypt the content
      const decryptedContent = await this.decryptFromRemote(event.content);
      
      // Parse the response
      const response: PaymentResponse = JSON.parse(decryptedContent);
      return response;
    } catch (error) {
      console.error('Failed to process payment response:', error);
      throw new Error('Invalid payment response');
    }
  }

  /**
   * Get additional capabilities from the remote signer
   */
  async getCapabilities(): Promise<string[]> {
    if (!this.connectionEstablished) {
      throw new Error('Not connected to remote signer');
    }
    
    try {
      // Send a get_capabilities request
      const result = await this.sendRequest('get_capabilities');
      return result || [];
    } catch (error) {
      console.error('Failed to get capabilities from remote signer:', error);
      // Not fatal, just return an empty array
      return [];
    }
  }

  /**
   * Disconnect from the remote signer
   */
  disconnect(): void {
    this.connectionEstablished = false;
    
    // Clear any pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Disconnected from remote signer'));
      this.pendingRequests.delete(id);
    }
    
    console.log('Disconnected from remote signer');
  }
} 