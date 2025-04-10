import Link from 'next/link'

export function Hero() {
  return (
    <div className="relative min-h-[80vh] bg-gradient-to-br from-ocean to-forest">
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-4 max-w-4xl">
          {/* Badge */}
          <div className="inline-block px-4 py-2 rounded-full bg-bitcoin/20 text-white mb-8">
            🌊 Madeira's First Bitcoin-Only Travel Platform
          </div>
          
          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Discover Madeira
            <span className="block mt-2 text-bitcoin">with Bitcoin</span>
          </h1>
          
          {/* Description */}
          <p className="text-lg md:text-xl text-sand mb-8">
            Experience the perfect blend of natural beauty and digital innovation
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/packages"
              className="px-8 py-3 bg-bitcoin text-white rounded-lg hover:bg-bitcoin/90 transition-colors"
            >
              Explore Packages
            </Link>
            <Link 
              href="/map"
              className="px-8 py-3 bg-ocean text-white rounded-lg hover:bg-ocean/90 transition-colors"
            >
              View Bitcoin Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 