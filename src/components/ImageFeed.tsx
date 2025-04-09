import React from 'react';
import { useFeed } from '../hooks/useFeed';

const ImageFeed = ({ npubs }) => {
  const { notes, loading, error } = useFeed({ npubs, type: 'image' });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading images</div>;

  return (
    <div>
      {notes.map(note => (
        <img key={note.id} src={note.images[0]} alt={note.content} />
      ))}
    </div>
  );
};

export default ImageFeed; 