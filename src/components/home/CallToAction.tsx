import Link from 'next/link'

export function CallToAction() {
  return (
    <div className="bg-ocean">
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to start your Bitcoin adventure?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-sand">
            Join our community of Bitcoin travelers and experience Madeira like never before.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/packages"
              className="rounded-md bg-bitcoin px-3.5 py-2.5 text-sm font-semibold text-ocean shadow-sm hover:bg-bitcoin/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bitcoin"
            >
              Book Now
            </Link>
            <Link href="/community" className="text-sm font-semibold leading-6 text-white">
              Join Community <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 