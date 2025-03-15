/** @type {import('next').NextConfig} */
const nextConfig = {
  // The swcMinify option is now enabled by default in Next.js 13+
  // Removing this option as it's causing warnings
  reactStrictMode: true,
  images: {
    domains: [''],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig 