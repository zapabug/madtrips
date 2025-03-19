'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PACKAGES, formatSats } from '../../data/packages';
import { Package } from '../../types/index';

export default function PackagesPage() {
  // No more API calls, using the direct hardcoded data
  const [packages] = useState<Package[]>(PACKAGES);

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