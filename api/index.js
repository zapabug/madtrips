import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as lightning from './services/lightning.js';
import * as nostr from './services/nostr.js';

// Load environment variables
dotenv.config();

console.log('Starting MadTrips API server...');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8080;

console.log(`Using port: ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Static data for MVP phase
const TRAVEL_PACKAGES = [
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

// Simple in-memory storage for MVP
const bookings = [];
const payments = [];

// API Routes

// Health check
app.get('/', (req, res) => {
  res.send('MadTrips API is running!');
});

// API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Create a lightning payment invoice
app.post('/api/payments', async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description are required' });
    }
    
    // Create a Lightning invoice using LNBits
    const invoiceData = await lightning.createInvoice(amount, description);
    
    // Generate QR code for the invoice
    const qrCodeDataUrl = await QRCode.toDataURL(invoiceData.invoice);
    
    // Store payment in our simple database
    const newPayment = {
      id: invoiceData.id,
      invoice: invoiceData.invoice,
      amount,
      description,
      qrCode: qrCodeDataUrl,
      status: 'pending',
      expiry: Date.now() + 15 * 60 * 1000, // 15 minutes
      createdAt: new Date().toISOString()
    };
    
    payments.push(newPayment);
    
    res.json({
      id: invoiceData.id,
      invoice: invoiceData.invoice,
      qrCode: qrCodeDataUrl,
      expiry: newPayment.expiry
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Check payment status
app.get('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find payment in our database
    const payment = payments.find(p => p.id === id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Check payment status with LNBits
    const paymentStatus = await lightning.checkPayment(id);
    
    // Update payment status in our database
    if (paymentStatus.paid && payment.status !== 'paid') {
      payment.status = 'paid';
      payment.paidAt = new Date().toISOString();
    }
    
    res.json({
      id: payment.id,
      status: payment.status,
      paid: payment.status === 'paid',
      paidAt: payment.paidAt || null
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Create a booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { packageId, nostrPubkey, invoice } = req.body;
    
    if (!packageId || !nostrPubkey || !invoice) {
      return res.status(400).json({ error: 'Missing required booking information' });
    }
    
    // Check if the package exists
    const packageItem = TRAVEL_PACKAGES.find(p => p.id === packageId);
    if (!packageItem) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Check if the payment exists
    const payment = payments.find(p => p.invoice === invoice);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Check payment status with LNBits
    const paymentStatus = await lightning.checkPayment(payment.id);
    
    // Update payment status in our database
    if (paymentStatus.paid) {
      payment.status = 'paid';
      payment.paidAt = new Date().toISOString();
    } else {
      // For demo purposes, we'll accept unpaid bookings with a warning
      console.warn(`Creating booking with unpaid invoice: ${payment.id}. In production, this would require payment.`);
    }
    
    // Create booking
    const bookingId = uuidv4();
    const newBooking = {
      id: bookingId,
      packageId,
      packageTitle: packageItem.title,
      nostrPubkey,
      paymentId: payment.id,
      amount: payment.amount,
      status: paymentStatus.paid ? 'confirmed' : 'pending_payment',
      createdAt: new Date().toISOString()
    };
    
    bookings.push(newBooking);
    
    // Generate Nostr proof of booking
    const nostrProof = nostr.generateNostrProof(bookingId);
    
    // Send booking confirmation via Nostr DM
    if (newBooking.status === 'confirmed') {
      await nostr.sendBookingConfirmation(newBooking, payment);
    }
    
    res.json({
      bookingId,
      status: newBooking.status,
      message: paymentStatus.paid 
        ? 'Your booking has been confirmed! Check your Nostr client for details.' 
        : 'Booking created. Waiting for payment confirmation.',
      nostrProof
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get all bookings (admin endpoint, would need auth in real app)
app.get('/api/bookings', (req, res) => {
  res.json({ bookings });
});

// TESTING ONLY: Simulate a payment being completed
app.post('/api/simulate-payment/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find payment in our database
    const payment = payments.find(p => p.id === id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Mark the payment as paid
    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
    
    // Find any bookings with this payment and update them
    const relatedBookings = bookings.filter(b => b.paymentId === id);
    for (const booking of relatedBookings) {
      booking.status = 'confirmed';
      
      // Send booking confirmation via Nostr DM
      nostr.sendBookingConfirmation(booking, payment)
        .catch(err => console.error('Error sending Nostr confirmation:', err));
    }
    
    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        paidAt: payment.paidAt
      },
      updatedBookings: relatedBookings.map(b => ({
        id: b.id,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Payment simulation error:', error);
    res.status(500).json({ error: 'Failed to simulate payment' });
  }
});

// Start the server
try {
  app.listen(PORT, () => {
    console.log(`MadTrips API running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
} 