'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NostrProfileHeader } from '@/components/community/NostrProfileHeader'

const navigation = [
  { name: 'Home', href: '/', sectionId: 'home' },
  { 
    name: 'Packages', 
    href: '/#packages',
    sectionId: 'packages',
    submenu: [
      { name: 'All Packages', href: '/packages' },
      { name: 'Build Custom Package', href: '/packages/custom' },
    ] 
  },
  { name: 'Map', href: '/#map', sectionId: 'map' },
  { name: 'Community', href: '/community', sectionId: 'community' },
]

// Madtrips agency npub
const MADTRIPS_NPUB = "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Implement intersection observer to track active sections
  useEffect(() => {
    const sectionIds = navigation.map(item => item.sectionId)
    
    const observerOptions = {
      root: null, // viewport
      rootMargin: '-80px 0px -20% 0px', // slightly biased towards the top
      threshold: 0.2 // 20% of the element must be visible
    }
    
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }
    
    const observer = new IntersectionObserver(observerCallback, observerOptions)
    
    sectionIds.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })
    
    return () => observer.disconnect()
  }, [mounted])

  // Set active section based on the pathname when navigation happens
  useEffect(() => {
    // Default to home
    if (pathname === '/') {
      setActiveSection('home')
    }
    
    // Check if we're on the packages page
    if (pathname.includes('/packages')) {
      setActiveSection('packages')
    }
    
    // Check if we're on the community page
    if (pathname.includes('/community')) {
      setActiveSection('community')
    }
    
    // Close menus on navigation
    setMobileMenuOpen(false)
    setOpenSubmenu(null)
  }, [pathname])

  const toggleSubmenu = (name: string) => {
    setOpenSubmenu(prev => prev === name ? null : name)
  }

  const handleSectionNavigation = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    
    // If already on home page, just scroll to the section
    if (pathname === '/') {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // Navigate to home page with the section hash
      router.push(`/#${sectionId}`)
    }
  }

  const isActive = (item: typeof navigation[0]) => {
    if (item.sectionId === activeSection) return true
    if (item.name === 'Packages' && pathname.includes('/packages')) return true
    if (item.name === 'Community' && pathname.includes('/community')) return true
    return false
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-sand dark:border-gray-700 fixed top-0 left-0 right-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-auto py-2">
          <div className="flex-1 flex justify-between items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center text-xl font-bold text-ocean dark:text-bitcoin hover:text-bitcoin transition-colors group">
                <NostrProfileHeader 
                  npub={MADTRIPS_NPUB} 
                  showImage={true}
                  className="text-xl text-ocean dark:text-bitcoin group-hover:text-bitcoin" 
                />
              </Link>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 sm:items-center">
              {navigation.map((item) => (
                <div key={item.name} className="relative group">
                  {item.submenu ? (
                    <>
                      <button
                        className={`inline-flex items-center px-1 pt-1 pb-1 border-b-2 text-sm font-medium ${
                          isActive(item)
                            ? 'border-bitcoin text-ocean dark:text-white'
                            : 'border-transparent text-forest dark:text-gray-300 hover:border-bitcoin/50 hover:text-bitcoin dark:hover:text-bitcoin'
                        } transition-colors`}
                        onClick={(e) => {
                          if (pathname === '/') {
                            // If on home page, scroll to packages section
                            handleSectionNavigation(e, item.sectionId)
                          } else {
                            // Go to home page packages section
                            router.push('/#packages')
                          }
                        }}
                      >
                        {item.name}
                        <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      <div className="absolute left-0 pt-3 top-6 group-hover:block hidden z-50">
                        <div className="w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-sand/20 dark:border-gray-700">
                          <div className="py-1">
                            {item.submenu.map((subitem) => (
                              <Link
                                key={subitem.name}
                                href={subitem.href}
                                className={`block px-4 py-2 text-sm ${
                                  mounted && pathname === subitem.href
                                    ? 'bg-bitcoin/10 dark:bg-bitcoin/20 text-bitcoin'
                                    : 'text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                                }`}
                              >
                                {subitem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : item.name === 'Map' ? (
                    <a
                      href={item.href}
                      onClick={(e) => handleSectionNavigation(e, item.sectionId)}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                        isActive(item)
                          ? 'border-bitcoin text-ocean dark:text-white'
                          : 'border-transparent text-forest dark:text-gray-300 hover:border-bitcoin/50 hover:text-bitcoin dark:hover:text-bitcoin'
                      }`}
                    >
                      {item.name}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                        isActive(item)
                          ? 'border-bitcoin text-ocean dark:text-white'
                          : 'border-transparent text-forest dark:text-gray-300 hover:border-bitcoin/50 hover:text-bitcoin dark:hover:text-bitcoin'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <div className="sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-forest dark:text-gray-300 hover:text-bitcoin dark:hover:text-bitcoin hover:bg-sand/20 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-bitcoin"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-sand/20 dark:border-gray-700" id="mobile-menu">
          <div className="py-2 space-y-1 bg-white dark:bg-gray-800">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.submenu ? (
                  <>
                    <button
                      className={`w-full flex justify-between items-center py-3 px-4 text-base font-medium ${
                        isActive(item)
                          ? 'bg-bitcoin/10 dark:bg-bitcoin/20 text-bitcoin'
                          : 'text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                      }`}
                      onClick={() => toggleSubmenu(item.name)}
                    >
                      {item.name}
                      <svg 
                        className={`h-4 w-4 transform ${openSubmenu === item.name ? 'rotate-180' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {openSubmenu === item.name && (
                      <div className="bg-sand/5 dark:bg-gray-700/50">
                        {item.submenu.map((subitem) => (
                          <Link
                            key={subitem.name}
                            href={subitem.href}
                            className={`block py-3 px-8 text-base font-medium ${
                              pathname === subitem.href
                                ? 'bg-bitcoin/10 dark:bg-bitcoin/20 text-bitcoin'
                                : 'text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {subitem.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`block py-3 px-4 text-base font-medium ${
                      isActive(item)
                        ? 'bg-bitcoin/10 dark:bg-bitcoin/20 text-bitcoin'
                        : 'text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                    }`}
                    onClick={() => {
                      if (item.name === 'Map') {
                        handleSectionNavigation({ preventDefault: () => {} } as React.MouseEvent, item.sectionId)
                      }
                      setMobileMenuOpen(false)
                    }}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
} 