import type { ComponentType } from 'react';
import LineThreeRenderer from '@bg/game-line-three/renderer';
import SealedBidsRenderer from '@bg/game-sealed-bids/renderer';
import type { GameRendererProps } from '@bg/ui';

/**
 * Reviewed UI bundles keyed by the clientBundleRef pinned on each table. A table only renders with the bundle it
 * was started with; when a new rules version ships with a new bundle, add it here and keep the old key until no
 * active table uses it (docs/ADDING_A_GAME.md).
 */
export const RENDERERS: Record<string, ComponentType<GameRendererProps<never>>> = {
  'line-three@1.0.0': LineThreeRenderer as ComponentType<GameRendererProps<never>>,
  'sealed-bids@1.0.0': SealedBidsRenderer as ComponentType<GameRendererProps<never>>
};
