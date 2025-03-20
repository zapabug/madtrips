/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Enable ESLint for production builds
    ignoreDuringBuilds: false,
  },
  // The swcMinify option is now enabled by default in Next.js 13+
  // Removing this option as it's causing warnings
  reactStrictMode: true,
  // Enable source maps only in development
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  // Optimize for production
  output: 'export',
}

module.exports = nextConfig 