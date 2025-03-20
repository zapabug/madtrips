'use client'

import React, { useRef } from 'react';

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

  return (
    <div className={`bitcoin-map-container ${className}`}>
      <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden relative">
        <div className="w-full" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
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
        </div>
      </div>
    </div>
  );
};

export default BitcoinBusinessMap; 