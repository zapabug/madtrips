// WebLN type definitions
// Based on the WebLN specification: https://webln.dev/

interface WebLNProvider {
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
}

// Note: Window interface is now defined in global.d.ts 