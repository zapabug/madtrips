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

interface UseLiteNostrDataOptions {
  npubs?: string[];
  fetchProfiles?: boolean;
  fetchContacts?: boolean;
  fetchImageNotes?: boolean;
  limit?: number;
  skipCache?: boolean;
}

interface UseLiteNostrDataResult {
  profiles: Map<string, LiteProfile>;
  contacts: Map<string, ContactList>;
  imageNotes: ImageNote[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching lightweight Nostr data in real-time
 * Focuses only on essential data needed for the app
 */
export function useLiteNostrData({
  npubs = [],
  fetchProfiles = true,
  fetchContacts = false,
  fetchImageNotes = false,
  limit = 30,
  skipCache = false,
}: UseLiteNostrDataOptions = {}): UseLiteNostrDataResult {
  const { ndk, ndkReady, getEvents } = useNostr();
  
  // State for data and loading status
  const [profiles, setProfiles] = useState<Map<string, LiteProfile>>(new Map());
  const [contacts, setContacts] = useState<Map<string, ContactList>>(new Map());
  const [imageNotes, setImageNotes] = useState<ImageNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for tracking fetch state
  const isMounted = useRef(true);
  const fetchingRef = useRef(false);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to fetch all required data
  const fetchData = useCallback(async () => {
    if (fetchingRef.current || !ndkReady || !npubs.length) return;
    
    fetchingRef.current = true;
    
    if (isMounted.current) {
      setLoading(true);
      setError(null);
    }
    
    try {
      // Prepare filter for kind:0 (profiles)
      if (fetchProfiles) {
        const profileFilter = {
          kinds: [0],
          authors: npubs.map(npub => {
            try {
              // Convert npub to hex if ndk is available
              if (ndk) {
                const user = ndk.getUser({ npub });
                return user.pubkey;
              }
              return npub;
            } catch (e) {
              return npub;
            }
          })
        };
        
        // Fetch profile events
        const profileEvents = await getEvents(profileFilter, { forceFresh: skipCache });
        
        if (profileEvents && isMounted.current) {
          const profilesMap = new Map<string, LiteProfile>();
          
          profileEvents.forEach(event => {
            try {
              // Convert pubkey to npub
              let userNpub = '';
              if (ndk) {
                const user = ndk.getUser({ pubkey: event.pubkey });
                userNpub = user.npub;
              }
              
              const profile = processLiteProfile(event, userNpub);
              if (profile) {
                profilesMap.set(profile.npub, profile);
              }
            } catch (e) {
              console.error('Error processing profile:', e);
            }
          });
          
          setProfiles(profilesMap);
        }
      }
      
      // Fetch contact lists (kind:3)
      if (fetchContacts) {
        const contactFilter = {
          kinds: [3],
          authors: npubs.map(npub => {
            try {
              if (ndk) {
                const user = ndk.getUser({ npub });
                return user.pubkey;
              }
              return npub;
            } catch (e) {
              return npub;
            }
          })
        };
        
        const contactEvents = await getEvents(contactFilter, { forceFresh: skipCache });
        
        if (contactEvents && isMounted.current) {
          const contactsMap = new Map<string, ContactList>();
          
          contactEvents.forEach(event => {
            try {
              const contactList = processContactList(event);
              if (contactList) {
                contactsMap.set(contactList.pubkey, contactList);
              }
            } catch (e) {
              console.error('Error processing contact list:', e);
            }
          });
          
          setContacts(contactsMap);
        }
      }
      
      // Fetch image notes (kind:1)
      if (fetchImageNotes) {
        const noteFilter = {
          kinds: [1],
          authors: npubs.map(npub => {
            try {
              if (ndk) {
                const user = ndk.getUser({ npub });
                return user.pubkey;
              }
              return npub;
            } catch (e) {
              return npub;
            }
          }),
          limit
        };
        
        const noteEvents = await getEvents(noteFilter, { forceFresh: skipCache });
        
        if (noteEvents && isMounted.current) {
          const notes: ImageNote[] = [];
          
          noteEvents.forEach(event => {
            try {
              const note = processImageNote(event);
              if (note) {
                notes.push(note);
              }
            } catch (e) {
              console.error('Error processing image note:', e);
            }
          });
          
          // Sort notes by created_at (newest first)
          notes.sort((a, b) => b.created_at - a.created_at);
          
          setImageNotes(notes);
        }
      }
      
    } catch (err) {
      console.error('Error fetching Nostr data:', err);
      if (isMounted.current) {
        setError('Error fetching data from Nostr network');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, [npubs, fetchProfiles, fetchContacts, fetchImageNotes, limit, skipCache, ndk, ndkReady, getEvents]);
  
  // Fetch data when dependencies change
  useEffect(() => {
    if (ndkReady && npubs.length > 0) {
      fetchData();
    }
  }, [ndkReady, npubs, fetchData]);
  
  // Function to manually refresh data
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);
  
  return {
    profiles,
    contacts,
    imageNotes,
    loading,
    error,
    refresh
  };
}

export default useLiteNostrData; 