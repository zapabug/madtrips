bin bashe# Complete Nostr Social Graph Implementation

## 1. Data Types and Interfaces

```typescript
// types/nostr-types.ts
export interface NostrProfile {
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// types/graph-types.ts
export interface GraphNode {
  id: string;
  pubkey: string;
  npub: string;
  name: string;
  picture?: string;
  isCoreNode: boolean;
  isSecondDegree?: boolean;
  val?: number;
  color?: string;
}

export interface GraphLink {
  id?: string;
  source: string;
  target: string;
  type: 'follows' | 'mutual';
  value: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lastUpdated: number;
}
```

## 2. Constants and Configuration

```typescript
// constants/config.ts
export const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine'
];

export const DEFAULT_PROFILE_IMAGE = '/assets/default-avatar.png';
export const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
export const MAX_CONNECTIONS = 25;
export const MAX_SECOND_DEGREE_NODES = 50;

// constants/brandColors.ts
export const BRAND_COLORS = {
  bitcoinOrange: '#F7931A',
  lightSand: '#F5F5DC',
  darkGray: '#333333',
  lightGray: '#E5E5E5',
  success: '#28A745',
  error: '#DC3545'
} as const;
```

## 3. Core Services

```typescript
// services/NostrService.ts
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { NostrProfile, NostrEvent } from '../types/nostr-types';
import { RELAY_URLS } from '../constants/config';

export class NostrService {
  private static instance: NostrService;
  private ndk: NDK | null = null;
  private profileSubscriptions: Map<string, () => void> = new Map();
  
  private constructor() {}
  
  static getInstance(): NostrService {
    if (!NostrService.instance) {
      NostrService.instance = new NostrService();
    }
    return NostrService.instance;
  }
  
  async initialize(): Promise<void> {
    try {
      this.ndk = new NDK({
        explicitRelayUrls: RELAY_URLS,
        enableOutboxModel: false
      });
      
      await this.ndk.connect();
    } catch (error) {
      console.error('Failed to initialize NDK:', error);
      throw error;
    }
  }
  
  async getProfile(npub: string): Promise<NostrProfile | null> {
    if (!this.ndk) throw new Error('NDK not initialized');
    
    try {
      const filter: NDKFilter = {
        kinds: [0],
        authors: [npub],
        limit: 1
      };
      
      const events = await this.ndk.fetchEvents([filter], { closeOnEose: true });
      const event = Array.from(events)[0];
      
      if (!event) return null;
      
      return JSON.parse(event.content);
    } catch (error) {
      console.error(`Error fetching profile for ${npub}:`, error);
      return null;
    }
  }
  
  async getContacts(pubkey: string): Promise<string[]> {
    if (!this.ndk) throw new Error('NDK not initialized');
    
    try {
      const filter: NDKFilter = {
        kinds: [3],
        authors: [pubkey],
        limit: 1
      };
      
      const events = await this.ndk.fetchEvents([filter], { closeOnEose: true });
      const event = Array.from(events)[0];
      
      if (!event || !event.tags) return [];
      
      return event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
    } catch (error) {
      console.error(`Error fetching contacts for ${pubkey}:`, error);
      return [];
    }
  }
  
  subscribeToProfile(npub: string, callback: (profile: NostrProfile) => void): () => void {
    if (!this.ndk) throw new Error('NDK not initialized');
    
    const filter: NDKFilter = {
      kinds: [0],
      authors: [npub]
    };
    
    const sub = this.ndk.subscribe([filter], {
      closeOnEose: false,
      onevent: async (event) => {
        try {
          const profile = JSON.parse(event.content);
          callback(profile);
        } catch (error) {
          console.error('Error parsing profile:', error);
        }
      }
    });
    
    const unsubscribe = () => {
      sub.stop();
      this.profileSubscriptions.delete(npub);
    };
    
    this.profileSubscriptions.set(npub, unsubscribe);
    return unsubscribe;
  }
  
  cleanup(): void {
    this.profileSubscriptions.forEach(unsubscribe => unsubscribe());
    this.profileSubscriptions.clear();
  }
}

// services/CacheService.ts
export class CacheService {
  private static instance: CacheService;
  private storage: Map<string, { data: any; timestamp: number }> = new Map();
  
  private constructor() {}
  
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  set(key: string, data: any, duration: number = CACHE_DURATION): void {
    this.storage.set(key, {
      data,
      timestamp: Date.now() + duration
    });
  }
  
  get<T>(key: string): T | null {
    const item = this.storage.get(key);
    if (!item) return null;
    
    if (Date.now() > item.timestamp) {
      this.storage.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  clear(): void {
    this.storage.clear();
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.storage.entries()) {
      if (now > item.timestamp) {
        this.storage.delete(key);
      }
    }
  }
}
```

## 4. Custom Hooks

```typescript
// hooks/useNostr.ts
import { useState, useEffect, useCallback } from 'react';
import { NostrService } from '../services/NostrService';
import { NostrProfile } from '../types/nostr-types';
import { CacheService } from '../services/CacheService';

export const useNostr = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const nostrService = NostrService.getInstance();
  const cacheService = CacheService.getInstance();
  
  useEffect(() => {
    const initializeNostr = async () => {
      try {
        await nostrService.initialize();
        setIsReady(true);
      } catch (err) {
        setError('Failed to initialize Nostr');
        console.error(err);
      }
    };
    
    initializeNostr();
  }, []);
  
  const getProfile = useCallback(async (npub: string): Promise<NostrProfile | null> => {
    const cacheKey = `profile:${npub}`;
    const cached = cacheService.get<NostrProfile>(cacheKey);
    if (cached) return cached;
    
    const profile = await nostrService.getProfile(npub);
    if (profile) {
      cacheService.set(cacheKey, profile);
    }
    return profile;
  }, []);
  
  const subscribeToProfile = useCallback((
    npub: string,
    callback: (profile: NostrProfile) => void
  ): () => void => {
    return nostrService.subscribeToProfile(npub, callback);
  }, []);
  
  return {
    isReady,
    error,
    getProfile,
    subscribeToProfile
  };
};

// hooks/useCache.ts
import { useCallback } from 'react';
import { CacheService } from '../services/CacheService';
import { CACHE_DURATION } from '../constants/config';

export const useCache = () => {
  const cacheService = CacheService.getInstance();
  
  const get = useCallback(<T>(key: string): T | null => {
    return cacheService.get<T>(key);
  }, []);
  
  const set = useCallback((key: string, data: any, duration?: number) => {
    cacheService.set(key, data, duration || CACHE_DURATION);
  }, []);
  
  const clear = useCallback(() => {
    cacheService.clear();
  }, []);
  
  return { get, set, clear };
};
```

## 5. Components

```typescript
// components/ProfileHeader.tsx
import React, { useEffect, useState } from 'react';
import { useNostr } from '../hooks/useNostr';
import { NostrProfile } from '../types/nostr-types';
import { DEFAULT_PROFILE_IMAGE } from '../constants/config';

interface ProfileHeaderProps {
  npub: string;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ npub }) => {
  const { getProfile, subscribeToProfile } = useNostr();
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const loadProfile = async () => {
      try {
        const initialProfile = await getProfile(npub);
        if (initialProfile) {
          setProfile(initialProfile);
        }
        
        // Subscribe to real-time updates
        unsubscribe = subscribeToProfile(npub, (updatedProfile) => {
          setProfile(updatedProfile);
        });
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [npub, getProfile, subscribeToProfile]);
  
  if (loading) {
    return <div>Loading profile...</div>;
  }
  
  return (
    <div className="profile-header">
      <img 
        src={profile?.picture || DEFAULT_PROFILE_IMAGE}
        alt={profile?.name || 'Profile'}
        className="profile-avatar"
      />
      <div className="profile-info">
        <h1>{profile?.displayName || profile?.name || 'Anonymous'}</h1>
        {profile?.about && <p>{profile.about}</p>}
        {profile?.nip05 && <p className="nip05">{profile.nip05}</p>}
      </div>
    </div>
  );
};

// styles/ProfileHeader.css
.profile-header {
  display: flex;
  align-items: center;
  padding: 20px;
  background: var(--bg-surface);
  border-radius: 12px;
  margin-bottom: 20px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-right: 20px;
  object-fit: cover;
}

.profile-info {
  flex: 1;
}

.profile-info h1 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: var(--text-primary);
}

.profile-info p {
  margin: 5px 0;
  color: var(--text-secondary);
}

.nip05 {
  font-size: 14px;
  color: var(--text-accent);
}
```

## 6. Utilities

```typescript
// utils/nostrUtils.ts
import { nip19 } from 'nostr-tools';

export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
};

export const npubToHex = (npub: string): string => {
  try {
    const { data } = nip19.decode(npub);
    return data as string;
  } catch (error) {
    console.error('Invalid npub:', error);
    return '';
  }
};

export const hexToNpub = (hex: string): string => {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    console.error('Invalid hex:', error);
    return '';
  }
};

// utils/errorUtils.ts
export const handleError = (error: unknown, context: string): string => {
  console.error(`Error in ${context}:`, error);
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};
```

## 7. Setup Instructions

1. Install dependencies:
```bash
npm install @nostr-dev-kit/ndk nostr-tools react-force-graph-2d
```

2. Create directory structure:
```
src/
  components/
  hooks/
  services/
  types/
  utils/
  constants/
  styles/
```

3. Copy each snippet to its respective file

4. Add to your main app:
```typescript
// App.tsx
import { NostrService } from './services/NostrService';

// Initialize Nostr service
NostrService.getInstance().initialize().catch(console.error);
```

## 8. Usage Example

```typescript
// pages/Profile.tsx
import React from 'react';
import { ProfileHeader } from '../components/ProfileHeader';
import { SocialGraphVisualization } from '../components/SocialGraphVisualization';
import { useSocialGraph } from '../hooks/useSocialGraph';

interface ProfilePageProps {
  npub: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ npub }) => {
  const { graph, loading, error } = useSocialGraph({
    npubs: [npub],
    centerNpub: npub,
    maxConnections: 25,
    showSecondDegree: false
  });
  
  return (
    <div className="profile-page">
      <ProfileHeader npub={npub} />
      {loading && <div>Loading graph...</div>}
      {error && <div className="error">{error}</div>}
      {graph && (
        <SocialGraphVisualization
          data={graph}
          width={800}
          height={600}
        />
      )}
    </div>
  );
};
```

Would you like me to provide more details about any specific part or help you get started with implementation? 