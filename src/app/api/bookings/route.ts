import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import * as nostr from '@/lib/nostr';
import { 
  TRAVEL_PACKAGES, 
  getPaymentById, 
  updatePaymentStatus, 
  addBooking,
  Booking 
} from '@/lib/data';

// POST handler for creating a booking
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { packageId, nostrPubkey, invoice } = body;
    
    if (!packageId || !nostrPubkey || !invoice) {
      return NextResponse.json(
        { error: 'Missing required booking information' },
        { status: 400 }
      );
    }
    
    // Check if the package exists
    const packageItem = TRAVEL_PACKAGES.find(p => p.id === packageId);
    if (!packageItem) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }
    
    // Check if the payment exists
    const payment = getPaymentById(invoice);
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Create the booking
    const newBooking: Booking = {
      id: uuidv4(),
      packageId,
      packageTitle: packageItem.title,
      nostrPubkey,
      invoice,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Save the booking
    addBooking(newBooking);
    
    // Send confirmation via Nostr DM if payment is already complete
    if (payment.status === 'paid') {
      // Update booking status
      newBooking.status = 'confirmed';
      
      // Send a Nostr DM to confirm the booking
      await nostr.sendBookingConfirmation(
        {
          id: newBooking.id,
          nostrPubkey: newBooking.nostrPubkey,
          packageTitle: newBooking.packageTitle,
          createdAt: newBooking.createdAt
        },
        { amount: payment.amount }
      );
    }
    
    // Generate a Nostr proof of the booking
    const proof = nostr.generateNostrProof(newBooking.id);
    
    return NextResponse.json({
      id: newBooking.id,
      status: newBooking.status,
      proof
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
} 