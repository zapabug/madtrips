import React from 'react';
import { useNostrProfiles } from '../hooks/useNostrProfiles';

const ProfileList = ({ npubs }) => {
  const { profiles, loading, error } = useNostrProfiles(npubs);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading profiles</div>;

  return (
    <ul>
      {Array.from(profiles.values()).map(profile => (
        <li key={profile.pubkey}>{profile.displayName}</li>
      ))}
    </ul>
  );
};

export default ProfileList; 