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
    // Ensure data directory exists
    await ensureDataDir();
    
    // Get URL params
    const url = new URL(request.url);
    const dataType = url.searchParams.get('type') || 'graph';
    const forceUpdate = url.searchParams.get('update') === 'true';
    const format = url.searchParams.get('format') || 'vis';
    
    if (forceUpdate) {
      // Force an update of the social graph data
      console.log('Forcing social graph update...');
      const result = await forceSocialGraphUpdate();
      return createCachedResponse({
        message: 'Social graph updated successfully', 
        timestamp: Date.now(),
        nodeCount: result.nodes.length,
        linkCount: result.links.length
      }, 200, 60); // Short cache for update requests
    }
    
    if (dataType === 'npubs') {
      // Return known npubs data
      console.log('Returning known npubs data...');
      const knownNpubs = await getKnownNpubsData();
      return createCachedResponse(knownNpubs, 200, 3600);
    } else if (dataType === 'raw' && format === 'raw') {
      // Return raw social graph data (for debugging)
      console.log('Returning raw social graph data...');
      const rawData = await getRawSocialGraphData();
      return createCachedResponse(rawData, 200, 3600);
    } else {
      // Return visualization-ready social graph data
      console.log('Returning visualization graph data...');
      const graphData = await getSocialGraphData();
      
      // Check if we have data
      if (!graphData.nodes || graphData.nodes.length === 0) {
        console.log('No nodes in graph data, triggering update...');
        // If no nodes, trigger an update and return what we have (may still be empty)
        forceSocialGraphUpdate().catch(e => console.error('Background update failed:', e));
        return createCachedResponse(graphData, 200, 60);
      }
      
      return createCachedResponse(graphData, 200, 3600);
    }
  } catch (error) {
    console.error('Error in social graph API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve social graph data' }, 
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