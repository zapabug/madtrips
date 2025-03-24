// Common utility functions for community components
import { nip19 } from 'nostr-tools';

// Core list of npubs that are central to the Free Madeira community
export const CORE_NPUBS = [
  'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh', // MadTrips
  'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e', // Free Madeira
  'npub1s0veng2gvfwr62acrxhnqexq76sj6ldg3a5t935jy8e6w3shr5vsnwrmq5', // Sovereign Individual
  'npub1funchalx8v747rsee6ahsuyrcd2s3rnxlyrtumfex9lecpmgwars6hq8kc', // Funchal
];

// Define the popular hashtags to highlight
export const POPULAR_HASHTAGS = [
  'bitcoin', 'madeira', 'funchal', 'travel', 
  'nostr', 'portugal', 'satoshi', 'freedom',
  'sovereignty', 'privacy', 'bitcoinbeach', 'bitcoinjungle'
];

/**
 * Strips links from the content
 */
export const stripLinks = (content: string): string => {
  // Remove HTTP/HTTPS links
  return content.replace(/https?:\/\/[^\s]+/g, '[link]');
};

/**
 * Extracts image URLs from the content
 */
export const extractImageUrls = (content: string): string[] => {
  const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
  const matches = content.match(imageRegex);
  return matches || [];
};

/**
 * Extracts hashtags from the content
 */
export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.matchAll(hashtagRegex);
  return Array.from(matches, m => m[1].toLowerCase());
};

// Graph data interfaces for shared use
export interface GraphNode {
  id: string;
  npub?: string;
  name?: string;
  picture?: string;
  isCoreNode?: boolean;
  val?: number;
  color?: string;
  // Optional position properties for force-directed layout
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value?: number;
  color?: string;
  type?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Process imported graph data to ensure it has all required fields
 */
export const processGraphData = (jsonData: any): GraphData => {
  // Default empty structure in case of errors
  if (!jsonData || !jsonData.nodes || !jsonData.links) {
    console.error('Invalid graph data structure', jsonData);
    return { nodes: [], links: [] };
  }

  try {
    // Map over nodes and ensure they have the required fields
    const processedNodes = jsonData.nodes.map((node: any) => ({
      id: node.id || `node-${Math.random().toString(36).substring(2, 9)}`,
      npub: node.npub || '',
      name: node.name || 'Unknown',
      picture: node.picture || '/assets/bitcoin.png',
      isCoreNode: node.type === 'core' || (node.npub && CORE_NPUBS.includes(node.npub)),
      val: node.isCoreNode ? 15 : 5,
      color: node.isCoreNode ? '#f7931a' : '#efddcc',
    }));

    // Process links
    const processedLinks = jsonData.links.map((link: any) => ({
      source: typeof link.source === 'string' ? link.source : link.source?.id || '',
      target: typeof link.target === 'string' ? link.target : link.target?.id || '',
      value: link.value || 1,
      color: link.type === 'mutual' ? '#f7931a' : '#efddcc99',
      type: link.type,
    }));

    // Return the processed data
    return {
      nodes: processedNodes,
      links: processedLinks
    };
  } catch (error) {
    console.error('Error processing graph data:', error);
    return { nodes: [], links: [] };
  }
};

// Profile cache TTL in milliseconds
export const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes 