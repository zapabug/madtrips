import Link from 'next/link'

export function Hero() {
  return (
    <div className="relative bg-gradient-to-br from-ocean via-ocean/90 to-forest overflow-hidden min-h-[80vh] flex items-center">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="relative max-w-7xl mx-auto w-full">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8">
          <main className="mx-auto max-w-7xl">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-bitcoin/10 text-bitcoin border border-bitcoin/20 mb-8">
                🌊 Madeira's First Bitcoin-Only Travel Platform
              </div>
              <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="block">Discover Madeira</span>
                <span className="block text-bitcoin mt-3">with Bitcoin</span>
              </h1>
              <p className="mt-3 text-base text-sand sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                Experience the perfect blend of natural beauty and digital innovation. Book your Bitcoin-friendly adventure in Madeira today.
              </p>
            </div>
          </main>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute inset-y-0 right-0 w-1/2 hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-l from-forest/20 to-transparent" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
      </div>
    </div>
  )
} 