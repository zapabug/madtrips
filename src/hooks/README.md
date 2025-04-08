# Custom Hooks Directory

This directory contains custom React hooks that encapsulate reusable logic and state management for the MadTrips application.

## Contents

- [`useNostrFeed.ts`](#usenostrfeedts) - Hook for fetching Nostr feed data
- [`useNostrGraph.ts`](#usenostrgraphts) - Hook for Nostr-based social graph data
- [`useCachedProfiles.ts`](#usecachedprofilests) - Hook for profile data with caching
- [`useCache.ts`](#usecachets) - General-purpose caching hook
- [`useImageFeed.ts`](#useimagefeedts) - Hook for image-focused Nostr feed
- [`useSocialGraph.ts`](#usesocialgraphts) - Hook for social graph visualization data
- [`useGraphData.ts`](#usegraphdatats) - Hook for graph data manipulation
- [`useNostrProfile.ts`](#usenostrprofilets) - Hook for Nostr profile data
- [`useCheckoutFlow.ts`](#usecheckoutflowts) - Hook for payment checkout process
- [`useMediaQuery.ts`](#usemediaqueryts) - Hook for responsive design queries

## useNostrFeed.ts

Hook for fetching and managing Nostr feed data.

### Key Features
- Real-time feed updates
- Filtering by hashtags and keywords
- Content sanitization
- Pagination support

### Example
```tsx
import { useNostrFeed } from '../hooks/useNostrFeed';

function Feed() {
  const { notes, loading, error, refresh } = useNostrFeed({
    npubs: ['npub1...'],
    limit: 50,
    requiredHashtags: ['bitcoin', 'madeira']
  });
  
  return (
    // Component implementation
  );
}
```

## useNostrGraph.ts

Hook for managing Nostr social graph data.

### Key Features
- Follow relationship data
- Graph structure creation
- Profile enrichment
- Connection analysis

## useCachedProfiles.ts

Hook for fetching and caching Nostr profile data.

### Key Features
- Profile data caching
- Batch profile fetching
- Automatic cache invalidation
- Error handling

## useCache.ts

General-purpose hook for data caching.

### Key Features
- Multiple cache strategies
- TTL support
- Invalidation methods
- Persistent cache options

## useImageFeed.ts

Hook for fetching image-focused content from Nostr feeds.

### Key Features
- Image extraction from notes
- Media filtering
- Gallery formatting
- Optimized loading

## useSocialGraph.ts

Advanced hook for social graph visualization data.

### Key Features
- Network graph creation
- Node and edge management
- Interactive graph operations
- Force-directed layout data

## useGraphData.ts

Hook for manipulating graph data structures.

### Key Features
- Node and link manipulation
- Graph traversal
- Data transformation
- Graph merging

## useNostrProfile.ts

Hook for fetching and managing Nostr profile data.

### Key Features
- Profile metadata fetching
- NIP-05 verification
- Custom profile fields
- Profile following/unfollowing

## useCheckoutFlow.ts

Hook for managing payment checkout process.

### Key Features
- Payment flow state
- Lightning invoice generation
- Payment status monitoring
- Checkout completion handling

## useMediaQuery.ts

Hook for responsive design based on media queries.

### Key Features
- Breakpoint detection
- Responsive layout control
- Window resize handling
- Device-specific behavior

## Best Practices

1. Custom hooks should focus on a single responsibility
2. Hooks that access Nostr functionality should use the NostrContext
3. Include proper error handling and loading states
4. Memoize expensive calculations and callback functions
5. Use cleanup functions to prevent memory leaks with subscriptions 