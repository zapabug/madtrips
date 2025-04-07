import { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

/**
 * MCP-enhanced Nostr Integration
 * 
 * This module provides enhanced Nostr integration for real-time data
 * with Web of Trust support and strict data validation.
 */

// Define window global type extension
declare global {
  interface Window {
    _mcp_profile_image_cache?: Map<string, HTMLImageElement>;
  }
}

export interface MCPNostrOptions {
  enforceRealData: boolean;
  useWebOfTrust: boolean;
  maxSecondDegreeNodes?: number;
  coreNpubs: string[];
}

// Define the relays statically to avoid the Object.values().flat() issue
export const STATIC_RELAYS = {
  PRIMARY: [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
    "wss://relay.snort.social",
    "wss://nostr.wine",
    "wss://relay.nostr.info"
  ],
  COMMUNITY: [
    "wss://purplepag.es",
    "wss://nostr.mutinywallet.com",
    "wss://relay.nostrati.com",
    "wss://relay.sendstr.com",
    "wss://relay.nostromo.social",
    "wss://eden.nostr.land"
  ],
  FAST: [
    "wss://relay.primal.net",
    "wss://relay.damus.io",
    "wss://nostr.zebedee.cloud",
    "wss://relay.snort.social",
    "wss://relay.nostr.band"
  ],
  MADEIRA: [
    "wss://relay.current.fyi",
    "wss://purplepag.es",
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.snort.social"
  ]
};

/**
 * Creates a Web of Trust filter that only returns events from 
 * users who are connected through trusted relationships
 */
export const createWoTFilter = (
  npubs: string[], 
  kinds: number[], 
  limit?: number
): NDKFilter[] => {
  // Convert npubs to pubkeys
  const pubkeys = npubs.map(npub => {
    try {
      if (npub.startsWith('npub1')) {
        const { type, data } = nip19.decode(npub);
        if (type === 'npub') return data as string;
      }
      return npub;
    } catch (e) {
      console.warn(`Invalid npub: ${npub}`, e);
      return null;
    }
  }).filter(Boolean) as string[];

  // Create filters for the pubkeys
  return [
    {
      kinds,
      authors: pubkeys,
      limit: limit || 25
    }
  ];
};

/**
 * Validates Nostr data to ensure it's real and not placeholder
 * Only returns true if the data passes validation
 */
export const validateNostrData = (event: NDKEvent): boolean => {
  if (!event) return false;
  if (!event.id) return false;
  if (!event.pubkey) return false;
  if (!event.content) return false;
  
  // Check for obviously fake content
  if (event.content.includes('Lorem ipsum')) return false;
  if (event.content.includes('placeholder')) return false;
  
  return true;
};

/**
 * Enhanced subscription function that enforces real data
 * and can apply Web of Trust filtering
 */
export const createEnhancedSubscription = (
  ndk: any,
  filters: NDKFilter[],
  options: MCPNostrOptions,
  onEvent: (event: NDKEvent) => void
): NDKSubscription | null => {
  if (!ndk) return null;
  
  try {
    // Essential relays that should always be included
    const essentialRelays = [
      "wss://relay.damus.io",
      "wss://nos.lol",
      "wss://relay.nostr.band",
      "wss://relay.snort.social",
      "wss://nostr.wine"
    ];
    
    // Check if we're loading a single profile/specific NPUB
    const isSingleProfile = filters.some(f => 
      f.authors && f.authors.length === 1 && 
      (!options.coreNpubs.includes(f.authors[0]) || options.coreNpubs.length === 1)
    );
    
    // Special case for Free Madeira NPUB
    const isFreeMadeira = filters.some(f => 
      f.authors && f.authors.length === 1 &&
      f.authors[0] && (
        // Check for the hex pubkey of Free Madeira
        f.authors[0] === '3ebd734d48f3b4995a1e8ef6a52001cb1b847278bd9851448b95bb483b6f368f' ||
        // Or check if the npub is in options
        options.coreNpubs.some(npub => npub === 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e')
      )
    );
    
    // Use special relays for Free Madeira
    let relaysToAdd: string[] = [];
    
    if (isFreeMadeira) {
      // For Free Madeira content, use extra relays known to have its content
      relaysToAdd = [
        ...essentialRelays,
        ...STATIC_RELAYS.MADEIRA,
        ...STATIC_RELAYS.COMMUNITY.slice(0, 3),
        "wss://relay.current.fyi",
        "wss://eden.nostr.land",
        "wss://nostr-pub.wellorder.net"
      ];
    } 
    else if (isSingleProfile) {
      // For single profiles, use a wider range of relays
      relaysToAdd = [
        ...essentialRelays,
        ...STATIC_RELAYS.PRIMARY,
        ...STATIC_RELAYS.FAST.slice(0, 3)
      ];
    }
    else {
      // For general feed fetching, use a balanced approach
      relaysToAdd = [
        ...essentialRelays,
        ...STATIC_RELAYS.PRIMARY.slice(0, 3),
        ...STATIC_RELAYS.FAST.slice(0, 3)
      ];
    }
    
    // Remove duplicates
    relaysToAdd = [...new Set(relaysToAdd)];
    
    // Ensure connected relay count is optimal
    let optimalRelayCount = isSingleProfile ? 10 : (isFreeMadeira ? 15 : 8);
    
    // Add relays until we reach the optimal count
    let connectedCount = 0;
    for (const relay of relaysToAdd) {
      try {
        ndk.addRelayUrl(relay);
        connectedCount++;
        
        // Stop adding relays if we've reached optimal count
        if (connectedCount >= optimalRelayCount) break;
      } catch (e) {
        console.warn(`Failed to add relay ${relay}:`, e);
      }
    }
    
    // Ensure we have minimum connections
    if (connectedCount < 3) {
      // Emergency fallback - if we have very few connections, try more relays
      console.warn(`Low relay connection count (${connectedCount}), adding fallbacks`);
      
      // Use a manually defined fallback list instead of trying to use allRelays
      const fallbackRelays = [
        "wss://relay.current.fyi",
        "wss://relay.nostr.band",
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://nostr.wine",
        "wss://relay.nostr.info",
        "wss://relay.nostrati.com",
        "wss://relay.nostrplebs.com"
      ];
      
      // Try fallback relays
      for (const relay of fallbackRelays) {
        if (!relaysToAdd.includes(relay)) {
          try {
            ndk.addRelayUrl(relay);
            connectedCount++;
            
            if (connectedCount >= 5) break; // Stop at 5 for fallback
          } catch (e) {
            // Ignore errors for fallbacks
          }
        }
      }
    }
    
    // Log the relay connection status
    console.log(`MCP connected to ${connectedCount} relays for subscription`);
    
    // Create subscription with error handling
    const sub = ndk.subscribe(filters, { 
      closeOnEose: false,
      // Important: Set timeout to ensure we don't hang
      timeout: isFreeMadeira ? 25000 : (isSingleProfile ? 15000 : 30000)
    });
    
    // Keep track of events received
    let eventCount = 0;
    
    // Subscribe to events
    sub.on('event', (event: NDKEvent) => {
      // Check if it's a Free Madeira event
      const isFreeMadeiraEvent = event.pubkey === '3ebd734d48f3b4995a1e8ef6a52001cb1b847278bd9851448b95bb483b6f368f';
      
      // Skip validation for Free Madeira content
      if (options.enforceRealData && !isFreeMadeiraEvent && !validateNostrData(event)) {
        return;
      }
      
      eventCount++;
      onEvent(event);
    });
    
    // Log eose (end of stored events)
    sub.on('eose', () => {
      console.log(`MCP subscription received ${eventCount} events (EOSE)`);
      
      // If we got no events from Free Madeira but that's what we were looking for,
      // add a small delay before closing to allow for slow relays
      if (eventCount === 0 && isFreeMadeira) {
        setTimeout(() => {
          console.log('Additional wait time for Free Madeira completed');
        }, 5000);
      }
    });
    
    return sub;
  } catch (error) {
    console.error('Error creating enhanced subscription:', error);
    return null;
  }
};

/**
 * Fetches profiles with Web of Trust expansion
 */
export const fetchProfilesWithWoT = async (
  ndk: any,
  npubs: string[],
  options: MCPNostrOptions
): Promise<string[]> => {
  if (!ndk || !options.useWebOfTrust) return npubs;
  
  const expandedNpubs = new Set<string>(npubs);
  
  // Process each core npub to get their contacts
  for (const npub of options.coreNpubs) {
    try {
      const { data: pubkey } = nip19.decode(npub);
      
      // Fetch contact lists
      const filter: NDKFilter = {
        kinds: [3],
        authors: [pubkey as string],
        limit: 1
      };
      
      const events = await ndk.fetchEvents([filter], { closeOnEose: true });
      
      if (events.size === 0) continue;
      
      // Process contact lists
      for (const event of events) {
        const contacts = event.tags
          .filter((tag: string[]) => tag[0] === 'p')
          .map((tag: string[]) => tag[1])
          .filter(Boolean);
        
        // Convert hex pubkeys to npubs and add to set
        for (const contact of contacts) {
          try {
            const contactNpub = nip19.npubEncode(contact);
            expandedNpubs.add(contactNpub);
          } catch (e) {
            // Skip invalid pubkeys
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch contacts for ${npub}:`, e);
    }
  }
  
  const result = Array.from(expandedNpubs);
  
  // Limit the number of second-degree connections if specified
  if (options.maxSecondDegreeNodes && result.length > options.coreNpubs.length) {
    const coreSet = new Set(options.coreNpubs);
    const secondDegree = result.filter(npub => !coreSet.has(npub));
    
    if (secondDegree.length > options.maxSecondDegreeNodes) {
      // Randomly select a subset
      const selected = secondDegree.sort(() => 0.5 - Math.random()).slice(0, options.maxSecondDegreeNodes);
      return [...options.coreNpubs, ...selected];
    }
  }
  
  return result;
};

/**
 * Utility to force load profile images in advance
 */
export const preloadProfileImages = (profiles: any[]): void => {
  if (typeof window === 'undefined') return;
  
  for (const profile of profiles) {
    if (profile.picture) {
      const img = new Image();
      img.src = profile.picture;
      // Store in cache
      window._mcp_profile_image_cache = window._mcp_profile_image_cache || new Map();
      window._mcp_profile_image_cache.set(profile.picture, img);
    }
  }
}; 