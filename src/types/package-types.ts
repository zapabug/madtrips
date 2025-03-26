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
  location?: string;
  imageUrl?: string;
  tags?: string[];
  includesTransportation?: boolean;
  includesFood?: boolean;
  includesLodging?: boolean;
  difficultyLevel?: string;
  availability?: string[];
  providerNpub: string; // Provider's Nostr public key
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