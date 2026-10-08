// Reviewed in-repo game registry. Only modules listed here can be seeded/published;
// no uploaded or external code is ever executed.
import { lineThree } from '@bg/game-line-three';
import { sealedBids } from '@bg/game-sealed-bids';
import { uno } from '@bg/game-uno';
import { chess } from '@bg/game-chess';
import { snakesLadders } from '@bg/game-snakes-ladders';
import { ludo } from '@bg/game-ludo';
import { amlak } from '@bg/game-amlak';
import { unmatched } from '@bg/game-unmatched';
import { catan } from '@bg/game-catan';
import { risk } from '@bg/game-risk';
import { ticketToRide } from '@bg/game-ticket-to-ride';
import { backgammon } from '@bg/game-backgammon';
import { checkers } from '@bg/game-checkers';
import { othello } from '@bg/game-othello';
import { quoridor } from '@bg/game-quoridor';
import { onitama } from '@bg/game-onitama';
import type { GameDefinition } from '@bg/game-sdk';

export const gameRegistry: readonly GameDefinition[] = [lineThree, sealedBids, uno, unmatched, catan, chess, snakesLadders, ludo, risk, amlak, ticketToRide, backgammon, checkers, othello, quoridor, onitama];
