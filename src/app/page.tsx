import { Metadata } from 'next'
import { Hero } from '@/components/home/Hero'
import { FeaturedPackages } from '@/components/home/FeaturedPackages'
import { CallToAction } from '@/components/home/CallToAction'
import { FunchalMap } from '@/components/home/FunchalMap'

export const metadata: Metadata = {
  title: 'MadTrips - Bitcoin-Friendly Travel in Madeira',
  description: 'Discover and book Bitcoin-friendly travel experiences in Madeira. Experience the perfect blend of natural beauty and digital innovation.',
}

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeaturedPackages />
      <FunchalMap />
      <CallToAction />
    </main>
  )
}
