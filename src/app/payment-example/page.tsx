'use client';

import React, { useState } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import { NostrPayment } from '@/components/NostrPayment';

export default function PaymentExamplePage() {
  const { user, loginMethod } = useNostr();
  const [invoice, setInvoice] = useState<string>('');
  const [amount, setAmount] = useState<string>('1000');
  const [description, setDescription] = useState<string>('Test Payment');
  const [showPayment, setShowPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<string | null>(null);
  
  // Handle success
  const handlePaymentSuccess = (preimage: string) => {
    console.log('Payment successful with preimage:', preimage);
    setPaymentResult(`Payment successful! Preimage: ${preimage.substring(0, 8)}...`);
    // In a real application, you would update the order status or redirect to a success page
  };
  
  // Handle error
  const handlePaymentError = (error: Error) => {
    console.error('Payment failed:', error);
    setPaymentResult(`Payment failed: ${error.message}`);
    // In a real application, you might want to show a retry option or alternative payment method
  };
  
  // Handle cancel
  const handlePaymentCancel = () => {
    console.log('Payment cancelled');
    setShowPayment(false);
    // In a real application, you might want to return to the checkout page
  };
  
  // Generate a demo Lightning invoice
  const generateDemoInvoice = () => {
    // This is a fake invoice for demonstration purposes
    // In a real application, you would use a Lightning service to generate a real invoice
    const fakeInvoice = 'lnbc10m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaqnqsfcq0d4jq3n3q0jaunt4qz7zs0gyaqyfz8yrtfd6cm9a3t3kxzwfjuj3hxxecpda9qxdhp8p0nyumz2vzjzle60e4g9ekrdffr9znscdhvugz';
    setInvoice(fakeInvoice);
    return fakeInvoice;
  };
  
  // Start payment process
  const startPayment = () => {
    // Generate an invoice if one doesn't exist
    const currentInvoice = invoice || generateDemoInvoice();
    setShowPayment(true);
    setPaymentResult(null);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Nostr Payment Example</h1>
      
      {!user ? (
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-100 p-4 rounded mb-6">
          <p className="font-medium">Please log in to test the payment functionality.</p>
          <p className="text-sm mt-2">Use the Nostr login button in the bottom right corner.</p>
        </div>
      ) : loginMethod === 'viewonly' ? (
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-100 p-4 rounded mb-6">
          <p className="font-medium">You are in view-only mode.</p>
          <p className="text-sm mt-2">Please log in with a NIP-07 extension or NIP-47 remote signer to test payments.</p>
        </div>
      ) : (
        <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-800 dark:text-green-100 p-4 rounded mb-6">
          <p className="font-medium">You are logged in with {loginMethod === 'nip07' ? 'a browser extension' : 'a remote signer'}.</p>
          <p className="text-sm mt-2">You can now test the payment functionality.</p>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Payment Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount (sats)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Enter amount in satoshis"
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Enter payment description"
            />
          </div>
          
          <div>
            <label htmlFor="invoice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lightning Invoice (optional)
            </label>
            <textarea
              id="invoice"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Enter a Lightning invoice or leave empty to generate a demo one"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If left empty, a fake invoice will be generated for demonstration.
            </p>
          </div>
          
          <div>
            <button
              onClick={startPayment}
              disabled={!user || loginMethod === 'viewonly'}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Payment Demo
            </button>
          </div>
        </div>
      </div>
      
      {paymentResult && (
        <div className={`mb-6 p-4 rounded ${paymentResult.includes('failed') ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100' : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'}`}>
          <p>{paymentResult}</p>
        </div>
      )}
      
      {showPayment && (
        <div className="mt-8">
          <NostrPayment
            invoice={invoice}
            amount={amount}
            description={description}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={handlePaymentCancel}
          />
        </div>
      )}
      
      <div className="mt-8 bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-2">How It Works</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          This example demonstrates how to integrate Nostr-based Lightning payments into your application:
        </p>
        <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-2">
          <li>User logs in with a Nostr wallet (NIP-07 extension or NIP-47 remote signer)</li>
          <li>Application generates a Lightning invoice</li>
          <li>Payment component connects to the user's wallet</li>
          <li>User confirms the payment in their wallet</li>
          <li>Application verifies the payment and updates the UI</li>
        </ol>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">
          In a real application, you would integrate with a Lightning service to generate valid invoices and verify payments.
        </p>
      </div>
    </div>
  );
} 