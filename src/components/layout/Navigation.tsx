'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

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

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
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
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-ocean dark:text-bitcoin hover:text-bitcoin transition-colors">
                MadTrips
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <div key={item.name} className="relative group">
                  {item.submenu ? (
                    <>
                      <button
                        className={`inline-flex items-center px-1 pt-1 pb-5 border-b-2 text-sm font-medium ${
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
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-forest dark:text-gray-300 hover:text-bitcoin dark:hover:text-bitcoin"
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            
            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-forest dark:text-gray-300 hover:text-bitcoin dark:hover:text-bitcoin hover:bg-sand/20 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-bitcoin"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {/* Icon when menu is closed */}
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
                {/* Icon when menu is open */}
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
      <div
        className={`${mobileMenuOpen ? 'block' : 'hidden'} sm:hidden absolute w-full bg-white dark:bg-gray-800 z-40`}
        id="mobile-menu"
      >
        <div className="pt-2 pb-3 space-y-1">
          {navigation.map((item) => {
            if (item.submenu) {
              return (
                <div key={item.name} className="flex flex-col">
                  <button
                    onClick={(e) => {
                      if (pathname === '/') {
                        // If on home page, scroll to packages section
                        handleSectionNavigation(e, item.sectionId)
                        setMobileMenuOpen(false)
                      } else {
                        // Go to home page packages section
                        router.push('/#packages')
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-base font-medium border-l-4 ${
                      isActive(item)
                        ? 'border-bitcoin text-bitcoin bg-bitcoin/5 dark:bg-bitcoin/10'
                        : 'border-transparent text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                    }`}
                  >
                    <span>{item.name}</span>
                    <svg
                      className={`h-4 w-4 ${openSubmenu === item.name ? 'transform rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSubmenu(item.name)
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {openSubmenu === item.name && (
                    <div className="ml-4 border-l border-sand/20 dark:border-gray-700">
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.name}
                          href={subitem.href}
                          className={`block pl-8 pr-3 py-2 text-base font-medium ${
                            mounted && pathname === subitem.href
                              ? 'text-bitcoin'
                              : 'text-forest/80 dark:text-gray-400 hover:text-bitcoin'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {subitem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            
            if (item.name === 'Map') {
              return (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    handleSectionNavigation(e, item.sectionId)
                    setMobileMenuOpen(false)
                  }}
                  className={`block pl-3 pr-4 py-2 text-base font-medium border-l-4 ${
                    isActive(item)
                      ? 'border-bitcoin text-bitcoin bg-bitcoin/5 dark:bg-bitcoin/10'
                      : 'border-transparent text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                  }`}
                >
                  {item.name}
                </a>
              )
            }
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block pl-3 pr-4 py-2 text-base font-medium border-l-4 ${
                  isActive(item)
                    ? 'border-bitcoin text-bitcoin bg-bitcoin/5 dark:bg-bitcoin/10'
                    : 'border-transparent text-forest dark:text-gray-300 hover:bg-sand/10 dark:hover:bg-gray-700 hover:text-bitcoin'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
} 