/**
 * Nostr configuration for the social graph fetcher
 */

export const NOSTR_CONFIG = {
  // Default relays to connect to
  defaultRelays: [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol',
    'wss://nostr.wine',
    'wss://relay.snort.social'
  ],
  
  // Initial set of known npubs (Free Madeira members)
  // This is just an initial set - more can be added via the API
  initialKnownNpubs: [
    // Free Madeira 
    'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e',
    
    // Madtrips agency
    'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh',
  ],
  
  // Timeouts and limits
  fetchTimeoutMs: 10000, // 10 seconds
  maxEventsPerRelay: 500,
  
  // Data file paths (relative to project root)
  dataPath: './data',
  socialGraphFile: './data/social-graph.json',
  knownPubkeysFile: './data/known-pubkeys.json',
};

// Social graph node types
export enum NodeType {
  CORE = 'core',      // Core Free Madeira member
  FOLLOWER = 'follower',  // Follows Free Madeira members
  FOLLOWING = 'following', // Followed by Free Madeira members
  MUTUAL = 'mutual',    // Mutual follows with Free Madeira members
}

// Interaction types
export enum InteractionType {
  FOLLOWS = 'follows',
  MENTIONED = 'mentioned',
  REPLIED = 'replied',
  REPOSTED = 'reposted',
  LIKED = 'liked',
  ZAPPED = 'zapped',
}

// Event kinds we're interested in
export enum NostrEventKind {
  METADATA = 0,
  TEXT_NOTE = 1,
  RECOMMEND_RELAY = 2,
  CONTACTS = 3,
  ENCRYPTED_DM = 4,
  DELETE = 5,
  REPOST = 6,
  REACTION = 7,
  ZAP = 9735,
}

// Configuration for the visualization
export const VISUALIZATION_CONFIG = {
  coreNodeColor: '#9333EA', // Purple for Free Madeira
  followerNodeColor: '#3B82F6', // Blue
  followingNodeColor: '#22C55E', // Green
  mutualNodeColor: '#F59E0B', // Amber
  defaultNodeSize: 5,
  coreNodeSize: 10,
  linkDistance: 100,
  linkStrength: 0.1,
}; 