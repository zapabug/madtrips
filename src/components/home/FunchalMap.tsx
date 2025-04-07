'use client'

import { useRef, useEffect, useState } from 'react'

export function FunchalMap() {
  const mapUrl = 'https://btcmap.org/map#11/32.74087/-17.01636'
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const handleLoad = () => {
      setIsLoading(false)
    }

    const handleError = () => {
      setIsLoading(false)
      setHasError(true)
    }

    const iframe = iframeRef.current
    if (iframe) {
      iframe.addEventListener('load', handleLoad)
      iframe.addEventListener('error', handleError)
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleLoad)
        iframe.removeEventListener('error', handleError)
      }
    }
  }, [])

  return (
    <div className="bg-gradient-to-b from-sand/30 to-white dark:from-ocean/10 dark:to-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold tracking-tight text-[#f7931a] dark:text-[#f7931a] sm:text-3xl">
            Bitcoin Map
          </h2>
        </div>
        
        <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden">
          <div className="w-full h-[250px] aspect-[3/1] sm:h-[400px] lg:h-[500px] relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7931a]"></div>
              </div>
            )}
            {hasError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <div className="text-center p-4">
                  <p className="text-gray-600 dark:text-gray-400">Unable to load map</p>
                  <a 
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f7931a] hover:text-[#f7931a]/80 mt-2 inline-block"
                  >
                    Open in new tab
                  </a>
                </div>
              </div>
            ) : (
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
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 