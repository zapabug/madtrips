import { useProfileImage } from '@/lib/hooks/useProfileImage';

// Known profile pictures for specific npubs
export const KNOWN_PROFILES: Record<string, string> = {
  'npub1freemadeir39t3zlklv2yq2espvmhqnntwlvf34jp9xy2k79gqmqrg9g7w': 'https://freemadeira.com/wp-content/uploads/2023/03/freemadeira-logo-01.png',
  'npub1etgqcj9gc6yaxttuwu9eqgs3ynt2dzaudvwnrssrn2zdt2useaasfj8n6e': 'https://m.primal.net/LveZ.png', // FREE Madeira
};

// Default profile image to use as fallback
export const DEFAULT_PROFILE_IMAGE = "https://nostr.build/i/nostr.build_d421c1d7fd21c5d73c3428f0fc5ed7359cedb81bcad8074de350bec2d02e9a67.jpeg";

// Helper function to shorten NPUBs for display
export const shortenNpub = (npub: string | undefined): string => {
  if (!npub) return '';
  return `${npub.substring(0, 6)}...${npub.substring(npub.length - 4)}`;
}; 