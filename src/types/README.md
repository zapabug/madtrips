HEAD:README.md | cat
MadTrips - Bitcoin-Powered Travel in Madeira

Overview

MadTrips is an all-in-one travel solution for Bitcoiners living on a Bitcoin standard, offering curated travel experiences, Bitcoin-friendly business connections, and full-service trip planning in Madeira.

Features

- **Bitcoin-Only Travel Packages**: Adventure, luxury, and business retreats with full Bitcoin payment integration
- **Bitcoin Business Directory & Map**: Explore over 130+ Bitcoin-accepting businesses in Madeira
- **Custom Tours & Airport Transfers**: Bitcoin-accepted taxi and guided experiences
- **Bitcoin Circular Economy**: Experience a 100% BTC-based lifestyle
- **Nostr Integration**: Decentralized authentication, data storage, and community engagement
- **Personalized Experience**: Save packages, track bookings, and manage your travel preferences

Services

Travel Packages

- Bitcoin & Business Teambuilding Retreats
- Ultimate Madeira Adventure
- Couples Escape
- Bitcoin Pioneer Tour (100% BTC Lifestyle)
- VIP Experience (Luxury & Custom Trips)

Additional Services

- Guided Bitcoin Economy Tours
- BTC-to-Fiat Exchange Facilitation

Tech Stack

- **Frontend**: Next.js + TailwindCSS
- **Authentication & Storage**: Nostr (NIP-07, NIP-19)
- **Payments**: Lightning Network (LNURL, BTCPay, LNBits)
- **State Management**: React Context + Nostr Storage

Getting Started

1. **Connect Your Wallet**: Use your Nostr wallet to sign in and access personalized features
2. **Browse Packages**: Explore pre-designed packages or build your own custom experience
3. **Save & Compare**: Save packages to your wishlist and compare options
4. **Book & Pay**: Complete your booking with Bitcoin via Lightning Network
5. **Track & Manage**: View your booking history and manage upcoming trips

User Features

- **Personal Cart**: Save and manage your selected packages (stored in your Nostr relays)
- **Booking History**: Track all your past and upcoming trips
- **Saved Packages**: Create a wishlist of packages for future reference
- **Decentralized Storage**: Your data is stored in your Nostr relays, not on our servers
- **Bitcoin Payments**: Secure and instant payments via Lightning Network

Contact & Community

- Website: https://mad-trips.npub.pro/ [nsite coming soon]
- Nostr: npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh
- Community: Join NOSTR!

🚀 MadTrips – Experience the Future of Travel with Bitcoin!

## Architecture Overview

MadTrips uses a fully decentralized architecture leveraging Nostr for authentication and data storage, eliminating the need for traditional backend servers.

### Key Features

- **Decentralized Storage**: User data stored in Nostr relays using NIP-19
- **Client-side Nostr Integration**: Direct browser integration with NIP-07 compatible extensions
- **Server Components**: Using React Server Components for improved performance
- **State Management**: React Context with Nostr persistence

### Folder Structure

- `/src/app/*` - Next.js App Router pages
- `/src/components/*` - React components
- `/src/hooks/*` - Custom React hooks for Nostr integration
- `/src/lib/*` - Shared utilities and Nostr services
- `/src/types/*` - TypeScript type definitions

### Data Storage

- **User Preferences**: Stored in Nostr relays using NIP-19
- **Cart State**: Persisted to user's Nostr relays
- **Booking History**: Stored as Nostr events
- **Package Data**: Static data with optional Nostr updates

### Benefits of This Architecture

1. **True Decentralization**: No central server required
2. **Enhanced Privacy**: Data stored in user's own relays
3. **Better Developer Experience**: TypeScript and modern React features
4. **Enhanced Security**: Nostr-based authentication and Bitcoin payments
5. **Seamless User Experience**: Persistent state and offline capabilities
6. **Cost Effective**: No server infrastructure needed