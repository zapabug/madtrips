/**
 * Lightweight Nostr data types for the Madeira app
 * Focused on minimal data requirements for the app:
 * - Profile image & name (kind:0)
 * - Contact list (kind:3)
 * - Image notes (kind:1)
 * - Hashtags (from tags in kind:1)
 */

/**
 * Lightweight profile data from kind:0 events
 */
export interface LiteProfile {
  pubkey: string;             // hex
  npub?: string;               // bech32 encoded
  name?: string;              // from profile.name
  displayName?: string;       // from profile.display_name or name
  picture?: string;           // profile picture URL
  lastFetched?: number;       // optional for cache
}

/**
 * User's contact/follow list from kind:3 events
 */
export interface ContactList {
  pubkey: string;
  contacts: string[];         // array of pubkeys this user follows
  lastFetched?: number;
}

/**
 * Image-focused note data from kind:1 events
 */
export interface ImageNote {
  id: string;
  pubkey: string;
  content: string;
  tags: string[];             // hashtags only
  created_at: number;
  imageUrls: string[];        // extracted from content or tags
}

/**
 * Extract image URLs from note content
 */
export const extractImageUrls = (content: string): string[] => {
  const regex = /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp))/gi;
  return [...content.matchAll(regex)].map(match => match[0]);
};

/**
 * Extract hashtags from note tags
 * Processes tags in the format ["t", "hashtag"]
 */
export const extractHashtags = (tags: string[][]): string[] =>
  tags.filter(t => t[0] === "t").map(t => t[1]);

/**
 * Process a raw Nostr event into an ImageNote
 */
export const processImageNote = (event: any): ImageNote | null => {
  if (!event || event.kind !== 1) return null;
  
  // Extract image URLs from content
  const imageUrls = extractImageUrls(event.content);
  
  // Only process if it has images
  if (imageUrls.length === 0) return null;
  
  // Extract hashtags from tags
  const hashtags = extractHashtags(event.tags);
  
  return {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    tags: hashtags,
    created_at: event.created_at,
    imageUrls
  };
};

/**
 * Process a raw Nostr kind:0 event into a LiteProfile
 */
export const processLiteProfile = (event: any, npub: string): LiteProfile | null => {
  if (!event || event.kind !== 0 || !event.content) return null;
  
  try {
    // Parse profile content JSON
    const content = JSON.parse(event.content);
    
    return {
      pubkey: event.pubkey,
      npub,
      name: content.name || content.display_name || content.displayName,
      displayName: content.display_name || content.name || content.displayName,
      picture: content.picture,
      lastFetched: Date.now()
    };
  } catch (error) {
    console.error('Error parsing profile JSON:', error);
    return null;
  }
};

/**
 * Process a raw Nostr kind:3 event into a ContactList
 */
export const processContactList = (event: any): ContactList | null => {
  if (!event || event.kind !== 3) return null;
  
  // Extract pubkeys from p tags
  const contacts = event.tags
    .filter((tag: string[]) => tag[0] === 'p')
    .map((tag: string[]) => tag[1]);
  
  return {
    pubkey: event.pubkey,
    contacts,
    lastFetched: Date.now()
  };
}; 