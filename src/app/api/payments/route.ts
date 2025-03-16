import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import * as lightning from '@/lib/lightning';
import { addPayment } from '@/lib/data';
import { Payment } from '@/lib/data';

// POST handler for creating a payment invoice
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, description } = body;
    
    if (!amount || !description) {
      return NextResponse.json(
        { error: 'Amount and description are required' },
        { status: 400 }
      );
    }
    
    // Create a Lightning invoice
    const invoiceData = await lightning.createInvoice(amount, description);
    
    // Store payment in our simple database
    const newPayment: Payment = {
      id: invoiceData.id,
      invoice: invoiceData.invoice,
      amount,
      description,
      qrCode: invoiceData.qrCode || '',
      status: 'pending',
      expiry: Date.now() + 15 * 60 * 1000, // 15 minutes
      createdAt: new Date().toISOString()
    };
    
    addPayment(newPayment);
    
    return NextResponse.json({
      id: invoiceData.id,
      invoice: invoiceData.invoice,
      qrCode: invoiceData.qrCode,
      expiry: newPayment.expiry
    });
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
} 