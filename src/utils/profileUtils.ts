import { nip19 } from 'nostr-tools';
import { NostrProfile } from '../types/nostr';

// Known profile pictures for specific npubs
export const KNOWN_PROFILES: Record<string, string> = {
  'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh': '', // MADTRIPS
  'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc': '', // FUNCHAL  
  'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e': '', // COMMUNITY
  'npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5': '',  // SEC
};

// Default profile image to use when none available
export const DEFAULT_PROFILE_IMAGE = '/assets/images/default-profile.png';

/**
 * Shorten an npub for display purposes
 * @param npub Nostr public key (npub)
 * @returns Shortened npub string
 */
export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  
  if (npub.length <= 16) return npub;
  
  if (npub.startsWith('npub1')) {
    return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
  }
  
  return `${npub.substring(0, 6)}...${npub.substring(npub.length - 4)}`;
};

/**
 * Convert hex pubkey to npub format
 * @param hexPubkey Hex format pubkey
 * @returns npub formatted key or original if conversion fails
 */
export const hexToNpub = (hexPubkey: string): string => {
  if (!hexPubkey) return '';
  
  try {
    // If already npub format, return as is
    if (hexPubkey.startsWith('npub1')) {
      return hexPubkey;
    }
    
    // Convert hex to npub
    return nip19.npubEncode(hexPubkey);
  } catch (error) {
    console.error('Error converting hex to npub:', error);
    return hexPubkey;
  }
};

/**
 * Convert npub to hex pubkey format
 * @param npub npub format pubkey 
 * @returns hex formatted pubkey or original if conversion fails
 */
export const npubToHex = (npub: string): string => {
  if (!npub) return '';
  
  try {
    // If already hex format, return as is
    if (!/^npub1/.test(npub)) {
      return npub;
    }
    
    // Decode npub to hex
    const { type, data } = nip19.decode(npub);
    return type === 'npub' ? data as string : npub;
  } catch (error) {
    console.error('Error converting npub to hex:', error);
    return npub;
  }
};

/**
 * Get a valid profile picture URL or fallback to default
 * @param profile Nostr profile object
 * @returns Valid image URL
 */
export const getProfileImageUrl = (profile: NostrProfile | null): string => {
  if (!profile) return DEFAULT_PROFILE_IMAGE;
  
  const { picture } = profile;
  
  if (!picture) return DEFAULT_PROFILE_IMAGE;
  
  // Validate URL format
  try {
    new URL(picture);
    return picture;
  } catch (error) {
    return DEFAULT_PROFILE_IMAGE;
  }
};

/**
 * Get display name from profile with fallbacks
 * @param profile Nostr profile object
 * @returns Best available display name
 */
export const getDisplayName = (profile: NostrProfile | null): string => {
  if (!profile) return 'Unknown User';
  
  // Prefer display name > name > shortened npub
  if (profile.displayName) return profile.displayName;
  if (profile.name) return profile.name;
  if (profile.npub) return shortenNpub(profile.npub);
  
  return 'Unknown User';
};

/**
 * Format time elapsed since event
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted time string (e.g., "2h ago")
 */
export const formatTimeAgo = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
  // Format as date for older posts
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}; 