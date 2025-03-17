/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Temporarily disable ESLint during the build process
    ignoreDuringBuilds: true,
  },
  // The swcMinify option is now enabled by default in Next.js 13+
  // Removing this option as it's causing warnings
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig 