// Reviewed in-repo game registry. Only modules listed here can be seeded/published;
// no uploaded or external code is ever executed.
import { lineThree } from '@bg/game-line-three';
import { sealedBids } from '@bg/game-sealed-bids';
import type { GameDefinition } from '@bg/game-sdk';

export const gameRegistry: readonly GameDefinition[] = [lineThree, sealedBids];
