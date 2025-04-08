'use client';

/**
 * Payment Service for handling Lightning payments across different providers
 */

// Define WebLN interface
interface WebLNProvider {
  enable: () => Promise<void>;
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}

// Define Nostr Lightning interface
interface NostrLightningProvider {
  pay: (paymentRequest: string) => Promise<{ preimage: string }>;
}

// Payment service types
type PaymentProvider = 'webln' | 'nostr' | 'nip47' | 'none';

interface PaymentService {
  provider: PaymentProvider;
  available: boolean;
  pay: (invoice: string) => Promise<{ preimage: string }>;
}

/**
 * Get an appropriate payment service based on available providers
 */
export function getPaymentService(): PaymentService {
  // Check if running in browser
  if (typeof window === 'undefined') {
    return {
      provider: 'none',
      available: false,
      pay: async () => {
        throw new Error('Cannot make payments in server environment');
      }
    };
  }

  // Try WebLN first (Alby, Getalby extension, etc.)
  if ('webln' in window) {
    return {
      provider: 'webln',
      available: true,
      pay: async (invoice: string) => {
        try {
          const webln = (window as any).webln as WebLNProvider;
          await webln.enable();
          const result = await webln.sendPayment(invoice);
          return { preimage: result.preimage || 'unknown-preimage' };
        } catch (error) {
          console.error('WebLN payment failed:', error);
          throw error;
        }
      }
    };
  }

  // Try Nostr extension with Lightning capabilities
  if ((window as any).nostr && 'lightning' in (window as any).nostr) {
    return {
      provider: 'nostr',
      available: true,
      pay: async (invoice: string) => {
        try {
          const lightning = (window as any).nostr.lightning as NostrLightningProvider;
          const result = await lightning.pay(invoice);
          return { preimage: result.preimage || 'unknown-preimage' };
        } catch (error) {
          console.error('Nostr Lightning payment failed:', error);
          throw error;
        }
      }
    };
  }

  // No available payment methods
  return {
    provider: 'none',
    available: false,
    pay: async () => {
      throw new Error('No Lightning payment provider available');
    }
  };
} 