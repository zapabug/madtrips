import React from 'react';
import { useLiteProfiles } from '../hooks/useLiteProfiles';
import { LiteProfile } from '../types/lite-nostr';

interface LiteProfileGalleryProps {
  npubs: string[];
  className?: string;
}

/**
 * A lightweight gallery of Nostr profiles
 * Always fetches real-time data with no caching
 */
export default function LiteProfileGallery({ 
  npubs, 
  className = '' 
}: LiteProfileGalleryProps) {
  // Use our lightweight profiles hook that skips caching
  const { profiles, loading, error, progress, refresh } = useLiteProfiles({
    npubs,
    batchSize: 5 // Process in small batches for better UX
  });
  
  // Convert profiles Map to Array for rendering
  const profilesList = Array.from(profiles.values());
  
  if (loading && profilesList.length === 0) {
    return (
      <div className={`lite-profile-gallery ${className}`}>
        <div className="loading-state">
          <h3>Loading profiles...</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{progress}% complete</div>
        </div>
      </div>
    );
  }
  
  if (error && profilesList.length === 0) {
    return (
      <div className={`lite-profile-gallery ${className}`}>
        <div className="error-state">
          <h3>Error loading profiles</h3>
          <p>{error}</p>
          <button onClick={() => refresh()}>Try Again</button>
        </div>
      </div>
    );
  }
  
  if (profilesList.length === 0) {
    return (
      <div className={`lite-profile-gallery ${className}`}>
        <div className="empty-state">
          <h3>No profiles found</h3>
          <p>No profiles could be found for the provided npubs.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`lite-profile-gallery ${className}`}>
      <div className="profile-grid">
        {profilesList.map((profile: LiteProfile) => (
          <ProfileCard key={profile.npub} profile={profile} />
        ))}
      </div>
      
      {loading && profilesList.length > 0 && (
        <div className="loading-more">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">Loading more profiles ({progress}%)</div>
        </div>
      )}
      
      <div className="gallery-actions">
        <button onClick={() => refresh()}>Refresh Profiles</button>
      </div>
      
      <style jsx>{`
        .lite-profile-gallery {
          width: 100%;
          padding: 1rem;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .profile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background-color: #eee;
          border-radius: 4px;
          overflow: hidden;
          margin: 0.5rem 0;
        }
        
        .progress-fill {
          height: 100%;
          background-color: #007bff;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          font-size: 0.8rem;
          color: #666;
          text-align: center;
        }
        
        .loading-state, .error-state, .empty-state {
          text-align: center;
          padding: 2rem;
          background: #f9f9f9;
          border-radius: 8px;
        }
        
        .loading-more {
          margin: 1rem 0;
        }
        
        .gallery-actions {
          text-align: center;
          margin-top: 1rem;
        }
        
        button {
          padding: 0.5rem 1rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  );
}

// Profile card subcomponent
function ProfileCard({ profile }: { profile: LiteProfile }) {
  return (
    <div className="profile-card">
      <div className="profile-picture">
        {profile.picture ? (
          <img 
            src={profile.picture} 
            alt={profile.name || 'Unknown'} 
            onError={(e) => {
              // Handle image load errors
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=N';
            }}
          />
        ) : (
          <div className="placeholder-image">{profile.name?.charAt(0) || '?'}</div>
        )}
      </div>
      
      <div className="profile-info">
        <h4 className="profile-name">{profile.name || 'Unnamed'}</h4>
        <div className="profile-npub">{shortenNpub(profile.npub)}</div>
      </div>
      
      <style jsx>{`
        .profile-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          border-radius: 8px;
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .profile-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .profile-picture {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }
        
        .profile-picture img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .placeholder-image {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0e0e0;
          color: #666;
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .profile-info {
          width: 100%;
          text-align: center;
        }
        
        .profile-name {
          margin: 0 0 0.25rem;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .profile-npub {
          font-size: 0.7rem;
          color: #666;
        }
      `}</style>
    </div>
  );
}

// Utility function to shorten NPUB
function shortenNpub(npub: string): string {
  if (!npub) return '';
  const start = npub.slice(0, 8);
  const end = npub.slice(-4);
  return `${start}...${end}`;
} 