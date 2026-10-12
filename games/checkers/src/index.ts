import { checkersModule as rules } from './rules.ts';
import { checkersBot } from './bot.ts';

export { checkers } from './definition.ts';
export * from './rules.ts';
export { checkersBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const checkersModule: typeof rules = { ...rules, bot: checkersBot };
