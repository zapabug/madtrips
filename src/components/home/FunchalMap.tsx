'use client'

export function FunchalMap() {
  return (
    <div className="bg-gradient-to-b from-sand/30 to-white dark:from-ocean/10 dark:to-gray-900 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-ocean dark:text-white sm:text-4xl">
            Bitcoin-Friendly Map
          </h2>
          <p className="mt-4 text-lg text-forest/70 dark:text-gray-400">
            Explore Bitcoin-accepting businesses within 20km of Funchal
          </p>
        </div>
        
        <div className="w-full h-[600px] rounded-lg overflow-hidden border border-sand/20 dark:border-gray-700 shadow-lg">
          <iframe 
            src="https://btcmap.org/map#12/32.650/-16.908" 
            width="100%" 
            height="100%" 
            frameBorder="0"
            title="Bitcoin-friendly businesses in Funchal"
          ></iframe>
        </div>
      </div>
    </div>
  )
} 