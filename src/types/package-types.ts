/**
 * Package Types
 * 
 * This file contains all types related to travel packages, bookings, and payments.
 */

// Travel package type
export interface Package {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  includes: string[];
  image?: string;
}

// Payment data
export interface PaymentData {
  id: string;
  invoice: string;
  qrCode: string;
  expiry: number;
}

// Booking data
export interface BookingData {
  id: string;
  packageId: string;
  packageTitle: string;
  nostrPubkey: string;
  paymentId: string;
  amount: number;
  status: string;
  createdAt: string;
}

// Booking form data
export interface BookingFormData {
  name: string;
  email: string;
}

// Payment creation request
export interface CreatePaymentRequest {
  amount: number;
  description: string;
}

// Booking creation request
export interface CreateBookingRequest {
  packageId: string;
  nostrPubkey: string;
  invoice: string;
}

// Cart item type
export interface CartItem {
  id: string;
  packageId: string;
  title: string;
  price: number;
  quantity: number;
  selectedOptions?: Record<string, any>;
}

// Cart state type
export interface CartState {
  items: CartItem[];
  total: number;
  lastUpdated: string;
}

// User selections type
export interface UserSelections {
  nostrPubkey: string;
  cart: CartState;
  savedPackages: string[]; // Array of package IDs
  bookingHistory: BookingData[];
} 