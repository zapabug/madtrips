# Nostr Library

This directory contains core Nostr protocol implementations and utilities for the MadTrips application.

## Contents

- [`ndk.ts`](#ndkts) - NDK (Nostr Development Kit) configuration and setup
- [`test-integration.ts`](#test-integrationts) - Testing utilities for Nostr integration

## ndk.ts

Core configuration and initialization for the Nostr Development Kit (NDK) library.

### Key Features

- NDK instance configuration
- Default relay setup
- Signer configuration
- Connection management

### Example

```typescript
import { initializeNDK } from '../lib/nostr/ndk';

// Initialize NDK with specific relays
const ndk = await initializeNDK({
  explicitRelayUrls: ['wss://relay.madeira.com', 'wss://purplepag.es']
});

// Use NDK for Nostr operations
const user = ndk.getUser({ npub: 'npub1...' });
```

## test-integration.ts

Provides utilities for testing Nostr integration in various environments.

### Key Features

- Test data generation
- Relay connection testing
- Mock event generation
- Integration validation

### Example

```typescript
import { testRelayConnection } from '../lib/nostr/test-integration';

// Test connection to a specific relay
const status = await testRelayConnection('wss://relay.example.com');
console.log(`Relay connection status: ${status.connected}`);
```

## Notes

- This directory contains the low-level Nostr protocol integration
- Higher-level functionality is built on top of these core components
- The NDK library is the primary mechanism for Nostr interactions 