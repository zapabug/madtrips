# Community Components

This directory contains components related to the community features of MadTrips, primarily focused on Nostr integration.

## Component Overview

- **NostrFeed**: Displays posts from popular #t 
- **MultiUserNostrFeed**: Displays posts from core_npubs abd user with optimized fetching 
- **NostrProfileImage**: Reusable component for displaying Nostr profile images
- **NostrProfileHeader**: Component for displaying a Nostr profile header with name and image
- **SocialGraphVisualization**: Lightweight visualization of the Bitcoin Madeira community social graph

## Architectural Decisions

### Shared Utilities

The `utils.ts` file contains shared utilities for all community components, including:
- Constants like `CORE_NPUBS` for important community members
- Helper functions for processing text content and extracting images from Nostr posts
- Graph data interfaces and processing functions

### Component Optimization

Components are optimized for performance through:
- Memoization of component rendering
- Efficient data fetching with caching
- Proper handling of Nostr relay connections
- Shared data structures to prevent redundant code

### Migration Notes

The `SocialGraph` component has been replaced by the more lightweight `SocialGraphVisualization` component.
The original component had more dynamic features but consumed excessive resources for what was needed.
The visualization now uses static data from `socialgraph.json` to provide a performant representation of
the Bitcoin Madeira community network.

## Data Flow

1. The Nostr context establishes connections to relays
2. Feed components request data through the Nostr context
3. Profile data is cached to minimize redundant requests
4. The reconnection system ensures reliable data fetching

## Future Improvements

- Further optimize the MultiUserNostrFeed to reduce render cycles
- Consider implementing virtualization for large feeds
- Add more interactive features to the social graph visualization 