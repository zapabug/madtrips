# Utils Directory

This directory contains utility functions used throughout the MadTrips application. These utilities are organized by domain to provide standardized functionality and reduce code duplication.

## Contents

- [`profileUtils.ts`](#profileutils) - Profile-related utility functions
- [`nostrUtils.ts`](#nostrutils) - Nostr protocol utility functions
- [`graphUtils.ts`](#graphutils) - Social graph visualization utilities
- [`images.ts`](#images) - Image handling utilities

## profileUtils

Utilities for handling user profiles in the Nostr protocol.

### Key Functions

- `shortenNpub(npub: string)` - Formats a Nostr public key for display
- `hexToNpub(hexPubkey: string)` - Converts hex format pubkey to npub format
- `npubToHex(npub: string)` - Converts npub format to hex pubkey
- `getProfileImageUrl(profile: NostrProfile)` - Gets valid profile image URL with fallback
- `getDisplayName(profile: NostrProfile)` - Extracts best display name from profile data
- `formatTimeAgo(timestamp: number)` - Formats timestamp as relative time

### Example

```typescript
import { shortenNpub, getDisplayName } from '../utils/profileUtils';

// Display shortened npub
const displayId = shortenNpub('npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e');
// Result: "npub1etg...fj8n6e"

// Get display name with fallbacks
const name = getDisplayName(profile);
// Returns profile.displayName, profile.name, or shortened npub in that order
```

## nostrUtils

Centralized utilities for working with Nostr data and events.

### Key Functions

- `validateNpub(npub: string)` - Validates if a string is a valid npub
- `extractImageUrls(content: string)` - Extracts image URLs from event content
- `extractHashtags(content: string)` - Extracts hashtags from event content
- `handleNostrError(error: unknown, context: string)` - Standardized error handler
- `getDisplayName(profile: any, pubkey: string)` - Extract name from profile metadata

### Example

```typescript
import { extractHashtags, validateNpub } from '../utils/nostrUtils';

// Extract hashtags from content
const hashtags = extractHashtags('Check out #bitcoin and #nostr technologies');
// Result: ['bitcoin', 'nostr']

// Validate npub
const isValid = validateNpub('npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e');
// Result: true
```

## graphUtils

Utilities for the social graph visualization components.

### Key Functions

- `handleNodeClick(event, node, navigate?)` - Handle click events on graph nodes
- `calculateForceParameters(nodeCount)` - Calculate optimal force simulation parameters
- `restartSimulation(simulation, nodes, links)` - Restart D3 force simulation
- `createNodeColorScale()` - Create a color scale for nodes based on connections
- `formatNodeLabel(node)` - Format node labels based on profile data

### Example

```typescript
import { restartSimulation, calculateForceParameters } from '../utils/graphUtils';

// Create D3 simulation with optimized parameters
const simulation = d3.forceSimulation();
restartSimulation(simulation, graphData.nodes, graphData.links);
```

## images

Image handling utilities.

### Key Functions

- `preloadProfileImages(nodes)` - Preload node profile images for faster rendering

### Example

```typescript
import { preloadProfileImages } from '../utils/images';

// Preload images for graph nodes
preloadProfileImages(graphData.nodes);
```

## Best Practices

1. Import utilities directly from their specific file rather than from index exports
2. Avoid duplicating utility functions across the codebase
3. Add new utilities to the appropriate file based on domain
4. Include proper JSDoc comments for all utility functions 