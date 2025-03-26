import { NextResponse } from 'next/server';
import { generateInvoice } from '@/lib/services/LightningService';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { amount, option, lnAddress1, lnAddress2, split } = data;
    
    if (!amount || !option || !lnAddress1) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Generate actual invoice using Lightning Network
    const invoiceResponse = await generateInvoice({
      amount,
      split,
      lnAddress1,
      lnAddress2
    });
    
    if (!invoiceResponse.success) {
      return NextResponse.json(
        { error: invoiceResponse.error || 'Failed to generate invoice' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ invoice: invoiceResponse.invoice });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 