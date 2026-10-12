import { chessModule as rules } from './rules.ts';
import { chessBot } from './bot.ts';

export { chess } from './definition.ts';
export * from './rules.ts';
export { chessBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const chessModule: typeof rules = { ...rules, bot: chessBot };
