// API utility functions for interacting with backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9090/api';

// Generic fetch function with error handling
async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`API Request: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log(`API Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('API Response Data (first few items):', 
      Array.isArray(data) ? data.slice(0, 2) : 
      typeof data === 'object' ? Object.keys(data) : data
    );
    return data;
  } catch (error) {
    console.error(`API Fetch Error for ${url}:`, error);
    throw error;
  }
}

// API functions
export const api = {
  // Travel packages
  async getPackages() {
    return fetchAPI<{ packages: any[] }>('/packages');
  },
  
  async getPackage(id: string) {
    return fetchAPI<{ package: any }>(`/packages/${id}`);
  },
  
  // Businesses
  getBusinesses: () => fetchAPI('/businesses'),

  // Payments
  async createPayment(amount: number, description: string) {
    return fetchAPI<{ id: string; invoice: string; qrCode: string; expiry: number }>('/payments', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  },
  
  async checkPaymentStatus(paymentId: string) {
    return fetchAPI<{ id: string; status: string; paid: boolean; paidAt: string | null }>(`/payments/${paymentId}`);
  },

  // Bookings
  async createBooking(data: { packageId: string; nostrPubkey: string; invoice: string }) {
    return fetchAPI<{ bookingId: string; status: string; message: string }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
}; 