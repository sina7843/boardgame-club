import { backgammonModule as rules } from './rules.ts';
import { backgammonBot } from './bot.ts';

export { backgammon } from './definition.ts';
export * from './rules.ts';
export { backgammonBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const backgammonModule: typeof rules = { ...rules, bot: backgammonBot };
