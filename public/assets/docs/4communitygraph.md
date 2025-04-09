# Force Graph Renderer - LLM Recreation Guide

This document contains prompts and code snippets for recreating the force-directed graph visualization component from scratch using an LLM.

## Complete Component Generation Prompt

```
Create a React component called GraphRenderer that visualizes a social network using a force-directed graph.

Requirements:
- Use TypeScript with React
- Implement a force-directed graph using react-force-graph-2d
- Add the 'use client' directive at the top for Next.js compatibility
- Use dynamic import for ForceGraph2D to ensure it only loads client-side
- Implement efficient node rendering with canvas
- Use image caching to improve performance
- Support dark/light mode with appropriate styling
- Include proper cleanup of resources
- Add custom node and link styling
- Support node selection and hovering
- Allow focusing on specific nodes
- Optimize simulation parameters for responsiveness
- Handle loading and empty states

The component should accept these props:
- graph: GraphData (contains nodes and links for visualization)
- height?: number | string (default: 600)
- width?: number | string (default: '100%')
- onNodeClick?: (node: GraphNode) => void
- onNodeHover?: (node: GraphNode | null) => void
- selectedNode?: GraphNode | null
- isLoggedIn?: boolean
- centerNodeId?: string

The GraphData should contain:
- nodes: Array of GraphNode objects
- links: Array of GraphLink objects

Each GraphNode should include:
- id: string (unique identifier)
- pubkey: string
- npub?: string (public key in npub format)
- name?: string
- picture?: string (profile image URL)
- isCoreNode?: boolean (if this is a core community member)
- isSecondDegree?: boolean (if this is a second-degree connection)

Ensure the graph is optimized for performance with many nodes.
```

## Interface Definitions

```typescript
// Node in the visualization
interface GraphNode {
  id: string;             // Unique identifier
  pubkey: string;         // Public key in hex format
  npub?: string;          // Public key in npub format
  name?: string;          // User name if available
  picture?: string;       // Profile image URL
  nip05?: string;         // NIP-05 identifier for verification
  followers?: number;     // Number of followers
  following?: number;     // Number of users being followed
  group?: number;         // Group/cluster number
  x?: number;             // X position in visualization
  y?: number;             // Y position in visualization
  vx?: number;            // X velocity in simulation
  vy?: number;            // Y velocity in simulation
  fx?: number | null;     // Fixed X position (if pinned)
  fy?: number | null;     // Fixed Y position (if pinned)
  val?: number;           // Node size value
  color?: string;         // Node color
  isCoreNode?: boolean;   // Whether this is a core node
  isSecondDegree?: boolean; // Whether this is a second-degree connection
}

// Connection between nodes
interface GraphLink {
  id?: string;            // Unique identifier
  source: string | GraphNode; // Source node ID or node object
  target: string | GraphNode; // Target node ID or node object
  value?: number;         // Connection strength/weight
  type?: 'follows' | 'mentions' | 'zap' | 'mutual'; // Type of connection
  color?: string;         // Link color
}

// Complete graph data structure
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lastUpdated?: number;   // Timestamp of last update
}

// Component props
interface GraphRendererProps {
  graph: GraphData;
  height?: number | string;
  width?: number | string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  selectedNode?: GraphNode | null;
  isLoggedIn?: boolean;
  centerNodeId?: string;
}
```

## Key Component Elements

### Dynamic Import for ForceGraph2D

```jsx
const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then((mod) => mod.default), { ssr: false });
```

### Graph Data Preparation

```jsx
const prepareGraphData = (graphData: GraphData) => {
  // Precompute special node status
  const mutualFollows = new Set<string>();
  const coreFollowCounts = new Map<string, number>();

  graphData.links.forEach((link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target?.id;

    // Mutual follows
    if (link.type === 'mutual') {
      mutualFollows.add(sourceId);
      mutualFollows.add(targetId);
    }

    // Count follows to core nodes
    if (graphData.nodes.find((n) => n.id === targetId && n.isCoreNode)) {
      coreFollowCounts.set(sourceId, (coreFollowCounts.get(sourceId) || 0) + 1);
    }
  });

  return {
    nodes: graphData.nodes.map((node) => ({
      ...node,
      val: node.val || (node.isCoreNode ? 50 : 6),
      color: node.color || (node.isCoreNode ? BRAND_COLORS.bitcoinOrange : undefined),
      fx: node.fx === null ? undefined : node.fx,
      fy: node.fy === null ? undefined : node.fy,
      isMutual: mutualFollows.has(node.id),
      followsMultipleCores: (coreFollowCounts.get(node.id) || 0) >= 2,
    })),
    links: graphData.links.map((link) => ({
      source: typeof link.source === 'string' ? link.source : link.source?.id || '',
      target: typeof link.target === 'string' ? link.target : link.target?.id || '',
      value: link.value || 1,
      color: link.color || (link.type === 'mutual' ? BRAND_COLORS.bitcoinOrange : undefined),
    })),
  };
};
```

### Image Caching

```jsx
// Image cache to avoid recreating Image objects
const imageCache = new Map<string, HTMLImageElement>();

// In component:
useEffect(() => {
  return () => {
    imageCache.clear();
  };
}, []);
```

### Custom Node Rendering

```jsx
const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
  const nodeRadius = node.val;

  // Draw base circle
  ctx.beginPath();
  ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
  ctx.fillStyle = node.color || 'rgba(0,0,0,0.1)';
  ctx.fill();

  // Draw Bitcoin-colored circle for mutual follows or multiple core followers
  if (node.isMutual || node.followsMultipleCores) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius + 2, 0, 2 * Math.PI, false);
    ctx.strokeStyle = BRAND_COLORS.bitcoinOrange;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Render profile image if available
  if (node.picture) {
    let img = imageCache.get(node.picture);
    if (!img) {
      img = new Image();
      img.src = node.picture;
      imageCache.set(node.picture, img);
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius - 2, 0, 2 * Math.PI, false);
      ctx.clip();
      const imgSize = nodeRadius * 2;
      ctx.drawImage(img, node.x - nodeRadius, node.y - nodeRadius, imgSize, imgSize);
      ctx.restore();
    }
  }
}, []);
```

### Node Focus Functionality

```jsx
const focusNode = useCallback((node: GraphNode | null) => {
  if (graphRef.current && node) {
    graphRef.current.centerAt(node.x, node.y, 1000);
    graphRef.current.zoom(4, 1000);
  }
}, []);

useEffect(() => {
  if (selectedNode) focusNode(selectedNode);
}, [selectedNode, focusNode]);

useEffect(() => {
  if (graphRef.current && centerNodeId) {
    const centerNode = graph.nodes.find((node) => node.id === centerNodeId);
    if (centerNode) {
      setTimeout(() => focusNode(centerNode), 500);
    }
  }
}, [centerNodeId, graph.nodes, focusNode]);
```

### ForceGraph2D Configuration

```jsx
<ForceGraph2D
  ref={graphRef}
  graphData={graphData}
  nodeCanvasObject={paintNode}
  nodeLabel={(node: any) => node.name || node.npub?.slice(0, 6) + '...' || 'Unknown'} // Name on hover
  linkColor={(link: any) => link.color || 'rgba(0,0,0,0.05)'}
  linkWidth={(link: any) => link.value}
  linkDirectionalArrowLength={0}
  linkCurvature={0.2}
  linkDirectionalParticles={0}
  onNodeClick={(node: any) => onNodeClick?.(node)}
  onNodeHover={(node: any, previousNode: any) => onNodeHover?.(node)}
  nodeRelSize={12}
  warmupTicks={20}
  cooldownTicks={100}
  d3AlphaDecay={0.02}
  d3VelocityDecay={0.1}
/>
```

## Performance Optimization Tips

1. **Canvas-based rendering**: Use `nodeCanvasObject` for custom rendering instead of SVG for better performance with many nodes

2. **Image caching**: Reuse image objects to prevent constant reloading of profile pictures
   ```jsx
   const imageCache = new Map<string, HTMLImageElement>();
   ```

3. **Force simulation parameters**: Tune these values for the right balance of visual appeal and performance
   ```
   warmupTicks: 20        // Limited initial simulation steps
   cooldownTicks: 100     // Controlled cooling phase
   d3AlphaDecay: 0.02     // Slower simulation cooling for better layout
   d3VelocityDecay: 0.1   // Lower value for smoother motion
   ```

4. **Memoizing the component**: Prevent unnecessary re-renders
   ```jsx
   const GraphRenderer = memo(({ ... }) => { ... });
   ```

5. **Precomputation**: Calculate derived values once during data preparation
   ```jsx
   // In prepareGraphData function
   const mutualFollows = new Set<string>();
   const coreFollowCounts = new Map<string, number>();
   
   // ... calculate once and store for efficient use in rendering
   ```

## Integration Example

```jsx
import { GraphRenderer } from '../../components/community/graph';

// In your page component:
<GraphRenderer 
  graph={processedGraphData}
  height={600}
  onNodeClick={handleNodeClick}
  selectedNode={selectedNode}
  centerNodeId="some-node-id"
/>
```

## Common Customizations

### Change Node Sizing

```jsx
// In prepareGraphData
val: node.val || calculateNodeSize(node), // Custom sizing function

// or directly in ForceGraph2D
<ForceGraph2D
  nodeRelSize={15} // Larger nodes
  // ...other props
/>
```

### Custom Node Colors

```jsx
// In prepareGraphData
color: node.color || getNodeColor(node), // Custom color function

// Example color function
const getNodeColor = (node) => {
  if (node.isCoreNode) return '#f7931a'; // Bitcoin orange
  if (node.isSecondDegree) return '#9ca3af'; // Gray
  return '#6366f1'; // Indigo
};
```

### Adjust Link Appearance

```jsx
<ForceGraph2D
  linkWidth={(link) => link.value * 0.5} // Thinner links
  linkCurvature={0}  // Straight lines instead of curves
  // ...other props
/>
``` 