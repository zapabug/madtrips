'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { NostrProfileHeader } from '../../components/community/profile/NostrProfileHeader'
import Image from 'next/image'
import { CORE_NPUBS } from '../../constants/nostr'
import { useLiteProfiles } from '../../hooks/useLiteProfiles'
import { useCache } from '../../hooks/useCache'

// Extracted constants and reusable styles
const MADTRIPS_NPUB = "npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh"

const navigation = [
  { name: 'Home', href: '/', sectionId: 'home' },
  { 
    name: 'Packages', 
    href: '/packages',
    sectionId: 'packages',
    submenu: [
      { name: 'Build Custom Package', href: '/packages/custom' },
    ] 
  },
  { name: 'Map', href: '/map', sectionId: 'map' },
  { name: 'Community', href: '/community', sectionId: 'community' },
]

// Common styles extracted for reuse and consistency
const styles = {
  activeDesktopLink: 'border-bitcoin text-ocean dark:text-white',
  inactiveDesktopLink: 'border-transparent text-forest dark:text-gray-300 hover:border-bitcoin/50 hover:text-bitcoin dark:hover:text-bitcoin',
  activeMobileLink: 'bg-bitcoin/10 dark:bg-bitcoin/20 text-bitcoin',
  inactiveMobileLink: 'text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin',
  desktopLinkBase: 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors',
  mobileLinkBase: 'block py-3 px-4 text-base font-medium',
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const cache = useCache()

  // Preload all core profile data using useLiteProfiles
  const { profiles } = useLiteProfiles({
    npubs: CORE_NPUBS,
    batchSize: 2
  })

  // Preload profile images for faster rendering
  useEffect(() => {
    const preloadProfileImages = async () => {
      // Wait for profiles to be loaded
      if (profiles.size > 0) {
        for (const profile of profiles.values()) {
          if (profile.picture) {
            try {
              await cache.preloadAndCacheImage(profile.picture)
              // Now profile.name and profile.npub exist on LiteProfile
              console.debug(`Preloaded image for ${profile.name || profile.npub}`)
            } catch (err) {
              // Silently fail for image preloading
              console.debug(`Failed to preload image for ${profile.npub}`)
            }
          }
        }
      }
    }

    if (mounted) {
      preloadProfileImages()
    }
  }, [profiles, mounted, cache])

  // Memoize section IDs to avoid recreating on each render
  const sectionIds = useMemo(() => navigation.map(item => item.sectionId), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Implement intersection observer to track active sections
  useEffect(() => {
    if (!mounted) return
    
    const observerOptions = {
      root: null,
      rootMargin: '-80px 0px -20% 0px',
      threshold: 0.2
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
  }, [mounted, sectionIds])

  // Set active section based on the pathname when navigation happens
  useEffect(() => {
    // Use path-based logic to determine active section
    if (pathname === '/') {
      setActiveSection('home')
    } else if (pathname.includes('/packages')) {
      setActiveSection('packages')
    } else if (pathname.includes('/community')) {
      setActiveSection('community')
    }
    
    // Close menus on navigation
    setMobileMenuOpen(false)
    setOpenSubmenu(null)
  }, [pathname])

  // Memoized handlers to prevent recreating on each render
  const toggleSubmenu = useCallback((name: string) => {
    setOpenSubmenu(prev => prev === name ? null : name)
  }, [])

  const handleSectionNavigation = useCallback((e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    
    if (sectionId === 'map') {
      router.push('/map')
    } else if (pathname === '/') {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      router.push(`/#${sectionId}`)
    }
  }, [pathname, router])

  // Memoized check for active state to avoid recalculating
  const isActive = useCallback((item: typeof navigation[0]) => {
    if (item.sectionId === activeSection) return true
    if (item.name === 'Packages' && pathname.includes('/packages')) return true
    if (item.name === 'Community' && pathname.includes('/community')) return true
    return false
  }, [activeSection, pathname])

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-sand dark:border-gray-700 fixed top-0 left-0 right-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex h-auto py-2">
          <div className="flex items-center justify-between w-full">
            {/* Logo/Profile section - Fixed mobile width issue */}
            <div className="w-auto max-w-[calc(100%-50px)] sm:w-auto overflow-hidden">
              <Link href="/" className="flex items-center text-xl font-bold text-ocean dark:text-bitcoin hover:text-bitcoin transition-colors group">
                <NostrProfileHeader npub={MADTRIPS_NPUB} />
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 sm:items-center">
              {navigation.map((item) => (
                <div key={item.name} className="relative group">
                  {item.submenu ? (
                    <>
                      <button
                        className={`${styles.desktopLinkBase} ${isActive(item) ? styles.activeDesktopLink : styles.inactiveDesktopLink}`}
                        onClick={(e) => {
                          if (item.name === 'Packages') {
                            router.push('/packages');
                          } else if (pathname === '/') {
                            handleSectionNavigation(e, item.sectionId);
                          } else {
                            router.push(item.href);
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
                                    ? styles.activeMobileLink
                                    : styles.inactiveMobileLink
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
                      className={`${styles.desktopLinkBase} ${isActive(item) ? styles.activeDesktopLink : styles.inactiveDesktopLink}`}
                    >
                      {item.name}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className={`${styles.desktopLinkBase} ${isActive(item) ? styles.activeDesktopLink : styles.inactiveDesktopLink}`}
                    >
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Hamburger menu button with fixed width */}
            <div className="sm:hidden w-[40px] flex-shrink-0">
              <button
                type="button"
                className="p-2 rounded-md text-forest dark:text-gray-300"
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-sand/20 dark:border-gray-700" id="mobile-menu">
          <div className="py-2 space-y-1 bg-white dark:bg-gray-800">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.submenu && item.name !== 'Packages' ? (
                  <>
                    <button
                      className={`w-full flex justify-between items-center py-3 px-4 text-base font-medium ${
                        isActive(item) ? styles.activeMobileLink : styles.inactiveMobileLink
                      }`}
                      onClick={() => {
                        toggleSubmenu(item.name);
                      }}
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
                                ? styles.activeMobileLink
                                : styles.inactiveMobileLink
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
                  <>
                    <Link
                      href={item.name === 'Packages' ? '/packages' : item.href}
                      className={`${styles.mobileLinkBase} ${isActive(item) ? styles.activeMobileLink : styles.inactiveMobileLink}`}
                      onClick={() => {
                        setMobileMenuOpen(false)
                      }}
                    >
                      {item.name}
                    </Link>
                    
                    {/* Add Build Custom Package as a separate item for mobile */}
                    {item.name === 'Packages' && item.submenu && (
                      <Link
                        href="/packages/custom"
                        className={`block py-3 px-8 text-base font-medium ${
                          pathname === '/packages/custom'
                            ? styles.activeMobileLink
                            : styles.inactiveMobileLink
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Build Custom Package
                      </Link>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
} 