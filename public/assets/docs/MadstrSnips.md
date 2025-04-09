# Nostr Data Caching and Information Gathering System - LLM Recreation Guide

This document contains prompts and code snippets for recreating the advanced caching and information gathering system powering the Bitcoin Madeira community page.

## Complete Hook Generation Prompt

```
Create a sophisticated React hooks system for fetching, caching, and processing Nostr data for a Bitcoin community app.

Requirements:
- Use TypeScript with React
- Implement a layered caching architecture with memory and localStorage fallbacks
- Create specialized hooks for different data types (profiles, notes, events, social graph)
- Optimize for performance with efficient data structures
- Implement intelligent batching and deduplication
- Handle connection state management gracefully
- Add TTL (time-to-live) for cached data
- Create hooks that depend on each other but don't cause circular dependencies
- Support both realtime subscription and one-time fetch patterns
- Add proper error handling and retry mechanisms

The system should include these core hooks:

1. useNostrConnection - Base connection management
   - Handles relay connections, reconnection logic
   - Manages connection state and health
   - Provides connection metrics

2. useCachedProfiles - Profile data caching
   - Fetches and caches Nostr profile data
   - Efficiently handles large numbers of profiles
   - Updates cached data when newer information is found
   - Exports a Map<string, ProfileData> interface

3. useNostrFeed - General purpose feed fetching
   - Filters by authors, hashtags, and content
   - Handles pagination and limits
   - Implements NSFW content filtering
   - Supports chronological and relevance sorting

4. useImageFeed - Specialized for image-heavy content
   - Extends useNostrFeed with image-focused features
   - Extracts and validates image URLs
   - Pre-processes images for optimal display
   - Handles carousel-optimized data structures

5. useSocialGraph - Network relationships
   - Builds network graphs of follows/followers
   - Calculates centrality and influence metrics
   - Identifies clusters and communities
   - Supports visualization-ready data structures

Include mechanisms for:
- Batched fetching to reduce network overhead
- Intelligent cache invalidation
- Web-of-trust filtering for relevance
- Garbage collection for memory efficiency
```

## Profile Caching System

### Core Interfaces

```typescript
// Profile data structure
interface ProfileData {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  created_at?: number;
  updated_at?: number;
  followers?: number;
  following?: number;
}

// Cache interface
interface ProfileCache {
  profiles: Map<string, ProfileData>;
  meta: {
    lastFetched: number;
    size: number;
    version: string;
  };
}

// Hook return type
interface UseCachedProfilesResult {
  profiles: Map<string, ProfileData>;
  loading: boolean;
  error: string | null;
  refresh: (npubs?: string[]) => Promise<void>;
  getProfile: (npub: string) => ProfileData | undefined;
  isLoading: (npub: string) => boolean;
}
```

### Batch Processing Logic

```typescript
// Smart batching to avoid overloading relays
const processBatchedProfiles = async (
  npubsToFetch: string[],
  batchSize: number = 10,
  maxConcurrent: number = 3
): Promise<Map<string, ProfileData>> => {
  const results = new Map<string, ProfileData>();
  const batches: string[][] = [];
  
  // Create batches of npubs
  for (let i = 0; i < npubsToFetch.length; i += batchSize) {
    batches.push(npubsToFetch.slice(i, i + batchSize));
  }
  
  // Process batches with limited concurrency
  const concurrentBatches = async (batchIndex: number = 0): Promise<void> => {
    if (batchIndex >= batches.length) return;
    
    const batch = batches[batchIndex];
    const batchPromises = batch.map(npub => fetchProfileFromNostr(npub));
    
    try {
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((profile, i) => {
        if (profile) {
          results.set(batch[i], profile);
        }
      });
    } catch (error) {
      console.error(`Error processing batch ${batchIndex}:`, error);
    }
    
    // Process next batch
    await concurrentBatches(batchIndex + 1);
  };
  
  // Start concurrent batch processing
  const concurrentPromises = Array.from(
    { length: Math.min(maxConcurrent, batches.length) },
    (_, i) => concurrentBatches(i)
  );
  
  await Promise.all(concurrentPromises);
  return results;
};
```

### Cache Management

```typescript
// Two-layer caching system
const saveProfilesToCache = (profiles: Map<string, ProfileData>): void => {
  try {
    // Memory cache
    memoryCache.profiles = new Map([...memoryCache.profiles, ...profiles]);
    memoryCache.meta.lastFetched = Date.now();
    memoryCache.meta.size = memoryCache.profiles.size;
    
    // LocalStorage cache (with size limits)
    const profilesArray = Array.from(profiles.entries());
    if (profilesArray.length > MAX_LOCALSTORAGE_PROFILES) {
      // Only save most recent/relevant profiles to localStorage
      profilesArray.sort((a, b) => (b[1].updated_at || 0) - (a[1].updated_at || 0));
      const truncatedProfiles = new Map(profilesArray.slice(0, MAX_LOCALSTORAGE_PROFILES));
      
      const serializedCache = JSON.stringify({
        profilesArray: Array.from(truncatedProfiles.entries()),
        meta: {
          lastFetched: Date.now(),
          size: truncatedProfiles.size,
          version: CACHE_VERSION
        }
      });
      
      localStorage.setItem(PROFILES_CACHE_KEY, serializedCache);
    }
  } catch (error) {
    console.error('Failed to save profiles to cache:', error);
  }
};

// Cache invalidation with TTL
const isProfileCacheValid = (cache: ProfileCache): boolean => {
  const now = Date.now();
  const maxAge = PROFILE_CACHE_TTL_MS;
  return (
    cache &&
    cache.meta &&
    cache.meta.lastFetched &&
    (now - cache.meta.lastFetched) < maxAge &&
    cache.meta.version === CACHE_VERSION
  );
};
```

### Memory Optimization

```typescript
// Garbage collection for memory efficiency
const optimizeMemoryCache = () => {
  // If memory cache exceeds limits, trim it
  if (memoryCache.profiles.size > MAX_MEMORY_PROFILES) {
    console.log(`Optimizing memory cache: ${memoryCache.profiles.size} -> ${MAX_MEMORY_PROFILES}`);
    
    // Convert to array for sorting
    const profilesArray = Array.from(memoryCache.profiles.entries());
    
    // Sort by recency and usage count
    profilesArray.sort((a, b) => {
      const aScore = (a[1].updated_at || 0) + (profileAccessCounts.get(a[0]) || 0) * 10000;
      const bScore = (b[1].updated_at || 0) + (profileAccessCounts.get(b[0]) || 0) * 10000;
      return bScore - aScore;
    });
    
    // Keep only the most valuable profiles
    memoryCache.profiles = new Map(profilesArray.slice(0, MAX_MEMORY_PROFILES));
    memoryCache.meta.size = memoryCache.profiles.size;
    
    // Reset access counts for retained profiles
    profileAccessCounts = new Map(
      Array.from(memoryCache.profiles.keys()).map(key => [key, 0])
    );
  }
};
```

## Feed Data System

### Filtering Logic

```typescript
// Smart feed filtering with content analysis
const filterNotes = (notes: Note[], options: {
  requiredHashtags?: string[],
  excludedKeywords?: string[],
  onlyWithImages?: boolean,
  minRelevanceScore?: number
}): Note[] => {
  return notes.filter(note => {
    // If hashtags specified, note must have at least one
    if (options.requiredHashtags && options.requiredHashtags.length > 0) {
      const hasRequiredTag = options.requiredHashtags.some(tag => 
        note.hashtags.includes(tag.toLowerCase()) ||
        note.content.toLowerCase().includes(`#${tag.toLowerCase()}`)
      );
      if (!hasRequiredTag) return false;
    }
    
    // Filter out content with excluded keywords
    if (options.excludedKeywords && options.excludedKeywords.length > 0) {
      const hasExcludedKeyword = options.excludedKeywords.some(keyword => 
        note.content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasExcludedKeyword) return false;
    }
    
    // Filter by images if requested
    if (options.onlyWithImages && (!note.images || note.images.length === 0)) {
      return false;
    }
    
    // Check relevance score (based on likes, reposts, etc.)
    if (options.minRelevanceScore && calculateRelevanceScore(note) < options.minRelevanceScore) {
      return false;
    }
    
    return true;
  });
};
```

### Feed Deduplication

```typescript
// Remove duplicate notes with intelligent merging
const deduplicateNotes = (notes: Note[]): Note[] => {
  const uniqueNotes = new Map<string, Note>();
  
  notes.forEach(note => {
    const existingNote = uniqueNotes.get(note.id);
    
    if (!existingNote) {
      // Note doesn't exist yet, add it
      uniqueNotes.set(note.id, note);
    } else {
      // Merge with existing note, keeping the most complete version
      uniqueNotes.set(note.id, mergeNotes(existingNote, note));
    }
  });
  
  return Array.from(uniqueNotes.values());
};

// Smart note merging to create the most complete version
const mergeNotes = (noteA: Note, noteB: Note): Note => {
  // Prefer the note with more complete data
  return {
    ...noteA,
    // Use the more complete author info
    author: {
      ...noteA.author,
      ...noteB.author,
    },
    // Combine and deduplicate images
    images: Array.from(new Set([
      ...(noteA.images || []),
      ...(noteB.images || [])
    ])),
    // Take the more complete content
    content: noteB.content.length > noteA.content.length ? 
      noteB.content : noteA.content,
    // Merge and deduplicate hashtags
    hashtags: Array.from(new Set([
      ...(noteA.hashtags || []),
      ...(noteB.hashtags || [])
    ])),
    // Take the most recent creation date
    created_at: Math.max(noteA.created_at, noteB.created_at)
  };
};
```

### Image Extraction Logic

```typescript
// Extract image URLs from note content
const extractImages = (note: NostrEvent): string[] => {
  const images: string[] = [];
  
  // Direct image URLs in content
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  const contentUrls = note.content.match(urlRegex) || [];
  images.push(...contentUrls);
  
  // Images in tags
  const imageTags = note.tags.filter(tag => 
    tag[0] === 'image' || 
    tag[0] === 'picture' || 
    (tag[0] === 'media' && isImageUrl(tag[1]))
  );
  
  images.push(...imageTags.map(tag => tag[1]));
  
  // Validate and deduplicate
  return Array.from(new Set(
    images.filter(url => isValidImageUrl(url))
  ));
};

// Validate image URLs
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp)$/.test(path) && 
           (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:');
  } catch (e) {
    return false;
  }
};
```

## Social Graph System

### Graph Construction

```typescript
// Build a social graph from follow events
const buildSocialGraph = (events: NostrEvent[]): GraphData => {
  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();
  
  // Process follow events
  events.forEach(event => {
    if (event.kind !== 3) return; // Only process contact lists
    
    const sourcePubkey = event.pubkey;
    if (!nodes.has(sourcePubkey)) {
      nodes.set(sourcePubkey, {
        id: sourcePubkey,
        pubkey: sourcePubkey,
        npub: pubkeyToNpub(sourcePubkey),
        following: 0,
        followers: 0
      });
    }
    
    // Process p tags (followed pubkeys)
    event.tags
      .filter(tag => tag[0] === 'p')
      .forEach(tag => {
        const targetPubkey = tag[1];
        
        // Add target node if not exists
        if (!nodes.has(targetPubkey)) {
          nodes.set(targetPubkey, {
            id: targetPubkey,
            pubkey: targetPubkey,
            npub: pubkeyToNpub(targetPubkey),
            following: 0,
            followers: 0
          });
        }
        
        // Update follower/following counts
        nodes.get(sourcePubkey)!.following = (nodes.get(sourcePubkey)!.following || 0) + 1;
        nodes.get(targetPubkey)!.followers = (nodes.get(targetPubkey)!.followers || 0) + 1;
        
        // Create or update link
        const linkId = `${sourcePubkey}-${targetPubkey}`;
        links.set(linkId, {
          id: linkId,
          source: sourcePubkey,
          target: targetPubkey,
          type: 'follows',
          value: 1
        });
      });
  });
  
  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values())
  };
};
```

### Graph Metrics Calculation

```typescript
// Calculate network metrics for social graph
const calculateGraphMetrics = (graph: GraphData): GraphData => {
  const { nodes, links } = graph;
  
  // Create lookup map for faster operations
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  
  // Create adjacency map for centrality calculation
  const adjacencyMap = new Map<string, Set<string>>();
  nodes.forEach(node => adjacencyMap.set(node.id, new Set()));
  
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    adjacencyMap.get(sourceId)?.add(targetId);
  });
  
  // Calculate degree centrality (normalized)
  const maxPossibleConnections = nodes.length - 1;
  nodes.forEach(node => {
    const outDegree = adjacencyMap.get(node.id)?.size || 0;
    const inDegree = links.filter(link => {
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return targetId === node.id;
    }).length;
    
    node.outDegreeCentrality = maxPossibleConnections > 0 ? outDegree / maxPossibleConnections : 0;
    node.inDegreeCentrality = maxPossibleConnections > 0 ? inDegree / maxPossibleConnections : 0;
    
    // Use centrality for node sizing
    node.val = 5 + Math.sqrt(inDegree) * 3;
  });
  
  // Identify core nodes (high centrality)
  const centralityThreshold = calculateCentralityThreshold(nodes);
  nodes.forEach(node => {
    node.isCoreNode = (node.inDegreeCentrality || 0) > centralityThreshold;
  });
  
  // Identify mutual connections
  const mutualLinks = findMutualConnections(links);
  mutualLinks.forEach(link => {
    link.type = 'mutual';
    link.value = 2; // Make mutual connections stronger
  });
  
  return { nodes, links };
};
```

### Community Detection Algorithm

```typescript
// Detect communities in the graph using a basic clustering algorithm
const detectCommunities = (graph: GraphData): GraphData => {
  const { nodes, links } = graph;
  
  // Create an adjacency matrix for community detection
  const nodeIds = nodes.map(node => node.id);
  const nodeIdToIndex = new Map(nodeIds.map((id, index) => [id, index]));
  
  // Initialize adjacency matrix
  const n = nodes.length;
  const adjacency = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Fill adjacency matrix
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    const sourceIndex = nodeIdToIndex.get(sourceId);
    const targetIndex = nodeIdToIndex.get(targetId);
    
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      adjacency[sourceIndex][targetIndex] = 1;
    }
  });
  
  // Run a simple clustering algorithm (this is a basic implementation)
  // In production, you'd use a more sophisticated algorithm like Louvain
  const communities = basicCommunityDetection(adjacency, n);
  
  // Assign community IDs to nodes
  communities.forEach((communityId, i) => {
    const nodeId = nodeIds[i];
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      node.group = communityId;
    }
  });
  
  return { nodes, links };
};

// Simple community detection using edge betweenness
// (In production, use a library implementation for better results)
const basicCommunityDetection = (adjacency: number[][], n: number): number[] => {
  // Initialize each node to its own community
  const communities = Array(n).fill(0).map((_, i) => i);
  
  // Merge communities based on connections
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacency[i][j] === 1 || adjacency[j][i] === 1) {
        // If there's a connection, merge communities
        const targetCommunity = Math.min(communities[i], communities[j]);
        const sourceCommunity = Math.max(communities[i], communities[j]);
        
        // Update all nodes in the source community to target
        for (let k = 0; k < n; k++) {
          if (communities[k] === sourceCommunity) {
            communities[k] = targetCommunity;
          }
        }
      }
    }
  }
  
  // Normalize community IDs to be sequential
  const uniqueCommunities = Array.from(new Set(communities));
  const communityMap = new Map(uniqueCommunities.map((id, index) => [id, index]));
  
  return communities.map(id => communityMap.get(id) || 0);
};
```

## WebOfTrust Relevance Filtering

```typescript
// Calculate relevance score based on web of trust
const calculateRelevanceScore = (
  note: Note, 
  followingSet: Set<string>,
  coreMembers: Set<string>
): number => {
  let score = 1; // Base score
  
  // Author is directly followed
  if (followingSet.has(note.pubkey)) {
    score += 10;
  }
  
  // Author is a core community member
  if (coreMembers.has(note.pubkey)) {
    score += 15;
  }
  
  // Recency bonus (last 48 hours get bonus)
  const hoursAgo = (Date.now() - note.created_at * 1000) / (1000 * 60 * 60);
  if (hoursAgo < 48) {
    score += Math.max(0, 5 - (hoursAgo / 12)); // Gradually decreasing bonus
  }
  
  // Hashtag relevance (Bitcoin, Madeira, etc.)
  const relevantTags = ['bitcoin', 'madeira', 'btc', 'lightning'];
  const hasRelevantTag = note.hashtags.some(tag => 
    relevantTags.includes(tag.toLowerCase())
  );
  if (hasRelevantTag) {
    score += 5;
  }
  
  // Image presence bonus
  if (note.images && note.images.length > 0) {
    score += 3;
  }
  
  return score;
};

// Filter feed by web of trust and relevance
const filterByWebOfTrust = (
  notes: Note[], 
  options: {
    following: string[],
    coreMembers: string[],
    minRelevanceScore?: number
  }
): Note[] => {
  const followingSet = new Set(options.following);
  const coreMembersSet = new Set(options.coreMembers);
  const minScore = options.minRelevanceScore || 5;
  
  // Calculate relevance scores
  const scoredNotes = notes.map(note => ({
    note,
    score: calculateRelevanceScore(note, followingSet, coreMembersSet)
  }));
  
  // Filter by minimum score
  const filteredNotes = scoredNotes
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score) // Sort by descending score
    .map(item => item.note);
  
  return filteredNotes;
};
```

## Integration Example

```jsx
// Component using combined hooks
const CommunityPage = () => {
  // 1. Fetch social graph data
  const { 
    graphData,
    npubsInGraph, 
    loading: graphLoading, 
    error: graphError,
    refresh: refreshGraph 
  } = useNostrGraph({
    coreNpubs: CORE_NPUBS,
    followsLimit: 10,
    followersLimit: 10,
    showMutuals: true
  });
  
  // 2. Fetch profiles for graph members
  const {
    profiles
  } = useCachedProfiles(npubsInGraph, {
    minimalProfile: true,
    batchSize: 20
  });
  
  // 3. Get community feed from these profiles
  return (
    <div>
      <h1>Bitcoin Madeira Community</h1>
      
      {/* Visualization of community connections */}
      <SocialGraph 
        graphData={graphData}
        profiles={profiles}
        loading={graphLoading}
        error={graphError}
        onRefresh={refreshGraph}
      />
      
      {/* Image carousel of Madeira content */}
      <MadeiraFeed 
        profilesMap={profiles} 
        initialCount={30}
        maxCached={150}
      />
      
      {/* Community posts feed */}
      <CommunityFeed 
        npubs={npubsInGraph} 
        limit={30}
        hashtags={[]}
      />
    </div>
  );
};
```

## Performance Monitoring Utilities

```typescript
// Track and report hook performance
const trackHookPerformance = <T>(
  hookName: string,
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  
  return operation().then(result => {
    const duration = performance.now() - startTime;
    
    // Log performance metrics
    if (duration > 500) {
      console.warn(`⚠️ Slow hook: ${hookName} took ${Math.round(duration)}ms`);
    } else {
      console.debug(`✓ Hook: ${hookName} completed in ${Math.round(duration)}ms`);
    }
    
    // Track metrics for later analysis
    updatePerformanceMetrics(hookName, duration);
    
    return result;
  });
};

// Track memory usage
const trackMemoryUsage = () => {
  if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize } = window.performance.memory;
    const usedMB = Math.round(usedJSHeapSize / (1024 * 1024));
    const totalMB = Math.round(totalJSHeapSize / (1024 * 1024));
    const usagePercent = Math.round((usedMB / totalMB) * 100);
    
    console.debug(`Memory usage: ${usedMB}MB / ${totalMB}MB (${usagePercent}%)`);
    
    // Trigger garbage collection if approaching limits
    if (usagePercent > 80) {
      console.warn('High memory usage detected, optimizing caches...');
      optimizeAllCaches();
    }
  }
};
``` 