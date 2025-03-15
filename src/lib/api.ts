// API utility functions for interacting with backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Generic fetch function with error handling
async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
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