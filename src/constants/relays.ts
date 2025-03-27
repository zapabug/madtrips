import { NDKRelay } from '@nostr-dev-kit/ndk';

export const RELAYS = {
  // Primary relays - essential for core app functionality
  PRIMARY: [
    "wss://relay.primal.net",
    "wss://relay.nostr.band",
    "wss://relay.snort.social",
    "wss://relay.olas.app"
  ],
  
  // Community-focused relays
  COMMUNITY: [
    "wss://purplepag.es",
    "wss://nostr.mutinywallet.com",
    "wss://relay.nostrati.com",
  ],
  
  // Backup relays when primary fails
  BACKUP: [
    "wss://nos.lol",
    "wss://nostr.fmt.wiz.biz",
    "wss://relay.current.fyi",
  ],
  
  // Fast relays optimized for quick responses
  FAST: [
    "wss://relay.primal.net",
    "wss://nostr.zebedee.cloud",
    "wss://relay.eupurplerelay.net",
    "wss://nostr.1312.media",
    "wss://nostr.stakey.net",
    "wss://relay.nostr.net",
    "wss://lunchbox.sandwich.farm",
    "wss://r.lostr.net",
    "wss://nostr.yael.at",
    "wss://history.nostr.watch",
    "wss://travis-shears-nostr-relay-v2.fly.dev",
    "wss://nostr.sprovoost.nl",
    "wss://nostr.agentcampfire.com",
    "wss://dvms.f7z.io",
    "wss://fl.purplerelay.com"
  ],
};

// Default list of relays to use (combines Primary and Fast)
export const DEFAULT_RELAYS = [
  ...RELAYS.PRIMARY,
  ...RELAYS.FAST.slice(0, 5), // Use only the first 5 fast relays by default to avoid overwhelming connections
];

// Function to get a specific set of relays
export const getRelays = (type: keyof typeof RELAYS | 'DEFAULT') => {
  if (type === 'DEFAULT') return DEFAULT_RELAYS;
  return RELAYS[type];
};

// Function to get all available relays
export const getAllRelays = () => {
  return [
    ...RELAYS.PRIMARY,
    ...RELAYS.COMMUNITY,
    ...RELAYS.BACKUP,
    ...RELAYS.FAST,
  ];
};

// Helper function to create an NDKRelay from a URL string
export const createRelay = (url: string): NDKRelay => {
  return { url } as NDKRelay;
};

// Function to create an array of NDKRelay objects from a list of URLs
export const createRelays = (urls: string[]): NDKRelay[] => {
  return urls.map(url => createRelay(url));
}; 