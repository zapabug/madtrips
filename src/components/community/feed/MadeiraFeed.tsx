'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { NostrProfileImage } from '../profile/NostrProfileImage';
import { CORE_NPUBS } from '../utils';
import { useNostrFeed, Note } from '../../../hooks/useNostrFeed';
import { MCP_CONFIG } from '../../../../mcp/config';

// Madeira-related hashtags to filter by
const MADEIRA_HASHTAGS = [
  'madeira', 
  'travelmadeira', 
  'visitmadeira', 
  'funchal', 
  'fanal', 
  'espetada', 
  'freemadeira', 
  'madstr'
];

// NSFW-related keywords to filter out
const NSFW_KEYWORDS = [
  'nsfw', 'xxx', 'porn', 'adult', 'sex', 'nude', 'naked', 
  '18+', 'explicit', 'content warning', 'cw'
];

interface MadeiraFeedProps {
  npubs?: string[];
  limit?: number;
  useCorePubs?: boolean;
  className?: string;
}

export const MadeiraFeed: React.FC<MadeiraFeedProps> = ({ 
  npubs = [],
  limit = 25,
  useCorePubs = true,
  className = ''
}) => {
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [errorShown, setErrorShown] = useState(false);
  
  // Use the shared hook with Madeira-specific settings
  const { notes, loading, error, refresh } = useNostrFeed({
    npubs: useCorePubs ? [...CORE_NPUBS, ...npubs] : npubs,
    limit,
    requiredHashtags: MADEIRA_HASHTAGS,
    nsfwKeywords: NSFW_KEYWORDS,
    onlyWithImages: true, // Only show posts with images
    useWebOfTrust: MCP_CONFIG.defaults.useWebOfTrust // Use the Web of Trust from social graph
  });

  // Show error in console but not more than once
  useEffect(() => {
    if (error && !errorShown) {
      console.error('MadeiraFeed error:', error);
      setErrorShown(true);
    }
  }, [error, errorShown]);

  // Auto-rotate carousel
  React.useEffect(() => {
    if (!loading && notes.length > 0) {
      carouselIntervalRef.current = setInterval(() => {
        setCurrentNoteIndex(prevIndex => (prevIndex + 1) % notes.length);
      }, 5000);
    }
    
    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [loading, notes]);

  // Manual navigation
  const goToNext = () => {
    if (notes.length === 0) return;
    setCurrentNoteIndex(prevIndex => (prevIndex + 1) % notes.length);
    resetCarouselTimer();
  };

  const goToPrevious = () => {
    if (notes.length === 0) return;
    setCurrentNoteIndex(prevIndex => (prevIndex - 1 + notes.length) % notes.length);
    resetCarouselTimer();
  };

  const resetCarouselTimer = () => {
    if (carouselIntervalRef.current) {
      clearInterval(carouselIntervalRef.current);
      carouselIntervalRef.current = setInterval(() => {
        setCurrentNoteIndex(prevIndex => (prevIndex + 1) % notes.length);
      }, 5000);
    }
  };

  // Open post in njump when clicked
  const openInNjump = (note: Note) => {
    if (!note || !note.id) return;
    const njumpUrl = `https://njump.me/${note.id}`;
    window.open(njumpUrl, '_blank');
  };

  // Render the current note
  const renderCurrentNote = () => {
    if (loading || notes.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-pulse">
            <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full mb-4"></div>
            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
            <div className="h-24 w-full bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      );
    }

    const note = notes[currentNoteIndex];
    if (!note) return null;

    return (
      <div 
        className="flex flex-col space-y-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer" 
        onClick={() => openInNjump(note)}
      >
        {/* Author info */}
        <div className="flex items-center space-x-2">
          <NostrProfileImage
            npub={note.npub}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div>
            <div className="font-semibold text-sm dark:text-white">
              {note.author.displayName || note.author.name || 'Unknown'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(note.created_at * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {/* Note content (truncated) */}
        <div className="text-sm dark:text-gray-200 line-clamp-3">
          {note.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < note.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        
        {/* Image */}
        {note.images && note.images.length > 0 && (
          <div className="w-full h-48 relative rounded-md overflow-hidden">
            <Image
              src={note.images[0]}
              alt="Post image"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        
        {/* Hashtags */}
        {note.hashtags && note.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.hashtags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded">
                #{tag}
              </span>
            ))}
            {note.hashtags.length > 3 && (
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded">
                +{note.hashtags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Madeira Updates</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => refresh()}
            className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
            aria-label="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Carousel */}
      <div className="relative">
        {/* Content */}
        {renderCurrentNote()}
        
        {/* Navigation */}
        {notes.length > 1 && (
          <>
            <button
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-30 hover:bg-opacity-50 text-white p-2 rounded-full -ml-4"
              onClick={goToPrevious}
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-30 hover:bg-opacity-50 text-white p-2 rounded-full -mr-4"
              onClick={goToNext}
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Dots */}
            <div className="flex justify-center mt-4 space-x-2">
              {notes.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full ${currentNoteIndex === index ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  onClick={() => {
                    setCurrentNoteIndex(index);
                    resetCarouselTimer();
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
              {notes.length > 5 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">+{notes.length - 5}</span>
              )}
            </div>
          </>
        )}
        
        {/* Show very minimal error */}
        {error && notes.length === 0 && !loading && (
          <div className="flex items-center justify-center h-40 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button 
              onClick={() => refresh()}
              className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MadeiraFeed; 