# MadTrips App Rebuild Guide

## Core Architecture

### 1. Service Layer Implementation
First prompt to create core services:
```
Please help me implement the core services for a Nostr-based travel app:
1. CacheService for managing different types of caches (profiles, posts, graph data)
2. RelayService for handling Nostr relay connections
3. NostrContext for managing authentication and state
Focus on real-time data without fallbacks.
```

### 2. Custom Hooks Implementation
Next prompt for custom hooks:
```
Please implement the following custom hooks for the Nostr travel app:
1. useNostrProfile for profile management
2. useNostrFeed for feed data
3. useSocialGraph for graph visualization
4. useCache for centralized caching
Ensure they use the previously created services.
```

### 3. Component Structure
Prompt for building components:
```
Please help implement the core components:
1. NostrLoginButton
2. SocialGraph visualization
3. CommunityFeed
4. Profile components
Focus on real-time Nostr data and modern UI.
```

## Page Structure

### App Routes
```
/app
├── page.tsx                # Home page
├── layout.tsx              # Root layout
├── community/             
│   └── page.tsx           # Community page
├── packages/              
│   ├── page.tsx           # Packages listing
│   ├── [id]/              # Package details
│   └── custom/            # Custom package builder
├── map/                   
│   └── page.tsx           # Bitcoin business map
├── checkout/              
│   └── page.tsx           # Checkout process
└── api/                   # API routes
```

### Layout Components
```
/components/layout
├── Navigation.tsx         # Main navigation
├── Footer.tsx            # Footer component
└── ThemeProvider.tsx     # Theme management
```

## Implementation Best Practices

### 1. Service Pattern
- Use singleton pattern for services
- Implement proper cleanup and error handling
- Cache management with TTL
- Real-time data synchronization

### 2. Component Architecture
- Separate container and presentational components
- Use React.memo for performance optimization
- Implement proper loading states
- Error boundary implementation

### 3. State Management
- Context for global state
- Local state for component-specific data
- Proper cache invalidation
- Real-time updates

## Styling Strategy

### 1. Theme System
```typescript
// Theme configuration
const theme = {
  colors: {
    bitcoin: '#F7931A',
    sand: '#F5F5DC',
    ocean: '#1E3A8A',
    forest: '#2F4F4F'
  },
  fonts: {
    body: 'Inter, sans-serif',
    heading: 'Inter, sans-serif'
  }
}
```

### 2. Layout Components
- Responsive design with Tailwind CSS
- Dark mode support
- Consistent spacing system
- Accessible color contrast

## Data Flow

### 1. Nostr Integration
```typescript
// Core Nostr integration pattern
const nostrFlow = {
  authentication: 'NIP-07',
  dataFetch: 'Real-time only',
  caching: 'In-memory with TTL',
  relays: ['wss://relay.damus.io', 'wss://relay.nostr.band']
}
```

### 2. Cache Strategy
```typescript
// Cache configuration
const cacheConfig = {
  profiles: { ttl: 900000 },  // 15 minutes
  posts: { ttl: 300000 },     // 5 minutes
  graph: { ttl: 600000 }      // 10 minutes
}
```

## Rebuild Sequence

1. Core Services Setup
2. Authentication Implementation
3. Data Layer Implementation
4. UI Components Development
5. Page Routes Implementation
6. Integration Testing
7. Performance Optimization

## Key Features

1. Real-time Nostr Integration
2. Social Graph Visualization
3. Community Feed
4. Bitcoin Business Map
5. Package Management
6. Lightning Network Payments

## Performance Considerations

1. Implement proper caching
2. Use React.memo for expensive components
3. Lazy loading for routes
4. Image optimization
5. Relay connection management

## Testing Strategy

1. Unit tests for services
2. Integration tests for Nostr functionality
3. Component testing
4. E2E testing for critical flows

## Deployment Considerations

1. Environment configuration
2. Relay availability monitoring
3. Cache management
4. Error tracking
5. Analytics implementation 