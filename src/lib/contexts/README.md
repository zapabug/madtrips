# Contexts Directory

This directory contains React Context providers that manage global state and provide functionality throughout the MadTrips application.

## Contents

- [`NostrContext.tsx`](#nostrcontexttsx) - Nostr protocol integration context

## NostrContext.tsx

The primary context for Nostr protocol integration, providing Nostr functionality to the entire application.

### Key Features

- NDK instance management
- User profile handling
- Relay connection management
- Event subscription
- Data fetching utilities

### Context Exports

- `ndk` - NDK instance for direct Nostr operations
- `pubkey` - Current user's public key
- `loggedIn` - User login status
- `relayUrls` - Connected relay URLs
- `relayCount` - Number of connected relays
- `getUserProfile` - Function to fetch user profiles
- `publishEvent` - Function to publish events to relays
- `subscribeToEvents` - Function to subscribe to specific events
- And many other Nostr-related utilities

### Example Usage

```tsx
import { useNostr } from '../lib/contexts/NostrContext';

function ProfileComponent() {
  const { getUserProfile, pubkey, loggedIn } = useNostr();
  
  const fetchProfile = async () => {
    if (!loggedIn) return;
    
    const profile = await getUserProfile(pubkey);
    // Use profile data
  };
  
  return (
    // Component implementation
  );
}
```

### Provider Setup

The NostrContext provider should be included high in the component tree to make Nostr functionality available throughout the application:

```tsx
import { NostrProvider } from '../lib/contexts/NostrContext';

function App() {
  return (
    <NostrProvider>
      {/* Application components */}
    </NostrProvider>
  );
}
```

## Best Practices

1. Use the context hooks (`useNostr`) rather than importing context directly
2. Handle loading and error states when using asynchronous context functions
3. Verify login status before performing actions that require authentication
4. Consider performance implications when subscribing to events 