/**
 * Centralized Nostr Utilities
 * 
 * This file contains common utilities for working with Nostr data and events.
 * It consolidates functions that were previously duplicated across components.
 */

import { nip19 } from 'nostr-tools';
import { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Validates if a string is a valid npub
 */
export const validateNpub = (npub: string): boolean => {
  try {
    if (!npub.startsWith('npub1')) {
      return false;
    }
    const { type } = nip19.decode(npub);
    return type === 'npub';
  } catch (e) {
    return false;
  }
};

/**
 * Shortens an npub for display
 */
export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  if (npub.length <= 12) return npub;
  
  return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
};

/**
 * Extracts image URLs from event content
 */
export const extractImageUrls = (content: string): string[] => {
  if (!content) return [];
  
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?)/gi;
  const matches = content.match(urlRegex) || [];
  
  return matches.filter(url => {
    // Simple filter for valid image URLs
    try {
      const urlObj = new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  });
};

/**
 * Extracts hashtags from event content
 */
export const extractHashtags = (content: string): string[] => {
  if (!content) return [];
  
  const regex = /#(\w+)/g;
  const matches = content.match(regex) || [];
  
  return matches
    .map(tag => tag.replace('#', '').toLowerCase())
    .filter(tag => tag.length > 0);
};

/**
 * Standardized error handler for Nostr operations
 */
export const handleNostrError = (error: unknown, context: string): void => {
  console.error(`Error in ${context}:`, error);
  // Add centralized error reporting if needed
};

/**
 * Extract name from profile metadata or fallback to shortening pubkey
 */
export const getDisplayName = (profile: any, pubkey: string): string => {
  if (profile?.displayName) return profile.displayName;
  if (profile?.name) return profile.name;
  
  // Fallback: shorten pubkey
  return shortenNpub(pubkey);
}; 