Sure! Here's a clean, copy-paste-ready **Markdown implementation guide** for your custom lightweight Nostr data types and utilities.

---

# 🧠 MadTrips Lite Nostr Types & Utilities

This guide defines lightweight TypeScript types and utility functions for extracting essential Nostr data for **profile display**, **graph building**, and **image feed rendering** in the **MadTrips** app.

---

## ✅ Type Definitions

### `LiteProfile` — from `kind:0`

```ts
export interface LiteProfile {
  pubkey: string;             // Hex public key
  npub: string;               // Bech32-encoded (optional, for convenience)
  name?: string;              // display_name or name from kind:0 content
  picture?: string;           // profile picture URL
  lastFetched?: number;       // optional cache TTL
}
```

---

### `ContactList` — from `kind:3`

```ts
export interface ContactList {
  pubkey: string;
  contacts: string[];         // Follows as hex pubkeys
  lastFetched?: number;
}
```

---

### `ImageNote` — from `kind:1`

```ts
export interface ImageNote {
  id: string;
  pubkey: string;
  content: string;
  tags: string[];             // Extracted hashtags
  created_at: number;
  imageUrls: string[];        // Links to images
}
```

---

## 🔧 Utility Functions

### Parse `kind:0` into `LiteProfile`

```ts
export const parseLiteProfile = (
  event: NostrEvent
): LiteProfile | null => {
  if (event.kind !== 0) return null;

  try {
    const content = JSON.parse(event.content);
    return {
      pubkey: event.pubkey,
      npub: '', // You can convert using a bech32 utility like `nip19`
      name: content.display_name || content.name,
      picture: content.picture,
      lastFetched: Date.now(),
    };
  } catch {
    return null;
  }
};
```

---

### Parse `kind:3` into `ContactList`

```ts
export const parseContactList = (
  event: NostrEvent
): ContactList | null => {
  if (event.kind !== 3) return null;

  const contacts = event.tags
    .filter(tag => tag[0] === 'p')
    .map(tag => tag[1]);

  return {
    pubkey: event.pubkey,
    contacts,
    lastFetched: Date.now(),
  };
};
```

---

### Parse `kind:1` into `ImageNote`

```ts
export const extractImageUrls = (content: string): string[] => {
  const regex = /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp))/gi;
  return [...content.matchAll(regex)].map(match => match[0]);
};

export const extractHashtags = (tags: string[][]): string[] =>
  tags.filter(tag => tag[0] === 't').map(tag => tag[1]);

export const parseImageNote = (
  event: NostrEvent
): ImageNote | null => {
  if (event.kind !== 1) return null;

  const imageUrls = extractImageUrls(event.content);
  if (!imageUrls.length) return null;

  return {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    created_at: event.created_at,
    imageUrls,
    tags: extractHashtags(event.tags),
  };
};
```

---

## 🗂 Suggested Folder Structure

```
/types
  nostr.ts         // LiteProfile, ContactList, ImageNote

/utils
  nostrParser.ts   // parseLiteProfile, parseContactList, parseImageNote
```

---

## 🔌 Integration Plan

- 🔁 Use `RelayService` to subscribe to:
  - `kind:0` for profiles
  - `kind:3` for follows
  - `kind:1` for image notes
- 🧠 Use these types and parsers inside:
  - `useNostrFeed` (for feed)
  - `useSocialGraph` (for graph building)
  - `CacheService` (for storing processed results)

---

Let me know if you want this bundled as a ready-to-use `.ts` module or if you'd like to add avatar fallback, profile validation, or NIP-05 verification!