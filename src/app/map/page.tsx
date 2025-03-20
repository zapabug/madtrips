import { Metadata } from 'next'
import { MultiTipJar } from '../../components/tip/MultiTipJar'
import BitcoinBusinessMap from '../../components/map/BitcoinBusinessMap'

export const metadata: Metadata = {
  title: 'Bitcoin Business Map | MadTrips',
  description: 'Discover Bitcoin-friendly businesses around Funchal, Madeira',
}

export default function MapPage() {
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
          <BitcoinBusinessMap height={600} />
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