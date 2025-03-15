import { Metadata } from 'next'
import { NostrSocialGraph } from '@/components/community/NostrSocialGraph'

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
            Explore the Bitcoin community social graphs and connections in Madeira.
          </p>
        </div>
        
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-forest dark:text-white mb-4">
            Free Madeira Community
          </h2>
          <p className="text-forest/70 dark:text-gray-400 mb-6">
            The Free Madeira organization works to promote Bitcoin adoption and education in Madeira.
            Below is a visualization of their social connections on Nostr.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <NostrSocialGraph 
              npub="npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh" 
              maxConnections={30}
            />
          </div>
        </div>
        
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-forest dark:text-white mb-4">
            Bitcoin Madeira Explorer
          </h2>
          <p className="text-forest/70 dark:text-gray-400 mb-6">
            The Bitcoin Madeira Explorer focuses on showcasing Bitcoin businesses and opportunities throughout the island.
            Explore their network connections below.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <NostrSocialGraph 
              npub="npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e" 
              maxConnections={25}
            />
          </div>
        </div>
        
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
          </div>
        </div>
      </div>
    </main>
  )
} 