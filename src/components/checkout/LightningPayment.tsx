import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface LightningPaymentProps {
  amount: number;
  description: string;
  onPaymentComplete: (preimage: string) => void;
  onPaymentError: (error: string) => void;
}

export const LightningPayment: React.FC<LightningPaymentProps> = ({
  amount,
  description,
  onPaymentComplete,
  onPaymentError,
}) => {
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create payment request on mount
  useEffect(() => {
    const createPayment = async () => {
      try {
        const response = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            description,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment');
        }

        const data = await response.json();
        setPaymentRequest(data.payment_request);
        setPaymentHash(data.payment_hash);
      } catch (error) {
        console.error('Failed to create payment:', error);
        setError('Failed to create payment request');
        onPaymentError('Failed to create payment request');
      }
    };

    createPayment();
  }, [amount, description, onPaymentError]);

  // Check payment status periodically
  useEffect(() => {
    if (!paymentHash || checking) return;

    const checkStatus = async () => {
      try {
        setChecking(true);
        const response = await fetch(`/api/payments/status/${paymentHash}`);

        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }

        const data = await response.json();

        if (data.paid) {
          // Payment complete
          onPaymentComplete(data.preimage || '');
          return true;
        }

        return false;
      } catch (error) {
        console.error('Failed to check payment status:', error);
        return false;
      } finally {
        setChecking(false);
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 2 seconds
    const interval = setInterval(async () => {
      const paid = await checkStatus();
      if (paid) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [paymentHash, checking, onPaymentComplete]);

  // Handle copy to clipboard
  const copyToClipboard = async () => {
    if (!paymentRequest) return;

    try {
      await navigator.clipboard.writeText(paymentRequest);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  if (!paymentRequest) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F7931A]" />
      </div>
    );
  }

  return (
    <div className="lightning-payment bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium mb-2">Lightning Payment</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Scan the QR code or click to copy invoice
        </p>
      </div>

      {/* QR Code */}
      <div 
        className="flex justify-center mb-4 cursor-pointer" 
        onClick={copyToClipboard}
      >
        <div className="bg-white p-2 rounded-lg">
          <QRCodeSVG 
            value={paymentRequest} 
            size={200}
            level="M"
            includeMargin={true}
          />
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={copyToClipboard}
        className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors mb-4"
      >
        Copy Invoice
      </button>

      {/* Amount */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Amount:</p>
        <p className="text-lg font-bold text-[#F7931A]">{amount} sats</p>
      </div>

      {checking && (
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Checking payment status...
        </div>
      )}
    </div>
  );
}; 