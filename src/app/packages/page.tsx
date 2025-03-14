import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Travel Packages | MadTrips',
  description: 'Explore our curated Bitcoin-friendly travel packages',
}

export default function PackagesPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Travel Packages</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Package cards will go here */}
      </div>
    </main>
  )
} 