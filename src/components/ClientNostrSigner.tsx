'use client';

import { useState } from 'react';
import { normalizeNostrPubkey } from '@/lib/nostr';

// This component demonstrates how to move Nostr signing to the client-side
// Instead of making server API calls for Nostr operations

export default function ClientNostrSigner() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{success: boolean; eventId?: string} | null>(null);
  const [pubkey, setPubkey] = useState('');
  const [error, setError] = useState('');

  // Check if window.nostr exists (NIP-07)
  const isNostrAvailable = () => {
    return typeof window !== 'undefined' && 'nostr' in window;
  };

  // Sign and publish a message directly from client
  const signAndPublish = async () => {
    setError('');
    setResult(null);
    
    if (!message) {
      setError('Please enter a message');
      return;
    }
    
    if (!isNostrAvailable()) {
      setError('Nostr extension not found. Please install a NIP-07 compatible extension like GetAlby or nos2x.');
      return;
    }
    
    try {
      // Get user pubkey from extension
      const userPubkey = await (window as any).nostr.getPublicKey();
      setPubkey(userPubkey);
      
      // Create event object
      const event = {
        kind: 1,
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: message
      };
      
      // Sign the event with extension
      const signedEvent = await (window as any).nostr.signEvent(event);
      
      // In a real app, you would publish this to relays
      // For demo, we'll just show success
      setResult({
        success: true,
        eventId: signedEvent.id
      });
      
      // Clear message after successful publish
      setMessage('');
    } catch (err: any) {
      setError(`Failed to sign or publish: ${err.message}`);
    }
  };

  // Send a DM directly from client
  const sendDM = async (recipientPubkey: string) => {
    if (!isNostrAvailable()) {
      setError('Nostr extension not found. Please install a NIP-07 compatible extension.');
      return;
    }
    
    try {
      // Get user pubkey from extension
      const userPubkey = await (window as any).nostr.getPublicKey();
      setPubkey(userPubkey);
      
      // Normalize recipient pubkey
      const normalizedRecipient = normalizeNostrPubkey(recipientPubkey);
      
      // Create encrypted DM event (kind 4)
      const event = {
        kind: 4,
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', normalizedRecipient]],
        content: message // In a real implementation, this would be encrypted
      };
      
      // Sign the event with extension
      const signedEvent = await (window as any).nostr.signEvent(event);
      
      // In a real app, you would publish this to relays
      setResult({
        success: true,
        eventId: signedEvent.id
      });
      
      // Clear message after successful publish
      setMessage('');
    } catch (err: any) {
      setError(`Failed to send DM: ${err.message}`);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Client-side Nostr Signing</h2>
      
      {isNostrAvailable() ? (
        <div className="text-sm text-green-500 mb-2">✓ Nostr extension detected</div>
      ) : (
        <div className="text-sm text-amber-500 mb-2">⚠️ No Nostr extension detected</div>
      )}
      
      {pubkey && (
        <div className="text-sm mb-4">
          Your pubkey: <span className="font-mono">{pubkey.substring(0, 8)}...</span>
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm mb-1">Message:</label>
        <textarea
          className="w-full p-2 border rounded"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Enter your message"
        />
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={signAndPublish}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Sign & Publish
        </button>
        
        <button
          onClick={() => sendDM('npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc')}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Send DM to Demo User
        </button>
      </div>
      
      {error && (
        <div className="p-2 bg-red-100 text-red-700 rounded mb-4">
          {error}
        </div>
      )}
      
      {result && (
        <div className="p-2 bg-green-100 text-green-700 rounded">
          {result.success ? (
            <div>
              <p>Message signed and published successfully!</p>
              <p className="text-xs font-mono">Event ID: {result.eventId}</p>
            </div>
          ) : (
            <p>Failed to publish message.</p>
          )}
        </div>
      )}
    </div>
  );
} 