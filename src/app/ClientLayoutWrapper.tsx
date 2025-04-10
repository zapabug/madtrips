'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '../components/layout/Navigation'

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Set a timer to update the state after 3.5 seconds
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 3500) // 3500 milliseconds = 3.5 seconds

    // Cleanup function to clear the timer if the component unmounts
    return () => clearTimeout(timer)
  }, []) // Empty dependency array ensures this runs only once on mount

  return (
    <>
      {isReady ? (
        <>
          <Navigation /> {/* Render Navigation */}
          <main className="flex-grow">{children}</main> {/* Render main content */}
        </>
      ) : (
        // Optional: Render a loading indicator during the delay
        <div className="flex flex-grow items-center justify-center min-h-screen">
          <p>Initializing...</p> 
          {/* You could put a spinner or logo here instead */}
        </div>
      )}
    </>
  )
}
