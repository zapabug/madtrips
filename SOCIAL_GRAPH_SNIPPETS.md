# Social Graph Implementation Snippets

## Core Types (types/graph-types.ts)
```typescript
export interface GraphNode {
  id: string;
  pubkey: string;
  npub: string;
  name: string;
  picture?: string;
  isCoreNode: boolean;
  isSecondDegree?: boolean;
  val?: number;
  color?: string;
}

export interface GraphLink {
  id?: string;
  source: string;
  target: string;
  type: 'follows' | 'mutual';
  value: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lastUpdated: number;
}
```

## Safe Array Utilities (utils/arrayUtils.ts)
```typescript
export const safeArrayLimit = <T>(arr: T[] | undefined | null, maxLength = 10000): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  if (arr.length > safeMaxLength) {
    console.warn(`Array exceeded limit (${arr.length}), truncating to ${safeMaxLength}`);
    return arr.slice(0, safeMaxLength);
  }
  return [...arr];
};

export const safeMergeArrays = <T>(
  arrayA: T[] | undefined | null, 
  arrayB: T[] | undefined | null, 
  maxLength = 10000
): T[] => {
  const a = safeArrayLimit(arrayA, maxLength);
  const b = safeArrayLimit(arrayB, maxLength);
  const safeMaxLength = Math.max(1, Math.min(10000, Math.floor(maxLength)));
  
  const totalLength = a.length + b.length;
  if (totalLength > safeMaxLength) {
    const availableSpace = Math.max(0, safeMaxLength - a.length);
    return [...a, ...b.slice(0, availableSpace)];
  }
  return [...a, ...b];
};
```

## Cache Service (services/CacheService.ts)
```typescript
export class CacheService {
  private static instance: CacheService;
  private profileCache: Map<string, NostrProfile>;
  private graphCache: Map<string, GraphData>;
  
  private constructor() {
    this.profileCache = new Map();
    this.graphCache = new Map();
  }
  
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  getCachedProfile(npub: string): NostrProfile | undefined {
    return this.profileCache.get(npub);
  }
  
  setCachedProfile(npub: string, profile: NostrProfile): void {
    this.profileCache.set(npub, profile);
  }
  
  getCachedGraph(npubs: string[], showSecondDegree: boolean): GraphData | undefined {
    const key = this.createGraphCacheKey(npubs, showSecondDegree);
    return this.graphCache.get(key);
  }
  
  setCachedGraph(npubs: string[], showSecondDegree: boolean, graph: GraphData): void {
    const key = this.createGraphCacheKey(npubs, showSecondDegree);
    this.graphCache.set(key, graph);
  }
  
  private createGraphCacheKey(npubs: string[], showSecondDegree: boolean): string {
    return `${npubs.sort().join(',')}_${showSecondDegree}`;
  }
  
  clearCache(): void {
    this.profileCache.clear();
    this.graphCache.clear();
  }
}
```

## Relay Service (services/RelayService.ts)
```typescript
import { NDKRelay } from '@nostr-dev-kit/ndk';

export class RelayService {
  private static instance: RelayService;
  private ndk: NDK | null = null;
  private connectedRelays: Set<NDKRelay> = new Set();
  private statusListeners: ((relays: NDKRelay[]) => void)[] = [];
  
  static getInstance(): RelayService {
    if (!RelayService.instance) {
      RelayService.instance = new RelayService();
    }
    return RelayService.instance;
  }
  
  async initialize(relayUrls: string[]): Promise<void> {
    try {
      this.ndk = new NDK({
        explicitRelayUrls: relayUrls,
        enableOutboxModel: false
      });
      
      await this.ndk.connect();
      this.updateConnectedRelays();
    } catch (error) {
      console.error('Failed to initialize NDK:', error);
    }
  }
  
  getNDK(): NDK | null {
    return this.ndk;
  }
  
  getConnectedRelays(): NDKRelay[] {
    return Array.from(this.connectedRelays);
  }
  
  onStatusUpdate(callback: (relays: NDKRelay[]) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }
  
  private updateConnectedRelays(): void {
    if (!this.ndk) return;
    
    const connected = this.ndk.pool?.relays.filter(r => r.status === 1) || [];
    this.connectedRelays = new Set(connected);
    this.notifyListeners();
  }
  
  private notifyListeners(): void {
    const relays = Array.from(this.connectedRelays);
    this.statusListeners.forEach(callback => callback(relays));
  }
}
```

## Social Graph Hook (hooks/useSocialGraph.ts)
```typescript
export const useSocialGraph = ({
  npubs,
  centerNpub,
  maxConnections = 25,
  showSecondDegree = false,
  maxSecondDegreeNodes = 50,
}: UseSocialGraphProps): UseSocialGraphResult => {
  // ... Previous state and ref declarations ...

  const fetchProfiles = useCallback(async (nodes: GraphNode[]): Promise<GraphNode[]> => {
    if (!ndkReady || !nodes?.length) return [];
    
    const safeNodes = safeArrayLimit(nodes, 500);
    const result = safeNodes.map(node => ({...node}));
    
    for (const node of safeNodes) {
      if (!node.name || node.name === shortenNpub(node.npub || '')) {
        try {
          const profile = await getUserProfile(node.npub);
          if (profile) {
            const index = result.findIndex(n => n.id === node.id);
            if (index !== -1) {
              result[index] = {
                ...node,
                name: profile.displayName || profile.name || shortenNpub(node.npub || ''),
                picture: profile.picture || DEFAULT_PROFILE_IMAGE
              };
            }
          }
        } catch (e) {
          console.warn(`Error fetching profile: ${node.npub}`, e);
        }
      }
    }
    
    return result.filter(Boolean);
  }, [getUserProfile, shortenNpub, ndkReady]);

  const buildGraph = useCallback(async () => {
    if (!ndkReady) return null;
    
    const coreNodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    
    // Process core nodes
    for (const npub of npubs) {
      try {
        const { data: pubkey } = nip19.decode(npub);
        coreNodes.push({
          id: pubkey,
          pubkey,
          npub,
          name: shortenNpub(npub),
          picture: DEFAULT_PROFILE_IMAGE,
          isCoreNode: true
        });
      } catch (e) {
        console.warn(`Invalid npub: ${npub}`, e);
      }
    }
    
    // Fetch profiles and process connections
    const nodesWithProfiles = await fetchProfiles(coreNodes);
    
    // Process connections
    for (const node of nodesWithProfiles) {
      const contacts = await fetchNodeContacts(node.pubkey);
      for (const contact of contacts) {
        const targetNode = nodesWithProfiles.find(n => n.pubkey === contact);
        if (targetNode) {
          links.push({
            source: node.id,
            target: targetNode.id,
            type: 'follows',
            value: 1
          });
        }
      }
    }
    
    return {
      nodes: nodesWithProfiles,
      links,
      lastUpdated: Date.now()
    };
  }, [npubs, fetchProfiles, fetchNodeContacts, shortenNpub, ndkReady]);

  // ... Rest of the implementation ...
};
```

## Future Improvements

1. Performance Optimizations:
   - Implement WebWorker for graph calculations
   - Use IndexedDB for caching instead of in-memory
   - Implement virtual scrolling for large graphs
   - Add lazy loading for profile images

2. Reliability Improvements:
   - Add retry mechanisms for failed relay connections
   - Implement fallback relay strategy
   - Add timeout handling for slow relays
   - Implement circuit breaker pattern for API calls

3. Feature Enhancements:
   - Add graph layout algorithms
   - Implement zoom and pan controls
   - Add search and filter capabilities
   - Add graph analytics and metrics
   - Implement node clustering for large graphs

4. Data Management:
   - Implement proper garbage collection for cache
   - Add data versioning for cache invalidation
   - Implement progressive loading of graph data
   - Add data compression for cached items

5. User Experience:
   - Add loading states and progress indicators
   - Implement error recovery mechanisms
   - Add tooltips and context menus
   - Implement graph export/import functionality

6. Testing:
   - Add unit tests for core functions
   - Add integration tests for relay interactions
   - Add performance benchmarks
   - Implement E2E tests for graph visualization

## Implementation Notes

1. Error Handling:
   - Always validate input data
   - Implement proper error boundaries
   - Log errors with context
   - Provide user feedback for errors

2. State Management:
   - Use proper state initialization
   - Implement proper cleanup
   - Handle component unmounting
   - Manage memory usage

3. Data Flow:
   - Implement proper data validation
   - Use proper data transformation
   - Implement proper data caching
   - Handle data updates efficiently

4. Component Structure:
   - Keep components focused
   - Implement proper prop drilling
   - Use proper component composition
   - Implement proper event handling

5. Security:
   - Validate all input data
   - Implement proper sanitization
   - Handle sensitive data properly
   - Implement proper access control

## Graph Visualization Component (components/SocialGraphVisualization.tsx)
```typescript
import React, { useRef, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphNode, GraphLink, GraphData } from '../types/graph-types';
import { BRAND_COLORS } from '../constants/brandColors';

interface SocialGraphVisualizationProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  selectedNode?: GraphNode | null;
}

export const SocialGraphVisualization: React.FC<SocialGraphVisualizationProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  selectedNode
}) => {
  const graphRef = useRef<any>();
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);
  
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    if (onNodeHover) {
      onNodeHover(node);
    }
    
    if (graphRef.current) {
      graphRef.current.centerAt(
        node?.x,
        node?.y,
        1000
      );
      if (node) {
        graphRef.current.zoom(2.5, 1000);
      }
    }
  }, [onNodeHover]);
  
  useEffect(() => {
    if (graphRef.current && selectedNode) {
      const node = data.nodes.find(n => n.id === selectedNode.id);
      if (node) {
        graphRef.current.centerAt(
          node.x,
          node.y,
          1000
        );
        graphRef.current.zoom(2.5, 1000);
      }
    }
  }, [selectedNode, data.nodes]);
  
  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={data}
      nodeLabel={node => (node as GraphNode).name}
      nodeColor={node => 
        (node as GraphNode).isCoreNode 
          ? BRAND_COLORS.bitcoinOrange 
          : BRAND_COLORS.lightSand
      }
      nodeVal={node => (node as GraphNode).val || 3}
      linkColor={link => 
        (link as GraphLink).type === 'mutual'
          ? BRAND_COLORS.bitcoinOrange
          : BRAND_COLORS.lightSand + '99'
      }
      linkWidth={link => (link as GraphLink).value || 1}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      width={width}
      height={height}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const label = (node as GraphNode).name;
        const fontSize = 12/globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = (node as GraphNode).isCoreNode 
          ? BRAND_COLORS.bitcoinOrange 
          : BRAND_COLORS.lightSand;
        ctx.fillText(label, node.x!, node.y!);
      }}
    />
  );
};
```

## Graph Controls Component (components/GraphControls.tsx)
```typescript
import React from 'react';
import { Button, ButtonGroup, Tooltip } from '@your-ui-library';

interface GraphControlsProps {
  onRefresh: () => void;
  onToggleSecondDegree: () => void;
  onConnectMore: () => void;
  showSecondDegree: boolean;
  isLoading: boolean;
  isConnecting: boolean;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  onRefresh,
  onToggleSecondDegree,
  onConnectMore,
  showSecondDegree,
  isLoading,
  isConnecting
}) => {
  return (
    <ButtonGroup>
      <Tooltip content="Refresh graph data">
        <Button 
          onClick={onRefresh}
          disabled={isLoading}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Tooltip>
      
      <Tooltip content="Toggle second-degree connections">
        <Button
          onClick={onToggleSecondDegree}
          disabled={isLoading}
          variant={showSecondDegree ? 'solid' : 'outline'}
        >
          Show Extended Network
        </Button>
      </Tooltip>
      
      <Tooltip content="Connect to more relays">
        <Button
          onClick={onConnectMore}
          disabled={isConnecting}
          loading={isConnecting}
        >
          Connect More Relays
        </Button>
      </Tooltip>
    </ButtonGroup>
  );
};
```

## Node Details Component (components/NodeDetails.tsx)
```typescript
import React from 'react';
import { Card, Avatar, Text, Button } from '@your-ui-library';
import { GraphNode } from '../types/graph-types';

interface NodeDetailsProps {
  node: GraphNode;
  onFollow?: () => void;
  isFollowing?: boolean;
  isFollowLoading?: boolean;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  onFollow,
  isFollowing,
  isFollowLoading
}) => {
  return (
    <Card>
      <Avatar 
        src={node.picture || '/default-avatar.png'} 
        alt={node.name}
      />
      <Text size="lg" weight="bold">{node.name}</Text>
      <Text size="sm" color="gray">{node.npub}</Text>
      
      {onFollow && (
        <Button
          onClick={onFollow}
          loading={isFollowLoading}
          variant={isFollowing ? 'solid' : 'outline'}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Button>
      )}
    </Card>
  );
}; 