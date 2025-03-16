import { NIP47Client } from './nip47';
import { Event, type Filter } from 'nostr-tools';
import { v4 as uuidv4 } from 'uuid';

/**
 * NIP-47 Payment Request and Response handling
 * Based on https://github.com/gudnuf/nip47
 */

// Payment request types
export interface PaymentRequest {
  method: 'pay_invoice';
  params: {
    invoice: string;
  };
}

// Payment response types
export interface PaymentResponse {
  result?: {
    preimage: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class NIP47PaymentClient {
  private client: NIP47Client;
  
  constructor(client: NIP47Client) {
    this.client = client;
  }

  /**
   * Create and send a payment request for a Lightning invoice
   * @param invoice - The Lightning invoice to pay
   * @returns The payment response
   */
  async payInvoice(invoice: string): Promise<PaymentResponse> {
    try {
      if (!invoice || !invoice.startsWith('ln')) {
        throw new Error('Invalid Lightning invoice format');
      }

      console.log('Creating payment request for invoice:', invoice.substring(0, 15) + '...');
      
      // Create the payment request
      const request: PaymentRequest = {
        method: 'pay_invoice',
        params: {
          invoice
        }
      };

      // Use the underlying NIP47Client to send the request
      const response = await this.client.sendRequest(request.method, request.params);
      
      // Return the formatted response
      return {
        result: response as { preimage: string }
      };
    } catch (error) {
      console.error('Payment request failed:', error);
      
      // Format error response
      return {
        error: {
          code: error instanceof Error && 'code' in error ? (error as any).code : -1,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Get a filter to listen for payment responses
   * This generates a filter that can be used with NDK subscriptions
   * @param requestId - Optional specific request ID to filter for
   * @returns A Nostr filter object
   */
  getPaymentResponseFilter(requestId?: string): Filter {
    const filter: Filter = {
      kinds: [24133], // NIP-47 response kind
      '#p': [this.client.getClientPubkey()],
    };
    
    if (requestId) {
      filter['#e'] = [requestId];
    }
    
    return filter;
  }

  /**
   * Process a payment response event
   * @param event - The Nostr event containing the payment response
   * @returns The decoded payment response
   */
  async processPaymentResponse(event: Event): Promise<PaymentResponse> {
    try {
      // Decrypt the content
      const decryptedContent = await this.client.decryptFromRemote(event.content);
      
      // Parse the response
      const response = JSON.parse(decryptedContent);
      
      return response;
    } catch (error) {
      console.error('Failed to process payment response:', error);
      
      return {
        error: {
          code: -1,
          message: 'Failed to process payment response'
        }
      };
    }
  }

  /**
   * Check payment status for the user
   * This is a utility method to check if the user can make payments
   * @returns A status object indicating payment capability
   */
  async checkPaymentCapability(): Promise<{ canPay: boolean, reason?: string }> {
    try {
      // Check if the client is connected
      if (!this.client.isConnected()) {
        return { canPay: false, reason: 'Not connected to remote signer' };
      }
      
      // Check capabilities to see if pay_invoice is supported
      const capabilities = await this.client.getCapabilities();
      
      if (!capabilities.includes('pay_invoice')) {
        return { canPay: false, reason: 'Remote signer does not support payments' };
      }
      
      return { canPay: true };
    } catch (error) {
      console.error('Failed to check payment capability:', error);
      return { 
        canPay: false, 
        reason: error instanceof Error ? error.message : 'Unknown error checking payment capability'
      };
    }
  }
} 