MadTrips - Bitcoin-Powered Travel in Madeira

Overview

MadTrips is an all-in-one travel solution for Bitcoiners living on a Bitcoin standard, offering curated travel experiences, Bitcoin-friendly business connections, and full-service trip planning in Madeira.

Features

Bitcoin-Only Travel Packages: Adventure, luxury, and business retreats with full Bitcoin payment integration.

Bitcoin Business Directory & Map: Explore over 130+ Bitcoin-accepting businesses in Madeira.

Custom Tours & Airport Transfers: Bitcoin-accepted taxi and guided experiences.

Bitcoin Circular Economy: Experience a 100% BTC-based lifestyle.

Nostr Integration: Decentralized authentication, community engagement, and live updates.

Services

Travel Packages

Bitcoin & Business Teambuilding Retreats

Ultimate Madeira Adventure

Couples Escape

Bitcoin Pioneer Tour (100% BTC Lifestyle)

VIP Experience (Luxury & Custom Trips)

Additional Services

Guided Bitcoin Economy Tours

BTC-to-Fiat Exchange Facilitation

Tech Stack

Frontend: Next.js + TailwindCSS

Backend: Bun + Node.js + Express

Authentication & Data: Nostr (nsite & Blossom)

Payments: Lightning Network (LNURL, BTCPay, LNBits)

Getting Started

Book Your Trip: Select from pre-designed packages or build your own.

Pay in Bitcoin: Secure transactions via LNURL or On-Chain BTC.

Enjoy Madeira: Use Bitcoin to pay for food, transport, and experiences.

Contact & Community

Website: https://mad-trips.npub.pro/ [nsite comming soon]

Nostr: npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh

Community: Join NOSTR! 

🚀 MadTrips – Experience the Future of Travel with Bitcoin!

## Architecture Overview

MadTrips uses an optimized architecture that leverages Next.js App Router and API Routes to eliminate the need for a separate Express.js server.

### Key Features

- **Serverless API Routes**: All backend functionality is implemented through Next.js API Routes, eliminating the need for a separate server.
- **Client-side Nostr Integration**: Where possible, Nostr operations are performed directly in the browser using NIP-07 compatible extensions.
- **Server Components**: Using React Server Components for improved performance and reduced client-side JavaScript.
- **Minimal Server-Side Logic**: Server-side operations are limited only to those requiring secrets or security (like payment processing).

### Centralized Caching System

The application uses a centralized caching system to improve performance and reduce relay load:

- **CacheService**: A singleton service that manages different types of caches:
  - Profile cache: Stores user profiles to minimize duplicate requests
  - Post cache: Stores Nostr posts with configurable retention
  - Graph cache: Stores social graph data for efficient community visualization
  - Image cache: Preloads and caches profile images and post images

- **Component Integration**:
  - SocialGraph populates the cache with community connections
  - MadeiraFeed and CommunityFeed read from this cache
  - All components share profile data through the same cache

- **Benefits**:
  - Reduced network requests to Nostr relays
  - Better user experience with faster loading
  - Consistent data across components
  - Type-safe cache access through the useCache hook

### Folder Structure

- `/src/app/api/*` - Next.js API Routes replacing Express.js endpoints
- `/src/lib/*` - Shared libraries for both client and server
- `/src/components/*` - React components, including client-side Nostr integration
- `/src/lib/services/CacheService.ts` - Centralized caching system
- `/src/hooks/useCache.ts` - React hook for accessing the cache

### API Routes

- `GET /api/packages` - List all travel packages
- `GET /api/packages/[id]` - Get a specific travel package
- `GET /api/businesses` - List Bitcoin-accepting businesses
- `POST /api/payments` - Create a Lightning invoice
- `GET /api/payments/[id]` - Check payment status
- `POST /api/bookings` - Create a new booking

### Benefits of This Architecture

1. **Simplified Deployment**: Single deployment instead of separate frontend and backend
2. **Reduced Infrastructure**: No need to maintain separate servers
3. **Improved Performance**: API routes can be deployed at the edge for faster response times
4. **Better Developer Experience**: Single codebase and seamless TypeScript integration
5. **Enhanced Security**: Sensitive operations remain server-side while moving non-sensitive operations to the client

## Recent Fixes

### Graph Rendering Issues
- Optimized relay connection management to limit connections to a maximum of 4 properly connected relays
- Added connection delay between relay connections to prevent overwhelming the system
- Improved the continuous loading feature to be less aggressive with 3 nodes per batch instead of 5
- Added error handling to prevent crashes during graph refreshes
- Improved cache timestamp handling for better cache validation

### Feed/Event Fetching Issues
- Added proper timeout handling for Nostr event fetching to prevent hanging requests
- Improved error recovery for subscription connections with automatic health checks
- Fixed reconnection logic for better relay connection stability
- Added closeOnEose option to fetchEvents calls for more reliable event fetching
- Implemented subscription health monitoring with automatic reconnection
- Added additional error handling to prevent subscription crashes

### General Improvements
- Better handling of connected relays tracking
- Improved error reporting in the UI
- More robust relay connection status detection
- Fixed race conditions in the reconnection logic
- Better state management for loading indicators
- Cache statistics tracking for monitoring hit/miss rates

## Running the Project

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

## Contributors

- MadTrips Team

## License

MIT