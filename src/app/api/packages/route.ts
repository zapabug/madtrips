import { NextResponse } from 'next/server';
import { TRAVEL_PACKAGES } from '@/lib/data';

// GET handler for listing all packages
export async function GET() {
  return NextResponse.json({ packages: TRAVEL_PACKAGES });
} 