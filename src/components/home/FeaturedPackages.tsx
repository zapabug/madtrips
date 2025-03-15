'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Package } from '@/types';

export function FeaturedPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPackages() {
      try {
        setLoading(true);
        const response = await api.getPackages() as { packages: Package[] };
        setPackages(response.packages);
        setError(null);
      } catch (err) {
        console.error('Error fetching packages:', err);
        setError('Failed to load packages');
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

  return (
    <div className="bg-white dark:bg-gray-900 py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ocean dark:text-[#F7931A] sm:text-4xl md:text-5xl">Featured Packages</h2>
          <p className="mt-2 text-lg leading-8 text-forest/80 dark:text-gray-400">
            Discover our curated Bitcoin-friendly travel experiences
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F7931A]" />
          </div>
        ) : error ? (
          <div className="mx-auto mt-12 max-w-2xl text-center">
            <p className="text-red-500">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-[#F7931A] text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:mt-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {packages.map((pkg) => (
              <article key={pkg.id} className="flex flex-col items-start group">
                <div className="relative w-full h-48 rounded-2xl overflow-hidden">
                  <Image
                    src={pkg.image || '/assets/placeholder.jpg'}
                    alt={pkg.title}
                    fill
                    className="object-cover transition-all duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <div className="max-w-xl w-full">
                  <div className="mt-6 flex items-center gap-x-4 text-xs">
                    <span className="text-[#F7931A] font-semibold">{formatSats(pkg.price)}</span>
                    <span className="text-forest/50 dark:text-gray-400">•</span>
                    <span className="text-forest/70 dark:text-gray-400">{pkg.duration}</span>
                  </div>
                  <div className="group relative">
                    <h3 className="mt-3 text-lg font-semibold leading-6 text-ocean dark:text-white group-hover:text-[#F7931A] transition-colors">
                      <Link href={`/packages/${pkg.id}`} aria-label={`View details for ${pkg.title}`} className="focus:outline-none focus:ring-2 focus:ring-[#F7931A] focus:ring-offset-2 rounded-sm">
                        {pkg.title}
                      </Link>
                    </h3>
                    <p className="mt-5 text-sm leading-6 text-forest/80 dark:text-gray-300">{pkg.description}</p>
                    <ul className="mt-4 space-y-2" aria-label={`Features of ${pkg.title}`}>
                      {pkg.includes.map((feature, index) => (
                        <li key={index} className="text-sm text-forest/60 dark:text-gray-400 flex items-center">
                          <span className="text-[#F7931A] mr-2" aria-hidden="true">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      <Link 
                        href={`/packages/${pkg.id}`}
                        className="text-sm font-medium text-[#F7931A] hover:text-[#F7931A]/80 transition-colors flex items-center"
                        aria-label={`Book ${pkg.title} package`}
                      >
                        Book this package
                        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 