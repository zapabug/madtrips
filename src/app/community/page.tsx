import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community | MadTrips',
  description: 'Connect with other Bitcoin travelers',
}

export default function CommunityPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Community</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Check-ins and updates will go here */}
        </div>
        <div>
          {/* Sidebar with community stats will go here */}
        </div>
      </div>
    </main>
  )
} 