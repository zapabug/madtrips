'use client';

import React, { useState, useEffect } from 'react';
import { PaymentMethod } from '../../types/cart-types';

interface PaymentMethodSelectorProps {
  amount: number; // Amount in sats
  onSelect: (method: PaymentMethod) => void;
  showMixedOption?: boolean;
  initialMethod?: PaymentMethod;
}

/**
 * Payment Method Selector
 * Implements the business rules for payment methods:
 * - Lightning for payments up to 900k sats
 * - On-Chain BTC for purchases over 900k sats
 * - eCash only for payments under 150k sats (except tips)
 * - Mixed (split between Lightning & On-Chain)
 */
const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  amount,
  onSelect,
  showMixedOption = false,
  initialMethod
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(initialMethod || 'lightning');
  
  // Calculate available payment methods based on amount
  const getAvailableMethods = (): PaymentMethod[] => {
    const methods: PaymentMethod[] = [];
    
    // eCash for small payments (under 150k sats)
    if (amount < 150_000) {
      methods.push('ecash');
    }
    
    // Lightning for payments up to 900k sats
    if (amount <= 900_000) {
      methods.push('lightning');
    }
    
    // On-chain for larger payments
    if (amount > 900_000) {
      methods.push('onchain');
    }
    
    // Mixed option (if enabled)
    if (showMixedOption && amount > 200_000) {
      methods.push('mixed');
    }
    
    return methods;
  };
  
  const availableMethods = getAvailableMethods();
  
  // Update selected method when available methods change
  useEffect(() => {
    // If current selection is not available, pick the first available
    if (!availableMethods.includes(selectedMethod) && availableMethods.length > 0) {
      setSelectedMethod(availableMethods[0]);
      onSelect(availableMethods[0]);
    }
  }, [availableMethods, selectedMethod, onSelect]);
  
  // Set initial selection
  useEffect(() => {
    if (initialMethod && availableMethods.includes(initialMethod)) {
      setSelectedMethod(initialMethod);
    } else if (availableMethods.length > 0) {
      setSelectedMethod(availableMethods[0]);
      onSelect(availableMethods[0]);
    }
  }, []);
  
  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    onSelect(method);
  };
  
  // Get display info for payment method
  const getMethodInfo = (method: PaymentMethod) => {
    switch (method) {
      case 'lightning':
        return {
          name: 'Lightning',
          description: 'Fast, low fees, best for payments up to 900,000 sats',
          icon: '⚡'
        };
      case 'onchain':
        return {
          name: 'On-Chain Bitcoin',
          description: 'Slower, higher fees, best for larger payments',
          icon: '₿'
        };
      case 'ecash':
        return {
          name: 'eCash (Nutzaps)',
          description: 'Instant, best for smaller payments up to 150,000 sats',
          icon: '💵'
        };
      case 'mixed':
        return {
          name: 'Mixed Payment',
          description: '999,000 sats via Lightning, remaining via On-Chain',
          icon: '⚡₿'
        };
      default:
        return {
          name: 'Unknown',
          description: '',
          icon: '?'
        };
    }
  };
  
  if (availableMethods.length === 0) {
    return <div className="text-red-500">No payment methods available for this amount</div>;
  }
  
  // If only one method is available, show it without options
  if (availableMethods.length === 1) {
    const method = availableMethods[0];
    const info = getMethodInfo(method);
    
    return (
      <div className="mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-lg">
              <span className="mr-2">{info.icon}</span>
              {info.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{info.description}</p>
          </div>
          <div className="h-4 w-4 rounded-full bg-green-500"></div>
        </div>
      </div>
    );
  }
  
  // Multiple payment methods available
  return (
    <div className="payment-method-selector mb-4">
      <h3 className="text-lg font-medium mb-3">Select Payment Method</h3>
      
      <div className="space-y-3">
        {availableMethods.map(method => {
          const info = getMethodInfo(method);
          
          return (
            <div
              key={method}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedMethod === method
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleMethodChange(method)}
            >
              <div className="flex items-center">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 ${
                  selectedMethod === method
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedMethod === method && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h4 className="font-medium">
                    <span className="mr-2">{info.icon}</span>
                    {info.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{info.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Info about when to use each payment method */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded">
        <p className="mb-1">⚡ Lightning: Fast payments up to 900,000 sats</p>
        <p className="mb-1">₿ On-Chain: Larger payments over 900,000 sats</p>
        <p className="mb-1">💵 eCash: Small payments under 150,000 sats</p>
        {showMixedOption && (
          <p>⚡₿ Mixed: Splits payment between Lightning and On-Chain</p>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodSelector; 