import React, { useState } from 'react';
import { useLiteNostrEvents } from '../hooks/useLiteNostrEvents';
import { ImageNote, LiteProfile } from '../types/lite-nostr';

interface LiteNostrGalleryProps {
  pubkeys: string[];         // Pubkeys or npubs to show images from
  limit?: number;            // Max number of images to display
  skipCache?: boolean;       // Force real-time data
  className?: string;        // Optional CSS class
}

/**
 * A lightweight gallery component that displays images from Nostr notes
 * Uses our minimal data types for optimal performance
 */
export default function LiteNostrGallery({ 
  pubkeys, 
  limit = 20, 
  skipCache = true,
  className = ''
}: LiteNostrGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Use our lightweight Nostr events hook
  const { 
    profiles, 
    imageNotes, 
    loading, 
    error, 
    refresh 
  } = useLiteNostrEvents({
    pubkeys,
    kinds: [0, 1],        // Only fetch profiles and notes
    limit: limit * 3,     // Fetch more than we need in case some don't have images
    skipCache,
    autoSubscribe: true   // Auto-subscribe to get real-time updates
  });
  
  // Filter to show only the latest notes with images up to the limit
  const notesToShow = imageNotes.slice(0, limit);
  
  // Handle opening image modal
  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };
  
  // Handle closing image modal
  const closeImageModal = () => {
    setSelectedImage(null);
  };
  
  // Find author profile for a note
  const getProfileForNote = (note: ImageNote): LiteProfile | undefined => {
    // Convert pubkey to npub
    let npub = '';
    try {
      // This assumes npub is already stored in the profiles Map
      // In a real component, you'd want a helper function to convert pubkey to npub
      // If the profile isn't found, we'll just use the data we have
      for (const [key, profile] of profiles.entries()) {
        if (profile.pubkey === note.pubkey) {
          npub = key;
          break;
        }
      }
    } catch (e) {
      console.error('Error finding profile for note:', e);
    }
    
    // Return profile if found
    return npub ? profiles.get(npub) : undefined;
  };
  
  if (loading && imageNotes.length === 0) {
    return (
      <div className={`lite-nostr-gallery ${className}`}>
        <div className="loading">Loading images from Nostr...</div>
      </div>
    );
  }
  
  if (error && imageNotes.length === 0) {
    return (
      <div className={`lite-nostr-gallery ${className}`}>
        <div className="error">
          Error: {error}
          <button onClick={() => refresh()}>Retry</button>
        </div>
      </div>
    );
  }
  
  if (imageNotes.length === 0) {
    return (
      <div className={`lite-nostr-gallery ${className}`}>
        <div className="empty">No images found for the selected profiles</div>
      </div>
    );
  }
  
  return (
    <div className={`lite-nostr-gallery ${className}`}>
      {/* Image Grid */}
      <div className="image-grid">
        {notesToShow.map(note => (
          <div key={note.id} className="image-card">
            {note.imageUrls.map((imageUrl, idx) => (
              <div key={`${note.id}-${idx}`} className="image-container">
                <img 
                  src={imageUrl} 
                  alt={`Nostr image by ${getProfileForNote(note)?.name || 'unknown'}`}
                  onClick={() => openImageModal(imageUrl)}
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
                
                {/* Author info */}
                <div className="image-author">
                  {getProfileForNote(note)?.picture && (
                    <img 
                      className="author-avatar" 
                      src={getProfileForNote(note)?.picture || ''} 
                      alt={getProfileForNote(note)?.name || 'author'}
                    />
                  )}
                  <span className="author-name">
                    {getProfileForNote(note)?.name || 'unknown'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Image modal */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close-button" onClick={closeImageModal}>&times;</span>
            <img src={selectedImage} alt="Full size" />
          </div>
        </div>
      )}
      
      {/* Load more button */}
      {imageNotes.length > limit && (
        <div className="load-more">
          <button onClick={() => refresh()}>Refresh</button>
        </div>
      )}
      
      {/* Basic CSS - in a real app you'd use CSS modules or a separate CSS file */}
      <style jsx>{`
        .lite-nostr-gallery {
          width: 100%;
          padding: 1rem;
        }
        
        .image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
        }
        
        .image-card {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .image-container {
          position: relative;
          aspect-ratio: 1 / 1;
          overflow: hidden;
        }
        
        .image-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: pointer;
          transition: transform 0.3s ease;
        }
        
        .image-container img:hover {
          transform: scale(1.05);
        }
        
        .image-author {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .author-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .image-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          position: relative;
          max-width: 90%;
          max-height: 90%;
        }
        
        .modal-content img {
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
        }
        
        .close-button {
          position: absolute;
          top: -40px;
          right: 0;
          font-size: 2rem;
          color: white;
          cursor: pointer;
        }
        
        .loading, .error, .empty {
          padding: 2rem;
          text-align: center;
          background: #f5f5f5;
          border-radius: 8px;
        }
        
        .load-more {
          margin-top: 1rem;
          text-align: center;
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