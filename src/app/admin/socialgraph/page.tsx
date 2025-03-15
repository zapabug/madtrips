import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Social Graph Admin | MadTrips',
  description: 'Admin controls for Nostr social graph data collection.'
}

export default function SocialGraphAdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Social Graph Admin</h1>
      
      {/* Simple alternative that doesn't require import */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm">
          <h2 className="font-bold mb-4">Add New npub</h2>
          <p className="mb-2">Add this npub via API:</p>
          <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mb-4 overflow-x-auto">
            npub10p5gc8ehreaey0v4x6xf9xxv5pkpas9gn65f02scr0tqpygjrl4q2900zw
          </pre>
          <a 
            href="/api/socialgraph?update=true" 
            className="inline-block px-4 py-2 bg-bitcoin/80 hover:bg-bitcoin text-white rounded-md"
          >
            Force Update Now
          </a>
        </div>
      </div>
      
      <div className="mt-4">
        <Link href="/community" className="text-bitcoin hover:underline">
          ← Back to Community Page
        </Link>
      </div>
    </div>
  )
} 