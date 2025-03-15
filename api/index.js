import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { generatePrivateKey, getPublicKey } from 'nostr-tools';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static data for MVP phase
const TRAVEL_PACKAGES = [
  {
    id: 'pkg-001',
    title: 'Bitcoin Beach Day',
    description: 'Enjoy a full day at the beach with Bitcoin-friendly restaurants and activities.',
    price: 100000, // sats
    duration: '1 day',
    includes: ['Lunch at Bitcoin-accepting restaurant', 'Beach activities', 'Transportation'],
    image: '/assets/packages/beach-day.jpg'
  },
  {
    id: 'pkg-002',
    title: 'Madeira Mountains Adventure',
    description: 'Explore the beautiful mountains of Madeira with Bitcoin enthusiasts.',
    price: 250000, // sats
    duration: '2 days',
    includes: ['Hiking guide', 'Overnight stay', 'Meals', 'Transportation'],
    image: '/assets/packages/mountains.jpg'
  },
  {
    id: 'pkg-003',
    title: 'Bitcoin Conference Package',
    description: 'All-inclusive package for the next Bitcoin conference in Madeira.',
    price: 500000, // sats
    duration: '3 days',
    includes: ['Conference tickets', 'Accommodation', 'Meals', 'Networking events'],
    image: '/assets/packages/conference.jpg'
  }
];

const BITCOIN_BUSINESSES = [
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

// API Routes

// Health check
app.get('/', (req, res) => {
  res.send('MadTrips API is running!');
});

// Get all travel packages
app.get('/api/packages', (req, res) => {
  res.json({ packages: TRAVEL_PACKAGES });
});

// Get package by ID
app.get('/api/packages/:id', (req, res) => {
  const packageItem = TRAVEL_PACKAGES.find(p => p.id === req.params.id);
  if (!packageItem) {
    return res.status(404).json({ error: 'Package not found' });
  }
  res.json({ package: packageItem });
});

// Get all Bitcoin businesses
app.get('/api/businesses', (req, res) => {
  res.json({ businesses: BITCOIN_BUSINESSES });
});

// Mock payment - generate a "Lightning invoice" (just a demo QR code for MVP)
app.post('/api/pay', async (req, res) => {
  const { amount, memo } = req.body;
  
  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }
  
  // Generate a dummy invoice (for MVP demonstration)
  const dummyInvoice = `lnbc${amount}n1pjq53s9pp5ennyd3cx5ezlpzd35h0g8xk0g5tippaqh7dlcz5h2an9g6nfq3fsdqqcqzzsxqyz5vqsp54h0zuxwg98w0kslrp6a77jvkz6g88klf85x6lge79l52jph8v5lq9qyyssqnfz47tq0jeapcxky3c0hfeg9g5azsrqknnkw5p08wf07jy3kyl7ppn3mmj4n5ewk3yqyt9zlj9g04s5te7wrmwkgms7lhwn7gjhwrycp9ygl7l`;
  
  try {
    // Generate QR code for the dummy invoice
    const qrCode = await QRCode.toDataURL(dummyInvoice);
    
    // For MVP, we'll just return a success response with the QR code
    // In a real implementation, this would integrate with LNBits or BTCPay
    res.json({
      success: true,
      invoice: dummyInvoice,
      qrCode,
      amount,
      memo: memo || 'MadTrips Booking',
      expiry: Date.now() + 15 * 60 * 1000 // 15 minutes from now
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// Simulate booking completion
app.post('/api/bookings', (req, res) => {
  const { packageId, name, email, invoice } = req.body;
  
  if (!packageId || !name) {
    return res.status(400).json({ error: 'Package ID and name are required' });
  }
  
  // For MVP, we'll just return a success response
  // In a real implementation, this would store the booking in Blossom
  res.json({
    success: true,
    bookingId: `booking-${Date.now()}`,
    packageId,
    name,
    email,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`MadTrips API running on http://localhost:${PORT}`);
}); 