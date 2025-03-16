'use client';

import React, { useState } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import { LightningPaymentButton } from './LightningPaymentButton';
import { QRCodeSVG } from 'qrcode.react';

interface PackagePaymentProps {
  packageName: string;
  packagePrice: number;
  invoice: string;
  onPaymentSuccess: () => void;
  onPaymentFailed: (error: Error) => void;
}

export const PackagePayment: React.FC<PackagePaymentProps> = ({
  packageName,
  packagePrice,
  invoice,
  onPaymentSuccess,
  onPaymentFailed,
}) => {
  const { user, canMakePayments } = useNostr();
  const [showQR, setShowQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Function to copy invoice to clipboard
  const copyInvoiceToClipboard = () => {
    navigator.clipboard.writeText(invoice);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Render a QR code for the invoice if needed
  const renderInvoiceQR = () => {
    if (!showQR) return null;

    return (
      <div className="mt-4 p-4 bg-white rounded-lg flex flex-col items-center">
        <p className="text-sm text-gray-500 mb-2">Scan with your Lightning wallet</p>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <QRCodeSVG
            value={invoice}
            size={200}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"L"}
            includeMargin={false}
          />
        </div>
        <button
          onClick={() => setShowQR(false)}
          className="mt-3 text-blue-500 text-sm hover:underline"
        >
          Hide QR
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-bold mb-4">Payment for {packageName}</h3>
      
      <div className="mb-4">
        <p className="text-gray-700 dark:text-gray-300">
          Amount: <span className="font-bold">{packagePrice.toLocaleString()} sats</span>
        </p>
      </div>

      <div className="flex flex-col space-y-4">
        {/* Lightning Payment Button */}
        <div className="flex flex-col items-center w-full">
          <LightningPaymentButton
            invoice={invoice}
            onSuccess={(preimage) => {
              console.log('Payment successful with preimage:', preimage);
              onPaymentSuccess();
            }}
            onError={onPaymentFailed}
            buttonText="Pay with Lightning"
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-medium flex items-center justify-center w-full max-w-sm"
          />
        </div>

        {/* Payment Options */}
        <div className="flex justify-center space-x-4 mt-2">
          {/* Show QR Option */}
          {!showQR ? (
            <button
              onClick={() => setShowQR(true)}
              className="text-blue-500 text-sm hover:underline flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 010 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h3a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h3a1 1 0 110 2H4a1 1 0 01-1-1zm10-12a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm0 6a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm0 6a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z" clipRule="evenodd"></path>
              </svg>
              Show QR Code
            </button>
          ) : null}

          {/* Copy Invoice */}
          <button
            onClick={copyInvoiceToClipboard}
            className="text-blue-500 text-sm hover:underline flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
            </svg>
            {copySuccess ? 'Copied!' : 'Copy Invoice'}
          </button>
        </div>

        {renderInvoiceQR()}

        {/* Additional Information */}
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>
            This payment is processed through your Nostr wallet.
            {!user && " Please log in to continue."}
            {user && !canMakePayments && " Your current login method doesn't support payments. Please switch to a NIP-47 wallet."}
          </p>
        </div>
      </div>
    </div>
  );
}; 