import { unoModule as rules } from './rules.ts';
import { unoBot } from './bot.ts';

export { uno } from './definition.ts';
export * from './rules.ts';
export { unoBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const unoModule: typeof rules = { ...rules, bot: unoBot };
