export const RELAYS = {
  // Primary relays - essential for core app functionality
  PRIMARY: [
    "wss://relay.damus.io",
    "wss://nostr.wine",
    "wss://relay.nostr.band",
    "wss://relay.snort.social",
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
  ],
};

// Default list of relays to use (combines Primary and Fast)
export const DEFAULT_RELAYS = [
  ...RELAYS.PRIMARY,
  ...RELAYS.FAST,
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