import { Metadata } from 'next'
import { FunchalMap } from '@/components/home/FunchalMap'

export const metadata: Metadata = {
  title: 'Bitcoin Business Map | MadTrips',
  description: 'Discover Bitcoin-friendly businesses around Funchal, Madeira',
}

export default function MapPage() {
  return (
    <div className="bg-gradient-to-b from-sand/30 to-white dark:from-ocean/10 dark:to-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-[#f7931a] dark:text-[#f7931a] sm:text-5xl mb-4">
            Bitcoin Business Map
          </h1>
          <p className="text-lg text-sand dark:text-sand/80">
            Find and explore Bitcoin and Lightning Network-accepting businesses in Madeira. Use the search function below the map to filter by business type.
          </p>
        </div>
        
        <FunchalMap />
      </div>
    </div>
  )
} 