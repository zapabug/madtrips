'use client'

import React, { memo, useState, useEffect } from 'react';
import { BRAND_COLORS } from '../../../constants/brandColors';
import RelayService from '../../../lib/services/RelayService';
import { GraphNode } from '../../../types/graph-types';

interface GraphControlsProps {
  onRefresh: () => void;
  onToggleSecondDegree: () => void;
  onClearCache: () => void;
  isRefreshing: boolean;
  showSecondDegree: boolean;
  canFollow?: boolean;
  onFollowNode?: (nodePubkey: string) => void;
  isFollowing?: boolean;
  isFollowingLoading?: boolean;
  selectedNode: GraphNode | null;
  relayCount?: number;
  onFollowToggle: () => Promise<void>;
  isLoggedIn: boolean;
  maxSecondDegreeConnections?: number;
  onMaxConnectionsChange?: (value: number) => void;
}

// Memoize to prevent unnecessary re-renders
const GraphControls = memo(({
  onRefresh,
  onToggleSecondDegree,
  onClearCache,
  isRefreshing,
  showSecondDegree,
  canFollow = false,
  onFollowNode,
  isFollowing = false,
  isFollowingLoading = false,
  selectedNode,
  relayCount: externalRelayCount,
  onFollowToggle,
  isLoggedIn,
  maxSecondDegreeConnections = 10,
  onMaxConnectionsChange
}: GraphControlsProps) => {
  const [relayCount, setRelayCount] = useState(externalRelayCount || 0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Subscribe to relay status updates from RelayService
  useEffect(() => {
    // If external relay count is provided, use that instead
    if (typeof externalRelayCount === 'number') {
      setRelayCount(externalRelayCount);
      return;
    }
    
    // Otherwise, use RelayService directly
    const updateRelayCount = () => {
      const relays = RelayService.getConnectedRelays();
      setRelayCount(relays.length);
    };
    
    // Initial update
    updateRelayCount();
    
    // Subscribe to relay status updates
    const unsubscribe = RelayService.onStatusUpdate((relays) => {
      setRelayCount(relays.length);
      setIsConnecting(false);
    });
    
    return () => {
      unsubscribe();
    };
  }, [externalRelayCount]);
  
  // Handle reconnect button click
  const handleReconnect = async () => {
    setIsConnecting(true);
    await RelayService.reconnect();
  };
  
  // Get selected node name for display
  const selectedNodeName = selectedNode ? (selectedNode.name || selectedNode.npub?.substring(0, 8)) : null;
  
  // Determine if follow button should be enabled
  const canFollowNode = !!(selectedNode && !selectedNode.isCoreNode && isLoggedIn);
  
  return (
    <div className="social-graph-controls">
      <div className="control-buttons">
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="control-button refresh-button"
          title="Refresh graph data"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>Refresh Graph</span>
            </>
          )}
        </button>
        
        <button
          onClick={onToggleSecondDegree}
          className={`control-button ${showSecondDegree ? 'active' : ''}`}
          title={showSecondDegree ? 'Show simplified graph' : 'Show extended graph'}
        >
          {showSecondDegree ? 'Simplified View' : 'Extended View'}
        </button>
        
        {showSecondDegree && onMaxConnectionsChange && (
          <div className="connections-slider">
            <label htmlFor="connectionsSlider" className="connections-label">
              Max Connections: {maxSecondDegreeConnections}
            </label>
            <input
              id="connectionsSlider"
              type="range"
              min="1"
              max="50"
              value={maxSecondDegreeConnections}
              onChange={(e) => onMaxConnectionsChange(parseInt(e.target.value))}
              className="connections-range"
            />
          </div>
        )}
        
        <button
          onClick={onClearCache}
          className="control-button clear-cache-button"
          title="Clear cached graph data"
        >
          Clear Cache
        </button>
        
        <div className="relay-status">
          <span className={`relay-count ${relayCount === 0 ? 'no-relays' : ''}`}>
            {relayCount} {relayCount === 1 ? 'relay' : 'relays'} connected
          </span>
          {relayCount === 0 && (
            <button 
              onClick={handleReconnect}
              disabled={isConnecting}
              className="relay-reconnect-button"
              title="Reconnect to relays"
            >
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </button>
          )}
        </div>
      </div>
      
      {selectedNodeName && (
        <div className="follow-controls">
          <span className="selected-node-name">
            {selectedNodeName}
          </span>
          <button
            onClick={onFollowToggle}
            disabled={isFollowingLoading}
            className={`follow-button ${isFollowing ? 'following' : ''}`}
            title={isFollowing ? `Unfollow ${selectedNodeName}` : `Follow ${selectedNodeName}`}
          >
            {isFollowingLoading 
              ? 'Processing...' 
              : isFollowing 
                ? 'Unfollow' 
                : 'Follow'}
          </button>
        </div>
      )}
      
      <style jsx>{`
        .social-graph-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .control-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .control-button {
          padding: 6px 12px;
          border: 1px solid ${BRAND_COLORS.deepBlue};
          background-color: transparent;
          color: ${BRAND_COLORS.deepBlue};
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .control-button:hover {
          background-color: ${BRAND_COLORS.deepBlue};
          color: white;
        }
        
        .control-button.active {
          background-color: ${BRAND_COLORS.deepBlue};
          color: white;
        }
        
        .control-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .relay-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          font-size: 14px;
        }
        
        .relay-count {
          color: ${BRAND_COLORS.deepBlue};
        }
        
        .relay-count.no-relays {
          color: #d32f2f;
        }
        
        .relay-reconnect-button {
          padding: 4px 8px;
          border: 1px solid #d32f2f;
          background-color: transparent;
          color: #d32f2f;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }
        
        .relay-reconnect-button:hover {
          background-color: #d32f2f;
          color: white;
        }
        
        .relay-reconnect-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .follow-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 5px;
        }
        
        .selected-node-name {
          font-weight: 500;
          color: ${BRAND_COLORS.deepBlue};
        }
        
        .follow-button {
          padding: 5px 10px;
          border: 1px solid ${BRAND_COLORS.bitcoinOrange};
          background-color: transparent;
          color: ${BRAND_COLORS.bitcoinOrange};
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .follow-button:hover {
          background-color: ${BRAND_COLORS.bitcoinOrange};
          color: white;
        }
        
        .follow-button.following {
          background-color: ${BRAND_COLORS.bitcoinOrange};
          color: white;
        }
        
        .follow-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @media (max-width: 640px) {
          .control-buttons {
            justify-content: space-between;
          }
          
          .relay-status {
            margin-left: 0;
            width: 100%;
            justify-content: center;
            margin-top: 8px;
          }
          
          .follow-controls {
            flex-direction: column;
            align-items: center;
          }
        }
        
        .connections-slider {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 200px;
        }
        
        .connections-label {
          font-size: 14px;
          color: ${BRAND_COLORS.deepBlue};
          white-space: nowrap;
        }
        
        .connections-range {
          flex: 1;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: #e2e8f0;
          border-radius: 4px;
          outline: none;
        }
        
        .connections-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${BRAND_COLORS.bitcoinOrange};
          cursor: pointer;
        }
        
        .connections-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${BRAND_COLORS.bitcoinOrange};
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
});

GraphControls.displayName = 'GraphControls';

export default GraphControls; 