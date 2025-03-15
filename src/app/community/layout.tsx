import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bitcoin Community | MadTrips',
  description: 'Explore the Bitcoin community in Madeira through interactive social graphs.'
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 