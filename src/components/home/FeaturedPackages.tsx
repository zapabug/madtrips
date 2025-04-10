'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FEATURED_PACKAGES, formatSats } from '../../data/packages';
import { Package } from '../../types/index';

export function FeaturedPackages() {
  // No more API calls, using the direct hardcoded data
  const [packages] = useState<Package[]>(FEATURED_PACKAGES);

  return (
    <div className="bg-gradient-to-b from-[#003366] via-[#14857C] to-[#003366] py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">Featured Packages</h2>
          <p className="mt-2 text-lg leading-8 text-gray-300">
            Discover our curated Bitcoin travel experiences
          </p>
        </div>

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
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-white group-hover:text-[#F7931A] transition-colors">
                    <Link href={`/packages/${pkg.id}`} aria-label={`View details for ${pkg.title}`} className="focus:outline-none focus:ring-2 focus:ring-[#F7931A] focus:ring-offset-2 rounded-sm">
                      {pkg.title}
                    </Link>
                  </h3>
                  <p className="mt-5 text-sm leading-6 text-gray-300">{pkg.description}</p>
                  <ul className="mt-4 space-y-2" aria-label={`Features of ${pkg.title}`}>
                    {pkg.includes.map((feature, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-center">
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
        
        <div className="text-center mt-12">
          <Link 
            href="/packages"
            className="px-8 py-3 bg-[#F7931A] text-white rounded-lg hover:bg-[#F7931A]/90 transition-colors"
          >
            View All Packages
          </Link>
        </div>
      </div>
    </div>
  );
} 