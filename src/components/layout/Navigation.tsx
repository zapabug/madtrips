'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Packages', href: '/packages' },
  { name: 'Map', href: '/map' },
  { name: 'Community', href: '/community' },
]

export function Navigation() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="bg-white shadow-md border-b border-sand">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-ocean hover:text-bitcoin transition-colors">
                MadTrips
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    mounted && pathname === item.href
                      ? 'border-bitcoin text-ocean'
                      : 'border-transparent text-forest hover:border-bitcoin/50 hover:text-bitcoin'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
} 