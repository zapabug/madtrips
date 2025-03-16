'use client';

import React, { useState } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { LightningPaymentButton } from '../../components/LightningPaymentButton';

/**
 * This component demonstrates the Nostr payment integration features
 * You can use this in your app to test the payment flow
 */
export default function NostrIntegrationTest() {
  const { user, loading, loginMethod, canMakePayments } = useNostr();
  const [invoice, setInvoice] = useState<string>('');
  const [paymentResult, setPaymentResult] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoice(e.target.value);
  };

  const handlePaymentSuccess = (preimage: string) => {
    setPaymentResult(`Payment successful! Preimage: ${preimage}`);
    setPaymentError(null);
  };

  const handlePaymentError = (error: Error) => {
    setPaymentError(`Payment failed: ${error.message}`);
    setPaymentResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Nostr Payment Integration Test</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Connection Status</h2>
        
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : user ? (
          <div className="space-y-2">
            <p className="text-green-500 font-medium">
              ✅ Connected as: {user.profile?.displayName || user.profile?.name || user.npub}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Login Method: <span className="font-medium">{loginMethod}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Payment Capable: 
              <span className={`font-medium ${canMakePayments ? 'text-green-500' : 'text-red-500'}`}>
                {canMakePayments ? ' Yes' : ' No'}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-amber-500">
            Not connected. Please log in using the Nostr login button.
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Lightning Payment Test</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="invoice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lightning Invoice (BOLT11)
            </label>
            <input
              type="text"
              id="invoice"
              value={invoice}
              onChange={handleInvoiceChange}
              placeholder="lnbc..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter a Lightning invoice to test the payment process.
            </p>
          </div>

          <div className="flex justify-center">
            <LightningPaymentButton 
              invoice={invoice}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              buttonText="Pay Lightning Invoice"
            />
          </div>

          {paymentResult && (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-md text-green-800 dark:text-green-200">
              {paymentResult}
            </div>
          )}

          {paymentError && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-200">
              {paymentError}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Integration Notes</h2>
        
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <p>
            <strong>NIP-07 Extension Users:</strong> Most browser extensions like Alby or nos2x don't directly 
            support the payment method, so you'll need to use a NIP-47 signer.
          </p>
          
          <p>
            <strong>NIP-47 Signers:</strong> To test payments, you need a remote signer that supports the 
            <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">pay_invoice</code> method.
          </p>
          
          <p>
            <strong>View-Only Mode:</strong> Payment functionality is disabled in view-only mode.
          </p>
          
          <p className="font-medium">
            This implementation follows the <a href="https://github.com/nostr-protocol/nips/blob/master/47.md" 
            className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">NIP-47 specification</a> 
            and is compatible with wallets that support the Nostr Wallet Connect protocol.
          </p>
        </div>
      </div>
    </div>
  );
} 