import { PaymentMethod } from '../../types/cart-types';

interface LNURLPaymentResponse {
  pr: string; // Payment request (invoice)
  routes: string[];
  status: string;
  successAction?: {
    tag: string;
    message: string;
  };
}

interface PaymentStatusResponse {
  paid: boolean;
  preimage?: string;
  details?: {
    bolt11: string;
    payment_hash: string;
  };
}

export class LightningPaymentService {
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(apiEndpoint: string, apiKey: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  /**
   * Create a new Lightning invoice
   * @param amount Amount in sats
   * @param description Payment description
   * @returns Promise with payment details
   */
  async createInvoice(amount: number, description: string): Promise<{
    paymentRequest: string;
    paymentHash: string;
  }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          out: false,
          amount,
          memo: description,
          unit: 'sat',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const data = await response.json();
      return {
        paymentRequest: data.payment_request,
        paymentHash: data.payment_hash,
      };
    } catch (error) {
      console.error('Failed to create Lightning invoice:', error);
      throw error;
    }
  }

  /**
   * Check the status of a payment
   * @param paymentHash Payment hash to check
   * @returns Promise with payment status
   */
  async checkPaymentStatus(paymentHash: string): Promise<PaymentStatusResponse> {
    try {
      const response = await fetch(
        `${this.apiEndpoint}/api/v1/payments/${paymentHash}`,
        {
          headers: {
            'X-Api-Key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }

      const data = await response.json();
      return {
        paid: data.paid,
        preimage: data.preimage,
        details: {
          bolt11: data.bolt11,
          payment_hash: data.payment_hash,
        },
      };
    } catch (error) {
      console.error('Failed to check payment status:', error);
      throw error;
    }
  }

  /**
   * Create a LNURL-pay link
   * @param amount Amount in sats
   * @param description Payment description
   * @returns Promise with LNURL payment details
   */
  async createLNURLPayment(
    amount: number,
    description: string
  ): Promise<LNURLPaymentResponse> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/v1/lnurl/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          description,
          amount,
          comment_chars: 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create LNURL payment');
      }

      return response.json();
    } catch (error) {
      console.error('Failed to create LNURL payment:', error);
      throw error;
    }
  }

  /**
   * Pay a Lightning invoice
   * @param paymentRequest BOLT11 invoice to pay
   * @returns Promise with payment result
   */
  async payInvoice(paymentRequest: string): Promise<{
    paid: boolean;
    preimage?: string;
  }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          out: true,
          bolt11: paymentRequest,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pay invoice');
      }

      const data = await response.json();
      return {
        paid: true,
        preimage: data.preimage,
      };
    } catch (error) {
      console.error('Failed to pay invoice:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   * @returns Promise with wallet balance in sats
   */
  async getWalletBalance(): Promise<number> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/v1/wallet`, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get wallet balance');
      }

      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      throw error;
    }
  }
}

// Create a singleton instance
let lightningServiceInstance: LightningPaymentService | null = null;

/**
 * Get or create the Lightning payment service instance
 */
export const getLightningService = (
  apiEndpoint: string,
  apiKey: string
): LightningPaymentService => {
  if (!lightningServiceInstance) {
    lightningServiceInstance = new LightningPaymentService(apiEndpoint, apiKey);
  }
  return lightningServiceInstance;
}; 