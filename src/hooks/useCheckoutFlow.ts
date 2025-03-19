import { useState, useEffect } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useCartStore } from '../lib/store/cart-store';
import { getMessagingService } from '../lib/services/NostrMessagingService';
import { PaymentMethod, NostrDM } from '../types/cart-types';
import { addDays } from 'date-fns';

/**
 * Hook for checkout flow functionality
 * Integrates cart store with Nostr messaging
 */
export function useCheckoutFlow() {
  const { ndk, user, loginMethod } = useNostr();
  const { 
    items, 
    paymentStatus, 
    calculateRemainingBalance, 
    refreshPricing,
    updateCollateralPayment,
    updateFinalPayment,
    setFinalPaymentDue,
    addMessage,
    providerNpub,
    setProviderNpub,
    messages
  } = useCartStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load messages from Nostr when user or provider changes
  useEffect(() => {
    if (!ndk || !user || !providerNpub) return;
    
    // Skip if there's no real provider npub
    if (providerNpub.startsWith('npub1madprovider')) return;
    
    const loadMessages = async () => {
      try {
        const messagingService = getMessagingService(ndk);
        const nostrMessages = await messagingService.getDirectMessages(
          user.npub,
          providerNpub
        );
        
        // Add messages to the store if they don't exist already
        nostrMessages.forEach(msg => {
          const exists = messages.some(m => m.id === msg.id);
          if (!exists) {
            addMessage(msg);
          }
        });
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };
    
    loadMessages();
    
    // Subscribe to new messages
    const messagingService = getMessagingService(ndk);
    const unsubscribe = messagingService.subscribeToDirectMessages(
      user.npub,
      (message) => {
        // Add new message to store
        const exists = messages.some(m => m.id === message.id);
        if (!exists) {
          addMessage(message);
        }
      }
    );
    
    return unsubscribe;
  }, [ndk, user, providerNpub, addMessage, messages]);
  
  // Calculate total price in sats
  const totalPrice = items.reduce((sum, item) => sum + item.lockedPrice, 0);
  
  // Calculate collateral amount (20% of total by default)
  const collateralAmount = Math.ceil(totalPrice * 0.2);
  
  // Get remaining balance
  const remainingBalance = calculateRemainingBalance();
  
  /**
   * Send a payment-related message via Nostr
   */
  const sendPaymentMessage = async (
    content: string,
    paymentType: 'collateral' | 'final' | 'reminder'
  ) => {
    if (!ndk || !user || !providerNpub) {
      throw new Error('Missing required data for sending message');
    }
    
    // Add message to local store
    addMessage({
      sender: user.npub,
      recipient: providerNpub,
      content,
      relatedToPayment: true,
      paymentType
    });
    
    // If using a real provider npub, send via NDK
    if (!providerNpub.startsWith('npub1madprovider')) {
      try {
        const messagingService = getMessagingService(ndk);
        await messagingService.sendDirectMessage(
          providerNpub,
          content,
          true,
          paymentType
        );
      } catch (error) {
        console.error('Failed to send message via NDK:', error);
      }
    }
  };
  
  /**
   * Handle paying collateral
   */
  const payCollateral = async (paymentMethod: PaymentMethod) => {
    if (!user || loginMethod === 'viewonly') {
      setError('You must be authenticated with Nostr to make payments');
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // In a real app, this would call an API to create and process the payment
      // For demo purposes, we'll simulate a payment
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Calculate and set payment deadline (2 days before scheduled activity)
      // In real app, would be based on the actual activity date
      const activityDate = addDays(new Date(), 10); // Example: activity in 10 days
      const paymentDeadline = addDays(activityDate, -2); // 2 days before activity
      
      // Update payment status in store
      updateCollateralPayment(
        collateralAmount,
        paymentMethod,
        'simulated_txid_' + Date.now(),
        'simulated_preimage_' + Date.now()
      );
      
      // Set final payment due date
      setFinalPaymentDue(paymentDeadline);
      
      // Send payment message
      if (providerNpub) {
        await sendPaymentMessage(
          `Collateral payment of ${collateralAmount} sats sent via ${paymentMethod}.`,
          'collateral'
        );
        
        // Simulate provider response
        if (providerNpub.startsWith('npub1madprovider')) {
          setTimeout(() => {
            addMessage({
              sender: providerNpub,
              recipient: user.npub,
              content: `Thank you for your collateral payment of ${collateralAmount} sats. Your booking is now secured. Please complete the final payment by ${paymentDeadline.toLocaleDateString()}.`,
              relatedToPayment: true,
              paymentType: 'collateral'
            });
          }, 2000);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Payment processing failed:', error);
      setError('Payment failed. Please try again.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Handle paying the remaining balance
   */
  const payRemainingBalance = async (paymentMethod: PaymentMethod) => {
    if (!user || loginMethod === 'viewonly' || !paymentStatus) {
      setError('You must be authenticated with Nostr to make payments');
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // In a real app, this would call an API to create and process the payment
      // For demo purposes, we'll simulate a payment
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update payment status in store
      updateFinalPayment(
        paymentMethod,
        'simulated_final_txid_' + Date.now(),
        'simulated_final_preimage_' + Date.now()
      );
      
      // Send payment message
      if (providerNpub) {
        await sendPaymentMessage(
          `Final payment of ${remainingBalance} sats sent via ${paymentMethod}.`,
          'final'
        );
        
        // Simulate provider response
        if (providerNpub.startsWith('npub1madprovider')) {
          setTimeout(() => {
            addMessage({
              sender: providerNpub,
              recipient: user.npub,
              content: `Thank you for your final payment. Your booking is now fully confirmed! Please save your reference key for check-in.`,
              relatedToPayment: true,
              paymentType: 'final'
            });
          }, 2000);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Payment processing failed:', error);
      setError('Payment failed. Please try again.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Send a regular message to the provider
   */
  const sendMessage = async (content: string) => {
    if (!ndk || !user || !providerNpub) {
      throw new Error('Missing required data for sending message');
    }
    
    try {
      // Add message to local store
      addMessage({
        sender: user.npub,
        recipient: providerNpub,
        content,
        relatedToPayment: false
      });
      
      // If using a real provider npub, send via NDK
      if (!providerNpub.startsWith('npub1madprovider')) {
        const messagingService = getMessagingService(ndk);
        await messagingService.sendDirectMessage(
          providerNpub,
          content,
          false
        );
      } else {
        // Simulate provider response for demo
        setTimeout(() => {
          addMessage({
            sender: providerNpub,
            recipient: user.npub,
            content: `Thank you for your message. How can I help you with your booking?`,
            relatedToPayment: false
          });
        }, 3000);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  };
  
  return {
    // State
    isProcessing,
    error,
    collateralAmount,
    remainingBalance,
    totalPrice,
    
    // Cart store data
    items,
    paymentStatus,
    messages,
    
    // Actions
    payCollateral,
    payRemainingBalance,
    sendMessage,
    refreshPricing,
    
    // Utilities
    calculateRemainingBalance
  };
} 