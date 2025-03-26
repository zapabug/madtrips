import axios from 'axios';

interface GenerateInvoiceParams {
  amount: number;
  split?: number;
  lnAddress1: string;
  lnAddress2?: string;
}

interface InvoiceResponse {
  success: boolean;
  invoice?: string;
  error?: string;
}

// Lightning Service for generating real invoices
export const generateInvoice = async ({
  amount,
  split = 100,
  lnAddress1,
  lnAddress2
}: GenerateInvoiceParams): Promise<InvoiceResponse> => {
  try {
    // Use environment variables for endpoints
    const endpoint = process.env.LIGHTNING_SERVICE_ENDPOINT;
    const apiKey = process.env.LIGHTNING_SERVICE_API_KEY;
    
    if (!endpoint || !apiKey) {
      return {
        success: false,
        error: 'Lightning service configuration missing'
      };
    }
    
    // If split payment, use appropriate endpoint
    const url = lnAddress2 ? 
      `${endpoint}/api/v1/split-invoice` : 
      `${endpoint}/api/v1/invoice`;
    
    const response = await axios.post(url, {
      amount,
      split_percent: split,
      receiver1: lnAddress1,
      receiver2: lnAddress2,
      memo: "MadTrips booking payment",
      api_key: apiKey
    });
    
    if (response.status !== 200 || !response.data.payment_request) {
      return {
        success: false,
        error: response.data.message || 'Failed to generate invoice'
      };
    }
    
    return {
      success: true,
      invoice: response.data.payment_request
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 