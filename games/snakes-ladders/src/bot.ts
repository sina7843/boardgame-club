// Snakes and Ladders has no decisions: the bot always rolls (every level plays the same).
import type { GameBot } from '@bg/game-sdk';
import type { SnakesAction, SnakesState } from './rules.ts';

export const snakesBot: GameBot<SnakesState, SnakesAction> = { decide: () => ({ type: 'roll' }) };
