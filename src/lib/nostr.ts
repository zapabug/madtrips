import { nip19 } from 'nostr-tools';

/**
 * Normalizes a Nostr pubkey to hex format
 * Handles both npub and hex formats
 */
export function normalizeNostrPubkey(input: string): string {
  // If input is already a hex pubkey (64 chars)
  if (/^[0-9a-f]{64}$/i.test(input)) {
    return input.toLowerCase();
  }
  
  // If input is an npub
  if (input.startsWith('npub1')) {
    try {
      const { data } = nip19.decode(input);
      return data as string;
    } catch (e) {
      throw new Error(`Invalid npub format: ${input}`);
    }
  }
  
  throw new Error(`Invalid pubkey format: ${input}`);
}

/**
 * Converts a hex pubkey to npub format
 */
export function hexToNpub(hexPubkey: string): string {
  if (!/^[0-9a-f]{64}$/i.test(hexPubkey)) {
    throw new Error('Invalid hex pubkey format');
  }
  
  return nip19.npubEncode(hexPubkey);
}

/**
 * Shortens an npub or hex pubkey for display
 */
export function shortenKey(key: string): string {
  // If npub, take first 8 chars after npub1 and last 4
  if (key.startsWith('npub1')) {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }
  
  // If hex, take first 6 and last 4
  if (/^[0-9a-f]{64}$/i.test(key)) {
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
  }
  
  return key;
} 