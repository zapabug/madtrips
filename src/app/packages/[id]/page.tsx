'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Package, PaymentData } from '@/types/index';
import { useNostr } from '@/lib/contexts/NostrContext';
import { NostrPayment } from '@/components/NostrPayment';
import React from 'react';
import { getPackageById, formatSats } from '@/data/packages';

// Real lnbits payment functions
const createPayment = async (amount: number, description: string): Promise<PaymentData> => {
  try {
    // Call your lnbits API
    const response = await fetch('/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        description,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create payment');
    }
    
    return data;
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
};

const checkPaymentStatus = async (paymentId: string) => {
  try {
    // Call your lnbits API to check payment status
    const response = await fetch(`/api/payments/status/${paymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to check payment status');
    }
    
    return data;
  } catch (error) {
    console.error('Error checking payment status:', error);
    throw error;
  }
};

const createBooking = async (data: { packageId: string; nostrPubkey: string; invoice: string; preimage?: string }) => {
  try {
    // Call your lnbits API to create booking
    const response = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || 'Failed to create booking');
    }
    
    return responseData;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

export default function PackageDetailPage() {
  // Use the useParams hook to get route params in a client component
  const params = useParams();
  const packageId = params.id as string;
  
  const [packageItem, setPackageItem] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Booking and payment states
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showNostrPayment, setShowNostrPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  
  // Nostr state
  const { user, loginMethod } = useNostr();

  useEffect(() => {
    // Find the package by ID from our centralized data
    const findPackage = () => {
      setLoading(true);
      
      if (!packageId) {
        setError('Invalid package ID');
        setLoading(false);
        return;
      }
      
      const foundPackage = getPackageById(packageId);
      
      if (foundPackage) {
        setPackageItem(foundPackage);
        setError(null);
      } else {
        setError('Package not found');
      }
      
      setLoading(false);
    };

    findPackage();
  }, [packageId]);

  const handleBookNow = () => {
    setShowBookingForm(true);
    // We'll handle the Nostr login separately
  };

  const handlePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!packageItem) return;
    
    // Check if Nostr is connected
    if (!user) {
      setError('Please connect your Nostr wallet to continue with payment.');
      return;
    }
    
    try {
      // Get a Lightning invoice from the API
      const paymentResponse = await createPayment(
        packageItem.price, 
        `MadTrips: ${packageItem.title}`
      );
      
      setPaymentData(paymentResponse);
      setShowNostrPayment(true);
      
    } catch (err) {
      console.error('Error generating payment:', err);
      setError('Failed to generate payment. Please try again.');
    }
  };
  
  // Handle payment success
  const handlePaymentSuccess = async (preimage: string) => {
    if (!packageItem || !user || !paymentData) return;
    
    try {
      // Create booking with the preimage as proof of payment
      const bookingResponse = await createBooking({
        packageId: packageItem.id,
        nostrPubkey: user.npub,
        invoice: paymentData.invoice,
        preimage: preimage
      });
      
      setBookingId(bookingResponse.bookingId);
      setBookingComplete(true);
      setShowNostrPayment(false);
    } catch (err) {
      console.error('Error creating booking:', err);
      setError('Payment confirmed, but booking creation failed. Please contact support.');
    }
  };

  // Handle payment error
  const handlePaymentError = (error: Error) => {
    setError(`Payment failed: ${error.message}`);
    setShowNostrPayment(false);
  };

  // Handle payment cancel
  const handlePaymentCancel = () => {
    setShowNostrPayment(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A]" />
      </div>
    );
  }

  if (error || !packageItem) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700">
          {error || 'Package not found'}
        </div>
        <Link href="/packages" className="mt-4 inline-block text-[#F7931A] hover:underline">
          &larr; Back to packages
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Link href="/packages" className="inline-block mb-8 text-[#F7931A] hover:underline">
        &larr; Back to packages
      </Link>
      
      {/* Package details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="relative h-96 w-full">
          <Image
            src={packageItem.image || '/assets/placeholder.jpg'}
            alt={packageItem.title}
            fill
            className="object-cover"
          />
        </div>
        
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-4 text-ocean dark:text-[#F7931A]">{packageItem.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">{packageItem.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">Package Details</h2>
              <div className="space-y-2">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Duration:</span> {packageItem.duration}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Price:</span> <span className="text-[#F7931A] font-semibold">{formatSats(packageItem.price)}</span>
                </p>
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">What's Included</h2>
              <ul className="list-disc pl-5 text-gray-600 dark:text-gray-400 space-y-1">
                {packageItem.includes.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {!showBookingForm && !bookingComplete && (
            <div className="text-center">
              <button
                onClick={handleBookNow}
                className="px-8 py-3 bg-[#F7931A] hover:bg-[#F7931A]/80 text-white rounded-md font-semibold transition-colors"
              >
                Book Now with Bitcoin
              </button>
            </div>
          )}
          
          {/* Booking Form */}
          {showBookingForm && !paymentData && !bookingComplete && !showNostrPayment && (
            <div className="mt-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Ready to Book</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
                  <p>{error}</p>
                </div>
              )}
              
              {!user ? (
                <div className="text-center mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please connect your Nostr wallet to continue with payment.
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Use the Nostr login button in the bottom right corner to connect.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Connected with Nostr pubkey:</p>
                    <p className="font-mono text-xs break-all">{user.npub}</p>
                    <div className="mt-2 flex items-center text-green-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs">Connected with {loginMethod === 'nip07' ? 'Browser Extension' : loginMethod === 'nip47' ? 'Remote Signer' : 'View Only'}</span>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handlePaymentRequest}
                      disabled={loginMethod === 'viewonly'}
                      className="w-full px-4 py-2 bg-[#F7931A] hover:bg-[#F7931A]/80 text-white rounded-md font-semibold transition-colors disabled:opacity-50"
                    >
                      Proceed to Payment
                    </button>
                    
                    {loginMethod === 'viewonly' && (
                      <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                        You are in view-only mode. Please connect with a signing method to make payments.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* NostrPayment Component - New Implementation */}
          {showNostrPayment && paymentData && !bookingComplete && (
            <div className="mt-8">
              <NostrPayment
                invoice={paymentData.invoice}
                amount={formatSats(packageItem.price)}
                description={`MadTrips: ${packageItem.title}`}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handlePaymentCancel}
              />
            </div>
          )}
          
          {/* Legacy Payment QR Code - Only show as fallback if NostrPayment not available */}
          {paymentData && !bookingComplete && !showNostrPayment && (
            <div className="mt-8 max-w-md mx-auto text-center">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Pay with Bitcoin</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Scan the QR code with your Lightning wallet to complete payment.
              </p>
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <Image
                  src={paymentData.qrCode}
                  alt="Lightning Invoice QR Code"
                  width={250}
                  height={250}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 break-all mb-4">
                <p className="font-medium mb-1">Lightning Invoice:</p>
                <code className="bg-gray-100 dark:bg-gray-700 p-2 rounded block">
                  {paymentData.invoice.substring(0, 30)}...
                </code>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="text-[#F7931A] font-semibold">Note:</span> This is a demo payment. In the MVP version, the payment will be automatically "confirmed" after 5 seconds.
              </p>
            </div>
          )}
          
          {/* Booking Complete */}
          {bookingComplete && bookingId && (
            <div className="mt-8 max-w-md mx-auto text-center">
              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Booking Confirmed!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Thank you for your booking. Your confirmation ID is: <span className="font-mono font-medium">{bookingId}</span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  You will receive a confirmation email shortly with all the details of your trip.
                </p>
                <div className="mt-6">
                  <Link 
                    href="/packages" 
                    className="px-6 py-2 bg-[#F7931A] hover:bg-[#F7931A]/80 text-white rounded-md font-medium transition-colors"
                  >
                    Browse More Packages
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 