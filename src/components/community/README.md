# Community Components

This directory contains components for the Bitcoin Madeira community features, including social graph visualization and Nostr feed components.

## Table of Contents

- [Component Structure](#component-structure)
- [Context and Relay Management](#context-and-relay-management)
- [Hooks](#hooks)
- [Cache System](#cache-system)
- [Graph Components](#graph-components)
- [Profile Components](#profile-components)
- [Feed Components](#feed-components)
- [Import Examples](#import-examples)
- [Performance Considerations](#performance-considerations)
- [Recent Changes](#recent-changes)

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
├── profile/                   # Profile components
│   ├── NostrProfileImage.tsx  # Profile image component
│   ├── NostrProfileHeader.tsx # Profile header component
│   └── index.ts               # Re-exports for easier imports
├── feed/                      # Feed components
│   ├── CommunityFeed.tsx      # Nostr feed component
│   ├── MadeiraFeed.tsx        # Madeira-specific feed
│   └── index.ts               # Re-exports for easier imports
├── utils.ts                   # Shared utilities
└── index.ts                   # Re-exports for easier imports
```

## Context and relay management

The `NostrContext.tsx` handles all relay management and provides Nostr functionality to components through React Context.

## Hooks

The data-fetching and state management logic has been extracted to custom hooks:

- `useSocialGraph`: Handles graph data loading and processing
- `useGraphData`: Manages graph data structure manipulation
- `useCache`: Provides caching capabilities for profiles, posts, and graph data
- `useNostrProfile`: Fetches and caches user profiles
- `useNostrFeed`: Fetches and processes Nostr feed data

## Cache System

A centralized caching system has been implemented to improve performance:

- `CacheService`: Singleton service for managing different types of caches:
  - Profile cache: Stores user profile data
  - Graph cache: Stores processed graph data
  - Image cache: Stores preloaded images

## Graph Components

The graph visualization is implemented through a set of modular components:

### SocialGraph

The main controller component that coordinates graph visualization.

#### Props
- `className?: string` - Optional CSS class name
- `graphData?: GraphData | null` - The graph data to visualize
- `profiles?: Map<string, ProfileData>` - Cached profile data to enrich graph nodes
- `loading?: boolean` - Whether graph data is loading
- `error?: string | null` - Error message if loading failed
- `onRefresh?: () => Promise<void>` - Callback to refresh graph data
- `compact?: boolean` - Whether to render in compact mode

#### Usage
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

### GraphRenderer

Handles the actual graph visualization using react-force-graph-2d.

#### Props
- `graph: GraphData` - The graph data to render
- `height?: number | string` - Height of the graph
- `width?: number | string` - Width of the graph
- `onNodeClick?: (node: GraphNode) => void` - Callback when a node is clicked
- `onNodeHover?: (node: GraphNode | null) => void` - Callback when a node is hovered
- `selectedNode?: GraphNode | null` - Currently selected node
- `isLoggedIn?: boolean` - Whether the user is logged in
- `centerNodeId?: string` - ID of the node to center the graph on

#### Usage
```tsx
<GraphRenderer 
  graph={processedGraphData}
  height={500}
  onNodeClick={handleNodeClick}
  selectedNode={selectedNode}
/>
```

### GraphControls

UI controls for interacting with the graph visualization.

#### Props
- `onRefresh: () => void` - Callback to refresh graph data
- `onToggleSecondDegree: () => void` - Toggle showing second-degree connections
- `onClearCache: () => void` - Clear cached graph data
- `isRefreshing: boolean` - Whether graph is currently refreshing
- `showSecondDegree: boolean` - Whether second-degree connections are shown
- `selectedNode: GraphNode | null` - Currently selected node
- `onFollowToggle: () => Promise<void>` - Callback to follow/unfollow selected node
- `isLoggedIn: boolean` - Whether user is logged in
- `isFollowing?: boolean` - Whether selected node is being followed

#### Usage
```tsx
<GraphControls
  onRefresh={refreshGraph}
  onToggleSecondDegree={toggleSecondDegree}
  onClearCache={clearGraphCache}
  isRefreshing={isLoading}
  showSecondDegree={showExtendedGraph}
  selectedNode={selectedNode}
  onFollowToggle={handleFollowToggle}
  isLoggedIn={isLoggedIn}
  isFollowing={isFollowingNode}
/>
```

### NodeTooltip

Displays detailed information about a selected node.

#### Props
- `node: GraphNode` - The node to display information for
- `onClose: () => void` - Callback to close the tooltip
- `isFollowing?: boolean` - Whether the node is being followed
- `onFollowNode?: () => void` - Callback to follow/unfollow the node
- `isFollowingLoading?: boolean` - Whether follow action is in progress
- `isLoggedIn?: boolean` - Whether user is logged in

#### Usage
```tsx
{selectedNode && (
  <NodeTooltip
    node={selectedNode}
    onClose={() => setSelectedNode(null)}
    isFollowing={isFollowingNode}
    onFollowNode={handleFollowNode}
    isLoggedIn={isLoggedIn}
  />
)}
```

## Profile Components

Components for displaying Nostr user profiles.

### NostrProfileImage

Displays a user's profile image with loading state.

#### Props
- `npub: string` - The user's Nostr public key
- `width?: number` - Width of the image (default: 64)
- `height?: number` - Height of the image (default: 64)
- `className?: string` - Optional CSS class name
- `alt?: string` - Alt text for the image

#### Usage
```tsx
<NostrProfileImage
  npub="npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e"
  width={40}
  height={40}
  className="rounded-full"
/>
```

### NostrProfileHeader

Displays a user's profile header with name and optional image.

#### Props
- `npub: string` - The user's Nostr public key
- `className?: string` - Optional CSS class name
- `showImage?: boolean` - Whether to show the profile image

#### Usage
```tsx
<NostrProfileHeader
  npub="npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e"
  showImage={true}
  className="mb-4"
/>
```

## Feed Components

### CommunityFeed

Displays a feed of Nostr posts with filtering capabilities.

#### Props
- `npub?: string` - Single Nostr public key to fetch feed for
- `npubs?: string[]` - Multiple Nostr public keys to fetch feed for
- `limit?: number` - Maximum number of posts to display
- `hashtags?: string[]` - Hashtags to filter by
- `className?: string` - Optional CSS class name

#### Usage
```tsx
<CommunityFeed 
  npubs={CORE_NPUBS} 
  limit={10} 
  hashtags={['bitcoin', 'madeira']}
/>
```

## Import Examples

```tsx
// Import from the graph directory
import { SocialGraph, GraphRenderer } from '@/components/community/graph';

// Import from the profile directory
import { NostrProfileImage, NostrProfileHeader } from '@/components/community/profile';

// Import from the community directory
import { 
  SocialGraph, 
  CommunityFeed, 
  MadeiraFeed, 
  NostrProfileImage 
} from '@/components/community';
```

## Performance Considerations

- The graph visualization now uses a failsafe mechanism to ensure it always renders, even with connection issues
- Graph loading is optimized with timeouts and error handling
- Image loading is done incrementally and cached
- The cache system prevents unnecessary network requests and calculations
- Components are memoized to prevent unnecessary re-renders

## Best Practices

1. **Data Fetching**: Use the provided hooks (`useSocialGraph`, `useNostrProfile`) rather than fetching data directly
2. **Caching**: Leverage the cache system for optimal performance
3. **Error Handling**: Always handle loading and error states appropriately
4. **Responsive Design**: Ensure components work well on different screen sizes
5. **Memoization**: Use React.memo for components that don't need frequent re-renders
6. **Context Usage**: Access Nostr functionality through `useNostr` hook

## Recent Changes

### April 2025
- Removed `CacheUsageExample` component as it was only intended for demonstration and development purposes. The example is still available in documentation form at `public/assets/docs/CacheUsageExample.md` for reference, but is no longer part of the production codebase.
- Removed `ClearGraphCache` component as it was redundant and not aligned with the current cache API.
- Renamed SocialGraphVisualization to SocialGraph and clarified component responsibilities. 