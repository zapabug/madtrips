'use client'

import { useState } from 'react'

export function FunchalMap() {
  const [searchTerm, setSearchTerm] = useState('')
  const [mapUrl, setMapUrl] = useState('https://btcmap.org/map#10/32.650/-16.908')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      // Update the map URL with the search parameter
      // Fixed URL format to properly handle query parameters with the fragment
      setMapUrl(`https://btcmap.org/map?q=${encodeURIComponent(searchTerm)}#10/32.650/-16.908`)
    } else {
      // Reset to default view if search is empty
      setMapUrl('https://btcmap.org/map#10/32.650/-16.908')
    }
  }

  return (
    <div className="bg-gradient-to-b from-sand/30 to-white dark:from-ocean/10 dark:to-gray-900 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#f7931a] dark:text-[#f7931a] sm:text-4xl">
            Explore Map
          </h2>
          <p className="mt-4 text-lg text-sand dark:text-sand/80">
            Discover and support Lightning ready businesses in Madeira.<br />
            All these locations accept Bitcoin payments.
          </p>
        </div>
        
        {/* Improved container with responsive border that aligns properly with the map */}
        <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden">
          <div className="w-full h-[600px]">
            <iframe 
              src={mapUrl} 
              width="100%" 
              height="100%" 
              frameBorder="0"
              title="Bitcoin-friendly businesses in Funchal"
              className="w-full h-full"
              loading="lazy"
              allow="geolocation"
            ></iframe>
          </div>
        </div>

        {/* Search Function */}
        <div className="mt-8 max-w-md mx-auto">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for businesses (e.g., cafe, restaurant)"
              className="flex-grow px-4 py-2 rounded-md border border-sand/30 dark:border-gray-700 bg-white dark:bg-gray-800 text-forest dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean"
              aria-label="Search for businesses"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-[#f7931a] hover:bg-[#f7931a]/90 text-white font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f7931a]"
              aria-label="Submit search"
            >
              Search
            </button>
          </form>
          <p className="mt-2 text-sm text-sand dark:text-sand/80">
            Search for Bitcoin-accepting businesses in Madeira
          </p>
        </div>
      </div>
    </div>
  )
} 