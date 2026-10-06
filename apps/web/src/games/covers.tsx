import type { ComponentType } from 'react';
import LineThreeCover from '@bg/game-line-three/cover';
import SealedBidsCover from '@bg/game-sealed-bids/cover';

// Client-side registry of reviewed game renderers. Only covers for now; table renderers join in DRAGON-01.
const COVERS: Record<string, ComponentType<{ title: string }>> = {
  'line-three': LineThreeCover,
  'sealed-bids': SealedBidsCover
};

export function GameCover({ gameId, title }: { gameId: string; title: string }) {
  const Cover = COVERS[gameId];
  return Cover ? <Cover title={title} /> : <div style={{ inlineSize: '100%', blockSize: '100%', background: 'var(--surface-2)' }} aria-hidden />;
}
