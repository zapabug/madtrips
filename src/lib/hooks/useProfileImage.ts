'use client';

import { useState, useEffect } from 'react';

type ImageSource = 'known' | 'nostr-build' | 'iris' | 'robohash' | 'default' | null;

export interface ProfileImageResult {
  profilePic: string | null;
  loading: boolean;
  source: ImageSource;
  error: string | null;
}

/**
 * A hook to handle Nostr profile image loading with multiple fallback strategies
 * @param npub The Nostr public key (npub) to fetch the profile image for
 * @param initialProfilePic Optional initial profile picture URL
 * @returns An object with the profile picture URL and loading state
 */
export function useProfileImage(npub: string | null, initialProfilePic?: string | null): ProfileImageResult {
  const [profilePic, setProfilePic] = useState<string | null>(initialProfilePic || null);
  const [loading, setLoading] = useState(!!npub); // Only start loading if npub is provided
  const [source, setSource] = useState<ImageSource>(initialProfilePic ? 'known' : null);
  const [error, setError] = useState<string | null>(null);

  // Generate a default profile picture based on npub
  const getDefaultProfilePic = (inputNpub: string): string => {
    // Generate a color based on the npub hash
    const hash = inputNpub.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const h = Math.abs(hash) % 360;
    
    // Create a data URI for a colored circle with the first letter
    const firstLetter = (inputNpub.replace('npub1', '') || 'N').charAt(0).toUpperCase();
    
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='hsl(${h}, 70%25, 60%25)'/%3E%3Ctext x='20' y='25' font-family='Arial' font-size='16' fill='white' text-anchor='middle'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
  };

  // Check if an image exists at a given URL
  const checkImageExists = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.crossOrigin = 'anonymous';
      // Set timeout to avoid waiting forever
      setTimeout(() => resolve(false), 3000);
      img.src = url;
    });
  };

  // Effect to load profile image when npub changes
  useEffect(() => {
    if (!npub) {
      setLoading(false);
      return;
    }
    
    // Don't reload if we already have the image and the npub hasn't changed
    if (profilePic && !loading) return;

    const loadProfileImage = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try multiple sources in sequence with fallbacks
        
        // 1. First try avatar.nostr.build with proper error handling
        try {
          const avatarUrl = `https://avatar.nostr.build/${npub}.png`;
          const avatarExists = await checkImageExists(avatarUrl);
          
          if (avatarExists) {
            console.log('Found profile picture at avatar.nostr.build');
            setProfilePic(avatarUrl);
            setSource('nostr-build');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Error checking avatar.nostr.build:', error);
          // Continue to next source
        }
        
        // 2. Try Iris API as a fallback
        try {
          const irisUrl = `https://iris.to/api/pfp/${npub}`;
          const irisExists = await checkImageExists(irisUrl);
          
          if (irisExists) {
            console.log('Found profile picture at iris.to');
            setProfilePic(irisUrl);
            setSource('iris');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Error checking iris.to:', error);
          // Continue to next source
        }
        
        // 3. As a last option, try robohash.org to generate a unique avatar
        try {
          const robohashUrl = `https://robohash.org/${npub}?set=set4`;
          console.log('Using robohash as fallback avatar');
          setProfilePic(robohashUrl);
          setSource('robohash');
          setLoading(false);
          return;
        } catch (error) {
          console.warn('Error using robohash:', error);
          // Fall back to generated SVG
        }
        
        // 4. Final fallback - generate an SVG
        const defaultPic = getDefaultProfilePic(npub);
        setProfilePic(defaultPic);
        setSource('default');
      } catch (error) {
        console.error('All profile picture sources failed:', error);
        setError('Failed to load profile picture');
        const defaultPic = getDefaultProfilePic(npub);
        setProfilePic(defaultPic);
        setSource('default');
      } finally {
        setLoading(false);
      }
    };

    loadProfileImage();
  }, [npub, profilePic, loading, setProfilePic, setLoading, setError, setSource]);

  return { profilePic, loading, source, error };
} 