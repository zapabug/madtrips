import { NextResponse } from 'next/server';
import { BITCOIN_BUSINESSES } from '@/lib/data';

// GET handler for listing all Bitcoin businesses
export async function GET() {
  return NextResponse.json({ businesses: BITCOIN_BUSINESSES });
} 