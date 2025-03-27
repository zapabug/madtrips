# Community Components

This directory contains components related to the community features of MadTrips, primarily focused on Nostr integration.

## Component Overview

- **CommunityFeed**: Displays posts from popular Nostr users with Bitcoin Madeira hashtags
- **MadeiraFeed**: A specialized feed displaying image-rich Madeira-specific posts from core NPUBs and their connections
- **MultiUserNostrFeed**: Displays posts from core NPUBs and user with optimized fetching 
- **SocialGraph**: Interactive visualization of the Bitcoin Madeira community social graph
- **SocialGraphVisualization**: Lightweight wrapper for displaying the social graph
- **NostrProfileImage**: Reusable component for displaying Nostr profile images
- **NostrProfileHeader**: Component for displaying a Nostr profile header with name and image

## Architectural Decisions

### Centralized Constants

Core definitions like `CORE_NPUBS` are imported from `src/constants/nostr.ts` to ensure consistency across the application.

### Shared Utilities

The `utils.ts` file contains shared utilities for all community components, including:
- Helper functions for processing text content and extracting images from Nostr posts
- Graph data interfaces and processing functions
- Common hashtag definitions

### Component Optimization

Components are optimized for performance through:
- Memoization of component rendering
- Efficient data fetching with caching
- Proper handling of Nostr relay connections
- Shared data structures to prevent redundant code

### Component Relationships

- **SocialGraph** fetches live Nostr data to build a visual network of community connections
- **MadeiraFeed** utilizes the social graph's connection data to display content from both core NPUBs and their connections
- Both components use caching to reduce load on Nostr relays while maintaining fresh data

## Data Flow

1. The Nostr context establishes connections to relays
2. Feed components request data through the Nostr context
3. Profile data is cached to minimize redundant requests
4. The reconnection system ensures reliable data fetching
5. The social graph maps relationships between community members
6. Feed components can use these relationships to enrich their content

## Special Features

- **Image-focused**: The MadeiraFeed specifically targets posts with images to create a visually rich experience
- **Hashtag filtering**: Posts are filtered to focus on Madeira-related content
- **Interactive graph**: The SocialGraph visualizes connections between community members
- **Live updates**: All feeds support real-time updates through Nostr subscriptions

## Future Improvements

- Further optimize the MultiUserNostrFeed to reduce render cycles
- Implement virtualization for large feeds
- Add more interactive features to the social graph visualization
- Improve mutual connection detection in the social graph
- Add better error recovery for network issues 