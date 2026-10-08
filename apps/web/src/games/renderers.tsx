import type { ComponentType } from 'react';
import LineThreeRenderer from '@bg/game-line-three/renderer';
import SealedBidsRenderer from '@bg/game-sealed-bids/renderer';
import UnoRenderer from '@bg/game-uno/renderer';
import ChessRenderer from '@bg/game-chess/renderer';
import SnakesRenderer from '@bg/game-snakes-ladders/renderer';
import LudoRenderer from '@bg/game-ludo/renderer';
import AmlakRenderer from '@bg/game-amlak/renderer';
import UnmatchedRenderer from '@bg/game-unmatched/renderer';
import CatanRenderer from '@bg/game-catan/renderer';
import RiskRenderer from '@bg/game-risk/renderer';
import TtrRenderer from '@bg/game-ticket-to-ride/renderer';
import BackgammonRenderer from '@bg/game-backgammon/renderer';
import CheckersRenderer from '@bg/game-checkers/renderer';
import OthelloRenderer from '@bg/game-othello/renderer';
import QuoridorRenderer from '@bg/game-quoridor/renderer';
import OnitamaRenderer from '@bg/game-onitama/renderer';
import GoRenderer from '@bg/game-go/renderer';
import SantoriniRenderer from '@bg/game-santorini/renderer';
import TakRenderer from '@bg/game-tak/renderer';
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
  'risk@1.0.0': RiskRenderer as ComponentType<GameRendererProps<never>>,
  'ticket-to-ride@1.0.0': TtrRenderer as ComponentType<GameRendererProps<never>>,
  'chess@1.0.0': ChessRenderer as ComponentType<GameRendererProps<never>>,
  'snakes-ladders@1.0.0': SnakesRenderer as ComponentType<GameRendererProps<never>>,
  'ludo@1.0.0': LudoRenderer as ComponentType<GameRendererProps<never>>,
  'amlak@1.0.0': AmlakRenderer as ComponentType<GameRendererProps<never>>,
  'backgammon@1.0.0': BackgammonRenderer as ComponentType<GameRendererProps<never>>,
  'checkers@1.0.0': CheckersRenderer as ComponentType<GameRendererProps<never>>,
  'othello@1.0.0': OthelloRenderer as ComponentType<GameRendererProps<never>>,
  'quoridor@1.0.0': QuoridorRenderer as ComponentType<GameRendererProps<never>>,
  'onitama@1.0.0': OnitamaRenderer as ComponentType<GameRendererProps<never>>,
  'go@1.0.0': GoRenderer as ComponentType<GameRendererProps<never>>,
  'santorini@1.0.0': SantoriniRenderer as ComponentType<GameRendererProps<never>>,
  'tak@1.0.0': TakRenderer as ComponentType<GameRendererProps<never>>
};
