'use client';

import React from 'react';
import { useCartStore } from '../../lib/store/cart-store';
import { formatDistance, addDays, isBefore } from 'date-fns';

interface PaymentStatusDisplayProps {
  onRefreshBalance?: () => Promise<void>;
  showDeadlineWarning?: boolean;
}

/**
 * PaymentStatusDisplay
 * Shows the current payment status, deadlines and remaining balance
 */
const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  onRefreshBalance,
  showDeadlineWarning = true
}) => {
  const { items, paymentStatus, calculateRemainingBalance } = useCartStore();
  
  // Calculate total price of all items in the cart
  const totalPrice = items.reduce((sum, item) => sum + item.lockedPrice, 0);
  
  // Get remaining balance
  const remainingBalance = calculateRemainingBalance();
  
  // Calculate collateral amount as a percentage
  const collateralPercentage = paymentStatus?.collateralPaid 
    ? Math.round((paymentStatus.collateralAmount / totalPrice) * 100) 
    : 0;
  
  // Calculate payment deadline (2 days before scheduled activity)
  const getDeadlineStatus = () => {
    if (!paymentStatus?.finalPaymentDue) return null;
    
    const now = new Date();
    const deadline = paymentStatus.finalPaymentDue;
    
    // Check if deadline is approaching (less than 2 days away)
    const isDeadlineApproaching = isBefore(deadline, addDays(now, 2));
    
    // Check if deadline is passed
    const isDeadlinePassed = isBefore(deadline, now);
    
    return {
      date: deadline,
      timeRemaining: formatDistance(deadline, now, { addSuffix: true }),
      isApproaching: isDeadlineApproaching,
      isPassed: isDeadlinePassed
    };
  };
  
  const deadlineStatus = getDeadlineStatus();
  
  // Determine if payment is complete
  const isPaymentComplete = paymentStatus?.finalPaymentPaid || false;
  
  // Format sats with comma separators
  const formatSats = (sats: number) => {
    return sats.toLocaleString();
  };
  
  return (
    <div className="payment-status-display bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-4 pb-2 border-b dark:border-gray-700">
        Payment Status
      </h3>
      
      {/* Total amount and prices */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600 dark:text-gray-400">Total Price:</span>
          <span className="font-medium">{formatSats(totalPrice)} sats</span>
        </div>
        
        {/* Price locked message */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {items.length > 0 && items[0].btcPriceAtLock && (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Price locked at ${items[0].btcPriceAtLock}/BTC
              {items[0].blockHeightAtLock && ` (block ${items[0].blockHeightAtLock})`}
            </div>
          )}
        </div>
        
        {/* Fetch price button */}
        {onRefreshBalance && !paymentStatus?.collateralPaid && (
          <button 
            onClick={onRefreshBalance}
            className="text-sm mt-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            Fetch latest BTC price
          </button>
        )}
      </div>
      
      {/* Payment progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 dark:text-gray-400">Payment Progress:</span>
          <span className="font-medium">
            {isPaymentComplete 
              ? '100% (Complete)' 
              : paymentStatus?.collateralPaid 
                ? `${collateralPercentage}% (Collateral Paid)` 
                : '0% (No Payment)'}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
          <div 
            className={`h-2.5 rounded-full ${
              isPaymentComplete 
                ? 'bg-green-500' 
                : paymentStatus?.collateralPaid 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
            }`}
            style={{ width: isPaymentComplete ? '100%' : `${collateralPercentage}%` }}
          ></div>
        </div>
      </div>
      
      {/* Collateral details */}
      {paymentStatus?.collateralPaid && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <h4 className="font-medium mb-2">Collateral Payment</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Amount:</span>
            <span>{formatSats(paymentStatus.collateralAmount)} sats</span>
            
            <span className="text-gray-600 dark:text-gray-400">Method:</span>
            <span className="capitalize">{paymentStatus.collateralPaymentMethod}</span>
            
            {paymentStatus.collateralPaymentDate && (
              <>
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span>{paymentStatus.collateralPaymentDate.toLocaleDateString()}</span>
              </>
            )}
            
            <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
            <span>{formatSats(remainingBalance)} sats</span>
          </div>
        </div>
      )}
      
      {/* Final payment deadline */}
      {paymentStatus?.collateralPaid && !paymentStatus.finalPaymentPaid && deadlineStatus && (
        <div className={`mb-4 p-3 rounded ${
          deadlineStatus.isPassed
            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            : deadlineStatus.isApproaching && showDeadlineWarning
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
              : 'bg-gray-50 dark:bg-gray-700'
        }`}>
          <h4 className="font-medium mb-2">Final Payment Deadline</h4>
          <div className="flex items-start">
            {deadlineStatus.isPassed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            )}
            <div>
              <div className="font-medium">Due {deadlineStatus.date.toLocaleDateString()}</div>
              <p className="text-sm">
                {deadlineStatus.isPassed 
                  ? 'Final payment is overdue!' 
                  : `Payment due ${deadlineStatus.timeRemaining}`}
              </p>
              <p className="text-xs mt-1">
                Final payment must be received 2 days before your scheduled activity.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Final payment complete */}
      {paymentStatus?.finalPaymentPaid && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium">Payment Complete</h4>
              <p className="text-sm">
                Your payment has been fully processed. Your booking is confirmed!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Reference key (if payment is complete) */}
      {isPaymentComplete && items.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Reference Key</h4>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm font-mono break-all">
            {items[0].referenceKey}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Present this reference key to the provider to verify your booking
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentStatusDisplay; 