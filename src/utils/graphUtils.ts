import * as d3 from 'd3';
import { GraphNode, GraphLink } from '../types/graph-types';

/**
 * Preload profile images to avoid flashing during visualization
 * @param nodes Graph nodes with image URLs
 */
export const preloadImages = (nodes: GraphNode[]): void => {
  nodes.forEach(node => {
    if (node.picture) {
      const img = new Image();
      img.src = node.picture;
    }
  });
};

/**
 * Handle node click in social graph visualization
 * @param event Click event
 * @param node Graph node that was clicked
 * @param navigate Navigation function (optional)
 */
export const handleNodeClick = (
  event: React.MouseEvent,
  node: GraphNode, 
  navigate?: (url: string) => void
): void => {
  event.preventDefault();
  event.stopPropagation();
  
  if (!node.npub) return;
  
  // Open profile in new tab if no navigation function provided
  if (!navigate) {
    window.open(`https://njump.me/${node.npub}`, '_blank');
    return;
  }
  
  // Use navigation function if provided
  navigate(`/profile/${node.npub}`);
};

/**
 * Calculate optimal force simulation parameters based on node count
 * @param nodeCount Number of nodes in the graph
 */
export const calculateForceParameters = (nodeCount: number) => {
  // Scale forces based on node count for optimal visualization
  const baseCharge = -30;
  const baseLinkDistance = 30;
  
  // More nodes = stronger repulsion and longer links
  const chargeMultiplier = Math.max(1, Math.log10(nodeCount) * 0.5);
  const distanceMultiplier = Math.max(1, Math.log10(nodeCount) * 0.3);
  
  return {
    charge: baseCharge * chargeMultiplier,
    linkDistance: baseLinkDistance * distanceMultiplier,
    collisionRadius: 5 + (20 / Math.log10(nodeCount + 10)),
  };
};

/**
 * Restart D3 force simulation with new parameters
 * @param simulation D3 force simulation
 * @param nodes Graph nodes
 * @param links Graph links
 */
export const restartSimulation = (
  simulation: d3.Simulation<GraphNode, GraphLink>,
  nodes: GraphNode[],
  links: GraphLink[]
): void => {
  // Update simulation with new nodes and links
  simulation.nodes(nodes);
  
  // Set force parameters based on graph size
  const { charge, linkDistance, collisionRadius } = calculateForceParameters(nodes.length);
  
  simulation
    .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(linkDistance))
    .force('charge', d3.forceManyBody().strength(charge))
    .force('collision', d3.forceCollide().radius(collisionRadius))
    .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .alpha(1)
    .restart();
};

/**
 * Create a color scale for nodes based on their connection count
 * @returns D3 color scale function
 */
export const createNodeColorScale = () => {
  return d3.scaleLinear<string>()
    .domain([0, 5, 15, 30])
    .range(['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E'])
    .clamp(true);
};

/**
 * Format node labels based on available profile data
 * @param node Graph node to format label for
 * @returns Formatted label string
 */
export const formatNodeLabel = (node: GraphNode): string => {
  if (node.name) {
    return node.name;
  }
  
  if (node.npub) {
    return shortenNpub(node.npub);
  }
  
  return shortenNpub(node.id);
};

/**
 * Shorten npub for display purposes
 * @param npub Nostr public key (npub)
 * @returns Shortened npub string (e.g., npub1abc...xyz)
 */
export const shortenNpub = (npub: string): string => {
  if (!npub) return '';
  
  if (npub.length <= 16) return npub;
  
  if (npub.startsWith('npub1')) {
    return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
  }
  
  return `${npub.substring(0, 6)}...${npub.substring(npub.length - 4)}`;
}; 