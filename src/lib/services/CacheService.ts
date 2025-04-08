/**
 * CacheService - Centralized caching system for MadTrips
 * 
 * This service provides caching capabilities for different types of data across the application:
 * - User profiles
 * - Social graph data
 * - Images
 * - Nostr posts
 * 
 * Each cache type has its own TTL (time-to-live) and size limits to optimize performance.
 */

export type CacheItem<T> = {
  data: T;
  timestamp: number;
};

export type CacheOptions = {
  ttl: number;  // Time-to-live in milliseconds
  maxSize: number;  // Maximum number of items in cache
};

export class GenericCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private options: CacheOptions;
  
  constructor(options: CacheOptions) {
    this.options = options;
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if item is expired
    if (Date.now() - item.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key: string, data: T): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.options.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 20% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.2));
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check if item is expired
    if (Date.now() - item.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Delete a specific key from the cache
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  prune(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.options.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  getAge(key: string): number | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Return age in milliseconds
    return Date.now() - item.timestamp;
  }
  
  size(): number {
    return this.cache.size;
  }
  
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Define our specific cache types
export interface UserProfile {
  name?: string;
  displayName?: string;
  website?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string; // Lightning address
  lud06?: string; // LNURL
}

export interface NostrPost {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
}

export interface GraphData {
  nodes: any[];
  links: any[];
  lastUpdated?: number;
}

// Create singleton instances of each cache type with appropriate TTLs
const PROFILE_CACHE_OPTIONS: CacheOptions = {
  ttl: 15 * 60 * 1000, // 15 minutes
  maxSize: 300 // Increased to accommodate larger social graphs
};

const POST_CACHE_OPTIONS: CacheOptions = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 2000 // Significantly increased for global event cache
};

const GRAPH_CACHE_OPTIONS: CacheOptions = {
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 10
};

const IMAGE_CACHE_OPTIONS: CacheOptions = {
  ttl: 30 * 60 * 1000, // 30 minutes
  maxSize: 150
};

// Add a new global event cache for raw NDK events
const EVENT_CACHE_OPTIONS: CacheOptions = {
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 1500 // Large enough for WoT networks
};

// Singleton instance pattern
export class CacheService {
  private static instance: CacheService;
  
  readonly profileCache: GenericCache<UserProfile>;
  readonly postCache: GenericCache<NostrPost[]>;
  readonly graphCache: GenericCache<GraphData>;
  readonly imageCache: GenericCache<HTMLImageElement>;
  readonly eventCache: GenericCache<any[]>; // For raw NDK events
  
  private constructor() {
    this.profileCache = new GenericCache<UserProfile>(PROFILE_CACHE_OPTIONS);
    this.postCache = new GenericCache<NostrPost[]>(POST_CACHE_OPTIONS);
    this.graphCache = new GenericCache<GraphData>(GRAPH_CACHE_OPTIONS);
    this.imageCache = new GenericCache<HTMLImageElement>(IMAGE_CACHE_OPTIONS);
    this.eventCache = new GenericCache<any[]>(EVENT_CACHE_OPTIONS);
  }
  
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  // Helper to preload and cache images
  async preloadImage(url: string, defaultImage: string): Promise<HTMLImageElement> {
    if (!url || url === defaultImage) {
      const img = new Image();
      img.src = defaultImage;
      return img;
    }
    
    // Check cache first
    const cachedImage = this.imageCache.get(url);
    if (cachedImage) {
      return cachedImage;
    }
    
    // Load the image
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Handle CORS
      
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      
      img.onerror = () => {
        console.warn(`Failed to load image: ${url}`);
        // Use default image on error
        const defaultImg = new Image();
        defaultImg.src = defaultImage;
        resolve(defaultImg);
      };
      
      // Set timeout for loading
      setTimeout(() => {
        if (!img.complete) {
          const defaultImg = new Image();
          defaultImg.src = defaultImage;
          resolve(defaultImg);
        }
      }, 5000);
      
      img.src = url;
    });
  }
  
  // Method to clear all caches
  clearAll(): void {
    this.profileCache.clear();
    this.postCache.clear();
    this.graphCache.clear();
    this.imageCache.clear();
    this.eventCache.clear(); // Clear event cache too
    console.log('All caches cleared');
  }
  
  // Method to prune all caches
  pruneAll(): void {
    this.profileCache.prune();
    this.postCache.prune();
    this.graphCache.prune();
    this.imageCache.prune();
    this.eventCache.prune(); // Prune event cache
  }
  
  // Generate a cache key for post queries
  generatePostCacheKey(npubs: string[], limit: number, hashtags?: string[]): string {
    const npubsKey = npubs.sort().join('-').substring(0, 30);
    const hashtagsKey = hashtags ? hashtags.sort().join('-') : '';
    return `posts-${npubsKey}-${limit}-${hashtagsKey}`;
  }
  
  // Generate a cache key for graph queries
  generateGraphCacheKey(npubs: string[], showExtended: boolean): string {
    const npubsKey = npubs.sort().join('-').substring(0, 30);
    return `graph-${npubsKey}-${showExtended ? 'extended' : 'basic'}`;
  }

  // Add event cache methods
  getCachedEvents(key: string): any[] | null {
    return this.eventCache.get(key);
  }

  setCachedEvents(key: string, events: any[]): void {
    this.eventCache.set(key, events);
  }

  // Get the age of a cached events entry in milliseconds
  getCacheAge(key: string): number | null {
    return this.eventCache.getAge(key);
  }
  
  /**
   * Create a cache key for event data
   * @param kinds Event kinds to filter
   * @param npubs NPubs to filter by
   * @param hashtags Hashtags to filter by
   */
  generateEventCacheKey(kinds: number[], npubs: string[] = [], hashtags: string[] = []): string {
    return `events:kinds=${kinds.join(',')}:npubs=${npubs.sort().join(',')}:tags=${hashtags.sort().join(',')}`;
  }
}

// Export a default instance
export default CacheService.getInstance(); 