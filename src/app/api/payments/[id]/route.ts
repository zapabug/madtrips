import { NextResponse } from 'next/server';
import * as lightning from '@/lib/lightning';
import { getPaymentById, updatePaymentStatus } from '@/lib/data';

// GET handler for checking payment status
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Find payment in our database
    const payment = getPaymentById(id);
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Check payment status with LNBits
    const paymentStatus = await lightning.checkPayment(id);
    
    // Update payment status in our database
    if (paymentStatus.paid && payment.status !== 'paid') {
      const now = new Date().toISOString();
      updatePaymentStatus(id, 'paid', now);
    }
    
    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      paid: payment.status === 'paid',
      paidAt: payment.paidAt || null
    });
  } catch (error: any) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
} 