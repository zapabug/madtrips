import { NextResponse } from 'next/server';
import { nip19 } from 'nostr-tools';
import { CORE_NPUBS } from '../../constants/nostr';
import { getNDKInstance } from '../../lib/nostr/ndk';

// Define minimal types for graph data
interface GraphNode {
  id: string;
  npub?: string;
  name?: string;
  picture?: string;
  type?: string;
  isCoreNode?: boolean;
  val?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  value?: number;
  type?: string;
  color?: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lastUpdated?: number;
}

const DEFAULT_PROFILE_IMAGE = '/assets/bitcoin.png';

export async function GET(request: Request) {
  try {
    // Check if update is requested
    const { searchParams } = new URL(request.url);
    const update = searchParams.get('update') === 'true';
    
    // Determine data path - use stored data if update not requested
    if (!update) {
      // Simple version: Return already processed data from the component's JSON
      try {
        // Try to import the existing data
        const staticData = await import('./socialgraph.json');
        return NextResponse.json({ 
          success: true, 
          data: staticData.default,
          source: 'static'
        });
      } catch (e) {
        // If no cached data exists, force a fresh fetch
        console.log('No static data found, fetching fresh data');
      }
    }
    
    // Initialize NDK
    const ndk = await getNDKInstance();
    if (!ndk) {
      return NextResponse.json(
        { error: 'Failed to initialize NDK' },
        { status: 500 }
      );
    }
    
    // Create placeholder graph with core nodes
    let graphData: GraphData = {
      nodes: [],
      links: [],
      lastUpdated: Date.now()
    };
    
    // Convert core npubs to hex
    const coreHexKeys = CORE_NPUBS.map(npub => {
      try {
        if (npub.startsWith('npub')) {
          const decoded = nip19.decode(npub);
          return decoded.data as string;
        }
        return npub;
      } catch (e) {
        return '';
      }
    }).filter(Boolean);
    
    // Add core nodes with placeholders
    for (const hexKey of coreHexKeys) {
      const npub = nip19.npubEncode(hexKey);
      graphData.nodes.push({
        id: hexKey,
        npub,
        name: npub.substring(0, 8) + '...',
        type: 'core',
        isCoreNode: true,
        val: 20,
        color: '#FFD700' // Gold color for core nodes
      });
    }
    
    // Return the graph data
    return NextResponse.json({ 
      success: true, 
      data: graphData,
      source: 'api'
    });
  } catch (error) {
    console.error('Error in social graph API:', error);
    return NextResponse.json(
      { error: 'Failed to process social graph data' },
      { status: 500 }
    );
  }
} 