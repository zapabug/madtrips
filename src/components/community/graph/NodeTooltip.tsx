'use client'

import React, { useEffect, useState, memo } from 'react';
import { GraphNode } from '../../../types/graph-types';
import { DEFAULT_PROFILE_IMAGE } from '../../../utils/profileUtils';
import { useNostr } from '../../../lib/contexts/NostrContext';
import Image from 'next/image';
import { BRAND_COLORS } from '../../../constants/brandColors';
import { shortenNpub } from '../../../utils/profileUtils';

interface NodeTooltipProps {
  node: GraphNode;
  onClose: () => void;
  isFollowing?: boolean;
  onFollowNode?: () => void;
  isFollowingLoading?: boolean;
  isLoggedIn?: boolean;
}

const NodeTooltip = memo(({
  node,
  onClose,
  isFollowing = false,
  onFollowNode,
  isFollowingLoading = false,
  isLoggedIn = false
}: NodeTooltipProps) => {
  const { getUserProfile } = useNostr();
  const [nip05, setNip05] = useState<string | null>(null);
  const [followers, setFollowers] = useState<number | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  
  // Fetch additional profile data including NIP-05
  useEffect(() => {
    if (node?.npub && getUserProfile) {
      // Reset state for new node
      setImageLoaded(false);
      setShowFullProfile(false);
      
      getUserProfile(node.npub)
        .then(profile => {
          if (profile) {
            setFullProfile(profile);
            if (profile?.nip05) {
              setNip05(profile.nip05);
            }
          }
        })
        .catch(err => {
          console.error('Error fetching profile details:', err);
        });
    }

    // Clear the profile data when the selected node changes
    return () => {
      setNip05(null);
      setFullProfile(null);
      setFollowers(null);
      setFollowing(null);
      setImageLoaded(false);
      setShowFullProfile(false);
    };
  }, [node?.npub, getUserProfile]);

  if (!node) return null;

  const displayName = fullProfile?.displayName || fullProfile?.name || node.name || shortenNpub(node.npub || '');
  const imageUrl = fullProfile?.picture || node.picture || DEFAULT_PROFILE_IMAGE;
  const profileUrl = `https://njump.me/${node.npub}`;

  return (
    <div className="node-tooltip">
      <div className="tooltip-header">
        <div className="profile-image">
          <img 
            src={imageUrl} 
            alt={displayName}
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_PROFILE_IMAGE;
            }}
          />
        </div>
        
        <div className="profile-info">
          <h3 className="profile-name">{displayName}</h3>
          <p className="profile-npub">{shortenNpub(node.npub || '')}</p>
        </div>
        
        <button onClick={onClose} className="close-button">
          &times;
        </button>
      </div>
      
      <div className="tooltip-actions">
        {isLoggedIn && node.pubkey && onFollowNode && (
          <button 
            onClick={onFollowNode}
            disabled={isFollowingLoading}
            className={`follow-button ${isFollowing ? 'following' : ''}`}
          >
            {isFollowingLoading ? 'Processing...' : (isFollowing ? 'Unfollow' : 'Follow')}
          </button>
        )}
        
        <a 
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="view-profile-button"
        >
          View Profile
        </a>
      </div>
      
      <style jsx>{`
        .node-tooltip {
          position: absolute;
          top: 0;
          right: 0;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          padding: 12px;
          width: 250px;
          z-index: 1000;
          margin: 10px;
        }
        
        .tooltip-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          position: relative;
        }
        
        .profile-image {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 10px;
          border: 2px solid ${BRAND_COLORS.bitcoinOrange};
        }
        
        .profile-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-info {
          flex: 1;
        }
        
        .profile-name {
          font-weight: 600;
          font-size: 16px;
          margin: 0 0 4px 0;
          color: #333;
        }
        
        .profile-npub {
          font-size: 12px;
          color: #777;
          margin: 0;
        }
        
        .close-button {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #eee;
          border: none;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .tooltip-actions {
          display: flex;
          gap: 8px;
        }
        
        .follow-button, .view-profile-button {
          flex: 1;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
        }
        
        .follow-button {
          background-color: transparent;
          border: 1px solid ${BRAND_COLORS.bitcoinOrange};
          color: ${BRAND_COLORS.bitcoinOrange};
        }
        
        .follow-button:hover {
          background-color: ${BRAND_COLORS.bitcoinOrange};
          color: white;
        }
        
        .follow-button.following {
          background-color: ${BRAND_COLORS.bitcoinOrange};
          color: white;
        }
        
        .view-profile-button {
          background-color: ${BRAND_COLORS.deepBlue};
          color: white;
          border: none;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .view-profile-button:hover {
          background-color: ${BRAND_COLORS.deepBlue}dd;
        }
      `}</style>
    </div>
  );
});

NodeTooltip.displayName = 'NodeTooltip';

export default NodeTooltip; 