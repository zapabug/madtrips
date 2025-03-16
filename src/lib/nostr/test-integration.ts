/**
 * NIP-47 Payment Integration Test
 * 
 * This file provides examples of how to use the NIP-47 payment functionality
 * in your application. You can use these examples as a reference for integrating
 * Lightning payments with Nostr in your own components.
 */

import { useNostr } from '@/lib/contexts/NostrContext';
import { getPaymentService } from '@/lib/services/PaymentService';
import { NIP47Client } from '@/lib/nostr/nip47';

/**
 * Example 1: Basic Payment Flow
 * This example demonstrates the basic flow for making a Lightning payment
 * using the NIP-47 protocol.
 */
export const basicPaymentExample = async (invoice: string, ndk: any, remotePubkey: string) => {
  try {
    console.log('Starting basic payment example...');
    
    // 1. Create a NIP-47 client
    const client = new NIP47Client(remotePubkey);
    
    // 2. Connect to the remote signer
    await client.connect();
    console.log('Connected to remote signer');
    
    // 3. Pay the invoice
    const result = await client.payInvoice(invoice);
    console.log('Payment successful:', result);
    
    // 4. Disconnect
    client.disconnect();
    console.log('Disconnected from remote signer');
    
    return result;
  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
};

/**
 * Example 2: Using the PaymentService
 * This example shows how to use the PaymentService for a more robust payment flow
 */
export const paymentServiceExample = async (invoice: string, ndk: any, remotePubkey: string) => {
  try {
    console.log('Starting payment service example...');
    
    // 1. Get the payment service
    const paymentService = getPaymentService(ndk);
    
    // 2. Connect to the remote signer
    await paymentService.connect(remotePubkey);
    console.log('Payment service connected to wallet');
    
    // 3. Get wallet info and balance (optional)
    const walletInfo = await paymentService.getWalletInfo();
    console.log('Wallet info:', walletInfo);
    
    const balance = await paymentService.getBalance();
    console.log('Wallet balance:', balance);
    
    // 4. Pay the invoice
    const result = await paymentService.payInvoice(invoice);
    console.log('Payment successful:', result);
    
    // 5. Disconnect
    await paymentService.disconnect();
    console.log('Payment service disconnected');
    
    return result;
  } catch (error) {
    console.error('Payment service example failed:', error);
    throw error;
  }
};

/**
 * Example 3: React Hook for Payments
 * This is a custom hook that can be used in React components
 */
export const useNostrPayment = () => {
  const { ndk, user, loginMethod } = useNostr();
  
  /**
   * Pay a Lightning invoice
   */
  const payInvoice = async (invoice: string): Promise<{ preimage: string, paymentHash: string }> => {
    if (!ndk || !user) {
      throw new Error('You must be logged in to make a payment');
    }
    
    // Different payment approaches based on login method
    if (loginMethod === 'nip47') {
      // For NIP-47, use the PaymentService
      const paymentService = getPaymentService(ndk);
      return await paymentService.payInvoice(invoice);
    } else if (loginMethod === 'nip07') {
      // For NIP-07, use WebLN if available
      if (typeof window !== 'undefined' && window.webln) {
        try {
          await window.webln.enable();
          const result = await window.webln.sendPayment(invoice);
          return { 
            preimage: result.preimage,
            paymentHash: result.paymentHash || ''
          };
        } catch (error) {
          console.error('WebLN payment failed:', error);
          throw new Error('WebLN payment failed');
        }
      } else {
        throw new Error('Your browser extension does not support WebLN for payments');
      }
    } else {
      throw new Error('No compatible payment method detected');
    }
  };
  
  return {
    payInvoice,
    canPay: !!ndk && !!user && loginMethod !== 'viewonly',
    isNip47: loginMethod === 'nip47',
    isNip07: loginMethod === 'nip07'
  };
};

/**
 * Example 4: Integration with Checkout Process
 * This is an example of how to integrate payments into a checkout process
 */
export const integrationWithCheckout = async (
  invoice: string, 
  orderDetails: any, 
  onSuccess: (receipt: any) => void,
  onError: (error: Error) => void
) => {
  // In a real component, you would use the useNostrPayment hook
  // For this example, we'll simulate it
  const mockNdk = { /* mock NDK instance */ };
  const mockRemotePubkey = 'npub1yourwalletpubkey';
  
  try {
    console.log('Processing checkout payment...');
    console.log('Order details:', orderDetails);
    
    // 1. Get the payment service
    const paymentService = getPaymentService(mockNdk as any);
    
    // 2. Connect to the wallet
    await paymentService.connect(mockRemotePubkey);
    
    // 3. Process the payment
    const result = await paymentService.payInvoice(invoice);
    
    // 4. Create a receipt for the successful payment
    const receipt = {
      orderId: orderDetails.id,
      amount: orderDetails.amount,
      timestamp: new Date().toISOString(),
      paymentProof: result.preimage,
      paymentHash: result.paymentHash
    };
    
    // 5. Call the success callback with the receipt
    onSuccess(receipt);
    
    // 6. Disconnect from the wallet
    await paymentService.disconnect();
    
    return receipt;
  } catch (error) {
    console.error('Checkout payment failed:', error);
    
    // Call the error callback
    onError(error instanceof Error ? error : new Error('Payment failed'));
    throw error;
  }
}; 