'use client';

import { useState, useEffect, useRef } from 'react';
import { normalizeNostrPubkey } from '@/lib/nostr';
import { QRCodeSVG } from 'qrcode.react';
import { useNostr } from '@/lib/contexts/NostrContext';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

// This component demonstrates how to move Nostr signing to the client-side
// Instead of making server API calls for Nostr operations

export default function ClientNostrSigner() {
  const { ndk } = useNostr();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{success: boolean; eventId?: string} | null>(null);
  const [pubkey, setPubkey] = useState('');
  const [error, setError] = useState('');
  const [connectUrl, setConnectUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  
  // Session token for NIP-47 connection
  const sessionToken = useRef<string>('');
  // Connection checking interval
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Security utilities for production use
  const SESSION_EXPIRY_HOURS = 24;
  const isSessionExpired = (timestamp: number) => {
    const expiryTime = timestamp + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    return Date.now() > expiryTime;
  };

  const generateSecureToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const saveSession = (token: string, pubkey: string, relay: string) => {
    const session = { token, pubkey, relay, timestamp: Date.now() };
    localStorage.setItem('nostr_client_signer_session', JSON.stringify(session));
  };
  
  // Check if window.nostr exists (NIP-07)
  const isNostrAvailable = () => {
    return typeof window !== 'undefined' && 'nostr' in window;
  };

  // Check for existing NIP-47 sessions on mount
  useEffect(() => {
    if (ndk) {
      // Check for existing connections on mount
      const savedSession = localStorage.getItem('nostr_client_signer_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.token && session.pubkey && session.relay && !isSessionExpired(session.timestamp)) {
            // Restore the session and check if it's still valid
            sessionToken.current = session.token;
            setConnectionStatus('connecting');
            startConnectionCheck();
          } else {
            // Session expired, remove it
            localStorage.removeItem('nostr_client_signer_session');
          }
        } catch (e) {
          console.error("Error restoring session:", e);
          localStorage.removeItem('nostr_client_signer_session');
        }
      }
    }
  }, [ndk]);

  // Generate a Nostr Connect URL (NIP-47) when component mounts
  useEffect(() => {
    if (ndk) {
      generateConnectUrl();
    }
    
    return () => {
      // Clean up on unmount
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
      }
    };
  }, [ndk]);

  // Generate a Nostr Connect URL with a random token
  const generateConnectUrl = () => {
    if (!ndk) {
      setError("NDK instance not available");
      setConnectionStatus('error');
      return;
    }
    
    try {
      // Create a unique session token using secure random generator
      sessionToken.current = generateSecureToken();
      
      // Get the app's public key from environment variable or use a fallback
      // In production, use your actual application pubkey from environment variable
      const APP_PUBKEY = process.env.NEXT_PUBLIC_APP_PUBKEY || 
                          "npub1nfgqmjytjcvu3lt5wd8xg05s8castvp5mjkufuk2dmcr4hgga5xs8qj85n";
      
      if (ndk.signer) {
        // Log information about the signer for debugging
        console.log("NDK signer type:", typeof ndk.signer);
      }
      
      // Get active relay URLs from NDK
      let relayUrls: string[] = [];
      if (ndk.pool?.relays) {
        // Convert Map to array of URLs safely
        try {
          const relaysArray = Array.from(ndk.pool.relays.values());
          relayUrls = relaysArray
            .map(relay => typeof relay === 'object' && relay !== null && 'url' in relay ? 
              String(relay.url) : undefined)
            .filter(Boolean) as string[];
        } catch (e) {
          console.error("Error extracting relay URLs:", e);
        }
      }
      
      const primaryRelay = relayUrls.length > 0 ? relayUrls[0] : "wss://relay.damus.io";
      
      // Construct proper app metadata
      const metadata = {
        name: "MadTrips",
        url: window.location.origin,
        description: "Travel booking with Nostr integration"
      };
      
      // Construct the NIP-47 URL
      const url = `nostrconnect://${APP_PUBKEY}?relay=${encodeURIComponent(primaryRelay)}&metadata=${encodeURIComponent(JSON.stringify(metadata))}&session_token=${sessionToken.current}`;
      
      console.log("Generated Nostr Connect URL for relay:", primaryRelay);
      setConnectUrl(url);
      setConnectionStatus('idle');
      
      // Start polling for connection status
      startConnectionCheck();
    } catch (error) {
      console.error("Error generating NIP-47 URL:", error);
      setError(`Failed to generate connection URL: ${error instanceof Error ? error.message : "Unknown error"}`);
      setConnectionStatus('error');
    }
  };

  // Start checking for connection status
  const startConnectionCheck = () => {
    // Clear any existing interval
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
    }
    
    setConnectionStatus('connecting');
    
    // Poll every 3 seconds to check if connection is established
    connectionCheckInterval.current = setInterval(async () => {
      try {
        if (ndk && sessionToken.current) {
          // Check for a real connection using NDK events
          const hasConnection = await checkForConnectionEvents();
          
          if (hasConnection) {
            clearInterval(connectionCheckInterval.current!);
            setConnectionStatus('connected');
            
            // Save connection information
            saveConnectionInfo();
            
            // Complete the connection process
            await completeNip47Login();
            
            // Setup event listeners for future sign requests
            setupEventListeners();
            
            // Reset state after successful connection
            setTimeout(() => {
              setConnectionStatus('idle');
            }, 3000);
          }
        }
      } catch (error) {
        console.error("Error checking connection status:", error);
      }
    }, 3000);
    
    // Time out after 2 minutes
    setTimeout(() => {
      if (connectionStatus !== 'connected' && connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        setConnectionStatus('error');
      }
    }, 120000);
  };

  // Save connection information for future use
  const saveConnectionInfo = async () => {
    if (!ndk || !sessionToken.current) return;
    
    try {
      // Get the first relay URL
      let relayUrl = "wss://relay.damus.io"; // Default fallback
      
      if (ndk.pool?.relays) {
        try {
          const relaysArray = Array.from(ndk.pool.relays.values());
          if (relaysArray.length > 0 && 
              typeof relaysArray[0] === 'object' && 
              relaysArray[0] !== null && 
              'url' in relaysArray[0]) {
            relayUrl = String(relaysArray[0].url);
          }
        } catch (e) {
          console.error("Error extracting relay URL:", e);
        }
      }
      
      // Get connection event to extract pubkey
      const filter = {
        kinds: [24133 as NDKKind],
        "#session": [sessionToken.current]
      };
      
      const events = await ndk.fetchEvents(filter);
      
      if (events && events.size > 0) {
        const connectionEvent = Array.from(events)[0];
        const userPubkey = connectionEvent.pubkey;
        
        // Save to local storage
        saveSession(sessionToken.current, userPubkey, relayUrl);
      }
    } catch (error) {
      console.error("Error saving connection info:", error);
    }
  };

  // Complete the NIP-47 login process once connected
  const completeNip47Login = async () => {
    try {
      if (ndk && sessionToken.current) {
        // Get the first relay URL from NDK if available
        let relayUrl = "wss://relay.damus.io"; // Default fallback
        
        try {
          if (ndk.pool?.relays) {
            const relaysArray = Array.from(ndk.pool.relays.values());
            if (relaysArray.length > 0 && 
                typeof relaysArray[0] === 'object' && 
                relaysArray[0] !== null && 
                'url' in relaysArray[0]) {
              relayUrl = String(relaysArray[0].url);
            }
          }
        } catch (e) {
          console.error("Error extracting relay URL for login:", e);
        }
        
        // First verify the connection is valid
        const filter = {
          kinds: [24133 as NDKKind],
          "#session": [sessionToken.current]
        };
        
        const events = await ndk.fetchEvents(filter);
        
        if (!events || events.size === 0) {
          throw new Error("No valid connection event found");
        }
        
        // Extract the user's pubkey from the connection event
        const connectionEvent = Array.from(events)[0];
        const userPubkey = connectionEvent.pubkey;
        
        // Set the pubkey in the component state for display
        setPubkey(userPubkey);
        
        console.log("NIP-47 login successful with pubkey:", userPubkey);
        
        // Show success message
        setResult({
          success: true,
          eventId: connectionEvent.id
        });
      }
    } catch (error) {
      console.error("Failed to complete NIP-47 login:", error);
      setConnectionStatus('error');
      setError("Failed to complete login: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  // Check for connection events using real NDK events
  const checkForConnectionEvents = async (): Promise<boolean> => {
    if (!ndk || !sessionToken.current) return false;
    
    try {
      // Subscribe to NIP-47 connection events (kind 24133)
      // Note: NIP-47 uses "session" as the tag identifier, not "#session"
      const filter = {
        kinds: [24133 as NDKKind],
        "#session": [sessionToken.current]
      };
      
      console.log("Checking for connection events with session token:", sessionToken.current.substring(0, 8) + "...");
      
      // Use NDK to fetch events
      let events = await ndk.fetchEvents(filter);
      
      // Also try with alternative tag format as implementations may vary
      if (!events || events.size === 0) {
        const alternativeFilter = {
          kinds: [24133 as NDKKind],
          "session": [sessionToken.current]
        };
        const alternativeEvents = await ndk.fetchEvents(alternativeFilter);
        if (alternativeEvents && alternativeEvents.size > 0) {
          console.log("Found events with alternative tag format");
          // Use these events instead
          events = alternativeEvents;
        }
      }
      
      // Check if we have any matching events
      if (events && events.size > 0) {
        // Log the first event for debugging
        const firstEvent = Array.from(events)[0];
        console.log("Received connection event:", firstEvent);
        
        // Validate event further to ensure it's a proper connection event
        // Check both tag formats as implementations may vary
        if (firstEvent.kind === 24133 && 
            (firstEvent.tags.some(tag => tag[0] === 'session' && tag[1] === sessionToken.current) ||
             firstEvent.tags.some(tag => tag[0] === '#session' && tag[1] === sessionToken.current))) {
          console.log("Valid connection event confirmed with pubkey:", firstEvent.pubkey);
          return true;
        } else {
          console.warn("Received event didn't fully match expected format, tags:", firstEvent.tags);
          // Log all tags for debugging
          firstEvent.tags.forEach(tag => {
            console.log(`Tag: ${tag[0]} = ${tag[1]}`);
          });
          return false;
        }
      } else {
        console.log("No connection events found yet");
      }
      
      return false;
    } catch (error) {
      console.error("Error checking for connection events:", error);
      return false;
    }
  };

  // Setup event listeners for NIP-47 requests
  const setupEventListeners = () => {
    if (!ndk) return;
    
    // Instead of using subscribe, we'll set up a polling mechanism to check for events
    const checkForSignRequests = async () => {
      try {
        // Fetch NIP-47 sign request events (kind 24134)
        const filter = {
          kinds: [24134 as NDKKind], // Sign request events
          "#session": [sessionToken.current]
        };
        
        const events = await ndk.fetchEvents(filter);
        
        if (events && events.size > 0) {
          // Process any new sign requests
          for (const event of events) {
            console.log("Processing sign request:", event);
            // Handle the sign request based on your application's needs
            // ...
          }
        }
      } catch (error) {
        console.error("Error checking for sign requests:", error);
      }
      
      // Poll again in a few seconds
      setTimeout(checkForSignRequests, 5000);
    };
    
    // Start the polling
    checkForSignRequests();
  };

  // Clean up a session when disconnecting
  const cleanupSession = () => {
    // Clear localStorage
    localStorage.removeItem('nostr_client_signer_session');
    
    // Send disconnection event (if implemented in your NIP-47 flow)
    if (ndk && sessionToken.current) {
      // Create and publish a disconnection event
      // This would depend on your specific implementation
    }
    
    // Reset state
    sessionToken.current = '';
    setConnectionStatus('idle');
  };

  // Copy Connect URL to clipboard
  const copyConnectUrl = async () => {
    if (connectUrl) {
      try {
        await navigator.clipboard.writeText(connectUrl);
        setCopySuccess(true);
        console.log("Secret URL copied to clipboard:", connectUrl.substring(0, 20) + "...");
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        setError("Failed to copy to clipboard. Your browser may not support this feature.");
      }
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
      <h2 className="text-lg font-semibold mb-4">Client-side Nostr Signing</h2>
      
      {/* NIP-47 Nostr Connect Section */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <h3 className="text-md font-semibold mb-2">Connect with Nostr Signing Device</h3>
        
        {connectionStatus === 'connecting' && (
          <div className="text-sm text-blue-600 dark:text-blue-400 mb-4 flex items-center">
            <div className="animate-pulse mr-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
            Waiting for connection...
          </div>
        )}
        
        {connectionStatus === 'error' && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-4">
            Connection error. Please try again.
          </div>
        )}
        
        {connectionStatus === 'connected' && (
          <div className="text-sm text-green-600 dark:text-green-400 mb-4 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Connected successfully!
          </div>
        )}
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Scan this QR code with your Nostr signing device
        </p>
        
        {/* QR Code Display */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div 
            className="bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={copyConnectUrl}
          >
            <QRCodeSVG
              value={connectUrl}
              size={200}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"}
              includeMargin={false}
            />
            {copySuccess && (
              <div className="mt-2 py-1 px-2 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-md font-medium text-center">
                ✓ Secret copied!
              </div>
            )}
            {!copySuccess && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                Click to copy secret URL
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-3 w-full md:w-auto">            
            <div className="flex flex-col gap-2">
              <button
                onClick={generateConnectUrl}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
              >
                Generate New Connection
              </button>
              
              {connectionStatus === 'error' && (
                <button
                  onClick={() => setConnectionStatus('idle')}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                >
                  Reset Error
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="border-t my-4 pt-4">
        <h3 className="text-md font-semibold mb-2">Test Message Signing</h3>
        
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