// API utility functions for interacting with backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9090/api';

// Mock data for packages since we've moved everything to the frontend
const MOCK_PACKAGES = [
  {
    id: '1',
    title: 'Beach Day Experience',
    description: 'Enjoy a day at Madeira\'s most beautiful beaches with transportation included.',
    price: 15000000, // 0.15 BTC in satoshis
    duration: '1 Day',
    includes: ['Transportation', 'Lunch', 'Beach Equipment'],
    image: '/assets/packages/beach-day.jpg'
  },
  {
    id: '2',
    title: 'Mountain Explorer',
    description: 'Discover the stunning mountains and levadas of Madeira with expert guides.',
    price: 30000000, // 0.3 BTC in satoshis
    duration: '2 Days',
    includes: ['Transportation', 'Accommodation', 'Meals', 'Guided Tours'],
    image: '/assets/packages/mountains.jpg'
  },
  {
    id: '3',
    title: 'Bitcoin Conference Package',
    description: 'All-inclusive package for the annual Bitcoin Madeira Conference.',
    price: 50000000, // 0.5 BTC in satoshis
    duration: '3 Days',
    includes: ['Conference Entry', 'Accommodation', 'Meals', 'Networking Events'],
    image: '/assets/packages/conference.jpg'
  }
];

// Generic fetch function with error handling
async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Special handling for packages endpoints that now use mock data
  if (endpoint === '/packages') {
    console.log('Using mock packages data instead of API call');
    return { packages: MOCK_PACKAGES } as unknown as T;
  }
  
  if (endpoint.startsWith('/packages/')) {
    const id = endpoint.split('/').pop();
    const mockPackage = MOCK_PACKAGES.find(p => p.id === id);
    
    if (mockPackage) {
      console.log(`Using mock data for package ${id}`);
      return { package: mockPackage } as unknown as T;
    } else {
      throw new Error(`Package with ID ${id} not found`);
    }
  }

  // For other endpoints, proceed with API call
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