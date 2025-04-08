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