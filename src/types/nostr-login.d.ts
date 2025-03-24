// Type definitions for nostr-login package
declare module 'nostr-login' {
  export function init(options: {
    theme?: string;
    bunkers?: string;
    perms?: string;
    darkMode?: boolean;
    noBanner?: boolean;
    methods?: string;
    onAuth?: (npub: string, options?: any) => void;
  }): void;

  export function launch(options?: { startScreen?: string }): { close?: () => void };
}

// Extend Window interface to include nostr properties
interface Window {
  nostrLogin?: {
    __nlInitialized?: boolean;
    [key: string]: any;
  };

  // This extends the existing NIP-07 interface
  nostr?: {
    getPublicKey: () => Promise<string>;
    signEvent: (event: any) => Promise<any>;
    getRelays?: () => Promise<{ [url: string]: { read: boolean; write: boolean } }>;
    nip04?: {
      encrypt: (pubkey: string, plaintext: string) => Promise<string>;
      decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
    };
    requestPermission?: (opts: { permissions: string[] }) => Promise<void>;
  };
} 