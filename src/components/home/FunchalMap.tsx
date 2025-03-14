'use client'

export function FunchalMap() {
  return (
    <div className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-ocean sm:text-4xl">
            Bitcoin-Friendly Map
          </h2>
          <p className="mt-4 text-lg text-forest/70">
            Explore Bitcoin-accepting businesses within 20km of Funchal
          </p>
        </div>
        
        <div className="w-full h-[600px] rounded-lg overflow-hidden border border-sand/20 shadow-lg">
          <iframe
            src="https://btcmap.org/map?lat=32.6496&lon=-16.9086&zoom=12"
            className="w-full h-full"
            title="Bitcoin-friendly businesses in Funchal"
            loading="lazy"
            allow="geolocation"
          />
        </div>
      </div>
    </div>
  )
} 