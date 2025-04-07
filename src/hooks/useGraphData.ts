'use client';

import { useState, useCallback, useRef } from 'react';
import { GraphData, GraphNode, GraphLink } from '../types/graph-types';
import { BRAND_COLORS } from '../constants/brandColors';
import { DEFAULT_PROFILE_IMAGE } from '../utils/profileUtils';

/**
 * Hook for managing social graph data, extracted from useSocialGraph
 * for better modularity and reuse
 */
export function useGraphData() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const graphDataRef = useRef<GraphData | null>(null);

  /**
   * Creates a new empty graph structure with default settings
   */
  const createEmptyGraph = useCallback((): GraphData => {
    return {
      nodes: [],
      links: [],
      lastUpdated: Date.now()
    };
  }, []);

  /**
   * Adds a node to the graph if it doesn't already exist
   */
  const addNode = useCallback((
    graph: GraphData,
    id: string,
    npub: string,
    name: string = '',
    group: number = 1,
    picture: string = DEFAULT_PROFILE_IMAGE
  ): GraphData => {
    // Check if node already exists
    if (graph.nodes.some(node => node.id === id)) {
      return graph;
    }

    // Create a new node
    const newNode: GraphNode = {
      id,
      pubkey: id, // Using id as pubkey
      npub,
      name: name || npub.substring(0, 8),
      group,
      picture,
      val: group === 0 ? 25 : group === 1 ? 15 : 10,
      color: group === 0 ? BRAND_COLORS.bitcoinOrange : BRAND_COLORS.lightSand
    };

    // Create a new graph with the added node
    return {
      ...graph,
      nodes: [...graph.nodes, newNode],
      lastUpdated: Date.now()
    };
  }, []);

  /**
   * Adds a link between two nodes if it doesn't already exist
   */
  const addLink = useCallback((
    graph: GraphData,
    source: string,
    target: string,
    value: number = 1,
    type: 'follows' | 'mentions' | 'zap' | 'mutual' = 'follows'
  ): GraphData => {
    // Skip if source and target are the same
    if (source === target) {
      return graph;
    }

    // Check if source and target nodes exist
    const sourceNode = graph.nodes.find(node => node.id === source);
    const targetNode = graph.nodes.find(node => node.id === target);
    
    if (!sourceNode || !targetNode) {
      return graph;
    }

    // Check if link already exists
    if (graph.links.some(link => {
      const linkSource = typeof link.source === 'string' ? link.source : link.source.id;
      const linkTarget = typeof link.target === 'string' ? link.target : link.target.id;
      
      return (linkSource === source && linkTarget === target) || 
             (type === 'mutual' && linkSource === target && linkTarget === source);
    })) {
      return graph;
    }

    // Create a new link
    const newLink: GraphLink = {
      source,
      target,
      value,
      type
    };

    // Create a new graph with the added link
    return {
      ...graph,
      links: [...graph.links, newLink],
      lastUpdated: Date.now()
    };
  }, []);

  /**
   * Updates the graph data and reference
   */
  const updateGraph = useCallback((newGraph: GraphData | null) => {
    setGraphData(newGraph);
    graphDataRef.current = newGraph;
  }, []);

  /**
   * Removes a node and all its links from the graph
   */
  const removeNode = useCallback((graph: GraphData, id: string): GraphData => {
    // Remove node
    const newNodes = graph.nodes.filter(node => node.id !== id);
    
    // Remove all links connected to this node
    const newLinks = graph.links.filter(link => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      
      return source !== id && target !== id;
    });

    return {
      nodes: newNodes,
      links: newLinks,
      lastUpdated: Date.now()
    };
  }, []);

  /**
   * Updates node properties
   */
  const updateNode = useCallback((
    graph: GraphData,
    id: string,
    updates: Partial<GraphNode>
  ): GraphData => {
    const newNodes = graph.nodes.map(node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      return node;
    });

    return {
      ...graph,
      nodes: newNodes,
      lastUpdated: Date.now()
    };
  }, []);

  /**
   * Gets a node by ID
   */
  const getNodeById = useCallback((graph: GraphData | null, id: string): GraphNode | null => {
    if (!graph) return null;
    return graph.nodes.find(node => node.id === id) || null;
  }, []);

  /**
   * Gets all nodes connected to a specific node
   */
  const getConnectedNodes = useCallback((graph: GraphData | null, id: string): GraphNode[] => {
    if (!graph) return [];
    
    // Find all links where this node is source or target
    const connectedLinks = graph.links.filter(link => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      
      return source === id || target === id;
    });
    
    // Get the IDs of connected nodes
    const connectedIds = new Set<string>();
    connectedLinks.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (source === id) {
        connectedIds.add(target);
      } else {
        connectedIds.add(source);
      }
    });
    
    // Return the connected nodes
    return graph.nodes.filter(node => connectedIds.has(node.id));
  }, []);

  return {
    graphData,
    graphDataRef,
    createEmptyGraph,
    addNode,
    addLink,
    updateGraph,
    removeNode,
    updateNode,
    getNodeById,
    getConnectedNodes
  };
}

// Export types
export type { GraphData, GraphNode, GraphLink } from '../types/graph-types'; 