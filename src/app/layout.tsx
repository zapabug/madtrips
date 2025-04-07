import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";

// Server component for metadata
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL 
        ? process.env.NEXT_PUBLIC_SITE_URL 
        : 'https://madtrips.com'
  ),
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

// Root layout
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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
