import Link from 'next/link'

const packages = [
  {
    id: 1,
    title: 'Bitcoin & Business Teambuilding Retreat',
    description: 'Perfect for Bitcoin startups and remote teams. Includes coworking sessions, community meetups, and team activities.',
    duration: '5-7 days',
    price: '1.2 BTC',
    image: 'bg-ocean',
    features: ['Bitcoin-friendly hotel', 'Daily coworking sessions', 'Community meetups', 'Team activities'],
  },
  {
    id: 2,
    title: 'Ultimate Madeira Adventure',
    description: '100% Bitcoin-accepted adventure for digital nomads. Experience Madeira\'s natural wonders with complete Bitcoin integration.',
    duration: '5 days',
    price: '0.8 BTC',
    image: 'bg-forest',
    features: ['Bitcoin-only hotels', 'Jeep safari', 'Whale watching', 'Adventure activities'],
  },
  {
    id: 3,
    title: 'Couples Escape',
    description: 'Romantic getaway for Bitcoin-loving couples. Experience luxury and adventure in Madeira\'s most beautiful locations.',
    duration: '4-5 days',
    price: '0.9 BTC',
    image: 'bg-bitcoin',
    features: ['Boutique hotel', 'Sunset dinner', 'Private sailing', 'Spa treatments'],
  },
  {
    id: 4,
    title: 'Bitcoin Pioneer Tour',
    description: 'Live entirely on Bitcoin in Madeira. Experience a true circular Bitcoin economy with no fiat transactions.',
    duration: '7 days',
    price: '1.5 BTC',
    image: 'bg-ocean',
    features: ['100% Bitcoin lifestyle', 'Self-custody workshop', 'Local meetups', 'Bitcoin scavenger hunt'],
  },
  {
    id: 5,
    title: 'Custom VIP Experience',
    description: 'Luxury Bitcoin-only experience for high-net-worth individuals. Exclusive activities and premium services.',
    duration: 'Flexible',
    price: 'Custom',
    image: 'bg-forest',
    features: ['Luxury villa/yacht', 'Private networking', 'Helicopter tours', 'VIP concierge'],
  },
]

export function FeaturedPackages() {
  return (
    <div className="bg-white dark:bg-gray-900 py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ocean dark:text-white sm:text-4xl md:text-5xl">Featured Packages</h2>
          <p className="mt-2 text-lg leading-8 text-forest/80 dark:text-gray-400">
            Discover our curated Bitcoin-friendly travel experiences
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:mt-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {packages.map((pkg) => (
            <article key={pkg.id} className="flex flex-col items-start group">
              <div className={`relative w-full h-48 rounded-2xl ${pkg.image} opacity-80 transition-all duration-300 group-hover:opacity-100 group-hover:scale-[1.02] overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              <div className="max-w-xl w-full">
                <div className="mt-6 flex items-center gap-x-4 text-xs">
                  <span className="text-bitcoin font-semibold">{pkg.price}</span>
                  <span className="text-forest/50 dark:text-gray-400">•</span>
                  <span className="text-forest/70 dark:text-gray-400">{pkg.duration}</span>
                </div>
                <div className="group relative">
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-ocean dark:text-white group-hover:text-bitcoin transition-colors">
                    <Link href={`/packages/${pkg.id}`} aria-label={`View details for ${pkg.title}`} className="focus:outline-none focus:ring-2 focus:ring-bitcoin focus:ring-offset-2 rounded-sm">
                      {pkg.title}
                    </Link>
                  </h3>
                  <p className="mt-5 text-sm leading-6 text-forest/80 dark:text-gray-300">{pkg.description}</p>
                  <ul className="mt-4 space-y-2" aria-label={`Features of ${pkg.title}`}>
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="text-sm text-forest/60 dark:text-gray-400 flex items-center">
                        <span className="text-bitcoin mr-2" aria-hidden="true">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Link 
                      href={`/packages/${pkg.id}`}
                      className="text-sm font-medium text-bitcoin hover:text-bitcoin/80 transition-colors flex items-center"
                      aria-label={`Book ${pkg.title} package`}
                    >
                      Book this package
                      <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
} 