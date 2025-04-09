# Nostr Image Feeds with Filtering and Caching - LLM Recreation Guide

This document contains prompts and code snippets for recreating Nostr-based image feed components from scratch using an LLM.

## Complete Component Generation Prompt for CommunityFeed

```
Create a React component called CommunityFeed that displays a feed of Nostr posts, optimized for the Bitcoin Madeira community.

Requirements:
- Use TypeScript with React and Next.js
- Add the 'use client' directive for Next.js compatibility
- Implement a Nostr feed that can show posts from multiple users
- Support filtering by hashtags
- Show user profiles with images
- Display post content and attached images
- Handle loading, empty, and error states gracefully
- Include a refresh mechanism
- Support auto-scrolling (optional feature)
- Optimize for performance with memory-efficient data handling
- Filter out NSFW content automatically
- Support both light and dark modes with appropriate styling

The component should accept these props:
- npub?: string (Single Nostr pubkey to fetch from)
- npubs?: string[] (Multiple Nostr pubkeys to fetch from)
- limit?: number (Maximum number of posts to display, default: 25)
- hashtags?: string[] (Filter posts by these hashtags)
- autoScroll?: boolean (Whether to auto-scroll through posts)
- scrollInterval?: number (Milliseconds between auto-scrolls, default: 10000)
- useCorePubs?: boolean (Whether to include core community members, default: true)
- className?: string (Additional CSS classes)
- showLoadingAnimation?: boolean (Whether to show loading animation, default: true)
- showHeader?: boolean (Whether to show the header with controls, default: true)
- showHashtagFilter?: boolean (Whether to show hashtag filtering UI, default: true)
- hideEmpty?: boolean (Whether to hide the component when empty, default: false)
- maxHeight?: number (Optional maximum height for the container)

Connect to the useNostrFeed hook to fetch data with this interface:
- notes: Array of Note objects
- loading: boolean indicating if data is being loaded
- error: string | null containing any error message
- refresh: () => void function to refresh the data

Each Note should include:
- id: string (unique note ID)
- pubkey: string (author's public key)
- npub: string (normalized public key)
- content: string (post content)
- created_at: number (timestamp)
- hashtags: string[] (extracted hashtags)
- images: string[] (URLs of attached images)
- author: { name?: string, displayName?: string, picture?: string } (author profile info)
```

## Complete Component Generation Prompt for MadeiraFeed

```
Create a React component called MadeiraFeed that displays a carousel of images related to Madeira from Nostr posts.

Requirements:
- Use TypeScript with React and Next.js
- Add the 'use client' directive for Next.js compatibility
- Implement an image carousel/slideshow of Madeira-related content
- Auto-rotate through images with smooth transitions
- Allow manual navigation with previous/next buttons
- Show indicators for available images
- Display caption and author information on images
- Handle loading, empty, and error states
- Optimize image loading with proper caching
- Support both light and dark modes

The component should accept these props:
- profilesMap: Map<string, ProfileData> | Record<string, ProfileData> (Cached profiles for authors)
- className?: string (Additional CSS classes)
- initialCount?: number (Initial number of images to fetch, default: 30)
- maxCached?: number (Maximum number of items to cache, default: 150)

Each profile should include:
- displayName?: string (User's display name)
- name?: string (User's name)
- picture?: string (Profile picture URL)

Connect to the useImageFeed hook with the following interface:
- notes: Array of Note objects with images
- loading: boolean indicating if data is being loaded
- refresh: () => void function to refresh the data
- hasMore: boolean indicating if more data is available

Use a predefined list of Madeira-related hashtags for filtering:
- madeira, funchal, madeirisland, visitmadeira, madeiraisland
- bitcoinmadeira, bitcoinfunchal, btcmadeira, btcfunchal
- And other location-specific tags

Include the following functionality:
- Auto-scrolling through images every 5 seconds
- Manual navigation that resets the auto-scroll timer
- Proper cleanup of intervals when unmounting
- Optimized rendering with useMemo and useCallback
```

## Key Shared Interfaces

```typescript
// Note object interface - shared between feeds
interface Note {
  id: string;
  pubkey: string;
  npub: string;
  content: string;
  created_at: number;
  hashtags: string[];
  images: string[];
  author: {
    name?: string;
    displayName?: string;
    picture?: string;
  };
}

// Profile data interface
interface ProfileData {
  displayName?: string;
  name?: string;
  picture?: string;
  // ... other profile properties
}
```

## CommunityFeed Implementation Details

### NSFW Content Filtering

```typescript
// Define NSFW keywords for content filtering
const NSFW_KEYWORDS = [
  'nsfw', 'nude', 'explicit', 'porn', 'xxx'
];
```

### Hashtag Extraction and Filtering

```typescript
// Filter notes by active hashtag
const filteredNotes = useMemo(() => {
  if (!selectedHashtag) return allNotes;
  
  return allNotes.filter(note => 
    note.hashtags.includes(selectedHashtag.toLowerCase()) || 
    note.content.toLowerCase().includes(`#${selectedHashtag.toLowerCase()}`)
  );
}, [allNotes, selectedHashtag]);

// Extract popular hashtags from notes
const popularHashtags = useMemo(() => {
  const tagCounts: Record<string, number> = {};
  
  allNotes.forEach(note => {
    note.hashtags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  return Object.entries(tagCounts)
    .filter(([tag]) => POPULAR_HASHTAGS.includes(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([tag, count]) => ({ tag, count }));
}, [allNotes]);
```

### Auto-Scrolling Logic

```typescript
// Fixed auto-scrolling logic with proper state management
useEffect(() => {
  if (!autoScroll || filteredNotes.length === 0 || loading) {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }
  
  // Clear any existing timeout
  if (scrollTimeoutRef.current) {
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = null;
  }
  
  // Set up the timeout
  scrollTimeoutRef.current = setTimeout(() => {
    setAutoScrollIndex(prev => {
      const nextIndex = (prev + 1) % filteredNotes.length;
      const noteElement = document.querySelector(`.note-item:nth-child(${nextIndex + 1})`);
      if (noteElement) {
        noteElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return nextIndex;
    });
  }, scrollInterval);
  
  // Cleanup
  return () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };
}, [autoScroll, filteredNotes.length, loading, scrollInterval, autoScrollIndex]);
```

### Loading Animation

```jsx
{loading && showLoadingAnimation ? (
  <div className="flex flex-col items-center justify-center h-64 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
    <div className="animate-pulse space-y-4 w-full">
      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
      </div>
      <div className="h-40 bg-gray-300 dark:bg-gray-600 rounded"></div>
    </div>
    <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
      {loadingMessage}
    </div>
  </div>
) : (
  // Regular content rendering
)}
```

### Note Rendering

```jsx
<div 
  key={note.id} 
  className="note-item bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
  onClick={() => openInNjump(note)}
>
  {/* Author info */}
  <div className="flex items-center space-x-2 mb-3">
    <NostrProfileImage
      npub={note.npub}
      width={40}
      height={40}
      className="rounded-full"
    />
    <div>
      <div className="font-semibold text-sm dark:text-white">
        {note.author.displayName || note.author.name || 'Unknown'}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {new Date(note.created_at * 1000).toLocaleDateString()}
      </div>
    </div>
  </div>
  
  {/* Note content */}
  <div className="text-sm dark:text-gray-200 mb-3">
    {note.content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < note.content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ))}
  </div>
  
  {/* Image(s) */}
  {note.images && note.images.length > 0 && (
    <div className="my-3 rounded-md overflow-hidden">
      <Image
        src={note.images[0]}
        alt="Post image"
        width={500}
        height={300}
        className="object-cover w-full max-h-[300px]"
        unoptimized
      />
    </div>
  )}
  
  {/* Hashtags */}
  {note.hashtags && note.hashtags.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-2">
      {note.hashtags.map(tag => (
        <span 
          key={tag} 
          className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded"
        >
          #{tag}
        </span>
      ))}
    </div>
  )}
</div>
```

## MadeiraFeed Implementation Details

### Madeira Hashtags

```typescript
// Madeira-related hashtags to filter by
export const MADEIRA_HASHTAGS = [
  'madeira', 'funchal', 'madeirisland', 'visitmadeira', 'madeiraisland',
  'bitcoinmadeira', 'bitcoinfunchal', 'btcmadeira', 'btcfunchal',
  'lido', 'ponchinha', 'santana', 'machico', 'calheta', 'portosanto',
  'pontadosol', 'madeiramadness', 'madeiradiggers'
];
```

### Carousel Auto-Rotation

```typescript
// Start auto-scroll when component mounts and stops loading
useEffect(() => {
  // Only set up auto-scroll if we have notes and we're not loading
  if (!loading && carouselNotes.length > 0) {
    // Clear any existing interval first to prevent multiple intervals
    clearAutoScroll();
    
    // Auto-scroll every 5 seconds
    autoScrollRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
    }, 5000);
  }
  
  // Cleanup interval on unmount or when dependencies change
  return clearAutoScroll;
}, [loading, carouselNotes, clearAutoScroll]);
```

### Carousel Navigation

```typescript
// Handle manual navigation - memoized callbacks
const handlePrev = useCallback(() => {
  // Reset auto-scroll timer
  clearAutoScroll();
  
  // Start new interval
  autoScrollRef.current = setInterval(() => {
    setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
  }, 5000);
  
  // Go to previous image
  setCurrentIndex(prev => (prev === 0 ? carouselNotes.length - 1 : prev - 1));
}, [carouselNotes, clearAutoScroll]);

const handleNext = useCallback(() => {
  // Reset auto-scroll timer
  clearAutoScroll();
  
  // Start new interval
  autoScrollRef.current = setInterval(() => {
    setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
  }, 5000);
  
  // Go to next image
  setCurrentIndex(prev => (prev + 1) % carouselNotes.length);
}, [carouselNotes, clearAutoScroll]);
```

### Image Carousel Rendering

```jsx
{/* Main image */}
<div className="absolute inset-0 transition-opacity duration-1000 ease-in-out">
  {carouselNotes.map((note, index) => (
    <div 
      key={note.id}
      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
        index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
      }`}
    >
      {/* Use next/image properly with width and height */}
      <img 
        src={note.images[0]} 
        alt={`Madeira image ${index + 1}`}
        className="object-contain w-full h-full"
      />
      
      {/* Caption overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
        <p className="text-sm truncate">
          {note.content.slice(0, 100)}{note.content.length > 100 ? '...' : ''}
        </p>
        <div className="flex items-center mt-2">
          {note.author.picture && (
            <img 
              src={note.author.picture} 
              alt={note.author.displayName || note.author.name || 'Author'} 
              className="w-6 h-6 rounded-full mr-2"
            />
          )}
          <span className="text-xs">
            {note.author.displayName || note.author.name || 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  ))}
</div>
```

### Carousel Navigation Controls

```jsx
{/* Navigation controls */}
<div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2 z-20">
  {carouselNotes.map((_, index) => (
    <button
      key={index}
      className={`w-2 h-2 rounded-full ${
        index === currentIndex ? 'bg-white' : 'bg-white/50'
      }`}
      onClick={() => handleIndicatorClick(index)}
      aria-label={`Go to slide ${index + 1}`}
    />
  ))}
</div>

{/* Left/Right buttons */}
<button
  className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/20 text-white z-20 hover:bg-black/40"
  onClick={handlePrev}
  aria-label="Previous image"
>
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
</button>

<button
  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-black/20 text-white z-20 hover:bg-black/40"
  onClick={handleNext}
  aria-label="Next image"
>
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
</button>
```

## Performance Optimization Techniques

### 1. Memoizing Heavy Calculations

```jsx
// Memoize arrays to prevent unnecessary rerenders
const hashtagsArray = useMemo(() => [...hashtags], [hashtags.join(',')]);
const npubsArray = useMemo(() => [...npubs], [npubs.join(',')]);

// Memoize filtered notes
const filteredNotes = useMemo(() => {
  if (!selectedHashtag) return allNotes;
  return allNotes.filter(note => /* filtering logic */);
}, [allNotes, selectedHashtag]);

// Memoize hook parameters
const feedParams = useMemo(() => ({
  npubs: effectiveNpubs,
  limit: isFreeMadeiraNpub ? 50 : limit,
  requiredHashtags: hashtagsArray,
  nsfwKeywords: NSFW_KEYWORDS,
  useWebOfTrust: MCP_CONFIG.defaults.useWebOfTrust && !npub
}), [effectiveNpubs, isFreeMadeiraNpub, limit, hashtagsArray, npub]);
```

### 2. Memoizing Callback Functions

```jsx
// Memoized callback functions
const openInNjump = useCallback((note: Note) => {
  if (!note || !note.id) return;
  const njumpUrl = `https://njump.me/${note.id}`;
  window.open(njumpUrl, '_blank');
}, []);

const handleRefresh = useCallback(() => {
  setSelectedHashtag(null);
  refresh();
}, [refresh]);
```

### 3. Efficient Resource Management

```jsx
// Clear auto-scroll interval safely
const clearAutoScroll = useCallback(() => {
  if (autoScrollRef.current) {
    clearInterval(autoScrollRef.current);
    autoScrollRef.current = null;
  }
}, []);

// Proper cleanup in useEffect
useEffect(() => {
  // Setup code
  return () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };
}, [dependencies]);
```

### 4. Optimizing Rendering

```jsx
// Convert profilesMap to Map only if needed
const profilesAsMap = useMemo(() => {
  return profilesMap instanceof Map 
    ? profilesMap 
    : new Map(Object.entries(profilesMap));
}, [profilesMap]);

// Create a stable reference to a slice of data
const carouselNotes = useMemo(() => {
  return notes.slice(0, 8);
}, [notes]);
```

## Integration Examples

### Community Feed Integration

```jsx
import { CommunityFeed } from '../../components/community/feed';

// In your page component:
<CommunityFeed 
  npubs={activeProfiles} 
  limit={30}
  hashtags={['madeira', 'bitcoin']}
  showHashtagFilter={true}
  maxHeight={600}
/>
```

### Madeira Feed Integration

```jsx
import { MadeiraFeed } from '../../components/community/feed';

// In your page component:
<MadeiraFeed 
  profilesMap={profiles}
  initialCount={30}
  maxCached={150}
/>
```

## Data Fetching Hooks

The components rely on these hooks:

1. `useNostrFeed` - Fetches general Nostr posts with filtering
2. `useImageFeed` - Specialized for fetching image-containing posts
3. `useCachedProfiles` - Handles profile data caching

These hooks handle:
- Batched data fetching
- Pagination and limits
- Caching and data deduplication
- Filtering by hashtags and content
- NSFW content detection 