import { Metadata } from 'next'
import Link from 'next/link'
import { NostrProfileImage } from '@/components/community/NostrProfileImage'
import { SocialGraph } from './SocialGraph'

export const metadata: Metadata = {
  title: 'Bitcoin Community | MadTrips',
  description: 'Explore the Bitcoin community in Madeira through interactive social graphs.'
}

export default function CommunityPage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Community</h1>
      <div 
        className="w-full bg-white rounded-lg shadow-md overflow-hidden"
        style={{ height: '600px' }}
      >
        <SocialGraph />
      </div>
    </main>
  )
} 