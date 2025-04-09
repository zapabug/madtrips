import { CORE_NPUBS } from '../src/hooks/utils';

/**
 * MCP Configuration
 * 
 * This file contains settings for the Model Context Protocol integration
 * with Nostr. It ensures consistent behavior across components.
 */

export const MCP_CONFIG = {
  // Default settings
  defaults: {
    enforceRealData: true,           // Only use real data, no mocks or placeholders
    useWebOfTrust: true,             // Enable web of trust by default
    maxSecondDegreeNodes: 50,        // Maximum number of second-degree nodes to include
    maxWebOfTrustPosts: 100,         // Maximum number of posts to load from Web of Trust
    billboardFullSizeImages: true,   // Allow billboard to display full-size images
    displayNIP05: true,              // Always show NIP-05 identifiers when available
    cleanInvalidData: true,          // Filter out invalid or placeholder data
    nsfwKeywords: ['nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', '18+', 'explicit', 'content warning', 'cw'],
  },
  
  // Core user identifiers (from canonical source)
  coreNpubs: CORE_NPUBS,
  
  // Cache settings
  cache: {
    ttl: 30 * 60 * 1000,             // 30 minutes cache TTL
    maxSize: 500,                    // Maximum number of items in cache
    storageKey: 'madeira-mcp-cache', // Local storage key for cache
  },
  
  // Graph visualization settings
  graph: {
    minZoom: 0.5,                    // Minimum zoom level
    maxZoom: 5,                      // Maximum zoom level
    initialZoom: 2,                  // Initial zoom level
    nodeSize: {
      core: 25,                      // Size for core nodes
      firstDegree: 15,               // Size for first-degree connections
      secondDegree: 10,              // Size for second-degree connections
    },
    colors: {
      core: '#f7931a',               // Bitcoin orange for core nodes
      mutual: '#f7931a',             // Bitcoin orange for mutual connections
      follows: '#e9e1d4',            // Light sand for follow connections
      background: 'transparent',     // Transparent background
    },
  },
  
  // Community feed settings
  feed: {
    defaultLimit: 25,                // Default number of posts to show
    refreshInterval: 30 * 1000,      // Auto-refresh interval (30 seconds)
    imageHandling: {
      enableFullSize: true,          // Enable viewing full-size images
      objectFit: 'contain',          // How images should fit in containers
      maxHeight: 500,                // Maximum image height in feed
    },
  },
}; 