import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNostr } from '../lib/contexts/NostrContext';
import { useWOTFollows, WOTEntry } from './useWOTFollows'; // Assuming WOTEntry is exported
import { useLiteProfiles } from './useLiteProfiles';
import { LiteProfile } from '../types/lite-nostr';
import { NDKUser } from '@nostr-dev-kit/ndk';

// Basic Graph Types (Define or import appropriately)
interface NodeObject {
  id: string; // npub
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  relevanceScore?: number;
  // Add other properties needed for visualization
}

interface LinkObject {
  source: string; // source npub
  target: string; // target npub
}

interface GraphData {
  nodes: NodeObject[];
  links: LinkObject[];
}

interface UseSimpleWOTGraphResult {
  graphData: GraphData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Creates a simple graph structure based on follows data from useWOTFollows.
 * Fetches profiles for involved nodes.
 * @param inputNpubs - The initial list of npubs to build the graph around.
 */
export function useSimpleWOTGraph(inputNpubs: string[]): UseSimpleWOTGraphResult {
  const { ndk, ndkReady } = useNostr();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  // 1. Fetch WOT Data for input npubs
  const { wot: wotMap, loading: wotLoading } = useWOTFollows(inputNpubs);

  // 2. Identify all involved npubs (input + followed)
  const involvedNpubs = useMemo(() => {
    if (!ndkReady || !ndk || wotLoading || !wotMap) return [];

    const allInvolved = new Set<string>(inputNpubs);
    const followedHexSet = new Set<string>();

    wotMap.forEach(entry => {
      entry.follows.forEach(hex => followedHexSet.add(hex));
    });

    // Convert followed hex pubkeys to npubs
    followedHexSet.forEach(hex => {
      try {
        const user = ndk.getUser({ pubkey: hex });
        if (user.npub) {
          allInvolved.add(user.npub);
        }
      } catch (e) {
        // Ignore errors during conversion
      }
    });

    return Array.from(allInvolved);
  }, [inputNpubs, wotMap, wotLoading, ndk, ndkReady]);

  // 3. Fetch Profiles for all involved npubs
  const { profiles: profilesMap, loading: profilesLoading } = useLiteProfiles({
    npubs: involvedNpubs,
    batchSize: 20 // Adjust batch size as needed
  });

  // 4. Build Graph Structure
  useEffect(() => {
    if (wotLoading || profilesLoading || !ndkReady || !ndk || !wotMap || !profilesMap) {
      // Don't build graph if still loading or dependencies missing
      return;
    }

    setInternalLoading(true);
    setError(null);

    try {
      const nodes: NodeObject[] = [];
      const nodeMap = new Map<string, NodeObject>(); // For quick lookup
      const links: LinkObject[] = [];

      // Create Nodes
      involvedNpubs.forEach(npub => {
        const profile = profilesMap.get(npub);
        const wotEntry = wotMap.get(npub); // Check if it was an input npub

        const node: NodeObject = {
          id: npub,
          pubkey: profile?.pubkey || '',
          name: profile?.name,
          displayName: profile?.displayName || profile?.name,
          picture: profile?.picture,
          relevanceScore: wotEntry?.relevanceScore // Only add score if it was an input npub
        };
        nodes.push(node);
        nodeMap.set(npub, node);
      });

      // Create Links
      wotMap.forEach((entry, sourceNpub) => {
        entry.follows.forEach(targetHex => {
          try {
            const targetUser = ndk.getUser({ pubkey: targetHex });
            const targetNpub = targetUser.npub;

            // Ensure both source and target nodes exist before creating link
            if (targetNpub && nodeMap.has(sourceNpub) && nodeMap.has(targetNpub)) {
              links.push({ source: sourceNpub, target: targetNpub });
            }
          } catch (e) {
             // Ignore errors during conversion
          }
        });
      });

      setGraphData({ nodes, links });

    } catch (err) {
        console.error("Error building graph data:", err);
        setError("Failed to build graph structure.");
        setGraphData(null);
    } finally {
        setInternalLoading(false);
    }

  }, [wotMap, profilesMap, involvedNpubs, wotLoading, profilesLoading, ndk, ndkReady]);

  const loading = wotLoading || profilesLoading || internalLoading;

  return { graphData, loading, error };
}

export default useSimpleWOTGraph; 