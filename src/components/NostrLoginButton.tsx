'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNostr } from '@/lib/contexts/NostrContext';
import Image from 'next/image';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

// No global declarations needed, they're now in types/nostr.d.ts

export const NostrLoginButton: React.FC = () => {
  const { user, loading, login, logout, shortenNpub, loginMethod, viewOnlyProfile, availableProfiles, ndk } = useNostr();
  const [showDetails, setShowDetails] = useState(false);
  const [showLoginOptions, setShowLoginOptions] = useState(false);
  const [profileImage, setProfileImage] = useState<string>("/assets/nostrloginicon.gif");
  const [imageError, setImageError] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  
  // Session token for NIP-47 connection
  const sessionToken = useRef<string>('');
  // Connection checking interval
  const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Force reset when user changes
  useEffect(() => {
    console.log("User state changed:", user ? "Logged in" : "Logged out");
    
    if (user && user.profile?.image && !imageError) {
      // User is logged in and has a profile image
      setProfileImage(user.profile.image);
      console.log("Setting profile image to:", user.profile.image);
    } else if (viewOnlyProfile?.picture && !imageError) {
      // Using view-only mode with a predefined profile picture
      setProfileImage(viewOnlyProfile.picture);
      console.log("Setting profile image to view-only picture:", viewOnlyProfile.picture);
    } else {
      // User is logged out or has no profile image
      setProfileImage("/assets/nostrloginicon.gif");
      console.log("Setting profile image to default GIF");
    }
  }, [user, viewOnlyProfile, imageError]);

  // Reset image error state when user changes
  useEffect(() => {
    setImageError(false);
  }, [user, viewOnlyProfile]);
  
  // Also show login options after logging out from view-only mode
  useEffect(() => {
    if (!user && !loading && loginMethod === null && viewOnlyProfile === null) {
      // This likely means we just logged out
      setShowLoginOptions(true);
    }
  }, [user, loading, loginMethod, viewOnlyProfile]);

  // Check for existing NIP-47 sessions on mount
  useEffect(() => {
    if (!user && ndk) {
      // Check for existing connections on mount
      const savedSession = localStorage.getItem('nostr_connect_session');
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
            localStorage.removeItem('nostr_connect_session');
          }
        } catch (e) {
          console.error("Error restoring session:", e);
          localStorage.removeItem('nostr_connect_session');
        }
      }
    }
  }, [ndk]);

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
    localStorage.setItem('nostr_connect_session', JSON.stringify(session));
  };

  // Clean up connection check interval on unmount
  useEffect(() => {
    return () => {
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
      }
    };
  }, []);

  // Generate a Nostr Connect URL (NIP-47)
  const generateConnectUrl = () => {
    // Make sure NDK instance is available
    if (!ndk) {
      console.error("NDK instance not available");
      setConnectionStatus('error');
      return;
    }

    try {
      // Create a unique session token - use secure token for production
      sessionToken.current = generateSecureToken();
      
      // Use production pubkey from environment variables
      const APP_PUBKEY = process.env.NEXT_PUBLIC_APP_PUBKEY;
      if (!APP_PUBKEY) {
        console.error("Application pubkey not configured! Set NEXT_PUBLIC_APP_PUBKEY environment variable.");
        setConnectionStatus('error');
        return;
      }
      
      // For debugging - log information about the signer
      if (ndk.signer) {
        console.log("NDK signer type:", typeof ndk.signer);
      }
      
      // Get our active relay URLs from NDK
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
          console.warn("Error extracting relay URLs:", e);
        }
      }
      
      const primaryRelay = relayUrls.length > 0 ? relayUrls[0] : "wss://relay.damus.io";
      
      // Construct proper app metadata
      const metadata = {
        name: "MadTrips",
        url: window.location.origin,
        description: "Travel booking with Nostr integration"
      };
      
      // Construct the NIP-47 URL (nostrconnect://<pubkey>?relay=wss://...)
      const url = `nostrconnect://${APP_PUBKEY}?relay=${encodeURIComponent(primaryRelay)}&metadata=${encodeURIComponent(JSON.stringify(metadata))}&session_token=${sessionToken.current}`;
      
      console.log("Generated Nostr Connect URL for relay:", primaryRelay);
      setConnectUrl(url);
      setConnectionStatus('idle');
      
      // Start polling for connection status
      startConnectionCheck();
    } catch (error) {
      console.error("Error generating NIP-47 URL:", error);
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
            
            // Complete the login process
            await completeNip47Login();
          }
        }
      } catch (error) {
        console.error("Error checking connection status:", error);
      }
    }, 3000);
    
    // Time out after 2 minutes (120000ms)
    setTimeout(() => {
      if (connectionStatus !== 'connected' && connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        setConnectionStatus('error');
      }
    }, 120000);
  };

  // Check for connection events using NDK events
  const checkForConnectionEvents = async (): Promise<boolean> => {
    if (!ndk || !sessionToken.current) return false;
    
    try {
      // Subscribe to NIP-47 connection events (kind 24133)
      const filter = {
        kinds: [24133],
        "#session": [sessionToken.current]
      };
      
      // Use NDK to fetch events - real implementation for production
      const events = await ndk.fetchEvents(filter);
      
      // Check if we have any matching events
      if (events && events.size > 0) {
        // Log the first event for debugging
        const firstEvent = Array.from(events)[0];
        console.log("Received connection event:", firstEvent);
        
        // Validate the event further if needed
        // For example, check the pubkey matches what we expect
        
        return true;
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
    localStorage.removeItem('nostr_connect_session');
    
    // Send disconnection event (if implemented in your NIP-47 flow)
    if (ndk && sessionToken.current) {
      // Create and publish a disconnection event
      // This would depend on your specific implementation
    }
  };

  // Complete the NIP-47 login process once connected
  const completeNip47Login = async () => {
    try {
      // Use the NDK instance to finalize the NIP-47 login
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
          console.warn("Error extracting relay URL for login:", e);
        }
        
        // First verify the connection is valid
        const filter = {
          kinds: [24133],
          "#session": [sessionToken.current]
        };
        
        const events = await ndk.fetchEvents(filter);
        
        if (!events || events.size === 0) {
          throw new Error("No valid connection event found");
        }
        
        // Extract the user's pubkey from the connection event
        const connectionEvent = Array.from(events)[0];
        const userPubkey = connectionEvent.pubkey;
        
        // Set up event listeners for future requests
        setupEventListeners();
        
        // Save the session information for persistence
        saveSession(sessionToken.current, userPubkey, relayUrl);
        
        // Complete the login
        await login('nip47', { 
          sessionToken: sessionToken.current,
          relayUrl: relayUrl,
          userPubkey: userPubkey // Pass the user's pubkey if your login function needs it
        });
        
        // Close the QR code modal and login options
        setShowQRCode(false);
        setShowLoginOptions(false);
      }
    } catch (error) {
      console.error("Failed to complete NIP-47 login:", error);
      setConnectionStatus('error');
      alert("Failed to complete login: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  const handleNIP07Login = async () => {
    try {
      await login('nip07');
      setShowLoginOptions(false);
    } catch (error) {
      console.error("Failed to login with NIP-07:", error);
      alert("NIP-07 login failed. Please make sure you have a compatible browser extension installed (like Alby or nos2x).");
    }
  };
  
  const handleNIP47Login = async () => {
    try {
      generateConnectUrl();
      setShowQRCode(true);
    } catch (error) {
      console.error("Failed to generate NIP-47 URL:", error);
      alert("Failed to generate connection URL: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleQRCodeClick = async () => {
    if (connectUrl) {
      try {
        await navigator.clipboard.writeText(connectUrl);
        setCopySuccess(true);
        console.log("Secret URL copied to clipboard:", connectUrl.substring(0, 20) + "...");
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        alert("Failed to copy to clipboard. Your browser may not support this feature.");
      }
    }
  };
  
  const handleViewOnlyLogin = async (profile: any) => {
    try {
      await login('viewonly', { profile });
      setShowLoginOptions(false);
    } catch (error) {
      console.error("Failed to login with view-only mode:", error);
      alert("View-only login failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  // Handle switching from view-only to another login method
  const handleSwitchFromViewOnly = () => {
    setShowLoginOptions(true);
    setShowDetails(false);
  };

  // Handle signup with nsec.app
  const handleSignup = () => {
    // Open nsec.app in a new tab for easy signup
    window.open('https://nsec.app', '_blank');
    
    // Let user know what to do after creating an account
    setTimeout(() => {
      alert('After creating your account on nsec.app, you can log in here using a browser extension (NIP-07) like Alby or nos2x, or connect using your nsec.app profile (NIP-47).');
    }, 1000);
  };
  
  const handleLogout = () => {
    console.log("Logout initiated");
    
    // Close the details panel first
    setShowDetails(false);
    
    // Force reset to default image immediately
    setProfileImage("/assets/nostrloginicon.gif");
    
    // Reset error state
    setImageError(false);
    
    // Clean up NIP-47 session if exists
    if (loginMethod === 'nip47') {
      cleanupSession();
    }
    
    // Call the logout function from context with a small delay
    // to ensure UI updates happen first
    setTimeout(() => {
      logout();
      console.log("Logout completed");
      
      // Force image update again after logout
      setProfileImage("/assets/nostrloginicon.gif");
    }, 10);
  };

  const handleButtonClick = () => {
    // If user is not logged in, show login options
    if (!user) {
      setShowLoginOptions(prev => !prev);
    } else {
      // Otherwise toggle the details panel
      setShowDetails(prev => !prev);
    }
  };

  const handleImageError = () => {
    console.log("Image error occurred, falling back to default GIF");
    setImageError(true);
    setProfileImage("/assets/nostrloginicon.gif");
  };
  
  // Close panels when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the login component
      const nostrLoginButton = document.querySelector('#nostr-login-container');
      if (nostrLoginButton && !nostrLoginButton.contains(event.target as Node)) {
        setShowLoginOptions(false);
        setShowDetails(false);
        setShowQRCode(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Add handler for QR code modal close
  const handleQRCodeClose = () => {
    setShowQRCode(false);
    setShowLoginOptions(false); // Hide login options when QR code is closed
    
    // Also clear connection check interval
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
      setConnectionStatus('idle');
    }
  };
  
  return (
    <div id="nostr-login-container" className="fixed bottom-4 right-4 z-50">
      {/* Main button - rounded square with no border or shadow */}
      <button 
        onClick={handleButtonClick}
        className="w-12 h-12 rounded-lg overflow-hidden transition-all transform hover:scale-105"
        aria-label={user ? "Your Nostr profile" : "Login with Nostr"}
        disabled={loading}
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <Image 
            src={profileImage} 
            alt={user ? "Your profile" : "Login with Nostr"}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            onError={handleImageError}
            key={`profile-image-${user?.npub || 'none'}-${profileImage}`} // Force re-render with reliable key
            priority
            unoptimized
          />
        )}
      </button>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium dark:text-white">Connect with Nostr Signing Device</h3>
              <button 
                onClick={handleQRCodeClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
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
                Connected! Logging in...
              </div>
            )}
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Scan with your Nostr signing device or click QR code to copy secret
            </p>
            <div 
              className="bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
              onClick={handleQRCodeClick}
            >
              <QRCodeSVG
                value={connectUrl}
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"L"}
                includeMargin={false}
              />
              {!copySuccess && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Click to copy secret URL
                </div>
              )}
              {copySuccess && (
                <div className="mt-2 py-1 px-2 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-md font-medium inline-block">
                  ✓ Secret copied!
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-center">
              <button
                onClick={generateConnectUrl}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
              >
                Generate New Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login options panel - only show when not logged in */}
      {!user && showLoginOptions && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 border border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-medium mb-3 text-center dark:text-white">Login Options</h3>
          
          <div className="space-y-3">
            {/* NIP-07 Browser Extension Login */}
            <button 
              onClick={handleNIP07Login}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"></path>
                </svg>
              </span>
              Browser Extension (NIP-07)
            </button>
            
            {/* NIP-47 Remote Signer Login */}
            <button 
              onClick={handleNIP47Login}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1H4v8a1 1 0 001 1h10a1 1 0 001-1V6zM4 4a1 1 0 011-1h10a1 1 0 011 1v1H4V4z" clipRule="evenodd"></path>
                </svg>
              </span>
              Remote Signer (NIP-47)
            </button>
            
            {/* Signup with nsec.app */}
            <button 
              onClick={handleSignup}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center justify-center"
            >
              <span className="mr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
                </svg>
              </span>
              Signup with nsec.app
            </button>
            
            {/* View-only Options */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or browse as:</p>
              <div className="space-y-2">
                {availableProfiles.map((profile) => (
                  <button 
                    key={profile.npub}
                    onClick={() => handleViewOnlyLogin(profile)}
                    className="w-full px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium flex items-center text-left"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0">
                      {profile.picture ? (
                        <Image 
                          src={profile.picture} 
                          alt={profile.displayName || profile.name || "Profile"}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                          {(profile.name || shortenNpub(profile.npub))[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="truncate">{profile.displayName || profile.name || shortenNpub(profile.npub)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup details panel - only show for logged in users */}
      {user && showDetails && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-lg overflow-hidden mb-3">
              {user.profile?.image && !imageError ? (
                <Image 
                  src={user.profile.image} 
                  alt={user.profile?.displayName || user.profile?.name || "User"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  key={`detail-image-${user.npub}-${user.profile.image}`}
                  priority
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                  {(user.profile?.name || shortenNpub(user.npub) || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            
            <p className="font-medium text-center dark:text-white">
              {user.profile?.displayName || user.profile?.name || shortenNpub(user.npub)}
            </p>
            
            {user.profile?.displayName && user.profile?.name && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 text-center">@{user.profile.name}</p>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">
              {shortenNpub(user.npub)}
            </p>
            
            {loginMethod === 'viewonly' ? (
              <div className="flex flex-col w-full space-y-2">
                <p className="text-xs text-center text-amber-600 dark:text-amber-400 mb-1">
                  You are browsing in view-only mode
                </p>
                <button 
                  onClick={handleSwitchFromViewOnly}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
                >
                  Switch Account
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium"
                >
                  Exit View-Only Mode
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 