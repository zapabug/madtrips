import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Business Map | MadTrips',
  description: 'Discover Bitcoin-friendly businesses around the world',
}

export default function MapPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Bitcoin Business Map</h1>
      <div className="h-[600px] w-full bg-gray-100 rounded-lg">
        {/* Map component will go here */}
      </div>
    </main>
  )
} 