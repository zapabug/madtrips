import { Metadata } from 'next'
import Link from 'next/link'
import { FeaturedPackages } from '@/components/home/FeaturedPackages'

export const metadata: Metadata = {
  title: 'Travel Packages | MadTrips',
  description: 'Browse our curated Bitcoin-friendly travel packages in Madeira. From adventure to relaxation, all payable with Bitcoin.',
}

export default function PackagesPage() {
  return (
    <div className="bg-white dark:bg-gray-900 py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ocean dark:text-white sm:text-4xl md:text-5xl">
            Bitcoin-Friendly Travel Packages
          </h1>
          <p className="mt-4 text-lg leading-8 text-forest/80 dark:text-gray-400">
            Discover our curated Bitcoin-friendly travel experiences in Madeira
          </p>
        </div>
        
        {/* Custom Package Banner */}
        <div className="mt-12 bg-gradient-to-r from-ocean to-forest rounded-xl overflow-hidden">
          <div className="px-6 py-12 sm:px-12 sm:py-16 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-white text-center sm:text-left">
              <h2 className="text-3xl font-bold mb-2 text-bitcoin">Create Your Own Experience</h2>
              <p className="text-sand max-w-lg">
                Mix and match activities to build your perfect custom Bitcoin-friendly travel package
              </p>
            </div>
            <Link 
              href="/packages/custom" 
              className="px-8 py-3 rounded-lg bg-bitcoin text-white font-semibold hover:bg-bitcoin/90 transition-colors whitespace-nowrap"
            >
              Build Custom Package
            </Link>
          </div>
        </div>
        
        {/* Featured packages */}
        <div id="packages" className="mt-16">
          <FeaturedPackages />
        </div>
      </div>
    </div>
  )
} 