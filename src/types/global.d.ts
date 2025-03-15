// Global type declarations

interface Window {
  NostrLogin?: {
    getProfile?: (npub: string) => { picture?: string, name?: string, [key: string]: any } | null;
    launch?: (opts: any) => void;
    [key: string]: any;
  };
  nostr?: {
    getPublicKey: () => Promise<string>;
    signEvent: (event: any) => Promise<any>;
    // Add other nostr methods as needed
  };
} 