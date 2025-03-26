import { Package } from './package-types';

export type PaymentMethod = 'lightning' | 'onchain' | 'ecash' | 'mixed';

export interface CartItem {
  packageId: string;
  package: Package;
  selectedDate?: Date;
  lockedPrice: number; // Price in sats at the time of selection
  btcPriceAtLock: number; // BTC price in USD at time of lock
  blockHeightAtLock?: number; // Block height when price was locked
  referenceKey: string; // Unique reference for provider verification
}

export interface PaymentStatus {
  collateralPaid: boolean;
  collateralAmount: number;
  collateralPaymentMethod: PaymentMethod;
  collateralPaymentDate?: Date;
  collateralPaymentTxid?: string;
  collateralPreimage?: string;
  
  remainingBalance: number;
  finalPaymentDue?: Date; // 2 days before scheduled activity
  finalPaymentMethod?: PaymentMethod;
  finalPaymentPaid: boolean;
  finalPaymentDate?: Date;
  finalPaymentTxid?: string;
  finalPreimage?: string;
  
  lastReminderSent?: Date;
}

export interface NostrDM {
  id: string;
  sender: string; // npub of sender
  recipient: string; // npub of recipient
  content: string;
  date: Date;
  relatedToPayment: boolean;
  paymentType?: 'collateral' | 'final' | 'reminder';
}

export interface CartState {
  items: CartItem[];
  paymentStatus: PaymentStatus | null;
  customerNpub: string | null;
  providerNpub: string | null;
  messages: NostrDM[];
  activeSession: boolean;
  
  // Cart expiry (if user doesn't complete payment within a certain time)
  expiryDate?: Date;
}