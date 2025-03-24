'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartState, CartItem, NostrDM, PaymentStatus } from '../../types/cart-types';
import { Package } from '../../types/package-types';

interface CartStore extends CartState {
  // Cart management
  addItem: (packageItem: Package, selectedDate?: Date) => void;
  removeItem: (packageId: string) => void;
  clearCart: () => void;
  
  // Payment status
  updatePaymentStatus: (status: Partial<PaymentStatus>) => void;
  markCollateralAsPaid: (amount: number, method: 'lightning' | 'onchain' | 'ecash') => void;
  markFinalPaymentAsPaid: (amount: number, method: 'lightning' | 'onchain' | 'ecash') => void;
  
  // Customer information
  setCustomerNpub: (npub: string) => void;
  
  // Messaging
  addMessage: (message: NostrDM) => void;
  clearMessages: () => void;
  
  // Session management
  startSession: () => void;
  endSession: () => void;
}

// Helper function to generate a reference key
const generateReferenceKey = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Initial state
const initialState: CartState = {
  items: [],
  paymentStatus: null,
  customerNpub: null,
  providerNpub: null,
  messages: [],
  activeSession: false
};

// Create the store with persistence
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Cart management
      addItem: (packageItem: Package, selectedDate?: Date) => {
        const items = get().items;
        const existingItemIndex = items.findIndex(item => item.packageId === packageItem.id);
        
        if (existingItemIndex >= 0) {
          // Update existing item
          const updatedItems = [...items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            selectedDate: selectedDate || updatedItems[existingItemIndex].selectedDate
          };
          set({ items: updatedItems });
        } else {
          // Add new item
          const btcPriceAtLock = 50000; // This would be fetched from an API
          const newItem: CartItem = {
            packageId: packageItem.id,
            package: packageItem,
            selectedDate,
            lockedPrice: packageItem.price * 1000, // Convert USD to sats (simplified)
            btcPriceAtLock,
            referenceKey: generateReferenceKey()
          };
          set({ items: [...items, newItem] });
        }
      },
      
      removeItem: (packageId: string) => {
        set(state => ({
          items: state.items.filter(item => item.packageId !== packageId)
        }));
      },
      
      clearCart: () => {
        set({
          items: [],
          paymentStatus: null
        });
      },
      
      // Payment status
      updatePaymentStatus: (status: Partial<PaymentStatus>) => {
        const currentStatus = get().paymentStatus || {
          collateralPaid: false,
          collateralAmount: 0,
          collateralPaymentMethod: 'lightning',
          remainingBalance: 0,
          finalPaymentPaid: false
        };
        
        set({
          paymentStatus: {
            ...currentStatus,
            ...status
          }
        });
      },
      
      markCollateralAsPaid: (amount: number, method: 'lightning' | 'onchain' | 'ecash') => {
        const totalPrice = get().items.reduce((sum, item) => sum + item.lockedPrice, 0);
        const collateralAmount = amount;
        const remainingBalance = totalPrice - collateralAmount;
        
        set(state => ({
          paymentStatus: {
            ...(state.paymentStatus || {
              collateralPaid: false,
              collateralPaymentMethod: 'lightning',
              remainingBalance: 0,
              finalPaymentPaid: false
            }),
            collateralPaid: true,
            collateralAmount,
            collateralPaymentMethod: method,
            collateralPaymentDate: new Date(),
            remainingBalance
          }
        }));
      },
      
      markFinalPaymentAsPaid: (amount: number, method: 'lightning' | 'onchain' | 'ecash') => {
        set(state => ({
          paymentStatus: {
            ...(state.paymentStatus || {
              collateralPaid: false,
              collateralAmount: 0,
              collateralPaymentMethod: 'lightning',
              remainingBalance: 0,
              finalPaymentPaid: false
            }),
            finalPaymentPaid: true,
            finalPaymentMethod: method,
            finalPaymentDate: new Date(),
            remainingBalance: 0
          }
        }));
      },
      
      // Customer information
      setCustomerNpub: (npub: string) => {
        set({ customerNpub: npub });
      },
      
      // Messaging
      addMessage: (message: NostrDM) => {
        set(state => ({
          messages: [...state.messages, message]
        }));
      },
      
      clearMessages: () => {
        set({ messages: [] });
      },
      
      // Session management
      startSession: () => {
        set({
          activeSession: true,
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        });
      },
      
      endSession: () => {
        set({
          activeSession: false,
          expiryDate: undefined
        });
      }
    }),
    {
      name: 'madtrips-cart-storage',
      // Only persist the data that needs to be saved
      partialize: (state) => ({
        items: state.items,
        paymentStatus: state.paymentStatus,
        customerNpub: state.customerNpub,
        providerNpub: state.providerNpub,
        activeSession: state.activeSession,
        expiryDate: state.expiryDate
      })
    }
  )
); 