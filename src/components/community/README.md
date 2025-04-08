# Community Components

This directory contains components for the Bitcoin Madeira community features, including social graph visualization and Nostr feed components.

## Component Structure

The community components have been refactored to follow a more modular and maintainable structure:

```
community/
├── graph/                     # Social graph components
│   ├── SocialGraph.tsx        # Main graph controller component
│   ├── GraphRenderer.tsx      # Core visualization rendering
│   ├── GraphControls.tsx      # UI controls for the graph
│   ├── NodeTooltip.tsx        # Node tooltip component
│   └── index.ts               # Re-exports for easier imports
├── CommunityFeed.tsx          # Nostr feed component
├── MadeiraFeed.tsx            # Madeira-specific feed
├── NostrProfileImage.tsx      # Profile image component
├── NostrProfileHeader.tsx     # Profile header component
├── utils.ts                   # Shared utilities
└── index.ts                   # Re-exports for easier imports
```

## Hooks

The data-fetching and state management logic has been extracted to custom hooks:

- `useSocialGraph`: Handles graph data loading and processing
- `useCache`: Provides caching capabilities for profiles, posts, and graph data
- `useNostrProfile`: Fetches and caches user profiles

## Cache System

A centralized caching system has been implemented to improve performance:

- `CacheService`: Singleton service for managing different types of caches:
  - Profile cache: Stores user profile data
  - Graph cache: Stores processed graph data
  - Image cache: Stores preloaded images

## Import Examples

```tsx
// Import from the graph directory
import { SocialGraph, GraphRenderer } from '@/components/community/graph';

// Import from the community directory
import { 
  SocialGraph, 
  CommunityFeed, 
  MadeiraFeed, 
  NostrProfileImage 
} from '@/components/community';
```

## Component Usage

### SocialGraph

```tsx
<SocialGraph
  graphData={graphData}
  profiles={profiles}
  loading={graphLoading}
  error={graphError}
  onRefresh={refreshGraph}
  className="w-full h-full"
/>
```

### CommunityFeed

```tsx
<CommunityFeed 
  npubs={CORE_NPUBS} 
  limit={10} 
  hashtags={['bitcoin', 'madeira']}
/>
```

## Performance Considerations

- The graph visualization now uses a failsafe mechanism to ensure it always renders, even with connection issues
- Graph loading is optimized with timeouts and error handling
- Image loading is done incrementally and cached
- The cache system prevents unnecessary network requests and calculations 

## Recent Changes

### April 2025
- Removed `CacheUsageExample` component as it was only intended for demonstration and development purposes. The example is still available in documentation form at `public/assets/docs/CacheUsageExample.md` for reference, but is no longer part of the production codebase.
- Removed `ClearGraphCache` component as it was redundant and not aligned with the current cache API.
- Renamed SocialGraphVisualization to SocialGraph and clarified component responsibilities. 