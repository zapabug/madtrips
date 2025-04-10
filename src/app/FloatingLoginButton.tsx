'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useNDKInit, useNDK } from '@nostr-dev-kit/ndk-hooks'
import NDK, { NDKUserProfile } from '@nostr-dev-kit/ndk'
import type { ReactNode } from 'react'

// Initialize NDK instance - consider moving relays to config
const ndkInstance = new NDK({
  explicitRelayUrls: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
})

// GIF URL provided by the user
const NOSTR_BUILD_GIF = 'https://camo.githubusercontent.com/8fc030d170b472876019dc1ff3b0b67d925034c8d441e6709bbb0a0631904b5b/68747470733a2f2f6e6f7374722e6275696c642f692f6e6f7374722e6275696c645f633538646131626162343238653766313835393664376562383062303536633530666239623939383535326261336230373764656532613163316538373066642e676966'

export function FloatingLoginButton(): ReactNode {
  const [npub, setNpub] = useState<string | null>(null)
  const [profile, setProfile] = useState<NDKUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnimatingIn, setIsAnimatingIn] = useState<boolean>(true) // State for animation
  const initializeNDK = useNDKInit()
  const { ndk } = useNDK()

  // Trigger animation start shortly after mount
  useEffect(() => {
    const animationTimer = setTimeout(() => setIsAnimatingIn(false), 50); // Small delay to trigger transition
    return () => clearTimeout(animationTimer);
  }, []);

  // Initialize NDK
  useEffect(() => {
    initializeNDK(ndkInstance)
    console.log('[FloatingLoginButton] NDK Hooks Initialized with instance')
    ndkInstance.connect().catch(err => {
        console.error('[FloatingLoginButton] NDK connection failed:', err)
        setError('Failed to connect to Nostr relays.')
    })
    // Disconnect on unmount - Remove shutdown call
    return () => {
        console.log('[FloatingLoginButton] NDK Disconnected (Cleanup)')
    }
  }, [initializeNDK])

  // Attempt to get public key via NIP-07 extension
  const loginWithExtension = async () => {
    setIsLoading(true)
    setError(null)
    setProfile(null) // Reset profile on new login attempt
    console.log('[FloatingLoginButton] Attempting login via NIP-07 extension...')
    if (window.nostr) {
      try {
        const publicKey = await window.nostr.getPublicKey()
        console.log('[FloatingLoginButton] Public key obtained:', publicKey)
        const user = ndkInstance.getUser({ hexpubkey: publicKey });
        await user.fetchProfile();
        setNpub(user.npub)
        setProfile(user.profile ?? null)
        if (!user.profile) {
          console.warn('[FloatingLoginButton] Profile not found for pubkey:', publicKey)
        }
      } catch (err: any) {
        console.error('[FloatingLoginButton] Error getting public key:', err)
        setError('Could not get public key from extension. Is it enabled and authorized?')
        setNpub(null)
      } finally {
        setIsLoading(false)
      }
    } else {
      console.warn('[FloatingLoginButton] window.nostr not found.')
      setError('Nostr extension (NIP-07) not found.')
      setIsLoading(false)
      setNpub(null)
    }
  }

  // Fetch profile when NDK is ready and npub is set (e.g., after login)
  useEffect(() => {
    if (ndk && npub && !profile && !isLoading) {
      const fetchProfile = async () => {
        console.log('[FloatingLoginButton] Fetching profile for npub:', npub);
        try {
          const user = ndk.getUser({ npub })
          await user.fetchProfile()
          if (user.profile) {
            setProfile(user.profile)
            console.log('[FloatingLoginButton] Profile fetched:', user.profile)
          } else {
            console.warn('[FloatingLoginButton] Profile not found for npub:', npub)
          }
        } catch (err) {
          console.error('[FloatingLoginButton] Error fetching profile:', err)
          setError('Failed to fetch profile.')
        }
      }
      fetchProfile()
    }
  }, [ndk, npub, profile, isLoading])

  return (
    // Add transition classes to the wrapping div
    <div
      className={`fixed bottom-5 right-5 z-50 transition-transform duration-[4000ms] ease-out ${
        isAnimatingIn ? 'translate-x-[-100vw]' : 'translate-x-0' // Start left, move to final position
      }`}
    >
      <button
        onClick={loginWithExtension}
        disabled={isLoading}
        className={`w-16 h-16 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-bitcoin focus:ring-offset-2 flex items-center justify-center transition-opacity hover:opacity-90 ${
          isLoading || profile?.picture 
            ? 'bg-gray-200 dark:bg-gray-700 shadow-lg' // Apply shadow only when background is gray
            : 'bg-transparent' // No shadow when background is transparent
        }`}
        title={profile ? `Logged in as ${profile?.name || npub}` : 'Login with Nostr Extension'}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bitcoin"></div>
        ) : profile?.picture ? (
          <Image
            src={profile.picture}
            alt={profile.name || 'User Profile'}
            width={64}
            height={64}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <Image
            src={NOSTR_BUILD_GIF}
            alt="Login with Nostr"
            width={64}
            height={64}
            className="object-cover w-full h-full"
            unoptimized
          />
        )}
      </button>
      {error && (
        <p className="text-red-500 text-xs mt-1 absolute bottom-full right-0 mb-1 bg-white dark:bg-black p-1 rounded shadow">{error}</p>
      )}
    </div>
  )
}
