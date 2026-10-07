import type { ComponentType } from 'react';
import LineThreeCover from '@bg/game-line-three/cover';
import SealedBidsCover from '@bg/game-sealed-bids/cover';
import UnoCover from '@bg/game-uno/cover';
import ChessCover from '@bg/game-chess/cover';
import SnakesCover from '@bg/game-snakes-ladders/cover';
import LudoCover from '@bg/game-ludo/cover';
import AmlakCover from '@bg/game-amlak/cover';
import UnmatchedCover from '@bg/game-unmatched/cover';
import CatanCover from '@bg/game-catan/cover';
import RiskCover from '@bg/game-risk/cover';
import TtrCover from '@bg/game-ticket-to-ride/cover';

// Client-side registry of reviewed game renderers. Only covers for now; table renderers join in DRAGON-01.
const COVERS: Record<string, ComponentType<{ title: string }>> = {
  'line-three': LineThreeCover,
  'sealed-bids': SealedBidsCover,
  uno: UnoCover,
  unmatched: UnmatchedCover,
  catan: CatanCover,
  risk: RiskCover,
  'ticket-to-ride': TtrCover,
  chess: ChessCover,
  'snakes-ladders': SnakesCover,
  ludo: LudoCover,
  amlak: AmlakCover
};

export function GameCover({ gameId, title }: { gameId: string; title: string }) {
  const Cover = COVERS[gameId];
  return Cover ? <Cover title={title} /> : <div style={{ inlineSize: '100%', blockSize: '100%', background: 'var(--surface-2)' }} aria-hidden />;
}
