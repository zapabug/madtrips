'use client';

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/layout/Navigation";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NostrLink } from "@/components/NostrLink";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { NostrLoginButton } from "@/components/NostrLoginButton";

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Use 'swap' instead of preloading
});

// Metadata is now imported from metadata.ts
// import { metadata, viewport } from './metadata';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Remove any manual preload tags for fonts */}
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Navigation />
          <main className="flex-grow bg-gray-900 pt-16">
            {children}
          </main>
          <footer className="bg-forest dark:bg-forest/80 text-sand py-8">
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                {/* Social Links - Nostr, Instagram, X */}
                <div className="flex items-center justify-center space-x-6 mb-4 md:mb-0">
                  <NostrLink />
                  <Link href="https://instagram.com/MadTrips" target="_blank" rel="noopener noreferrer" className="text-sand hover:text-pink-500 transition-colors" aria-label="Instagram">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                    </svg>
                  </Link>
                  <Link href="https://x.com/travelmadeira" target="_blank" rel="noopener noreferrer" className="text-sand hover:text-gray-900 transition-colors" aria-label="Twitter / X">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </Link>
                </div>
                
                {/* Nostr apps info */}
                <div className="flex items-center space-x-3">
                  <div className="text-sand font-medium flex items-center flex-wrap">
                    Powered by
                    <div className="flex items-center space-x-4 ml-2">
                      <Link href="https://blossom.nostr.com" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:text-bitcoin/80 transition-colors" aria-label="Blossom">
                        <div className="flex flex-col items-center">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
                            <path d="M12 6c-3.309 0-6 2.691-6 6s2.691 6 6 6 6-2.691 6-6-2.691-6-6-6zm0 10c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z"/>
                            <path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/>
                          </svg>
                          <span className="text-xs font-bold">Blossom</span>
                        </div>
                      </Link>
                      <Link href="https://nsite.nostr.com" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:text-bitcoin/80 transition-colors" aria-label="Nsite">
                        <div className="flex flex-col items-center">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 2H5a3 3 0 00-3 3v14a3 3 0 003 3h14a3 3 0 003-3V5a3 3 0 00-3-3zm1 17a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h14a1 1 0 011 1v14z"/>
                            <path d="M7 15h10v2H7zm0-4h10v2H7zm0-4h10v2H7z"/>
                          </svg>
                          <span className="text-xs font-bold">Nsite</span>
                        </div>
                      </Link>
                      <Link href="https://lnbits.com" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:text-bitcoin/80 transition-colors mr-0" aria-label="LNBits">
                        <div className="flex flex-col items-center">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
                          </svg>
                          <span className="text-xs font-bold">LNBits</span>
                        </div>
                      </Link>
                      <div className="flex flex-col items-center -ml-3">
                        <Image 
                          src="/assets/bitcoin.png" 
                          alt="Bitcoin" 
                          width={224} 
                          height={224} 
                          className="w-14 h-14 object-contain" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Copyright and links */}
              <div className="text-center border-t border-sand/20 pt-4">
                <p className="text-sm">© {new Date().getFullYear()} MadTrips. All rights reserved.</p>
                <div className="flex justify-center mt-2 space-x-4 text-xs">
                  <Link href="/privacy" className="text-sand hover:text-bitcoin transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="text-sand hover:text-bitcoin transition-colors">Terms of Service</Link>
                  <Link href="/contact" className="text-sand hover:text-bitcoin transition-colors">Contact</Link>
                </div>
              </div>
            </div>
          </footer>
          
          {/* Floating Nostr Login Button - This will be our custom UI for Nostr Login */}
          <NostrLoginButton />
        </ThemeProvider>
        
        {/* Nostr Login Script - Now hidden but still providing functionality */}
        <Script
          src="https://www.unpkg.com/nostr-login@latest/dist/unpkg.js"
          data-perms="sign_event:1,sign_event:0"
          data-theme="ocean"
          data-show-banner="false"
          strategy="afterInteractive"
        />
        
        {/* Custom script to ensure proper integration */}
        <Script id="nostr-login-custom-integration" strategy="afterInteractive">
          {`
            // Add TypeScript declaration for window.NostrLogin
            declare global {
              interface Window {
                NostrLogin?: {
                  getProfile?: (npub: string) => { picture?: string, name?: string, [key: string]: any } | null;
                  [key: string]: any;
                };
              }
            }
            
            document.addEventListener('DOMContentLoaded', function() {
              // Make sure the Nostr Login library is fully loaded
              setTimeout(() => {
                // We already have event listeners in our React component,
                // this just ensures the scripts work well together
                console.log('Nostr Login integration initialized');
                
                // Track Nostr login events to enhance profile data handling
                document.addEventListener('nlAuth', function(e) {
                  try {
                    console.log('Nostr Login auth event captured:', e.detail);
                    
                    // If event doesn't have profile picture but we can get it elsewhere
                    if (e.detail && e.detail.npub && (!e.detail.profile || !e.detail.profile.picture)) {
                      // Try to get profile data from nostr-login's cache
                      if (window.NostrLogin && window.NostrLogin.getProfile) {
                        const profile = window.NostrLogin.getProfile(e.detail.npub);
                        if (profile && profile.picture) {
                          console.log('Found profile picture from NostrLogin cache');
                          // Clone the event and add profile data
                          const newEvent = new CustomEvent('nlAuth', {
                            detail: {
                              ...e.detail,
                              profile: {
                                ...e.detail.profile,
                                picture: profile.picture
                              }
                            }
                          });
                          // Dispatch the enhanced event
                          setTimeout(() => document.dispatchEvent(newEvent), 0);
                        }
                      }
                    }
                  } catch (err) {
                    console.error('Error handling Nostr auth event:', err);
                  }
                });
                
                // Ensure nlLaunch events are properly captured
                document.addEventListener('nlLaunch', function(e) {
                  console.log('Nostr Login launch event captured', e.detail);
                });
              }, 1000);
            });
          `}
        </Script>
        
        {/* Add custom CSS to hide any remaining Nostr Login elements */}
        <style jsx global>{`
          .nl-banner {
            display: none !important;
          }
        `}</style>
      </body>
    </html>
  );
}
