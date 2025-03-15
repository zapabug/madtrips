'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Package, PaymentData } from '@/types';
import { useNostr } from '@/lib/nostr';
import React from 'react';

export default function PackageDetailPage() {
  // Use the useParams hook to get route params in a client component
  const params = useParams();
  const packageId = params.id as string;
  
  const [packageItem, setPackageItem] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Booking and payment states
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  
  // Nostr state
  const { publicKey, isNostrConnected, connectNostr, generateRandomPubkey, connectWithPrimal, preferredClient } = useNostr();

  useEffect(() => {
    async function fetchPackage() {
      try {
        setLoading(true);
        if (!packageId) {
          setError('Invalid package ID');
          setLoading(false);
          return;
        }
        
        const response = await api.getPackage(packageId) as { package: Package };
        setPackageItem(response.package);
        setError(null);
      } catch (err) {
        console.error('Error fetching package:', err);
        setError('Failed to load package details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchPackage();
  }, [packageId]);

  // Helper function to format satoshi amount to BTC
  const formatSats = (sats: number) => {
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC (${sats.toLocaleString()} sats)`;
  };

  const handleBookNow = () => {
    setShowBookingForm(true);
    if (!isNostrConnected) {
      // Don't auto-connect, let the user choose their preferred method
    }
  };

  const handlePrimalConnect = () => {
    connectWithPrimal({
      perms: "sign_event:1,sign_event:0",
      theme: "ocean",
      relayUrls: [
        "wss://relay.damus.io",
        "wss://relay.primal.net", 
        "wss://relay.snort.social"
      ]
    });
  };

  const handleNip07Connect = () => {
    connectNostr({
      perms: "sign_event:1,sign_event:0",
      theme: "ocean"
    });
  };

  const handlePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!packageItem) return;
    
    // Check if Nostr is connected
    if (!publicKey) {
      setError('Please connect your Nostr wallet to continue.');
      return;
    }
    
    try {
      // Generate payment invoice
      const paymentResponse = await api.createPayment(
        packageItem.price, 
        `MadTrips: ${packageItem.title}`
      ) as PaymentData;
      
      setPaymentData(paymentResponse);
      
      // Set up payment checking interval
      const paymentCheckInterval = setInterval(async () => {
        try {
          // Check payment status
          const statusResponse = await api.checkPaymentStatus(paymentResponse.id);
          
          if (statusResponse.paid) {
            clearInterval(paymentCheckInterval);
            
            // Create booking
            const bookingResponse = await api.createBooking({
              packageId: packageItem.id,
              nostrPubkey: publicKey,
              invoice: paymentResponse.invoice
            }) as { bookingId: string; status: string };
            
            setBookingId(bookingResponse.bookingId);
            setBookingComplete(true);
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
        }
      }, 5000); // Check every 5 seconds
      
      // For demo purposes, we'll also set a timeout to automatically complete the booking
      // This should be removed in a production environment
      setTimeout(() => {
        clearInterval(paymentCheckInterval);
        
        if (!bookingComplete) {
          // If booking isn't complete after 30 seconds, create it anyway for demo purposes
          const createDemoBooking = async () => {
            try {
              const bookingResponse = await api.createBooking({
                packageId: packageItem.id,
                nostrPubkey: publicKey,
                invoice: paymentResponse.invoice
              }) as { bookingId: string };
              
              setBookingId(bookingResponse.bookingId);
              setBookingComplete(true);
            } catch (err) {
              console.error('Error creating demo booking:', err);
              setError('Failed to complete booking. Please try again.');
            }
          };
          
          createDemoBooking();
        }
      }, 30000); // 30 second fallback for demo purposes
      
    } catch (err) {
      console.error('Error generating payment:', err);
      setError('Failed to generate payment. Please try again.');
    }
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
          {showBookingForm && !paymentData && !bookingComplete && (
            <div className="mt-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Connect with Nostr</h2>
              {!publicKey ? (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please select a Nostr connection method to continue.
                  </p>
                  
                  {/* Primal Connection - Recommended */}
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">Recommended</h3>
                    <button
                      onClick={handlePrimalConnect}
                      className="w-full px-6 py-3 bg-[#7B3FE4] hover:bg-[#6A35C2] text-white rounded-md font-semibold transition-colors mb-2 flex items-center justify-center"
                    >
                      <span className="mr-2">Connect with Primal</span>
                      <span className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded">Recommended</span>
                    </button>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Primal provides the best experience and avoids CORS issues
                    </p>
                  </div>
                  
                  {/* NIP-07 Connection */}
                  <div className="mb-4">
                    <button
                      onClick={handleNip07Connect}
                      className="px-6 py-2 bg-[#8E44AD] hover:bg-[#8E44AD]/80 text-white rounded-md font-semibold transition-colors mb-4"
                    >
                      Connect with NIP-07 Extension
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Works with extensions like nos2x or Alby
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">
                      For demo purposes only:
                    </p>
                    <button
                      onClick={() => generateRandomPubkey()}
                      className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md font-semibold transition-colors text-sm"
                    >
                      Use Demo Pubkey
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Connected with Nostr pubkey:</p>
                    <p className="font-mono text-xs break-all">{publicKey}</p>
                    {preferredClient === 'primal' && (
                      <div className="mt-2 flex items-center text-green-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">Using Primal (Recommended)</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handlePaymentRequest}
                      className="w-full px-4 py-2 bg-[#F7931A] hover:bg-[#F7931A]/80 text-white rounded-md font-semibold transition-colors"
                    >
                      Proceed to Payment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Payment QR Code */}
          {paymentData && !bookingComplete && (
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