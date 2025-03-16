// Types
export interface TravelPackage {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  includes: string[];
  image: string;
}

export interface BitcoinBusiness {
  id: string;
  name: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  category: string;
  acceptsLightning: boolean;
  image: string;
}

export interface Booking {
  id: string;
  packageId: string;
  packageTitle: string;
  nostrPubkey: string;
  invoice: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface Payment {
  id: string;
  invoice: string;
  amount: number;
  description: string;
  qrCode: string;
  status: 'pending' | 'paid' | 'expired';
  expiry: number;
  createdAt: string;
  paidAt?: string;
}

// Static travel packages data
export const TRAVEL_PACKAGES: TravelPackage[] = [
  {
    id: 'pkg-001',
    title: 'Bitcoin Beach Day',
    description: 'Enjoy a full day at the beach with Bitcoin-friendly restaurants and activities.',
    price: 1, // sats (updated for demo)
    duration: '1 day',
    includes: ['Lunch at Bitcoin-accepting restaurant', 'Beach activities', 'Transportation'],
    image: '/assets/packages/beach-day.jpg'
  },
  {
    id: 'pkg-002',
    title: 'Madeira Mountains Adventure',
    description: 'Explore the beautiful mountains of Madeira with Bitcoin enthusiasts.',
    price: 2, // sats (updated for demo)
    duration: '2 days',
    includes: ['Hiking guide', 'Overnight stay', 'Meals', 'Transportation'],
    image: '/assets/packages/mountains.jpg'
  },
  {
    id: 'pkg-003',
    title: 'Bitcoin Conference Package',
    description: 'All-inclusive package for the next Bitcoin conference in Madeira.',
    price: 3, // sats (updated for demo)
    duration: '3 days',
    includes: ['Conference tickets', 'Accommodation', 'Meals', 'Networking events'],
    image: '/assets/packages/conference.jpg'
  },
  {
    id: 'pkg-004',
    title: 'Porto Santo Island Getaway',
    description: 'Explore the beautiful golden sand beaches of Porto Santo island with Bitcoin payments.',
    price: 4, // sats (updated for demo)
    duration: '2 days',
    includes: ['Ferry tickets', 'Accommodation', 'Beach equipment', 'Guided tour'],
    image: '/assets/packages/porto-santo.jpg'
  },
  {
    id: 'pkg-005',
    title: 'Madeira Food & Wine Tour',
    description: 'Experience the best of Madeira\'s cuisine and famous wines while paying with Bitcoin.',
    price: 5, // sats (updated for demo)
    duration: '1 day',
    includes: ['Wine tasting', 'Traditional lunch', 'Transportation', 'Professional guide'],
    image: '/assets/packages/food-tour.jpg'
  },
  {
    id: 'pkg-006',
    title: 'Levada Hiking Adventure',
    description: 'Hike Madeira\'s famous levada trails and waterfalls with Bitcoin enthusiasts.',
    price: 6, // sats (updated for demo)
    duration: '1 day',
    includes: ['Hiking guide', 'Lunch pack', 'Transportation', 'Safety equipment'],
    image: '/assets/packages/hiking.jpg'
  },
  {
    id: 'pkg-007',
    title: 'Bitcoin Art Gallery Tour',
    description: 'Visit Madeira\'s exclusive art galleries that accept Bitcoin payments.',
    price: 7, // sats (updated for demo)
    duration: '1 day',
    includes: ['Gallery admissions', 'Expert guide', 'Lunch', 'Transportation'],
    image: '/assets/packages/porto-santo.jpg'
  }
];

// Static bitcoin businesses data
export const BITCOIN_BUSINESSES: BitcoinBusiness[] = [
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

// In-memory storage (for server-side use only)
// In a production app, this would be replaced with a proper database
// or managed with server-side state management

// For API routes, we use a global object to persist data between requests
// Note: This is specific to the Next.js server-side environment and won't be exposed to clients
declare global {
  var _bookings: Booking[];
  var _payments: Payment[];
}

// Initialize the global storage if it doesn't exist
global._bookings = global._bookings || [];
global._payments = global._payments || [];

// Export getters and setters for bookings
export const getBookings = () => global._bookings;
export const addBooking = (booking: Booking) => {
  global._bookings.push(booking);
  return booking;
};
export const getBookingById = (id: string) => 
  global._bookings.find(booking => booking.id === id);
export const getBookingByInvoice = (invoice: string) => 
  global._bookings.find(booking => booking.invoice === invoice);
export const updateBookingStatus = (id: string, status: Booking['status']) => {
  const booking = getBookingById(id);
  if (booking) {
    booking.status = status;
    return booking;
  }
  return null;
};

// Export getters and setters for payments
export const getPayments = () => global._payments;
export const addPayment = (payment: Payment) => {
  global._payments.push(payment);
  return payment;
};
export const getPaymentById = (id: string) => 
  global._payments.find(payment => payment.id === id);
export const updatePaymentStatus = (id: string, status: Payment['status'], paidAt?: string) => {
  const payment = getPaymentById(id);
  if (payment) {
    payment.status = status;
    if (paidAt) {
      payment.paidAt = paidAt;
    }
    return payment;
  }
  return null;
}; 