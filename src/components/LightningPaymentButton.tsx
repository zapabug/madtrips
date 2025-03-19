'use client';

import React, { useState } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';

interface LightningPaymentButtonProps {
  invoice: string;
  onSuccess?: (preimage: string) => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  className?: string;
}

export const LightningPaymentButton: React.FC<LightningPaymentButtonProps> = ({
  invoice,
  onSuccess,
  onError,
  buttonText = 'Pay with Lightning',
  className = 'px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-medium flex items-center justify-center'
}) => {
  const { user, payInvoice, canMakePayments, loginMethod } = useNostr();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    if (!user) {
      setError('Please log in to make a payment');
      onError?.(new Error('User not logged in'));
      return;
    }

    if (!canMakePayments || !payInvoice) {
      setError(`Payments not supported with current login method (${loginMethod})`);
      onError?.(new Error('Payment method not supported'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await payInvoice(invoice);
      setSuccess(true);
      onSuccess?.(result.preimage);
      console.log('Payment successful!', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown payment error';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      console.error('Payment failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handlePayment}
        disabled={loading || success || !canMakePayments || !user}
        className={`${className} ${loading ? 'opacity-70 cursor-wait' : ''} 
                  ${success ? 'bg-green-500 hover:bg-green-500' : ''} 
                  ${!canMakePayments || !user ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : success ? (
          <>
            <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
            </svg>
            Payment Successful
          </>
        ) : (
          <>
            <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"></path>
            </svg>
            {buttonText}
          </>
        )}
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {!user && (
        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 text-center">
          Please log in to make a payment
        </div>
      )}

      {user && !canMakePayments && (
        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 text-center">
          Your current login method does not support payments. Try using NIP-47 (remote signer).
        </div>
      )}
    </div>
  );
}; 