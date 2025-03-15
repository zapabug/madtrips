import { SimplePool, nip19, Event } from 'nostr-tools';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { NOSTR_CONFIG, NodeType } from './config';

// Interface for graph visualization structure
interface VisNode {
  id: string;
  name?: string;
  type: NodeType;
  npub: string;
  picture?: string;
}

interface VisLink {
  source: string;
  target: string;
  value: number;
  type: string;
}

interface VisGraph {
  nodes: VisNode[];
  links: VisLink[];
  timestamp: number;
}

// Interfaces for our data structures
interface SocialGraphData {
  lastUpdated: number;
  members: {
    [pubkey: string]: {
      follows: string[];
      followers: string[];
      mentions: string[];
      zaps: {
        target: string;
        amount: number;
        timestamp: number;
      }[];
      likes: string[];
      reposts: string[];
      metadata?: {
        name?: string;
        displayName?: string;
        picture?: string;
        about?: string;
        nip05?: string;
      };
    }
  };
}

interface KnownNpubsData {
  lastUpdated: number;
  npubs: {
    [pubkey: string]: {
      group: 'freeMadeira' | 'agency' | 'other';
      firstSeen: number;
      lastSeen: number;
    }
  };
}

// Helper function to convert npub to hex pubkey
function npubToHex(npub: string): string | null {
  if (!npub || !npub.startsWith('npub1')) return null;
  
  try {
    const result = nip19.decode(npub);
    return result.type === 'npub' ? result.data : null;
  } catch (error) {
    console.error('Failed to decode npub:', error);
    return null;
  }
}

// Helper function to convert hex pubkey to npub
function hexToNpub(hex: string): string | null {
  if (!hex) return null;
  
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    console.error('Failed to encode hex to npub:', error);
    return null;
  }
}

// Helper to ensure our data directories exist
async function ensureDataDirectories() {
  try {
    await mkdir(path.dirname(NOSTR_CONFIG.socialGraphFile), { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }

  try {
    await readFile(NOSTR_CONFIG.socialGraphFile);
  } catch (error) {
    // Initialize empty social graph file
    const initialData: SocialGraphData = {
      lastUpdated: Date.now(),
      members: {}
    };
    await writeFile(NOSTR_CONFIG.socialGraphFile, JSON.stringify(initialData, null, 2));
  }
  
  try {
    await readFile(NOSTR_CONFIG.knownPubkeysFile);
  } catch (error) {
    // Initialize empty known npubs file with our initial known pubkeys
    const initialKnownNpubs: KnownNpubsData = {
      lastUpdated: Date.now(),
      npubs: {}
    };
    
    // Add initial npubs from config
    for (const npub of NOSTR_CONFIG.initialKnownNpubs) {
      const hex = npubToHex(npub);
      if (hex) {
        // Determine the group based on npub
        let group: 'freeMadeira' | 'agency' | 'other' = 'other';
        
        // Check if it's the Free Madeira npub
        if (npub === 'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e') {
          group = 'freeMadeira';
        } 
        // Check if it's the Madtrips agency npub
        else if (npub === 'npub1dxd02kcjhgpkyrx60qnkd6j42kmc72u5lum0rp2ud8x5zfhnk4zscjj6hh') {
          group = 'agency';
        }
        
        initialKnownNpubs.npubs[hex] = {
          group,
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      }
    }
    
    await writeFile(NOSTR_CONFIG.knownPubkeysFile, JSON.stringify(initialKnownNpubs, null, 2));
  }
}

// Load current social graph data
async function loadSocialGraphData(): Promise<SocialGraphData> {
  try {
    const data = await readFile(NOSTR_CONFIG.socialGraphFile, 'utf8');
    return JSON.parse(data) as SocialGraphData;
  } catch (error) {
    console.error('Error loading social graph data:', error);
    return { lastUpdated: 0, members: {} };
  }
}

// Load current known npubs data
async function loadKnownNpubsData(): Promise<KnownNpubsData> {
  try {
    const data = await readFile(NOSTR_CONFIG.knownPubkeysFile, 'utf8');
    return JSON.parse(data) as KnownNpubsData;
  } catch (error) {
    console.error('Error loading known npubs data:', error);
    return { lastUpdated: 0, npubs: {} };
  }
}

// Save updated social graph data
async function saveSocialGraphData(data: SocialGraphData) {
  try {
    data.lastUpdated = Date.now();
    await writeFile(NOSTR_CONFIG.socialGraphFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving social graph data:', error);
  }
}

// Save updated known npubs data
async function saveKnownNpubsData(data: KnownNpubsData) {
  try {
    data.lastUpdated = Date.now();
    await writeFile(NOSTR_CONFIG.knownPubkeysFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving known npubs data:', error);
  }
}

// Add a new npub to our known npubs
async function addKnownNpub(
  npub: string, 
  group: 'freeMadeira' | 'agency' | 'other' = 'other'
): Promise<boolean> {
  const hex = npubToHex(npub);
  if (!hex) return false;
  
  const knownNpubs = await loadKnownNpubsData();
  
  // Add or update the npub
  knownNpubs.npubs[hex] = {
    group,
    firstSeen: knownNpubs.npubs[hex]?.firstSeen || Date.now(),
    lastSeen: Date.now()
  };
  
  await saveKnownNpubsData(knownNpubs);
  return true;
}

// Fetch profile metadata (kind:0) for a specific pubkey
async function fetchProfileMetadata(pubkey: string): Promise<any> {
  const pool = new SimplePool();
  let metadata = null;
  
  try {
    // Using the subscribeMany method instead of list since list is not available in this version
    const metadataPromise = new Promise<any>((resolve) => {
      let foundMetadata: any = null;
      
      const subscription = pool.subscribeMany(NOSTR_CONFIG.defaultRelays, [{
        kinds: [0], // metadata
        authors: [pubkey],
        limit: 1
      }], {
        onevent(event: Event) {
          try {
            foundMetadata = JSON.parse(event.content);
          } catch (e) {
            console.error('Failed to parse profile metadata:', e);
          }
        },
        oneose() {
          setTimeout(() => {
            subscription.close();
            resolve(foundMetadata);
          }, 1000);
        }
      });
      
      // Set a timeout in case we don't get EOSE
      setTimeout(() => {
        subscription.close();
        resolve(foundMetadata);
      }, NOSTR_CONFIG.fetchTimeoutMs);
    });
    
    metadata = await metadataPromise;
    pool.close(NOSTR_CONFIG.defaultRelays);
    return metadata;
  } catch (error) {
    console.error('Error fetching profile metadata:', error);
    pool.close(NOSTR_CONFIG.defaultRelays);
    return null;
  }
}

// Fetch follows (kind:3) events from a specific pubkey
async function fetchFollows(pubkey: string): Promise<string[]> {
  const pool = new SimplePool();
  const follows: string[] = [];
  
  try {
    // Create a promise to handle the subscription
    const followsPromise = new Promise<string[]>((resolve) => {
      const subscription = pool.subscribeMany(NOSTR_CONFIG.defaultRelays, [
        {
          kinds: [3], // contacts/follows
          authors: [pubkey],
          limit: 1 // We just need the most recent one
        }
      ], {
        onevent(event: Event) {
          try {
            // Extract 'p' tags which contain followed pubkeys
            const followedPubkeys = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1]);
              
            follows.push(...followedPubkeys);
          } catch (e) {
            console.error('Failed to parse follows:', e);
          }
        },
        oneose() {
          // After EOSE (End of Stored Events)
          setTimeout(() => {
            subscription.close();
            resolve(follows);
          }, 1000); // Give it a second to receive any last events
        }
      });
      
      // Set a timeout in case we don't get EOSE
      setTimeout(() => {
        subscription.close();
        resolve(follows);
      }, NOSTR_CONFIG.fetchTimeoutMs);
    });
    
    // Wait for the promise to resolve
    const result = await followsPromise;
    pool.close(NOSTR_CONFIG.defaultRelays);
    return result;
    
  } catch (error) {
    console.error('Error fetching follows:', error);
    pool.close(NOSTR_CONFIG.defaultRelays);
    return [];
  }
}

// Fetch interactions (mentions, likes, reposts, zaps) related to a pubkey
async function fetchInteractions(pubkey: string, since: number = 0) {
  const pool = new SimplePool();
  const interactions = {
    mentions: [] as string[],
    likes: [] as string[],
    reposts: [] as string[],
    zaps: [] as { target: string, amount: number, timestamp: number }[]
  };
  
  try {
    // Create a promise to handle the subscription
    const interactionsPromise = new Promise<typeof interactions>((resolve) => {
      const subscription = pool.subscribeMany(NOSTR_CONFIG.defaultRelays, [
        {
          kinds: [1, 6, 7, 9735], // notes, reposts, likes, zaps
          '#p': [pubkey], // Events that reference this pubkey
          since: since > 0 ? since : undefined,
          limit: NOSTR_CONFIG.maxEventsPerRelay
        }
      ], {
        onevent(event: Event) {
          try {
            switch (event.kind) {
              case 1: // note/post
                // Add author to mentions
                interactions.mentions.push(event.pubkey);
                break;
                
              case 6: // repost
                // Add author to reposts
                interactions.reposts.push(event.pubkey);
                break;
                
              case 7: // like/reaction
                // Add author to likes
                interactions.likes.push(event.pubkey);
                break;
                
              case 9735: // zap
                // Try to parse zap amount from tags
                const amountTag = event.tags.find(tag => tag[0] === 'amount');
                if (amountTag && amountTag[1]) {
                  const amount = parseInt(amountTag[1], 10);
                  if (!isNaN(amount)) {
                    interactions.zaps.push({
                      target: pubkey,
                      amount: amount,
                      timestamp: event.created_at
                    });
                  }
                }
                break;
            }
          } catch (e) {
            console.error('Failed to parse interaction:', e);
          }
        },
        oneose() {
          // After EOSE (End of Stored Events)
          setTimeout(() => {
            subscription.close();
            resolve(interactions);
          }, 1000); // Give it a second to receive any last events
        }
      });
      
      // Set a timeout in case we don't get EOSE
      setTimeout(() => {
        subscription.close();
        resolve(interactions);
      }, NOSTR_CONFIG.fetchTimeoutMs);
    });
    
    // Wait for the promise to resolve
    const result = await interactionsPromise;
    pool.close(NOSTR_CONFIG.defaultRelays);
    return result;
    
  } catch (error) {
    console.error('Error fetching interactions:', error);
    pool.close(NOSTR_CONFIG.defaultRelays);
    return interactions;
  }
}

// Update social graph with new data
async function updateSocialGraph() {
  // Ensure data directories exist
  await ensureDataDirectories();
  
  // Load current data
  const socialGraph = await loadSocialGraphData();
  const knownNpubs = await loadKnownNpubsData();
  
  // Get Free Madeira members (those with group 'freeMadeira')
  const freeMadeiraMembers = Object.entries(knownNpubs.npubs)
    .filter(([_, data]) => data.group === 'freeMadeira')
    .map(([pubkey]) => pubkey);
    
  // Get agency pubkeys
  const agencyPubkeys = Object.entries(knownNpubs.npubs)
    .filter(([_, data]) => data.group === 'agency')
    .map(([pubkey]) => pubkey);
  
  // Process Free Madeira members
  for (const pubkey of freeMadeiraMembers) {
    console.log(`Processing Free Madeira member: ${pubkey}`);
    
    // Initialize member data if not exists
    if (!socialGraph.members[pubkey]) {
      socialGraph.members[pubkey] = {
        follows: [],
        followers: [],
        mentions: [],
        zaps: [],
        likes: [],
        reposts: []
      };
    }
    
    // Get profile metadata
    const metadata = await fetchProfileMetadata(pubkey);
    if (metadata) {
      socialGraph.members[pubkey].metadata = {
        name: metadata.name,
        displayName: metadata.display_name || metadata.displayName,
        picture: metadata.picture,
        about: metadata.about,
        nip05: metadata.nip05
      };
    }
    
    // Get follows
    const follows = await fetchFollows(pubkey);
    socialGraph.members[pubkey].follows = follows;
    
    // Add new pubkeys to known npubs
    for (const followedPubkey of follows) {
      if (!knownNpubs.npubs[followedPubkey]) {
        knownNpubs.npubs[followedPubkey] = {
          group: 'other',
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      } else {
        knownNpubs.npubs[followedPubkey].lastSeen = Date.now();
      }
      
      // Initialize followed member data if not exists
      if (!socialGraph.members[followedPubkey]) {
        socialGraph.members[followedPubkey] = {
          follows: [],
          followers: [],
          mentions: [],
          zaps: [],
          likes: [],
          reposts: []
        };
      }
      
      // Add follower
      if (!socialGraph.members[followedPubkey].followers.includes(pubkey)) {
        socialGraph.members[followedPubkey].followers.push(pubkey);
      }
    }
    
    // Fetch metadata for followed accounts if needed
    for (const followedPubkey of follows) {
      if (!socialGraph.members[followedPubkey].metadata) {
        const followedMetadata = await fetchProfileMetadata(followedPubkey);
        if (followedMetadata) {
          socialGraph.members[followedPubkey].metadata = {
            name: followedMetadata.name,
            displayName: followedMetadata.display_name || followedMetadata.displayName,
            picture: followedMetadata.picture,
            about: followedMetadata.about,
            nip05: followedMetadata.nip05
          };
        }
      }
    }
  }
  
  // Process agency interactions
  for (const pubkey of agencyPubkeys) {
    console.log(`Processing agency account: ${pubkey}`);
    
    // Initialize member data if not exists
    if (!socialGraph.members[pubkey]) {
      socialGraph.members[pubkey] = {
        follows: [],
        followers: [],
        mentions: [],
        zaps: [],
        likes: [],
        reposts: []
      };
    }
    
    // Get profile metadata
    const metadata = await fetchProfileMetadata(pubkey);
    if (metadata) {
      socialGraph.members[pubkey].metadata = {
        name: metadata.name,
        displayName: metadata.display_name || metadata.displayName,
        picture: metadata.picture,
        about: metadata.about,
        nip05: metadata.nip05
      };
    }
    
    // Calculate since timestamp (1 week ago)
    const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    
    // Get interactions
    const interactions = await fetchInteractions(pubkey, oneWeekAgo);
    
    // Update interactions
    for (const mentionPubkey of interactions.mentions) {
      if (!socialGraph.members[pubkey].mentions.includes(mentionPubkey)) {
        socialGraph.members[pubkey].mentions.push(mentionPubkey);
      }
      
      // Add to known npubs
      if (!knownNpubs.npubs[mentionPubkey]) {
        knownNpubs.npubs[mentionPubkey] = {
          group: 'other',
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      } else {
        knownNpubs.npubs[mentionPubkey].lastSeen = Date.now();
      }
    }
    
    for (const likePubkey of interactions.likes) {
      if (!socialGraph.members[pubkey].likes.includes(likePubkey)) {
        socialGraph.members[pubkey].likes.push(likePubkey);
      }
      
      // Add to known npubs
      if (!knownNpubs.npubs[likePubkey]) {
        knownNpubs.npubs[likePubkey] = {
          group: 'other',
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      } else {
        knownNpubs.npubs[likePubkey].lastSeen = Date.now();
      }
    }
    
    for (const repostPubkey of interactions.reposts) {
      if (!socialGraph.members[pubkey].reposts.includes(repostPubkey)) {
        socialGraph.members[pubkey].reposts.push(repostPubkey);
      }
      
      // Add to known npubs
      if (!knownNpubs.npubs[repostPubkey]) {
        knownNpubs.npubs[repostPubkey] = {
          group: 'other',
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      } else {
        knownNpubs.npubs[repostPubkey].lastSeen = Date.now();
      }
    }
    
    // Add zaps
    socialGraph.members[pubkey].zaps.push(...interactions.zaps);
  }
  
  // Save updated data
  await saveSocialGraphData(socialGraph);
  await saveKnownNpubsData(knownNpubs);
  
  return {
    socialGraph,
    knownNpubs
  };
}

// Convert social graph data to visualization format
function socialGraphToVisGraph(socialGraph: SocialGraphData, knownNpubs: KnownNpubsData): VisGraph {
  const nodes: VisNode[] = [];
  const links: VisLink[] = [];
  const nodeMap = new Map<string, boolean>();
  
  // Helper to determine node type
  function getNodeType(pubkey: string): NodeType {
    const npubData = knownNpubs.npubs[pubkey];
    if (!npubData) return NodeType.FOLLOWING;
    
    if (npubData.group === 'freeMadeira') {
      return NodeType.CORE;
    }
    
    // Check if it's mutual with any core member
    const member = socialGraph.members[pubkey];
    if (!member) return NodeType.FOLLOWING;
    
    const coreMembers = Object.entries(knownNpubs.npubs)
      .filter(([_, data]) => data.group === 'freeMadeira')
      .map(([pubkey]) => pubkey);
    
    // Check if this pubkey follows any core members
    const followsCore = member.follows.some(followedPubkey => coreMembers.includes(followedPubkey));
    
    // Check if this pubkey is followed by any core members
    const followedByCore = member.followers.some(followerPubkey => coreMembers.includes(followerPubkey));
    
    if (followsCore && followedByCore) {
      return NodeType.MUTUAL;
    } else if (followsCore) {
      return NodeType.FOLLOWER;
    } else if (followedByCore) {
      return NodeType.FOLLOWING;
    }
    
    return NodeType.FOLLOWING;
  }
  
  // Add nodes for each member
  Object.keys(socialGraph.members).forEach(pubkey => {
    if (nodeMap.has(pubkey)) return;
    
    const member = socialGraph.members[pubkey];
    let npub;
    try {
      npub = hexToNpub(pubkey) || 'unknown';
    } catch (e) {
      npub = 'unknown';
    }
    
    nodes.push({
      id: pubkey,
      name: member.metadata?.displayName || member.metadata?.name,
      npub,
      type: getNodeType(pubkey),
      picture: member.metadata?.picture
    });
    
    nodeMap.set(pubkey, true);
  });
  
  // Add links for follows
  Object.keys(socialGraph.members).forEach(pubkey => {
    const member = socialGraph.members[pubkey];
    
    member.follows.forEach(targetPubkey => {
      // Only add links where both nodes exist
      if (socialGraph.members[targetPubkey]) {
        links.push({
          source: pubkey,
          target: targetPubkey,
          value: 1,
          type: 'follows'
        });
      }
    });
  });
  
  return {
    nodes,
    links,
    timestamp: socialGraph.lastUpdated
  };
}

// API to get social graph data in visualization format
export async function getSocialGraphData(): Promise<VisGraph> {
  await ensureDataDirectories();
  const socialGraph = await loadSocialGraphData();
  const knownNpubs = await loadKnownNpubsData();
  
  return socialGraphToVisGraph(socialGraph, knownNpubs);
}

// API to get raw social graph data
export async function getRawSocialGraphData(): Promise<SocialGraphData> {
  await ensureDataDirectories();
  return await loadSocialGraphData();
}

// API to get known npubs data
export async function getKnownNpubsData(): Promise<KnownNpubsData> {
  await ensureDataDirectories();
  return await loadKnownNpubsData();
}

// API to force update the social graph
export async function forceSocialGraphUpdate(): Promise<VisGraph> {
  await updateSocialGraph();
  return await getSocialGraphData();
}

// Set up a scheduled update (can be called from a Next.js API route)
export async function setupScheduledUpdate(intervalInHours = 24) {
  // First update immediately
  await updateSocialGraph();
  
  // Then schedule regular updates
  setInterval(async () => {
    await updateSocialGraph();
  }, intervalInHours * 60 * 60 * 1000);
}

// Export interfaces for use in other components
export type { SocialGraphData, KnownNpubsData, VisGraph, VisNode, VisLink }; 

// Export utility functions
export { addKnownNpub }; 