'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package } from '@/types';
import { api } from '@/lib/api';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPackages() {
      try {
        setLoading(true);
        console.log('Fetching packages from API...');
        const response = await api.getPackages() as { packages: Package[] };
        console.log('Packages response:', response);
        setPackages(response.packages);
        setError(null);
      } catch (err) {
        console.error('Error fetching packages:', err);
        if (err instanceof Error) {
          setError(`Failed to load packages: ${err.message}`);
        } else {
          setError('Failed to load packages. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPackages();
  }, []);

  // Helper function to format satoshi amount to BTC
  const formatSats = (sats: number) => {
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6 text-[#F7931A]">Bitcoin-Friendly Travel Packages</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-3xl">
        Explore Madeira with our curated travel packages, all payable with Bitcoin via Lightning Network. 
        Enjoy hassle-free booking and instant confirmation.
      </p>
      
      {/* Build Your Own Package Button */}
      <div className="mb-10">
        <Link 
          href="/packages/custom" 
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-md text-lg font-semibold transition-all shadow-md hover:shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Build Your Own Package
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div 
            key={pkg.id} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow"
          >
            <div className="relative h-48">
              <Image
                src={pkg.image || '/assets/placeholder.jpg'}
                alt={pkg.title}
                fill
                className="object-cover"
              />
            </div>
            
            <div className="p-6 flex flex-col flex-grow">
              <h2 className="text-xl font-bold mb-2 text-ocean dark:text-[#F7931A]">{pkg.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4 flex-grow">{pkg.description}</p>
              
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{pkg.duration}</span>
                <span className="font-semibold text-[#F7931A]">{formatSats(pkg.price)}</span>
              </div>
              
              <Link 
                href={`/packages/${pkg.id}`} 
                className="px-4 py-2 bg-[#F7931A] hover:bg-[#F7931A]/80 text-white rounded-md text-center font-medium transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 