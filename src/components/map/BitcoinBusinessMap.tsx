'use client'

import React, { useRef, useState, useEffect } from 'react';

interface BitcoinBusinessMapProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

const BitcoinBusinessMap: React.FC<BitcoinBusinessMapProps> = ({
  width = '100%',
  height = 600,
  className = ''
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapUrl = 'https://btcmap.org/map/#11/32.650/-16.908';
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleLoad = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      }
    };
  }, []);

  return (
    <div className={`bitcoin-map-container ${className}`}>
      <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden relative">
        <div className="w-full" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
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
              width={width}
              height={height}
              style={{ width: '100%', height: '100%' }}
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
  );
};

export default BitcoinBusinessMap; 