// Global type augmentations for Nostr
interface Window {
  nostr?: {
    getPublicKey: () => Promise<string>;
    signEvent: (event: any) => Promise<any>;
    // Add other nostr methods as needed
  };
  
  NostrLogin?: {
    getProfile?: (npub: string) => { picture?: string, name?: string, [key: string]: any } | null;
    launch?: (opts: any) => void;
    ensureAuth?: (opts?: any) => any;
    // Allow additional properties
    [key: string]: any;
  };
  
  // WebLN interface for Lightning payments
  webln?: {
    enable: () => Promise<void>;
    getInfo: () => Promise<{
      node: {
        alias: string;
        pubkey: string;
        color?: string;
      };
      methods: string[];
      // Additional fields may be present
      [key: string]: any;
    }>;
    sendPayment: (paymentRequest: string) => Promise<{
      preimage: string;
      paymentHash?: string;
    }>;
    makeInvoice: (args: {
      amount: string | number;
      defaultMemo?: string;
      defaultAmount?: string | number;
    }) => Promise<{
      paymentRequest: string;
      paymentHash?: string;
    }>;
    signMessage: (message: string) => Promise<{ signature: string }>;
    verifyMessage: (signature: string, message: string) => Promise<{ valid: boolean }>;
    // Allow additional properties
    [key: string]: any;
  };
}

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

// Define global namespace augmentation
declare global {
  interface Window {
    nostr?: NIP07Interface;
    madtripsNostr?: MadTripsNostr;
  }
} 