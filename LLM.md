# MadTrips LLM Context

## Project Overview

MadTrips is a web application focused on Bitcoin and travel experiences in Madeira, Portugal. The platform integrates Nostr protocol for decentralized social features and provides tools for exploring the Bitcoin community in Madeira.

## Core Technologies

- **React**: Frontend framework
- **Next.js**: React framework for server-rendered applications
- **TypeScript**: For type-safe code
- **Nostr Protocol**: Decentralized social networking protocol
- **NDK (Nostr Development Kit)**: For Nostr integration
- **D3.js**: For social graph visualization
- **Lightning Network**: For Bitcoin payments

## Key Modules

### Community Features

The community section provides social features powered by Nostr:

- **Social Graph Visualization**: Interactive network graph showing connections between Nostr users
- **Community Feed**: Real-time feed of notes from the Madeira Bitcoin community
- **Profile Components**: Display Nostr user profiles and images

### Nostr Integration

The application uses several layers for Nostr integration:

- **MCP (Madeira Community Protocol)**: Core protocol implementation for Nostr integration
- **NostrContext**: React context provider for Nostr functionality
- **RelayService**: Manages connections to Nostr relays
- **CacheService**: Caches profile data, graph data, and feed data

### Services

Services handle various aspects of state management and external API interactions:

- **NostrLoginService**: Handles Nostr authentication
- **RelayService**: Manages connections to Nostr relays
- **SessionService**: Handles user session management
- **LightningPaymentService**: Processes Bitcoin Lightning Network payments
- **CacheService**: Provides caching utilities

### Hooks

Custom hooks encapsulate reusable logic:

- **useSocialGraph**: Data for social graph visualization
- **useNostrFeed**: Fetches and manages Nostr feed data
- **useNostrProfile**: Fetches and caches user profile data
- **useGraphData**: Manipulates graph data structures
- **useCache**: General-purpose caching hook

### UI Components

- **Home Components**: Landing page UI elements (Hero, FunchalMap, etc.)
- **Community Components**: Social features (SocialGraph, CommunityFeed, etc.)
- **Graph Components**: Network visualization (GraphRenderer, GraphControls, etc.)
- **Profile Components**: User profile displays (NostrProfileImage, NostrProfileHeader)

## Architecture

The application follows a modular architecture:

1. **Contexts**: Global state management (NostrContext)
2. **Services**: Singleton services for core functionality
3. **Hooks**: Reusable logic with React hooks
4. **Components**: UI components organized by domain

Data flows:
- Nostr data is fetched via NDK through RelayService
- Data is cached through CacheService
- Components use hooks to access data and functionality
- UI is updated reactively based on state changes

## Relay Infrastructure

### Primary Relays
The application uses a tiered approach to relay management:
- **PRIMARY**: Core relays essential for functionality
  - wss://relay.damus.io
  - wss://nos.lol
  - wss://relay.nostr.band
  - wss://nostr.wine
  - wss://relay.nostr.info
  - wss://relay.primal.net
- **COMMUNITY**: Community-focused relays
  - wss://purplepag.es
  - wss://nostr.mutinywallet.com
- **BACKUP**: Used when primary relays fail
  - wss://nostr.fmt.wiz.biz
  - wss://relay.current.fyi
- **MADEIRA**: Specific relays with Madeira content
  - wss://relay.current.fyi
  - wss://purplepag.es

The app dynamically selects 8-9 relays by combining PRIMARY, FAST, and MADEIRA relays to optimize connectivity.

### Connection Strategy
- **Tiered Connections**: Connects to primary relays first, falls back to backups
- **Reconnection Policy**: 
  - Automatic reconnection with 5-second cooldown between attempts
  - Maximum 3 retry attempts before notifying the user
  - Exponential backoff for persistent connection issues
- **Connection Health Monitoring**:
  - Active connection monitoring every 30 seconds
  - Automatic relay switching when connections degrade

### Caching Approach
- **Profile Cache**: TTL of 15 minutes, 300 profiles max
- **Post Cache**: TTL of 5 minutes, 2000 posts max
- **Graph Cache**: TTL of 10 minutes, 10 graphs max
- **Event Cache**: TTL of 10 minutes, 1500 events max
- **Image Cache**: TTL of 30 minutes, 150 images max

## Error Handling

### Common Error Patterns
- **Connection Failures**: Handled with automatic retry and fallback to backup relays
- **Timeout Issues**: Requests timeout after 15 seconds to prevent hanging
- **Subscription Failures**: Automatic resubscription with clean state
- **Data Parsing Errors**: Graceful degradation with partial data display

### Fallback Mechanisms
- **Cached Data**: Falls back to cached data when relays are unavailable
- **Progressive Enhancement**: Core functionality works with minimal relay connectivity
- **Local Storage**: Critical data persisted in local storage for offline access
- **Default Content**: Shows placeholder content when data cannot be retrieved

### User Feedback
- **Status Indicators**: Relay connection status displayed in debugging tools
- **Error Messages**: User-friendly error messages for persistent connection issues
- **Loading States**: Visual feedback during data fetching and processing
- **Connectivity Warnings**: Notifications when operating with limited connectivity

## Data Flow

### Initial Bootstrapping
1. **Connection Initialization**: App connects to relays on startup through RelayService
2. **Core Data Loading**: Fetches essential profile and graph data for Madeira community
3. **First-party Data**: Loads user profile and connections if authenticated
4. **Extended Data**: Progressively loads extended network and content

### Data Refresh Patterns
- **Subscription-Based**: Real-time data via Nostr event subscriptions
- **Polling**: Periodic checks for relay health and connection status every 30 seconds
- **Manual Refresh**: User-triggered refresh for feed data
- **Background Updates**: Silent cache refresh for stale data

### Offline Mode
- **Cached Rendering**: Shows previously cached content when offline
- **Pending Actions Queue**: Stores user actions for execution when back online
- **Offline Indicators**: Visual indicators for offline status
- **Graceful Reconnection**: Automatic data synchronization when connection restored

## Performance Considerations

### Batch Size Limits
- **Profile Fetching**: Batches of 20 profiles at once
- **Feed Fetching**: Limit of 50 posts per request
- **Graph Data**: Limits node expansion to 15 connections at a time
- **Image Loading**: Progressive loading with 5 images at a time

### Rate Limiting
- **Self-imposed Throttling**: Maximum 2 concurrent relay requests
- **Exponential Backoff**: Increasing delays for repeated fetch failures
- **Request Coalescing**: Combines multiple requests into single relay queries
- **Subscription Management**: Limits active subscriptions to 5 per relay

### Lazy Loading
- **On-demand Profile Loading**: Profiles loaded when needed for rendering
- **Image Lazy Loading**: Images loaded as they enter viewport
- **Virtualized Lists**: Only renders visible items in long feeds
- **Graph Expansion**: Loads additional connections only on user interaction

## Community-Specific Features

### Madeira Community Context
- **Bitcoin Hub**: Madeira is emerging as a Bitcoin-friendly destination in Portugal
- **Community Building**: Focus on connecting local Bitcoiners with visitors
- **Event Discovery**: Highlighting Bitcoin meetups and events in Madeira
- **Travel Resources**: Bitcoin-focused travel tips for the region

### Content Filtering
- **Hashtag Filtering**: Content filtered for Madeira-related hashtags:
  - #madeira, #funchal, #bitcoinmadeira, #btcmadeira
  - #madeiraisland, #pontadosol, #machico
- **Relevance Sorting**: Prioritizes content from core community members
- **Image Highlighting**: Special focus on visual content showcasing Madeira

### Key Community Members
- **MadTrips**: Main community organizer (npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh)
- **Free Madeira**: Local Bitcoin community (npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e)
- **Sovereign Individual**: Bitcoin education in Madeira (npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5)
- **Funchal**: City-focused content (npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc)

These NPUBs serve as anchor points for the social graph and content discovery.

## Key Concepts

### Nostr Protocol

The application heavily relies on Nostr (Notes and Other Stuff Transmitted by Relays), a decentralized protocol for social networking:

- **npub**: Public keys used as user identifiers
- **Events**: Data objects (like notes, profiles) published to relays
- **Relays**: Servers that store and transmit events
- **NDK**: Library for integrating with Nostr

### Social Graph

The social graph visualizes connections between Nostr users:

- **Nodes**: Represent Nostr users
- **Links**: Represent follows/connections between users
- **Core Nodes**: Key members of the Madeira Bitcoin community
- **Second-degree Connections**: Follows of follows

### Caching System

The application implements a sophisticated caching strategy:

- **Profile Cache**: Stores user profile data
- **Graph Cache**: Stores processed social graph data
- **Feed Cache**: Stores recent notes and posts
- **TTL (Time to Live)**: Cache invalidation strategies

## Key Flow Examples

### Displaying the Social Graph

1. `useSocialGraph` hook fetches follows data from Nostr relays
2. Data is processed into a graph structure with nodes and links
3. `SocialGraph` component handles UI states (loading, error, empty)
4. `GraphRenderer` visualizes the data using force-directed layout
5. `GraphControls` provides user interface for interactions
6. `NodeTooltip` shows details when a user node is selected

### Loading Community Feed

1. `useNostrFeed` hook subscribes to events from specific npubs
2. Notes are filtered by hashtags and processed into a standard format
3. `CommunityFeed` component displays the notes with proper loading states
4. Profile data is fetched and cached for each note author
5. Images within notes are extracted and displayed in the feed

## Core NPUBs

The application focuses on these key Nostr identities:

- MadTrips: npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh
- Free Madeira: npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e
- Sovereign Individual: npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5
- Funchal: npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc

## Best Practices

- Use provided hooks rather than direct API calls
- Leverage the cache system for performance
- Handle loading and error states
- Implement proper cleanup in useEffect hooks
- Use memoization for performance-critical components

## Recent Development Focus

- Refactoring components into more modular structure
- Implementing comprehensive caching strategies
- Optimizing social graph visualization
- Improving profile data handling
- Enhancing error handling and connection reliability 