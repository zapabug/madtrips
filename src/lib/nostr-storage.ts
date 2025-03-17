import { SimplePool, Filter, Event } from 'nostr-tools';
import { CartState, UserSelections } from '@/types/package-types';

const KIND_USER_DATA = 30000; // Custom kind for user data
const KIND_CART = 30001; // Custom kind for cart data
const KIND_SAVED_PACKAGES = 30002; // Custom kind for saved packages

export class NostrStorage {
  private pool: SimplePool;
  private relays: string[];

  constructor(relays: string[] = [
    'wss://relay.damus.io',
    'wss://nostr.bitcoiner.social',
    'wss://nostr.fmt.wiz.biz'
  ]) {
    this.relays = relays;
    this.pool = new SimplePool();
  }

  // Store user selections
  async storeUserSelections(pubkey: string, selections: UserSelections): Promise<void> {
    const event: Event = {
      kind: KIND_USER_DATA,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(selections),
      id: '', // Will be computed by nostr-tools
      sig: '' // Will be computed by nostr-tools
    };

    await this.pool.publish(this.relays, event);
  }

  // Get user selections
  async getUserSelections(pubkey: string): Promise<UserSelections | null> {
    const filter: Filter = {
      kinds: [KIND_USER_DATA],
      authors: [pubkey],
      limit: 1
    };

    try {
      const events = await this.pool.querySync(this.relays, filter);
      if (!events || events.length === 0) return null;

      return JSON.parse(events[0].content);
    } catch (error: unknown) {
      console.error('Error getting user selections:', error);
      return null;
    }
  }

  // Store cart state
  async storeCart(pubkey: string, cart: CartState): Promise<void> {
    const event: Event = {
      kind: KIND_CART,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(cart),
      id: '', // Will be computed by nostr-tools
      sig: '' // Will be computed by nostr-tools
    };

    await this.pool.publish(this.relays, event);
  }

  // Get cart state
  async getCart(pubkey: string): Promise<CartState | null> {
    const filter: Filter = {
      kinds: [KIND_CART],
      authors: [pubkey],
      limit: 1
    };

    try {
      const events = await this.pool.querySync(this.relays, filter);
      if (!events || events.length === 0) return null;

      return JSON.parse(events[0].content);
    } catch (error: unknown) {
      console.error('Error getting cart:', error);
      return null;
    }
  }

  // Store saved packages
  async storeSavedPackages(pubkey: string, packageIds: string[]): Promise<void> {
    const event: Event = {
      kind: KIND_SAVED_PACKAGES,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(packageIds),
      id: '', // Will be computed by nostr-tools
      sig: '' // Will be computed by nostr-tools
    };

    await this.pool.publish(this.relays, event);
  }

  // Get saved packages
  async getSavedPackages(pubkey: string): Promise<string[]> {
    const filter: Filter = {
      kinds: [KIND_SAVED_PACKAGES],
      authors: [pubkey],
      limit: 1
    };

    try {
      const events = await this.pool.querySync(this.relays, filter);
      if (!events || events.length === 0) return [];

      return JSON.parse(events[0].content);
    } catch (error: unknown) {
      console.error('Error getting saved packages:', error);
      return [];
    }
  }

  // Clean up resources
  close(): void {
    this.pool.close(this.relays);
  }
} 