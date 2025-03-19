'use client';

import React, { useState } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { LightningPaymentButton } from '../LightningPaymentButton';
import { BRAND_COLORS } from '../../constants/brandColors';

// Define the tip jar options
const tipOptions = [
  {
    id: 'common-zents',
    name: 'Common Zents',
    description: 'Support Free Madeira & MadTrips',
    lnAddress1: 'freemadeira@getalby.com',
    lnAddress2: 'madtrips@getalby.com',
    split: [0.75, 0.25]
  },
  {
    id: 'madzaps',
    name: 'MadZaps',
    description: 'Support MadTrips',
    lnAddress1: 'madtrips@getalby.com',
    lnAddress2: '',
    split: [1, 0]
  },
  {
    id: 'tips-for-nips',
    name: 'Tips for NIPs',
    description: 'Support Sovereign Engineering & MadTrips',
    lnAddress1: 'sovereign@getalby.com',
    lnAddress2: 'madtrips@getalby.com',
    split: [0.75, 0.25]
  }
];

// Preset amounts
const presetAmounts = [21, 210, 2100];

export function MultiTipJar() {
  const { user } = useNostr();
  const [selectedOption, setSelectedOption] = useState(tipOptions[0]);
  const [amount, setAmount] = useState(210);
  const [invoice, setInvoice] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  const generateInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      // This is a placeholder for actual invoice generation logic
      // In a real implementation, you would call your backend to generate a split invoice
      const response = await fetch('/api/generate-split-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          option: selectedOption.id,
          lnAddress1: selectedOption.lnAddress1,
          lnAddress2: selectedOption.lnAddress2,
          split: selectedOption.split,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate invoice');
      }
      
      const data = await response.json();
      setInvoice(data.invoice);
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSuccess = () => {
    setTipSuccess(true);
    setTimeout(() => {
      setTipSuccess(false);
      setInvoice('');
    }, 3000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-xl mx-auto my-8">
      <h2 className="text-2xl font-bold text-bitcoin mb-4 text-center">Support with Lightning</h2>
      
      {tipSuccess ? (
        <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg mb-4 text-center">
          <p className="text-green-800 dark:text-green-100 font-medium">Thank you for your support! ⚡</p>
        </div>
      ) : null}
      
      <div className="mb-6 grid grid-cols-3 gap-3">
        {tipOptions.map((option) => (
          <button 
            key={option.id}
            className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all ${
              selectedOption.id === option.id
                ? 'bg-bitcoin text-white shadow-lg transform scale-105'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white'
            }`}
            onClick={() => setSelectedOption(option)}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
              selectedOption.id === option.id ? 'bg-white' : 'bg-bitcoin'
            }`}>
              {option.id === 'common-zents' && (
                <span className={`text-xl ${selectedOption.id === option.id ? 'text-bitcoin' : 'text-white'}`}>🛠️</span>
              )}
              {option.id === 'madzaps' && (
                <span className={`text-xl ${selectedOption.id === option.id ? 'text-bitcoin' : 'text-white'}`}>🏝️</span>
              )}
              {option.id === 'tips-for-nips' && (
                <span className={`text-xl ${selectedOption.id === option.id ? 'text-bitcoin' : 'text-white'}`}>⚡</span>
              )}
            </div>
            <h3 className="font-medium text-center text-[#14857C]">{option.name}</h3>
            <p className={`text-xs text-center mt-1 ${selectedOption.id === option.id ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{option.description}</p>
          </button>
        ))}
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tip Amount: {amount} sats
        </label>
        <input 
          type="range" 
          min="1" 
          max="5000" 
          value={amount} 
          onChange={(e) => setAmount(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between mt-4 space-x-2">
          {presetAmounts.map((presetAmount) => (
            <button
              key={presetAmount}
              onClick={() => setAmount(presetAmount)}
              className={`flex-1 py-2 rounded-md text-center font-medium ${
                amount === presetAmount
                  ? 'bg-bitcoin text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {presetAmount}
            </button>
          ))}
        </div>
      </div>
      
      {invoice ? (
        <LightningPaymentButton 
          invoice={invoice}
          onSuccess={handleSuccess}
          buttonText={`Pay ${amount} sats to ${selectedOption.name}`}
          className="w-full py-3 bg-bitcoin hover:bg-bitcoin/90 text-white rounded-md font-medium flex items-center justify-center"
        />
      ) : (
        <button
          onClick={generateInvoice}
          disabled={isGeneratingInvoice || !user}
          className={`w-full py-3 rounded-md font-medium flex items-center justify-center ${
            !user 
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
              : 'bg-bitcoin hover:bg-bitcoin/90 text-white'
          }`}
        >
          {isGeneratingInvoice ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Invoice...
            </>
          ) : !user ? (
            'Log in to Tip'
          ) : (
            <>⚡ Send {amount} sats</>
          )}
        </button>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
        Tips help us continue to improve the Madeira Bitcoin experience!
      </p>
    </div>
  );
} 