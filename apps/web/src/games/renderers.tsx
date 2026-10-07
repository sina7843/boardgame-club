import type { ComponentType } from 'react';
import LineThreeRenderer from '@bg/game-line-three/renderer';
import SealedBidsRenderer from '@bg/game-sealed-bids/renderer';
import UnoRenderer from '@bg/game-uno/renderer';
import ChessRenderer from '@bg/game-chess/renderer';
import SnakesRenderer from '@bg/game-snakes-ladders/renderer';
import LudoRenderer from '@bg/game-ludo/renderer';
import UnmatchedRenderer from '@bg/game-unmatched/renderer';
import CatanRenderer from '@bg/game-catan/renderer';
import type { GameRendererProps } from '@bg/ui';

/**
 * Reviewed UI bundles keyed by the clientBundleRef pinned on each table. A table only renders with the bundle it
 * was started with; when a new rules version ships with a new bundle, add it here and keep the old key until no
 * active table uses it (docs/ADDING_A_GAME.md).
 */
export const RENDERERS: Record<string, ComponentType<GameRendererProps<never>>> = {
  'line-three@1.0.0': LineThreeRenderer as ComponentType<GameRendererProps<never>>,
  'sealed-bids@1.0.0': SealedBidsRenderer as ComponentType<GameRendererProps<never>>,
  'uno@1.0.0': UnoRenderer as ComponentType<GameRendererProps<never>>,
  'unmatched@1.0.0': UnmatchedRenderer as ComponentType<GameRendererProps<never>>,
  'catan@1.0.0': CatanRenderer as ComponentType<GameRendererProps<never>>,
  'chess@1.0.0': ChessRenderer as ComponentType<GameRendererProps<never>>,
  'snakes-ladders@1.0.0': SnakesRenderer as ComponentType<GameRendererProps<never>>,
  'ludo@1.0.0': LudoRenderer as ComponentType<GameRendererProps<never>>
};
