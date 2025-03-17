'use client'

import { useRef } from 'react'

export function FunchalMap() {
  const mapUrl = 'https://btcmap.org/map#10/32.650/-16.908'
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
        
        <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden relative">
          <div className="w-full h-[600px]">
            <iframe 
              ref={iframeRef}
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
      </div>
    </div>
  )
} 