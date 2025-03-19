import { Metadata } from 'next'
import { MultiTipJar } from '../../components/tip/MultiTipJar'

export const metadata: Metadata = {
  title: 'Bitcoin Business Map | MadTrips',
  description: 'Discover Bitcoin-friendly businesses around Funchal, Madeira',
}

export default function MapPage() {
  const mapUrl = 'https://btcmap.org/map/#11/32.650/-16.908'

  return (
    <div className="bg-gradient-to-b from-sand/30 to-white dark:from-ocean/10 dark:to-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[#f7931a] dark:text-[#f7931a] sm:text-5xl mb-4">
            Bitcoin Business Map
          </h1>
          <p className="text-lg text-sand dark:text-sand/80">
            Find and explore Bitcoin and Lightning Network-accepting businesses in Madeira. Discover places where you can spend your sats!
          </p>
        </div>
        
        <div className="w-full overflow-hidden">
          <div className="w-full border-4 border-forest dark:border-forest/80 rounded-lg shadow-xl overflow-hidden relative">
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
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              ></iframe>
            </div>
          </div>
        </div>
        
        <div className="mt-8 max-w-3xl mx-auto text-center">
          <li>Bitcoin & Lightning enabled businesses in Madeira</li>
          <li>Data is added by community members</li>
        </div>
        
        {/* MultiTipJar component */}
        <div className="mt-16">
          <MultiTipJar />
        </div>
      </div>
    </div>
  )
} 