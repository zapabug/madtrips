import { Metadata } from 'next'
import Link from 'next/link'
import { NostrProfileImage } from '@/components/community/NostrProfileImage'
import SocialGraph from './SocialGraph'

export const metadata: Metadata = {
  title: 'Bitcoin Community | MadTrips',
  description: 'Explore the Bitcoin community in Madeira through interactive social graphs.'
}

export default function Community() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24 bg-sand/10 dark:bg-gray-900">
      <div className="z-10 max-w-7xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-forest dark:text-white mb-4">
            Bitcoin Community in Madeira
          </h1>
          <p className="text-lg text-forest/80 dark:text-gray-300">
            Explore the Bitcoin community connections in Madeira.
          </p>
        </div>
        
        <div className="mb-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
            <NostrProfileImage 
              npub="npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e" 
              width={120} 
              height={120} 
              alt="Free Madeira" 
              className="flex-shrink-0"
            />
            <div>
              <h2 className="text-2xl font-semibold text-forest dark:text-white mb-2">
                Free Madeira Community
              </h2>
              <p className="text-forest/70 dark:text-gray-400 mb-4">
                The Free Madeira organization works to promote Bitcoin adoption and education in Madeira.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link 
                  href="https://freemadeira.com" 
                  target="_blank"
                  className="text-sm px-3 py-1 bg-bitcoin text-white rounded-full hover:bg-bitcoin/90 transition-colors"
                >
                  Visit Website
                </Link>
                <Link 
                  href="https://iris.to/npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e" 
                  target="_blank" 
                  className="text-sm px-3 py-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
                >
                  Follow on Nostr
                </Link>
                <span className="text-sm px-3 py-1 bg-ocean/80 text-white rounded-full">
                  42 Followers
                </span>
                <span className="text-sm px-3 py-1 bg-forest/80 text-white rounded-full">
                  28 Following
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Social Graph Visualization (Client Component) */}
        <SocialGraph />
        
        <div className="text-center mt-16">
          <h2 className="text-2xl font-semibold text-forest dark:text-white mb-4">
            Join the Bitcoin Community
          </h2>
          <p className="text-forest/70 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Connect with Bitcoin enthusiasts, businesses, and educators in Madeira. Join the vibrant community 
            and be part of the Bitcoin revolution on this beautiful island.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://freemadeira.com" 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 bg-bitcoin text-white rounded-md hover:bg-bitcoin/90 transition-colors"
            >
              Free Madeira
            </a>
            <a 
              href="https://www.madbitcoin.org" 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 bg-ocean text-white rounded-md hover:bg-ocean/90 transition-colors"
            >
              Mad Bitcoin
            </a>
            <a 
              href="https://iris.to/npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e" 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
            >
              Connect on Nostr
            </a>
          </div>
          
          <div className="mt-12 text-center">
            <Link 
              href="/admin/socialgraph" 
              className="text-sm text-gray-500 hover:text-purple-500 transition-colors"
            >
              Manage Social Graph
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
} 