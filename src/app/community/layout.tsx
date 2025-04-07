import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MadTrips - Bitcoin Madeira Community',
  description: 'Connect with the Bitcoin Madeira community, view relationships, and stay up to date with the latest posts.',
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 