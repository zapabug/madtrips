import { NextResponse } from 'next/server';
import { 
  getSocialGraphData, 
  getRawSocialGraphData,
  getKnownNpubsData, 
  forceSocialGraphUpdate,
  addKnownNpub,
  VisGraph
} from '@/lib/nostr/NostrSocialGraphFetcher';
import { mkdir } from 'fs/promises';
import path from 'path';

// Ensure the data directory exists
async function ensureDataDir() {
  try {
    await mkdir(path.join(process.cwd(), 'data'), { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Helper to create a response with cache headers
function createCachedResponse(data: any, status: number = 200, cacheTime: number = 3600) {
  return NextResponse.json(data, { 
    status,
    headers: {
      'Cache-Control': `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`,
      'Content-Type': 'application/json',
    },
  });
}

// GET handler for retrieving social graph data
export async function GET(request: Request) {
  try {
    const data = await getSocialGraphData();
    console.log('API returning data:', data); // Debug log
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social graph' },
      { status: 500 }
    );
  }
}

// POST handler for adding a new npub to tracking
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    
    if (!body.npub || !body.npub.startsWith('npub1')) {
      return NextResponse.json(
        { error: 'Missing or invalid npub parameter' }, 
        { status: 400 }
      );
    }
    
    // Determine group based on the npub
    let group: 'freeMadeira' | 'agency' | 'other' = 'other';
    
    // Check if it's the Free Madeira npub
    if (body.npub === 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e') {
      group = 'freeMadeira';
    } 
    // Check if it's the Madtrips agency npub
    else if (body.npub === 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh') {
      group = 'agency';
    }
    // Allow explicitly setting the group
    else if (body.group && ['freeMadeira', 'agency', 'other'].includes(body.group)) {
      group = body.group as 'freeMadeira' | 'agency' | 'other';
    }
    
    // Add the npub to our known npubs with the determined group
    const added = await addKnownNpub(body.npub, group);
    
    if (!added) {
      return NextResponse.json(
        { error: 'Failed to add npub' }, 
        { status: 400 }
      );
    }
    
    // Force an update after adding the npub
    await forceSocialGraphUpdate();
    
    return NextResponse.json(
      { 
        message: 'Social graph updated with new npub', 
        timestamp: Date.now(),
        npub: body.npub,
        group
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in social graph API:', error);
    return NextResponse.json(
      { error: 'Failed to update social graph data' }, 
      { status: 500 }
    );
  }
} 