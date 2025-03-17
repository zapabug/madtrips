// Decentralized data utilities for MadTrips

import { NostrStorage } from './nostr-storage';

// Static data for packages
const PACKAGES = [
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

// Static data for businesses
const BUSINESSES = [
  {
    id: 'biz-001',
    name: 'Bitcoin Beach Bar',
    description: 'Beachfront bar accepting Bitcoin and Lightning payments.',
    location: { lat: 32.6451, lng: -16.9141 },
    category: 'Food & Drink',
    acceptsLightning: true,
    image: '/assets/businesses/beach-bar.jpg'
  },
  {
    id: 'biz-002',
    name: 'Satoshi Coffee',
    description: 'Specialty coffee shop with Bitcoin payments and regular meetups.',
    location: { lat: 32.6506, lng: -16.9084 },
    category: 'Food & Drink',
    acceptsLightning: true,
    image: '/assets/businesses/coffee-shop.jpg'
  },
  {
    id: 'biz-003',
    name: 'Bitcoin Surf School',
    description: 'Learn to surf while paying with Bitcoin.',
    location: { lat: 32.6442, lng: -16.9327 },
    category: 'Activities',
    acceptsLightning: false,
    image: '/assets/businesses/surf-school.jpg'
  }
];

// Create a singleton instance of NostrStorage
const nostrStorage = new NostrStorage();

// API functions using decentralized approach
export const api = {
  // Travel packages
  async getPackages() {
    console.log('Fetching packages (static data)');
    return { packages: PACKAGES };
  },
  
  async getPackage(id: string) {
    console.log(`Fetching package ${id} (static data)`);
    const packageItem = PACKAGES.find(p => p.id === id);
    if (!packageItem) {
      throw new Error(`Package with ID ${id} not found`);
    }
    return { package: packageItem };
  },
  
  // Businesses
  async getBusinesses() {
    console.log('Fetching businesses (static data)');
    return { businesses: BUSINESSES };
  },

  // Payments
  async createPayment(amount: number, description: string, pubkey: string) {
    console.log(`Creating payment of ${amount} sats for: ${description}`);
    
    // In a real implementation, this would integrate with LNBits, BTCPay, etc.
    // For now, we'll simulate the creation of a Lightning invoice
    
    // Create a simple invoice ID
    const id = `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Create a mock BOLT11 invoice (in production, this would come from a real Lightning node)
    const invoice = `lnbc${amount}n1pj${Math.random().toString(36).substring(2, 10)}qqqqqqqqqqqqqqq`;
    
    // In a real implementation, we'd generate a QR code from the invoice
    const qrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
    
    // Store payment details in Nostr if user is authenticated
    if (pubkey) {
      const paymentData = {
        id,
        amount,
        description,
        invoice,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // We'd store this payment in the user's Nostr data
      // For now, we'll just log it
      console.log('Storing payment data in Nostr', pubkey, paymentData);
    }
    
    return {
      id,
      invoice,
      qrCode,
      expiry: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
  },
  
  async checkPaymentStatus(paymentId: string) {
    console.log(`Checking payment status for ${paymentId}`);
    
    // In a real implementation, this would check the status with a Lightning node
    // For now, we'll simulate a successful payment
    
    // Randomly determine if the payment was successful (80% chance)
    const paid = Math.random() < 0.8;
    
    return {
      id: paymentId,
      status: paid ? 'paid' : 'pending',
      paid,
      paidAt: paid ? new Date().toISOString() : null
    };
  },

  // Bookings
  async createBooking(data: { packageId: string; nostrPubkey: string; invoice: string }) {
    console.log(`Creating booking for package ${data.packageId} by ${data.nostrPubkey}`);
    
    // Generate a booking ID
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Find the package
    const packageItem = PACKAGES.find(p => p.id === data.packageId);
    if (!packageItem) {
      throw new Error(`Package with ID ${data.packageId} not found`);
    }
    
    // Create booking data
    const bookingData = {
      id: bookingId,
      packageId: data.packageId,
      packageTitle: packageItem.title,
      nostrPubkey: data.nostrPubkey,
      invoice: data.invoice,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    
    // In a real implementation, this would be stored in the user's Nostr data
    // For now, we'll just log it
    console.log('Booking created:', bookingData);
    
    return {
      bookingId,
      status: 'confirmed',
      message: `Your booking for ${packageItem.title} has been confirmed!`
    };
  },
  
  // User data (stored in Nostr)
  async getUserData(pubkey: string) {
    if (!pubkey) {
      throw new Error('Public key is required to get user data');
    }
    
    try {
      // Get user selections from Nostr
      const selections = await nostrStorage.getUserSelections(pubkey);
      
      // Get cart from Nostr
      const cart = await nostrStorage.getCart(pubkey);
      
      // Get saved packages from Nostr
      const savedPackages = await nostrStorage.getSavedPackages(pubkey);
      
      return {
        selections,
        cart,
        savedPackages
      };
    } catch (error: any) {
      console.error('Error getting user data from Nostr:', error);
      throw new Error(`Failed to get user data: ${error.message}`);
    }
  },
  
  async saveUserData(pubkey: string, data: any) {
    if (!pubkey) {
      throw new Error('Public key is required to save user data');
    }
    
    try {
      // Store user selections in Nostr if provided
      if (data.selections) {
        await nostrStorage.storeUserSelections(pubkey, data.selections);
      }
      
      // Store cart in Nostr if provided
      if (data.cart) {
        await nostrStorage.storeCart(pubkey, data.cart);
      }
      
      // Store saved packages in Nostr if provided
      if (data.savedPackages) {
        await nostrStorage.storeSavedPackages(pubkey, data.savedPackages);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error saving user data to Nostr:', error);
      throw new Error(`Failed to save user data: ${error.message}`);
    }
  }
}; 