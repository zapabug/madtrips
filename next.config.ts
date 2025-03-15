/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['btcmap.org'],
  },
  // Increase timeout for large pages
  staticPageGenerationTimeout: 120,
}

export default config
