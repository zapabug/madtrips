'use client';

import React, { useState, useEffect } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import { getPaymentService } from '@/lib/services/PaymentService';

// Define WebLN interface directly in this file
interface WebLNProvider {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{
    preimage: string;
    paymentHash?: string;
  }>;
}

// Add a type declaration that is specific to this file
declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

interface NostrPaymentProps {
  invoice: string;
  amount: number;
  description: string;
  recipientPubkey: string;
  onSuccess?: (preimage: string) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export const NostrPayment: React.FC<NostrPaymentProps> = ({
  invoice,
  amount,
  description,
  recipientPubkey,
  onSuccess,
  onError,
  onCancel
}) => {
  const { ndk, user, loginMethod } = useNostr();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'paying' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preimage, setPreimage] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [useNutZaps, setUseNutZaps] = useState(false);

  // Check if the user is logged in with NIP-47
  const isNip47 = loginMethod === 'nip47';

  // Effect to handle payment when invoice changes
  useEffect(() => {
    setStatus('idle');
    setError(null);
    setPreimage(null);
  }, [invoice]);

  // Connect to the wallet
  const connectWallet = async () => {
    if (!ndk || !user) {
      setError('You must be logged in to make a payment');
      return;
    }

    try {
      setStatus('connecting');
      
      const paymentService = getPaymentService(ndk);
      
      // If using NIP-47, we can use the existing connection
      if (isNip47) {
        setWalletConnected(true);
        setStatus('idle');
        return;
      }
      
      // For NIP-07, we need to prompt the user
      // NIP-07 doesn't need explicit connection for payments - the browser extension handles it
      if (loginMethod === 'nip07') {
        setWalletConnected(true);
        setStatus('idle');
        return;
      }
      
      // If we're in view-only mode, we can't make payments
      if (loginMethod === 'viewonly') {
        throw new Error('Cannot make payments in view-only mode');
      }
      
      // If no method is detected, show an error
      throw new Error('No compatible payment method detected');
      
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setStatus('error');
    }
  };

  // Process payment
  const processPayment = async () => {
    if (!ndk || !user) {
      setError('You must be logged in to make a payment');
      return;
    }

    try {
      setStatus('paying');
      
      const paymentService = getPaymentService(ndk);
      
      // Check if recipient supports NutZaps
      const supportsNutZaps = await paymentService.checkNutZapSupport(recipientPubkey);
      
      if (isNip47) {
        // Use NIP-47 remote signer
        const result = await paymentService.payInvoice(invoice);
        setPreimage(result.preimage);
        setStatus('success');
        onSuccess?.(result.preimage);
      } else if (supportsNutZaps && useNutZaps) {
        // Use NutZaps if supported and enabled
        const result = await paymentService.sendNutZap(recipientPubkey, amount, description);
        setPreimage(result.preimage);
        setStatus('success');
        onSuccess?.(result.preimage);
      } else if (loginMethod === 'nip07') {
        // Fall back to standard Lightning payment
        if (typeof window !== 'undefined' && window.webln) {
          try {
            await window.webln.enable();
            const result = await window.webln.sendPayment(invoice);
            setPreimage(result.preimage);
            setStatus('success');
            onSuccess?.(result.preimage);
          } catch (weblnError) {
            console.error('WebLN payment failed:', weblnError);
            throw new Error('WebLN payment failed. Please try again.');
          }
        } else {
          throw new Error('Your browser extension does not support WebLN for payments');
        }
      } else {
        throw new Error('No compatible payment method detected');
      }
    } catch (err) {
      console.error('Payment failed:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error('Payment failed'));
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setStatus('idle');
    setError(null);
    onCancel?.();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 max-w-md mx-auto">
      <h3 className="text-lg font-medium mb-3 text-center dark:text-white">Lightning Payment</h3>
      
      <div className="mb-4 text-center">
        <p className="text-2xl font-bold dark:text-white">{amount} sats</p>
        <p className="text-gray-600 dark:text-gray-300">{description}</p>
      </div>
      
      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded">
          <p>Payment successful!</p>
          {preimage && (
            <details className="mt-2">
              <summary className="cursor-pointer">Payment Proof</summary>
              <p className="text-xs mt-1 break-all">{preimage}</p>
            </details>
          )}
        </div>
      )}
      
      <div className="space-y-3">
        {!walletConnected && status !== 'success' ? (
          <button 
            onClick={connectWallet}
            disabled={status === 'connecting'}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center disabled:opacity-50"
          >
            {status === 'connecting' ? (
              <>
                <span className="mr-2 animate-spin">⚡</span>
                Connecting...
              </>
            ) : (
              <>
                <span className="mr-2">⚡</span>
                Connect Wallet
              </>
            )}
          </button>
        ) : status !== 'success' ? (
          <>
            {/* Payment Method Selection */}
            <div className="flex items-center space-x-2 mb-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={useNutZaps}
                  onChange={(e) => setUseNutZaps(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span>Use NutZap (if supported)</span>
              </label>
            </div>

            <button 
              onClick={processPayment}
              disabled={status === 'paying'}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center justify-center disabled:opacity-50"
            >
              {status === 'paying' ? (
                <>
                  <span className="mr-2 animate-spin">⚡</span>
                  Paying...
                </>
              ) : (
                <>
                  <span className="mr-2">⚡</span>
                  Pay with {useNutZaps ? 'NutZap' : 'Lightning'}
                </>
              )}
            </button>
          </>
        ) : null}
        
        {(status === 'idle' || status === 'error') && (
          <button 
            onClick={handleCancel}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md text-sm font-medium"
          >
            Cancel
          </button>
        )}
        
        {status === 'success' && (
          <button 
            onClick={() => {
              setStatus('idle');
              setPreimage(null);
            }}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            Done
          </button>
        )}
      </div>
      
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Powered by Nostr + Lightning
      </div>
    </div>
  );
}; 