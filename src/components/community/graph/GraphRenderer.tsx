'use client';

import React, { useRef, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { GraphNode, GraphLink, GraphData } from '../../../types/graph-types';
import { useNostr } from '../../../lib/contexts/NostrContext';
import { BRAND_COLORS } from '../../../constants/brandColors';
import { getRandomLoadingMessage } from '../../../constants/loadingMessages';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then((mod) => mod.default), { ssr: false });

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

// Image cache to avoid recreating Image objects
const imageCache = new Map<string, HTMLImageElement>();

const GraphRenderer = memo(
  ({
    graph,
    height = 600,
    width = '100%',
    onNodeClick,
    onNodeHover,
    selectedNode,
    isLoggedIn = false,
    centerNodeId,
  }: GraphRendererProps) => {
    const { ndk } = useNostr();
    const graphRef = useRef<any>(null);

    const graphData = prepareGraphData(graph);

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

      // Remove white border highlight for selected nodes
    }, []);

    // Cleanup image cache on unmount
    useEffect(() => {
      return () => {
        imageCache.clear();
      };
    }, []);

    // Cool loading message with spinner
    if (!graphData?.nodes?.length) {
      return (
        <div
          style={{ height, width }}
          className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md"
        >
          <div className="text-center p-4">
            <div className="mb-2 text-gray-500 dark:text-gray-400">
              <svg
                className="animate-spin h-10 w-10 mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p>{getRandomLoadingMessage('GRAPH')}</p>
          </div>
        </div>
      );
    }

    return (
      <div style={{ height, width, position: 'relative' }}>
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
      </div>
    );
  }
);

GraphRenderer.displayName = 'GraphRenderer';

export default GraphRenderer;