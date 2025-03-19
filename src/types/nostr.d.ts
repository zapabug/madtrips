// Global type augmentations for Nostr

// Types for Nostr extensions and integrations
interface Nostr {
  getPublicKey: () => Promise<string>;
  signEvent: (event: any) => Promise<any>;
  requestPermission?: (opts: { permissions: string[] }) => Promise<void>;
  // Add any other Nostr methods
}

interface NostrLogin {
  [key: string]: any;
  getProfile?: (npub: string) => { [key: string]: any; picture?: string; name?: string } | null;
  launch?: (opts: any) => void;
  ensureAuth?: (opts?: any) => any;
  checkAuth?: () => any;
}

interface Amber {
  [key: string]: any;
  keystorage?: any;
}

// Nostr Protocol Type Definitions
// Includes support for NIP-07, NIP-47, and view-only modes

// NIP-07 Browser Extension Interface
interface NIP07Interface {
  getPublicKey: () => Promise<string>;
  signEvent: (event: any) => Promise<any>;
  getRelays?: () => Promise<{ [url: string]: { read: boolean; write: boolean } }>;
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
  requestPermission?: (opts: { permissions: string[] }) => Promise<void>;
}

// NIP-47 Remote Signer Interface (Nostr Connect)
interface NIP47Interface {
  connect: (target: string, relay?: string) => Promise<void>;
  getPublicKey: () => Promise<string>;
  signEvent: (event: any) => Promise<any>;
  encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
  decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
  // Add payment methods
  payInvoice?: (invoice: string) => Promise<{
    preimage: string;
    paymentHash: string;
  }>;
  getInfo?: () => Promise<any>;
  getBalance?: () => Promise<{ balance: number; currency: string }>;
}

// ViewOnly Mode Interface
interface ViewOnlyProfile {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

// MadTrips custom Nostr implementation
interface MadTripsNostr {
  activeProfile?: ViewOnlyProfile;
  isViewOnly: boolean;
  connect: (method: 'nip07' | 'nip47' | 'viewonly', options?: any) => Promise<string>;
  disconnect: () => void;
  isConnected: () => boolean;
  getPublicKey: () => Promise<string>;
  signEvent?: (event: any) => Promise<any>;
  // Add payment methods
  payInvoice?: (invoice: string) => Promise<{
    preimage: string;
    paymentHash: string;
  }>;
} 