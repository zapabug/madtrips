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
        </div>
        
        <FunchalMap />
      </div>
    </div>
  )
} 