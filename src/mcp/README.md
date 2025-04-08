# MCP (Madeira Community Protocol)

This directory contains the implementation of the Madeira Community Protocol, which integrates Nostr functionality into the MadTrips application.

## Contents

- [`nostr-integration.ts`](#nostr-integrationts) - Main Nostr integration logic
- [`config.ts`](#configts) - MCP configuration settings
- [`index.ts`](#indexts) - Entry point for MCP exports

## nostr-integration.ts

The core implementation of Nostr protocol integration within MadTrips.

### Key Features

- Community data synchronization
- Profile fetching and management
- Relay communication handling
- Event publishing and subscription

## config.ts

Configuration settings for the Madeira Community Protocol.

### Key Settings

- Default relay URLs
- Protocol parameters
- Feature flags
- Timeout settings

## index.ts

Entry point for MCP module, providing exports to the rest of the application.

## Usage

The MCP module is typically used by importing its functionality in context providers and services:

```typescript
import { initNostrIntegration } from '../mcp/nostr-integration';
import { MCP_CONFIG } from '../mcp/config';

// Initialize Nostr integration with configuration
const nostrClient = initNostrIntegration({
  relays: MCP_CONFIG.defaultRelays,
  enableCache: true
});
```

## Notes

- MCP is responsible for maintaining connection to the Nostr network
- It manages profile data and community interactions
- Provides data to higher-level hooks and components 