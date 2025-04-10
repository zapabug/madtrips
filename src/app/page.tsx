import { Metadata } from 'next'
import { Hero } from '../components/home/Hero'
import { FeaturedPackages } from '../components/home/FeaturedPackages'
import { CallToAction } from '../components/home/CallToAction'
import { FunchalMap } from '../components/home/FunchalMap'

export const metadata: Metadata = {
  title: 'MadTrips - Bitcoin-Friendly Travel in Madeira',
  description: 'Discover and book Bitcoin-friendly travel experiences in Madeira. Experience the perfect blend of natural beauty and digital innovation.',
}

export default function HomePage() {
  return (
    <main>
      <section id="home">
        <Hero />
      </section>
      <section id="packages">
        <FeaturedPackages />
      </section>

      {/* New Title Section */}
      <div className="bg-[#666666] py-4 border-t-[3px] border-b-[3px] border-[#666666]">
        <h2 className="text-3xl font-bold text-center text-bitcoin">
          Explore bitcoin businesses Madeira
        </h2>
      </div>

      {/* Map Section - Borders removed */}
      <section 
        id="map" 
        className="bg-[#003366]" // Removed borders
      >
         <FunchalMap />
      </section>

      <CallToAction />
    </main>
  )
}
