'use client';

import { useState, useEffect } from 'react';
import { normalizeNostrPubkey } from '@/lib/nostr';
import { QRCodeSVG } from 'qrcode.react';
import { useNostr } from '@/lib/contexts/NostrContext';

// This component demonstrates how to move Nostr signing to the client-side
// Instead of making server API calls for Nostr operations

export default function ClientNostrSigner() {
  const { user, login, loginMethod } = useNostr();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{success: boolean; eventId?: string} | null>(null);
  const [pubkey, setPubkey] = useState('');
  const [error, setError] = useState('');
  const [connectUrl, setConnectUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  // Check if window.nostr exists (NIP-07)
  const isNostrAvailable = () => {
    return typeof window !== 'undefined' && 'nostr' in window;
  };

  // Generate a Nostr Connect URL (NIP-47) when component mounts
  useEffect(() => {
    if (!user && loginMethod !== 'nip47') {
      generateConnectUrl();
    }
  }, [user, loginMethod]);

  // Generate a Nostr Connect URL with a random token
  const generateConnectUrl = () => {
    // Create a unique session token (in a real app, you'd want to store this)
    const token = crypto.randomUUID();
    
    // Generate a proper NIP-47 URL (nostrconnect://<pubkey>?relay=wss://...)
    // This is a placeholder - in a real app you'd use your app's pubkey
    const appPubkey = 'npub1example00000000000000000000000000000000000000000000';
    const relayUrl = 'wss://relay.example.com';
    
    // Construct the NIP-47 URL
    const url = `nostrconnect://${appPubkey}?relay=${encodeURIComponent(relayUrl)}&metadata=${encodeURIComponent(JSON.stringify({
      name: "MadTrips App",
      url: "https://madtrips.example.com",
      description: "Travel booking with Nostr"
    }))}&session_token=${token}`;
    
    setConnectUrl(url);
  };

  // Handle NIP-47 login
  const handleNip47Login = async () => {
    try {
      await login('nip47', { target: connectUrl });
      setShowQR(false);
    } catch (error) {
      console.error("Failed to login with NIP-47:", error);
      setError("NIP-47 login failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  // Copy Connect URL to clipboard
  const copyConnectUrl = () => {
    if (connectUrl) {
      navigator.clipboard.writeText(connectUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
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
      <h2 className="text-lg font-semibold mb-4">Nostr Signing</h2>
      
      {/* NIP-47 Nostr Connect Section */}
      {!user && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="text-md font-semibold mb-2">Connect with Nostr Signing Device</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Scan this QR code with your Nostr signing device or copy the connection URL
          </p>
          
          {/* QR Code Display */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <QRCodeSVG
                value={connectUrl}
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"L"}
                includeMargin={false}
              />
            </div>
            
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                <div className="font-semibold mb-1">Connection URL:</div>
                <div className="font-mono text-xs break-all">
                  {connectUrl.substring(0, 45)}...
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={copyConnectUrl}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                >
                  {copySuccess ? 'Secret Copied!' : 'Copy Secret'}
                </button>
                
                <button
                  onClick={handleNip47Login}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Message Signing Section - Only show when logged in */}
      {user && (
        <div className="border-t my-4 pt-4">
          <h3 className="text-md font-semibold mb-2">Message Signing</h3>
          
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
        </div>
      )}
      
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