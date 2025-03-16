import { NextResponse } from 'next/server';
import { TRAVEL_PACKAGES } from '@/lib/data';

// GET handler for a specific package by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const packageItem = TRAVEL_PACKAGES.find(p => p.id === params.id);
  
  if (!packageItem) {
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({ package: packageItem });
} 