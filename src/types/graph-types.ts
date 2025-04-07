/**
 * Types for social graph visualization
 */

// Graph node (user) in the visualization
export interface GraphNode {
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
export interface GraphLink {
  id?: string;            // Unique identifier
  source: string | GraphNode; // Source node ID or node object
  target: string | GraphNode; // Target node ID or node object
  value?: number;         // Connection strength/weight
  type?: 'follows' | 'mentions' | 'zap' | 'mutual'; // Type of connection
  color?: string;         // Link color
}

// Complete graph data structure
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lastUpdated?: number;   // Timestamp of last update
  nodeCount?: number;     // Number of nodes (for internal tracking)
  linkCount?: number;     // Number of links (for internal tracking)
}

// Graph visualization settings
export interface GraphSettings {
  showLabels: boolean;    // Show node labels
  showImages: boolean;    // Show profile images
  nodeSize: number;       // Base node size
  linkStrength: number;   // Link force strength
  nodeCharge: number;     // Node repulsion force
  enablePhysics: boolean; // Enable physics simulation
  highlightConnections: boolean; // Highlight node connections on hover
} 