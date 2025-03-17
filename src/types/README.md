# Types Directory

This directory contains all TypeScript type definitions for the MadTrips application.

## Directory Structure

- **index.ts**: Barrel file that re-exports all types from dedicated files
- **package-types.ts**: Types related to travel packages, bookings, and payments
- **graph-types.ts**: Types related to social graph visualization
- **global.d.ts**: Global type augmentations for general browser APIs
- **nostr.d.ts**: Nostr protocol-specific type definitions
- **webln.d.ts**: WebLN API type definitions

## Type Organization Patterns

### 1. Regular TypeScript Interfaces and Types

For most application-specific types, we define them in dedicated files and export them normally:

```typescript
// Example from package-types.ts
export interface Package {
  id: string;
  title: string;
  // ...
}
```

### 2. Global Augmentations

For extending global objects (like `Window`), we use the `declare global` pattern:

```typescript
// Example from webln.d.ts
declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}
```

## Import Patterns

### Recommended Import Approaches

1. **For application types (Package, PaymentData, etc.)**:
   ```typescript
   import { Package } from '@/types';
   ```

2. **For specific type categories**:
   ```typescript
   import { GraphNode, GraphLink } from '@/graph-types';
   ```

3. **For direct file imports**:
   ```typescript
   import { Package } from '@/types/package-types';
   ```

## Best Practices

1. **Keep related types together** in dedicated files following the naming convention `*-types.ts`
2. **Add helper functions** as `*-helpers.ts`
3. **Document complex types** with JSDoc comments
4. **Don't mix global augmentations** with regular exports in the same file 