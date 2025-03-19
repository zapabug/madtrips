import { NextResponse } from 'next/server';
import { getLightningService } from '../../../../lib/services/LightningPaymentService';

// Get LNBits configuration from environment variables
const LNBITS_ENDPOINT = process.env.LNBITS_ENDPOINT || '';
const LNBITS_API_KEY = process.env.LNBITS_API_KEY || '';

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!LNBITS_ENDPOINT || !LNBITS_API_KEY) {
      return NextResponse.json(
        { error: 'Lightning payment service not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount, description } = body;

    // Validate request data
    if (!amount || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Lightning service instance
    const lightningService = getLightningService(LNBITS_ENDPOINT, LNBITS_API_KEY);

    // Create invoice
    const { paymentRequest, paymentHash } = await lightningService.createInvoice(
      amount,
      description
    );

    // Return payment details
    return NextResponse.json({
      payment_request: paymentRequest,
      payment_hash: paymentHash,
    });
  } catch (error) {
    console.error('Failed to create payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
} 