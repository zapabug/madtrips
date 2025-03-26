'use client';

import React, { useState } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import CheckoutAuthWrapper from '../../components/checkout/CheckoutAuthWrapper';
import PaymentMethodSelector from '../../components/checkout/PaymentMethodSelector';
import PaymentStatusDisplay from '../../components/checkout/PaymentStatusDisplay';
import NostrMessageThread from '../../components/checkout/NostrMessageThread';
import { PaymentMethod } from '../../types/cart-types';
import { useCheckoutFlow } from '../../hooks/useCheckoutFlow';
import Link from 'next/link';

export default function CheckoutPage() {
  const { user } = useNostr();
  const [isFullyAuthenticated, setIsFullyAuthenticated] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('lightning');
  
  const {
    items,
    paymentStatus,
    messages,
    isProcessing,
    error,
    collateralAmount,
    remainingBalance,
    refreshPricing,
    payCollateral,
    payRemainingBalance,
    sendMessage
  } = useCheckoutFlow();
  
  // Determine what payment amount to show
  const paymentAmount = paymentStatus?.collateralPaid 
    ? remainingBalance
    : collateralAmount;
  
  // Check if cart is empty
  const isCartEmpty = items.length === 0;
  
  // Handle pay collateral button
  const handlePayCollateral = async () => {
    if (!isFullyAuthenticated) return;
    
    await payCollateral(selectedPaymentMethod);
  };
  
  // Handle pay remaining button
  const handlePayRemaining = async () => {
    if (!isFullyAuthenticated) return;
    
    await payRemainingBalance(selectedPaymentMethod);
  };
  
  return (
    <CheckoutAuthWrapper
      requireFullAuth={false} // Only require full auth when clicking payment buttons
      onStatusChange={setIsFullyAuthenticated}
    >
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        
        {isCartEmpty ? (
          <div className="max-w-2xl mx-auto mt-8 text-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
              <h2 className="text-xl font-semibold mb-4">Your cart is empty</h2>
              <p className="mb-6 text-gray-600 dark:text-gray-300">
                You haven't added any packages to your cart yet.
              </p>
              <Link 
                href="/packages" 
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Browse Packages
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {/* Left column - Cart contents and payment options */}
            <div>
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-xl font-semibold mb-4">Your Cart</h2>
                
                {/* Cart items */}
                <div className="divide-y dark:divide-gray-700">
                  {items.map(item => (
                    <div key={item.packageId} className="py-4">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <h3 className="font-medium">{item.package.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{item.package.duration}</p>
                          {item.selectedDate && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Date: {item.selectedDate.toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.lockedPrice.toLocaleString()} sats</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}
              
              {/* Payment method selector */}
              <div className="mb-6">
                <PaymentMethodSelector
                  amount={paymentAmount}
                  onSelect={setSelectedPaymentMethod}
                  initialMethod={selectedPaymentMethod}
                  showMixedOption={paymentAmount > 900000}
                />
              </div>
              
              {/* Payment action buttons */}
              <div className="mb-6">
                {!paymentStatus?.collateralPaid ? (
                  <button
                    onClick={handlePayCollateral}
                    disabled={!isFullyAuthenticated || isProcessing || collateralAmount <= 0}
                    className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                      isFullyAuthenticated && !isProcessing
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : !isFullyAuthenticated ? (
                      'Login to Pay Collateral'
                    ) : (
                      `Pay Collateral: ${collateralAmount.toLocaleString()} sats`
                    )}
                  </button>
                ) : !paymentStatus.finalPaymentPaid ? (
                  <button
                    onClick={handlePayRemaining}
                    disabled={!isFullyAuthenticated || isProcessing}
                    className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                      isFullyAuthenticated && !isProcessing
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : !isFullyAuthenticated ? (
                      'Login to Pay Remaining Balance'
                    ) : (
                      `Pay Remaining: ${remainingBalance.toLocaleString()} sats`
                    )}
                  </button>
                ) : (
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg p-4 text-center">
                    Payment complete! Your booking is confirmed.
                  </div>
                )}
                
                {!isFullyAuthenticated && (
                  <p className="text-sm text-center mt-2 text-gray-600 dark:text-gray-400">
                    You need to authenticate with your Nostr key to make payments
                  </p>
                )}
              </div>
              
              {/* Messaging */}
              <div className="mb-6">
                <NostrMessageThread
                  providerNpub={items.length > 0 ? items[0].package.providerNpub : undefined}
                  onSendMessage={sendMessage}
                />
              </div>
            </div>
            
            {/* Right column - Payment status and info */}
            <div>
              <PaymentStatusDisplay 
                onRefreshBalance={refreshPricing}
                showDeadlineWarning={true}
              />
              
              {/* Payment messages only */}
              <div className="mt-6">
                <NostrMessageThread
                  providerNpub={items.length > 0 ? items[0].package.providerNpub : undefined}
                  onlyShowPaymentMessages={true}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </CheckoutAuthWrapper>
  );
} 