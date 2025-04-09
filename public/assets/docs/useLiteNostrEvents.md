import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import {
  LiteProfile,
  ContactList,
  ImageNote,
  processLiteProfile,
  processContactList,
  processImageNote
} from '../types/lite-nostr';

interface UseLiteNostrEventsOptions {
  pubkeys?: string[];      // Hex pubkeys or npubs to subscribe to
  kinds?: number[];        // Event kinds to subscribe to (default: [0, 1, 3])
  limit?: number;          // Limit for event fetching
  since?: number;          // Timestamp to fetch events since (default: 24h ago)
  skipCache?: boolean;     // Skip any local caching
  autoSubscribe?: boolean; // Auto-subscribe to events (default: true)
}

interface UseLiteNostrEventsResult {
  profiles: Map<string, LiteProfile>;
  contacts: Map<string, ContactList>;
  imageNotes: ImageNote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
}

/**
 * A hook that processes and categorizes raw Nostr events into lightweight types
 * Optimized for real-time data with subscription capabilities
 */
export function useLiteNostrEvents({
  pubkeys = [],
  kinds = [0, 1, 3],
  limit = 100,
  since = Math.floor((Date.now() / 1000) - 86400), // Last 24 hours
  skipCache = false,
  autoSubscribe = true
}: UseLiteNostrEventsOptions = {}): UseLiteNostrEventsResult {
  const { ndk, ndkReady, getEvents } = useNostr();
  
  // State for processed events
  const [profiles, setProfiles] = useState<Map<string, LiteProfile>>(new Map());
  const [contacts, setContacts] = useState<Map<string, ContactList>>(new Map());
  const [imageNotes, setImageNotes] = useState<ImageNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track subscription state
  const subscriptionRef = useRef<any>(null);
  const isMounted = useRef(true);
  const pubkeysRef = useRef<string[]>([]);
  
  // Process an incoming event based on its kind
  const processEvent = useCallback((event: any) => {
    if (!event || !event.kind) return;
    
    try {
      // Process kind:0 (profile metadata)
      if (event.kind === 0) {
        // Convert pubkey to npub
        let userNpub = '';
        if (ndk) {
          const user = ndk.getUser({ pubkey: event.pubkey });
          userNpub = user.npub;
        }
        
        const profile = processLiteProfile(event, userNpub);
        if (profile) {
          setProfiles(prev => {
            const newMap = new Map(prev);
            newMap.set(profile.npub, profile);
            return newMap;
          });
        }
      }
      
      // Process kind:3 (contact list)
      if (event.kind === 3) {
        const contactList = processContactList(event);
        if (contactList) {
          setContacts(prev => {
            const newMap = new Map(prev);
            newMap.set(contactList.pubkey, contactList);
            return newMap;
          });
        }
      }
      
      // Process kind:1 (text note) - filter for image notes
      if (event.kind === 1) {
        const note = processImageNote(event);
        if (note) {
          setImageNotes(prev => {
            // Check if we already have this note
            if (prev.some(n => n.id === note.id)) return prev;
            
            // Add new note and sort by created_at (newest first)
            const newNotes = [...prev, note];
            return newNotes.sort((a, b) => b.created_at - a.created_at);
          });
        }
      }
    } catch (e) {
      console.error('Error processing Nostr event:', e);
    }
  }, [ndk]);
  
  // Convert npubs to hex pubkeys
  const normalizePubkeys = useCallback((keys: string[]) => {
    if (!ndk) return keys;
    
    return keys.map(key => {
      try {
        // Check if it's an npub and convert to hex if needed
        if (key.startsWith('npub1')) {
          const user = ndk.getUser({ npub: key });
          return user.pubkey;
        }
        return key;
      } catch (e) {
        return key;
      }
    });
  }, [ndk]);
  
  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    if (!ndkReady || !pubkeys.length) return;
    
    try {
      setLoading(true);
      
      // Convert npubs to hex pubkeys
      const hexPubkeys = normalizePubkeys(pubkeys);
      pubkeysRef.current = hexPubkeys;
      
      // Create filter for fetching all relevant events
      const filter = {
        kinds,
        authors: hexPubkeys,
        since,
        limit
      };
      
      // Fetch events
      const events = await getEvents(filter, { forceFresh: skipCache });
      
      if (events && isMounted.current) {
        // Process each event
        events.forEach(event => {
          processEvent(event);
        });
      }
    } catch (err) {
      console.error('Error fetching initial Nostr data:', err);
      if (isMounted.current) {
        setError('Error fetching data from Nostr network');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [pubkeys, kinds, limit, since, skipCache, ndkReady, normalizePubkeys, getEvents, processEvent]);
  
  // Set up subscription for real-time updates
  const subscribe = useCallback(() => {
    if (!ndk || !ndkReady || !pubkeys.length || subscriptionRef.current) return;
    
    try {
      // Convert npubs to hex pubkeys
      const hexPubkeys = normalizePubkeys(pubkeys);
      pubkeysRef.current = hexPubkeys;
      
      // Create filter for subscription
      const filter = {
        kinds,
        authors: hexPubkeys,
        since: Math.floor(Date.now() / 1000) // Subscribe to new events from now
      };
      
      // Create subscription
      const sub = ndk.subscribe(filter);
      
      // Process incoming events
      sub.on('event', (event: any) => {
        if (isMounted.current) {
          processEvent(event);
        }
      });
      
      // Store subscription reference
      subscriptionRef.current = sub;
    } catch (err) {
      console.error('Error setting up Nostr subscription:', err);
      if (isMounted.current) {
        setError('Error setting up real-time subscription');
      }
    }
  }, [ndk, ndkReady, pubkeys, kinds, normalizePubkeys, processEvent]);
  
  // Unsubscribe from real-time updates
  const unsubscribe = useCallback(() => {
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      } catch (e) {
        console.error('Error unsubscribing from Nostr events:', e);
      }
    }
  }, []);
  
  // Refresh data manually
  const refresh = useCallback(async () => {
    // Unsubscribe first
    unsubscribe();
    
    // Clear existing data
    setProfiles(new Map());
    setContacts(new Map());
    setImageNotes([]);
    
    // Fetch fresh data
    await fetchInitialData();
    
    // Re-subscribe if needed
    if (autoSubscribe) {
      subscribe();
    }
  }, [fetchInitialData, unsubscribe, subscribe, autoSubscribe]);
  
  // Initial setup and cleanup
  useEffect(() => {
    if (ndkReady && pubkeys.length > 0) {
      // Fetch initial data
      fetchInitialData();
      
      // Set up subscription if autoSubscribe is true
      if (autoSubscribe) {
        subscribe();
      }
    }
    
    // Cleanup on unmount
    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [ndkReady, pubkeys, fetchInitialData, subscribe, unsubscribe, autoSubscribe]);
  
  // Resubscribe when pubkeys or kinds change
  useEffect(() => {
    if (ndkReady && pubkeys.length > 0 && isMounted.current) {
      // Check if pubkeys have changed
      const currentPubkeys = pubkeysRef.current;
      const newPubkeys = normalizePubkeys(pubkeys);
      
      // If the pubkeys have changed, refresh subscription
      if (JSON.stringify(currentPubkeys) !== JSON.stringify(newPubkeys)) {
        unsubscribe();
        
        if (autoSubscribe) {
          subscribe();
        }
      }
    }
  }, [pubkeys, kinds, ndkReady, subscribe, unsubscribe, autoSubscribe, normalizePubkeys]);
  
  return {
    profiles,
    contacts,
    imageNotes,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe
  };
}

export default useLiteNostrEvents; 