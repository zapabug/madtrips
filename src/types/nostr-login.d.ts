// Type definitions for nostr-login package
declare module 'nostr-login' {
  export interface NostrLoginInitOptions {
    theme?: string;
    bunkers?: string;
    perms?: string;
    darkMode?: boolean;
    noBanner?: boolean;
    startScreen?: string;
    onAuth?: (npub: string, options: any) => void;
    methods?: string;
  }

  export function init(options?: NostrLoginInitOptions): void;
  export function launch(options?: { startScreen?: string }): void;
  export function logout(): void;
}

// Extend Window interface to include nostr properties
interface Window {
  nostr?: {
    getPublicKey(): Promise<string>;
    signEvent(event: any): Promise<any>;
    nip04?: {
      encrypt(pubkey: string, plaintext: string): Promise<string>;
      decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
  };
} 