import { NDKRelay } from '@nostr-dev-kit/ndk';

export const RELAYS = {
  // Primary relays - essential for core app functionality
  PRIMARY: [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
    "wss://relay.snort.social",
    "wss://nostr.wine",
    "wss://relay.nostr.info"
  ],
  
  // Community-focused relays
  COMMUNITY: [
    "wss://purplepag.es",
    "wss://nostr.mutinywallet.com",
    "wss://relay.nostrati.com",
    "wss://relay.sendstr.com",
    "wss://relay.nostromo.social",
    "wss://eden.nostr.land"
  ],
  
  // Backup relays when primary fails
  BACKUP: [
    "wss://nos.lol",
    "wss://nostr.fmt.wiz.biz",
    "wss://relay.current.fyi",
    "wss://relay.nostr.bg",
    "wss://nostr.bitcoiner.social",
    "wss://nostr-pub.wellorder.net"
  ],
  
  // Fast relays optimized for quick responses
  FAST: [
    "wss://relay.primal.net",
    "wss://relay.damus.io",
    "wss://nostr.zebedee.cloud",
    "wss://relay.snort.social",
    "wss://relay.nostr.band",
    "wss://relay.nos.social",
    "wss://nostr.oxtr.dev",
    "wss://relay.nostrplebs.com",
    "wss://relay.wellorder.net"
  ],
  
  // Special Madeira-focused relays
  MADEIRA: [
    "wss://relay.current.fyi",
    "wss://purplepag.es",
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.snort.social"
  ]
};

// Default list of relays to use (combines more reliable relays for better connectivity)
export const DEFAULT_RELAYS = [
  ...RELAYS.PRIMARY.slice(0, 4),
  ...RELAYS.FAST.slice(0, 3),
  ...RELAYS.MADEIRA.slice(0, 2)
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
    ...RELAYS.MADEIRA
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