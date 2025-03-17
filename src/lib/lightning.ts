'use client';

import QRCode from 'qrcode';

// Client-side Lightning interface types
export interface InvoiceResponse {
  id: string;
  invoice: string;
  qrCode?: string;
}

export interface PaymentStatus {
  paid: boolean;
  preimage?: string | null;
  details?: any;
  error?: string;
}

// WebLN detection and capabilities
export const hasWebLN = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'webln' in window;
};

// Get supported payment methods
export const getSupportedPaymentMethods = (): string[] => {
  const methods = ['manual'];
  
  if (hasWebLN()) {
    methods.push('webln');
  }
  
  return methods;
};

// Create a Lightning invoice
export const createInvoice = async (amount: number, memo: string): Promise<InvoiceResponse> => {
  // Check if WebLN is available
  if (hasWebLN()) {
    try {
      // Try to use WebLN
      // @ts-ignore - WebLN types are not included
      await window.webln.enable();
      
      // Create an invoice with WebLN
      try {
        // @ts-ignore - WebLN types are not included
        const result = await window.webln.makeInvoice({
          amount: amount,
          defaultMemo: memo
        });
        
        // Generate QR code for the invoice
        const qrCodeDataUrl = await QRCode.toDataURL(result.paymentRequest);
        
        return {
          id: result.id || result.paymentHash || Math.random().toString(36).substring(2, 15),
          invoice: result.paymentRequest,
          qrCode: qrCodeDataUrl
        };
      } catch (invoiceError) {
        console.error('Error creating invoice with WebLN:', invoiceError);
        // Fall back to manual invoice
      }
    } catch (error) {
      console.error('Error enabling WebLN:', error);
      // Fall back to manual invoice
    }
  }
  
  // If WebLN fails or is not available, create a fake invoice for demo purposes
  return createFakeInvoice(amount, memo);
};

// Send a payment
export const sendPayment = async (invoice: string): Promise<PaymentStatus> => {
  // Check if WebLN is available
  if (hasWebLN()) {
    try {
      // Try to use WebLN
      // @ts-ignore - WebLN types are not included
      await window.webln.enable();
      
      // Send payment with WebLN
      try {
        // @ts-ignore - WebLN types are not included
        const result = await window.webln.sendPayment(invoice);
        
        return {
          paid: true,
          preimage: result.preimage,
          details: result
        };
      } catch (paymentError) {
        console.error('Error sending payment with WebLN:', paymentError);
        return { paid: false, error: 'Payment failed' };
      }
    } catch (error) {
      console.error('Error enabling WebLN:', error);
      return { paid: false, error: 'WebLN not available' };
    }
  } else {
    // For demo purposes, simulate a successful payment after a delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ paid: true });
      }, 2000);
    });
  }
};

// Check if a payment has been received
export const checkPayment = async (paymentHash: string): Promise<PaymentStatus> => {
  // In a real implementation, this would verify the payment with the Lightning node
  // For demo purposes without a backend, we'll simulate payment status
  
  // Randomly determine if the payment was successful (80% chance)
  const paid = Math.random() < 0.8;
  
  return {
    paid,
    preimage: paid ? Math.random().toString(36).substring(2, 15) : null,
  };
};

// Create a fake invoice for testing
const createFakeInvoice = async (amount: number, memo: string): Promise<InvoiceResponse> => {
  const paymentHash = Math.random().toString(36).substring(2, 15);
  const fakeInvoice = `lnbcrt${amount}n1p${paymentHash}app5wkr9zr7heaxzrz0mfj8420fcn4ytp7j3h2fhk652jssmkscnypjhvsdqqcqzzsxqyz5vqsp5mw6nxs4c44ze2hsw40f3v54ztwe360hg76twx4dvu0etlkp8s6fq9qyyssqy2a5jk28hc3cfu6z056snfs7avjssywpnvwpgudj2ucl7l8n5c8dhjs4jf2u3049mkaeregutx87tzn54v88gft5pqeu5df2lg8fkkcpvp0yqf`;

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(fakeInvoice);
  
  return {
    id: paymentHash,
    invoice: fakeInvoice,
    qrCode: qrCodeDataUrl
  };
}; 