// Global type declarations

declare global {
  interface Window {
    // Nostr browser extension (NIP-07)
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
    
    // NostrLogin service
    NostrLogin?: {
      getProfile?: (npub: string) => { picture?: string, name?: string, [key: string]: any } | null;
      launch?: (opts: any) => void;
      ensureAuth?: (opts?: any) => any;
      checkAuth?: () => any;
      [key: string]: any;
    };
    
    // MadTrips custom Nostr implementation
    madtripsNostr?: {
      activeProfile?: {
        pubkey: string;
        npub: string;
        name?: string;
        displayName?: string;
        picture?: string;
      };
      isViewOnly: boolean;
      connect: (method: 'nip07' | 'nip47' | 'viewonly', options?: any) => Promise<string>;
      disconnect: () => void;
      isConnected: () => boolean;
      getPublicKey: () => Promise<string>;
      signEvent?: (event: any) => Promise<any>;
      payInvoice?: (invoice: string) => Promise<{
        preimage: string;
        paymentHash: string;
      }>;
    };
    
    // WebLN Lightning provider
    webln?: {
      enable: () => Promise<void>;
      getInfo: () => Promise<{
        node: {
          alias: string;
          pubkey: string;
          color?: string;
        };
        methods: string[];
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
      [key: string]: any;
    };
  }
} 