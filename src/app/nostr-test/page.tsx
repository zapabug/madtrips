'use client';

import dynamic from 'next/dynamic';

// Use dynamic import with no SSR to avoid hydration issues with client components
const NostrIntegrationTest = dynamic(
  () => import('../../lib/nostr/test-integration'),
  { ssr: false }
);

export default function NostrTestPage() {
  return (
    <div className="container mx-auto">
      <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-900 shadow-md rounded-lg mb-8">
        <h1 className="text-2xl font-bold mb-4">Nostr Payment Integration</h1>
        <p className="mb-4">
          This page demonstrates the MadTrips implementation of NIP-47 payments using Nostr Wallet Connect. 
          The implementation supports making payments via NIP-47-compatible wallets.
        </p>
        <p className="mb-4">
          Key features implemented:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>NIP-47 client for connecting to remote signers</li>
          <li>Lightning invoice payment processing via NIP-47</li>
          <li>Payment capability detection based on login method</li>
          <li>QR code display for manual payments</li>
          <li>Reusable payment components for the booking process</li>
        </ul>
        <p>
          Test integration with various clients and learn how to use the payment system.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Usage Instructions</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-bold">1. Connecting with NIP-47</h3>
            <p>Use a NIP-47 compatible wallet like Alby or nsec.app to connect to your account.</p>
          </div>
          
          <div>
            <h3 className="font-bold">2. Making Payments</h3>
            <p>After connecting, you can pay Lightning invoices directly from your wallet.</p>
          </div>
          
          <div>
            <h3 className="font-bold">3. Testing</h3>
            <p>You can test the payment flow by generating a test invoice and attempting to pay it.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metadata removed - should be in a metadata.ts file or similar 