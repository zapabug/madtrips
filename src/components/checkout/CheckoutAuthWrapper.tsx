'use client';

import React, { useEffect, useState } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { useCartStore } from '../../lib/store/cart-store';

interface CheckoutAuthWrapperProps {
  children: React.ReactNode;
  requireFullAuth?: boolean; // Set to true for payment pages that require full auth
  onStatusChange?: (isFullyAuthenticated: boolean) => void;
}

/**
 * CheckoutAuthWrapper
 * This component manages Nostr authentication flow for the checkout process:
 * 1. Auto-logs users in as view-only for browsing
 * 2. Forces logout and re-auth when checkout/payment is initiated
 * 3. Syncs cart session with authentication state
 */
const CheckoutAuthWrapper: React.FC<CheckoutAuthWrapperProps> = ({ 
  children, 
  requireFullAuth = false,
  onStatusChange
}) => {
  const { user, login, logout, loginMethod } = useNostr();
  const [authenticating, setAuthenticating] = useState(false);
  const { setCustomerNpub, setActiveSession } = useCartStore();
  
  // Sync cart with user status
  useEffect(() => {
    if (user) {
      setCustomerNpub(user.npub);
      setActiveSession(true);
    } else {
      setCustomerNpub(null);
    }
  }, [user, setCustomerNpub, setActiveSession]);
  
  // Auto-login as view-only if no user and not in authentication process
  useEffect(() => {
    const autoLogin = async () => {
      // Skip if already logged in, authenticating, or if full auth is required
      if (user || authenticating) return;
      
      // If we need full auth but don't have it, initiate auth flow
      if (requireFullAuth && (!user || loginMethod === 'viewonly')) {
        await initiateFullAuth();
        return;
      }
      
      // Otherwise, if no user is logged in, auto-login as view-only
      if (!user && !authenticating) {
        try {
          setAuthenticating(true);
          
          // Create a view-only profile with random npub for browsing
          await login('viewonly', { 
            profile: {
              npub: 'npub1guestviewer', // Dummy npub for view-only mode
              name: 'Guest',
              displayName: 'Guest Viewer',
              picture: '/assets/nostrloginicon.gif'
            }
          });
          
          console.log('Auto-logged in as view-only');
        } catch (error) {
          console.error('Auto-login failed:', error);
        } finally {
          setAuthenticating(false);
        }
      }
    };
    
    autoLogin();
  }, [user, authenticating, login, loginMethod, requireFullAuth]);
  
  // Notify parent component when authentication status changes
  useEffect(() => {
    if (onStatusChange) {
      const isFullyAuthenticated = !!user && loginMethod !== 'viewonly';
      onStatusChange(isFullyAuthenticated);
    }
  }, [user, loginMethod, onStatusChange]);
  
  // Initiate full authentication flow (logout and prompt for Nostr key)
  const initiateFullAuth = async () => {
    if (authenticating) return;
    
    try {
      setAuthenticating(true);
      
      // First logout current user (if any)
      if (user) {
        logout();
        
        // Wait a moment for clean logout
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Then trigger Nostr login prompt
      if (window.nostr) {
        try {
          const pubkey = await window.nostr.getPublicKey();
          if (pubkey) {
            // NostrContext should auto-detect and authenticate
            console.log('Obtained pubkey:', pubkey);
          }
        } catch (error) {
          console.error('Failed to get Nostr pubkey:', error);
          // Fall back to view-only if needed
          if (!requireFullAuth) {
            await login('viewonly', { 
              profile: {
                npub: 'npub1guestviewer',
                name: 'Guest',
                displayName: 'Guest Viewer',
                picture: '/assets/nostrloginicon.gif'
              }
            });
          }
        }
      } else {
        // If no extension, prompt user to install one (in real app)
        console.warn('No Nostr extension detected');
      }
    } catch (error) {
      console.error('Authentication process failed:', error);
    } finally {
      setAuthenticating(false);
    }
  };
  
  // Render children with authentication state
  return (
    <div className="checkout-auth-wrapper">
      {authenticating ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F7931A]" />
          <span className="ml-3 text-sm text-gray-600 dark:text-gray-300">
            Authenticating...
          </span>
        </div>
      ) : (
        children
      )}
      
      {/* Force authentication button for payment pages */}
      {requireFullAuth && (!user || loginMethod === 'viewonly') && !authenticating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-center">Authentication Required</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300 text-center">
              Please authenticate with your Nostr key to proceed with payment
            </p>
            <button
              onClick={initiateFullAuth}
              className="w-full py-3 bg-[#F7931A] hover:bg-[#E87F17] text-white rounded-lg font-medium"
            >
              Authenticate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutAuthWrapper; 