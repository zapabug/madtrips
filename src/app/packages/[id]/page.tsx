'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Package } from '../../../types/index';
import { useNostr } from '../../../lib/contexts/NostrContext';
import { useCartStore } from '../../../lib/store/cart-store';
import React from 'react';
import { getPackageById, formatSats } from '../../../data/packages';
import CheckoutAuthWrapper from '../../../components/checkout/CheckoutAuthWrapper';

export default function PackageDetailPage() {
  // Use the useParams hook to get route params in a client component
  const params = useParams();
  const router = useRouter();
  const packageId = params.id as string;
  
  const [packageItem, setPackageItem] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // Add proper eslint-disable for this specific line
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isFullyAuthenticated, setIsFullyAuthenticated] = useState(false);
  
  // Cart store
  const { addItem, items } = useCartStore();
  
  // Add eslint-disable for these variables
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  
  // Check if package is already in cart
  const isInCart = items.some(item => item.packageId === packageId);

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
  
  // Handle date selection
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setSelectedDate(date);
  };
  
  // Handle add to cart
  const handleAddToCart = () => {
    if (!packageItem) return;
    
    // Add package to cart
    addItem(packageItem, selectedDate);
    
    // Navigate to checkout
    router.push('/checkout');
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
        <div className="bg-red-100 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-red-800">Error</h2>
          <p className="text-red-700">{error || 'Failed to load package'}</p>
          <Link href="/packages" className="mt-4 inline-block text-blue-500 hover:underline">
            Browse all packages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CheckoutAuthWrapper>
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb navigation */}
          <div className="mb-6">
            <Link href="/packages" className="text-blue-500 hover:underline">
              ← Back to packages
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Package image */}
            <div className="relative h-80 md:h-auto overflow-hidden rounded-lg shadow-lg">
              <Image
                src={packageItem.image || '/assets/placeholder.jpg'}
                alt={packageItem.title}
                className="object-cover w-full h-full"
                width={600}
                height={400}
                priority
              />
            </div>
            
            {/* Package details */}
            <div>
              <h1 className="text-3xl font-bold mb-3">{packageItem.title}</h1>
              
              <div className="mb-6">
                <p className="text-lg mb-4">{packageItem.description}</p>
                
                <div className="flex items-center text-lg font-bold mb-2">
                  <span className="mr-2">Price:</span>
                  <span className="text-[#F7931A]">{formatSats(packageItem.price)} sats</span>
                </div>
                
                <div className="flex items-center mb-4">
                  <span className="mr-2">Duration:</span>
                  <span>{packageItem.duration}</span>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-bold mb-2">What&apos;s included:</h3>
                  <ul className="list-disc pl-5">
                    {packageItem.includes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Booking form */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-xl font-bold mb-4">Book Now</h2>
                
                <div className="mb-4">
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">
                    Select Date:
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    onChange={handleDateChange}
                  />
                </div>
                
                {isInCart ? (
                  <div className="mb-4">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded mb-4">
                      This package is already in your cart.
                    </div>
                    <Link 
                      href="/checkout"
                      className="block w-full py-3 px-4 bg-[#F7931A] hover:bg-[#E87F17] text-white rounded-lg font-medium text-center"
                    >
                      Go to Checkout
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    className="w-full py-3 px-4 bg-[#F7931A] hover:bg-[#E87F17] text-white rounded-lg font-medium"
                  >
                    Add to Cart
                  </button>
                )}
                
                {/* Authentication notice */}
                {!isFullyAuthenticated && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                    You&apos;ll be asked to authenticate with Nostr when making a payment
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </CheckoutAuthWrapper>
  );
} 