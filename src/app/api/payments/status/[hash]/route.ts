import { NextRequest, NextResponse } from 'next/server';
import { getLightningService } from '../../../../../lib/services/LightningPaymentService';

// Get LNBits configuration from environment variables
const LNBITS_ENDPOINT = process.env.LNBITS_ENDPOINT || '';
const LNBITS_API_KEY = process.env.LNBITS_API_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    // Validate environment variables
    if (!LNBITS_ENDPOINT || !LNBITS_API_KEY) {
      return NextResponse.json(
        { error: 'Lightning payment service not configured' },
        { status: 500 }
      );
    }

    const { hash } = await params;

    // Validate payment hash
    if (!hash) {
      return NextResponse.json(
        { error: 'Missing payment hash' },
        { status: 400 }
      );
    }

    // Get Lightning service instance
    const lightningService = getLightningService(LNBITS_ENDPOINT, LNBITS_API_KEY);

    // Check payment status
    const status = await lightningService.checkPaymentStatus(hash);

    // Return status
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to check payment status:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
} 