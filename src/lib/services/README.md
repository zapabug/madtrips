# Services Directory

This directory contains service classes that handle various aspects of data management, external API interactions, and state handling in the MadTrips application.

## Contents

- [`NostrLoginService.ts`](#nostrloginservicets) - Nostr login management
- [`CacheService.ts`](#cacheservicets) - Data caching utilities
- [`RelayService.ts`](#relayservicets) - Nostr relay communication
- [`SessionService.ts`](#sessionservicets) - User session management
- [`LightningPaymentService.ts`](#lightningpaymentservicets) - Lightning payment processing
- [`LightningService.ts`](#lightningservicets) - Lightning network interactions
- [`NostrMessagingService.ts`](#nostrmessagingservicets) - Nostr-based messaging

## NostrLoginService.ts

Handles user authentication and login through Nostr protocol.

### Key Features

- NIP-07 extension integration
- Login session management
- Public key handling and verification
- Login status tracking

## CacheService.ts

Provides caching functionality for various data types in the application.

### Key Features

- Profile data caching
- Graph data caching
- Feed caching
- Cache invalidation strategies
- Persistence options

## RelayService.ts

Manages connections to Nostr relays for data publishing and subscription.

### Key Features

- Relay connection pooling
- Event publishing
- Subscription management
- Relay status monitoring
- Error handling and reconnection

## SessionService.ts

Handles user session management and persistence.

### Key Features

- Session creation and termination
- Login state persistence
- Session recovery
- Cross-tab synchronization

## LightningPaymentService.ts

Processes Bitcoin Lightning Network payments.

### Key Features

- Invoice generation
- Payment validation
- Payment status tracking
- Receipt generation

## LightningService.ts

Core service for Lightning Network interactions.

### Key Features

- Node connection management
- LNURL handling
- Wallet interactions

## NostrMessagingService.ts

Handles direct messaging functionality using Nostr.

### Key Features

- Direct message sending
- Message reception
- Thread management
- Encryption/decryption

## Usage Pattern

Services typically follow a singleton pattern and are used by importing them directly:

```typescript
import { RelayService } from '../lib/services/RelayService';

// Use the service
const connectedRelays = RelayService.getConnectedRelays();
await RelayService.connect(['wss://relay.example.com']);
```

Services can also be injected into React components via context providers or passed as props. 