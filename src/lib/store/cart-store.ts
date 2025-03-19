import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  CartState, 
  CartItem, 
  PaymentStatus, 
  NostrDM, 
  PaymentMethod 
} from '../../types/cart-types';
import { Package } from '../../types/package-types';

interface CartStore extends CartState {
  // Add item to cart
  addItem: (packageItem: Package, selectedDate?: Date) => void;
  
  // Remove item from cart
  removeItem: (packageId: string) => void;
  
  // Clear all items from cart
  clearCart: () => void;
  
  // Update customer npub (called on login)
  setCustomerNpub: (npub: string | null) => void;
  
  // Update provider npub
  setProviderNpub: (npub: string | null) => void;
  
  // Set active session
  setActiveSession: (active: boolean) => void;
  
  // Update payment status for collateral
  updateCollateralPayment: (
    amount: number, 
    method: PaymentMethod, 
    txid?: string, 
    preimage?: string
  ) => void;
  
  // Update payment status for final payment
  updateFinalPayment: (
    method: PaymentMethod, 
    txid?: string, 
    preimage?: string
  ) => void;
  
  // Set final payment due date (2 days before activity)
  setFinalPaymentDue: (date: Date) => void;
  
  // Add a message to the messages array
  addMessage: (message: Omit<NostrDM, 'id' | 'date'>) => void;
  
  // Fetch latest BTC price in USD and update cart items
  refreshPricing: () => Promise<void>;
  
  // Calculate remaining balance
  calculateRemainingBalance: () => number;
}

// Helper function to get current timestamp
const getCurrentDate = () => new Date();

// Helper for calculating BTC price (in production, would be fetched from an API)
const fetchBTCPrice = async (): Promise<number> => {
  // In production app, this would call a real API
  // For demo, we'll return a hardcoded value
  return 58000; // Example price in USD
};

// Calculate block height (in production, would be fetched from a Bitcoin node)
const fetchBlockHeight = async (): Promise<number> => {
  // In production app, this would call a real API
  // For demo, we'll return a hardcoded value
  return 832000; // Example block height
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      paymentStatus: null,
      customerNpub: null,
      providerNpub: null,
      messages: [],
      activeSession: false,
      
      // Add item to cart
      addItem: async (packageItem: Package, selectedDate?: Date) => {
        const { items } = get();
        
        // Check if item already exists in cart
        const existingItemIndex = items.findIndex((item: CartItem) => item.packageId === packageItem.id);
        
        // Get current BTC price
        const btcPrice = await fetchBTCPrice();
        const blockHeight = await fetchBlockHeight();
        
        // If item exists, update it
        if (existingItemIndex >= 0) {
          const updatedItems = [...items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            selectedDate: selectedDate || updatedItems[existingItemIndex].selectedDate,
            // Don't update price if it's already locked in
          };
          set({ items: updatedItems });
        } else {
          // Add new item
          const newItem: CartItem = {
            packageId: packageItem.id,
            package: packageItem,
            selectedDate,
            lockedPrice: packageItem.price, // In sats
            btcPriceAtLock: btcPrice,
            blockHeightAtLock: blockHeight,
            referenceKey: uuidv4(), // Generate unique reference key
          };
          set({ items: [...items, newItem] });
        }
      },
      
      // Remove item from cart
      removeItem: (packageId: string) => {
        const { items } = get();
        set({ items: items.filter((item: CartItem) => item.packageId !== packageId) });
      },
      
      // Clear cart
      clearCart: () => {
        set({ 
          items: [],
          paymentStatus: null,
          messages: [],
          expiryDate: undefined
        });
      },
      
      // Set customer npub
      setCustomerNpub: (npub: string | null) => {
        set({ customerNpub: npub });
      },
      
      // Set provider npub
      setProviderNpub: (npub: string | null) => {
        set({ providerNpub: npub });
      },
      
      // Set active session
      setActiveSession: (active: boolean) => {
        set({ activeSession: active });
      },
      
      // Update collateral payment status
      updateCollateralPayment: (
        amount: number, 
        method: PaymentMethod, 
        txid?: string, 
        preimage?: string
      ) => {
        const current = get().paymentStatus || {
          collateralPaid: false,
          collateralAmount: 0,
          collateralPaymentMethod: 'lightning',
          remainingBalance: 0,
          finalPaymentPaid: false
        };
        
        const totalAmount = get().items.reduce((sum: number, item: CartItem) => sum + item.lockedPrice, 0);
        const remainingBalance = totalAmount - amount;
        
        set({ 
          paymentStatus: {
            ...current,
            collateralPaid: true,
            collateralAmount: amount,
            collateralPaymentMethod: method,
            collateralPaymentDate: getCurrentDate(),
            collateralPaymentTxid: txid,
            collateralPreimage: preimage,
            remainingBalance
          } 
        });
      },
      
      // Update final payment status
      updateFinalPayment: (
        method: PaymentMethod, 
        txid?: string, 
        preimage?: string
      ) => {
        const current = get().paymentStatus;
        if (!current) return;
        
        set({ 
          paymentStatus: {
            ...current,
            finalPaymentPaid: true,
            finalPaymentMethod: method,
            finalPaymentDate: getCurrentDate(),
            finalPaymentTxid: txid,
            finalPreimage: preimage,
            remainingBalance: 0
          } 
        });
      },
      
      // Set final payment due date
      setFinalPaymentDue: (date: Date) => {
        const current = get().paymentStatus;
        if (!current) return;
        
        set({
          paymentStatus: {
            ...current,
            finalPaymentDue: date
          }
        });
      },
      
      // Add message
      addMessage: (message: Omit<NostrDM, 'id' | 'date'>) => {
        const { messages } = get();
        const newMessage: NostrDM = {
          ...message,
          id: uuidv4(),
          date: getCurrentDate()
        };
        
        set({ messages: [...messages, newMessage] });
      },
      
      // Refresh pricing
      refreshPricing: async () => {
        const btcPrice = await fetchBTCPrice();
        const blockHeight = await fetchBlockHeight();
        
        // Only update if there's no collateral payment yet
        const { paymentStatus, items } = get();
        if (paymentStatus?.collateralPaid) return;
        
        // Update prices
        const updatedItems = items.map((item: CartItem) => ({
          ...item,
          btcPriceAtLock: btcPrice,
          blockHeightAtLock: blockHeight
        }));
        
        set({ items: updatedItems });
      },
      
      // Calculate remaining balance
      calculateRemainingBalance: () => {
        const { items, paymentStatus } = get();
        const totalAmount = items.reduce((sum: number, item: CartItem) => sum + item.lockedPrice, 0);
        
        if (!paymentStatus || !paymentStatus.collateralPaid) {
          return totalAmount;
        }
        
        return paymentStatus.remainingBalance;
      }
    }),
    {
      name: 'madtrips-cart-storage',
      // Only persist specific parts of the state to avoid security issues
      partialize: (state: CartStore) => ({
        items: state.items,
        paymentStatus: state.paymentStatus,
        activeSession: state.activeSession,
        expiryDate: state.expiryDate
      })
    }
  )
); 