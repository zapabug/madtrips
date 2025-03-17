export interface GraphNode {
  id: string;
  name?: string;
  npub?: string;
  type?: string;
  picture?: string;
  x?: number;
  y?: number;
  color?: string;
  val?: number;
  isCoreNode?: boolean;
  isCenter?: boolean;
  nodeType?: 'profile' | 'follower' | 'following' | 'connection';
  img?: HTMLImageElement;
}

export interface GraphLink {
  source: string | { id: string };
  target: string | { id: string };
  value?: number;
  color?: string;
  type?: 'follows' | 'followed_by' | 'mutual';
} 