import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Remove unused ClientLayout import if it was different from the new wrapper
// import ClientLayout from "./ClientLayout"; 
import { FloatingLoginButton } from './FloatingLoginButton' // Corrected import path relative to layout.tsx
import ClientLayoutWrapper from './ClientLayoutWrapper' // Import the new wrapper

// Determine the base URL first
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : 'https://madtrips.com';

// Keep metadata export - this is now allowed as it's a Server Component
export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    template: '%s | MadTrips',
    default: 'MadTrips - Your Bitcoin-Powered Adventure in Madeira'
  },
  description: 'Experience Madeira with Bitcoin-powered trips and connect with the local crypto community.',
  icons: {
    icon: '/assets/favicon.ico',
    apple: '/assets/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://madtrips.com',
    siteName: 'MadTrips',
    images: [
      {
        url: '/assets/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MadTrips - Your Bitcoin-Powered Adventure in Madeira'
      }
    ],
  }
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false, // Disable preloading for better performance
});

// Root layout remains a Server Component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Add preconnect to known relays for faster connections */}
        <link rel="preconnect" href="https://relay.damus.io" />
        <link rel="preconnect" href="https://relay.primal.net" />
        <link rel="preconnect" href="https://nostr-pub.wellorder.net" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        {/* Use the Client Wrapper for delayed content */}
        <ClientLayoutWrapper>
          {children} 
        </ClientLayoutWrapper>
        
        <FloatingLoginButton/> {/* Floating button renders immediately */}
      </body>
    </html>
  );
}
