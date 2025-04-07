/**
 * Community Page - Showcases the Bitcoin Madeira community connections and activity.
 */

import { SocialGraphVisualization, CommunityFeed, MadeiraFeed } from '../../components/community';

export const metadata = {
  title: 'MadTrips - Bitcoin Madeira Community',
  description: 'Connect with the Bitcoin Madeira community, view relationships, and stay up to date with the latest posts.',
}

export default function CommunityPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Bitcoin Madeira Community</h1>
      
      <div className="space-y-12">
        {/* Web of Trust visualization section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Community Connections</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Explore the Bitcoin Madeira web of trust - visualizing connections between community members 
              and their extended networks. The graph now shows friends-of-friends for a richer 
              social network visualization.
            </p>
          </div>
            
          <div className="px-6 pb-6">
            <SocialGraphVisualization 
              height={600} 
              width="100%" 
              showSecondDegree={true}
            />
          </div>
        </section>
        
        {/* Madeira Image Feed section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Madeira Moments</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Photos shared by the Madeira Bitcoin community and their connections. 
              This feed shows images with #madeira related hashtags from your network.
            </p>
          </div>
          
          <div className="px-6 pb-6">
            <div className="h-[400px]">
              <MadeiraFeed useCorePubs={true} />
            </div>
          </div>
        </section>
        
        {/* Community Feed section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Community Feed</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              The latest posts from Bitcoin Madeira community members. Stay up to date with 
              discussions, announcements, and activities.
            </p>
          </div>
          
          <div className="px-6 pb-6">
            <CommunityFeed limit={30} />
          </div>
        </section>
      </div>
    </div>
  )
} 