import { camelModule as rules } from './rules.ts';
import { camelBot } from './bot.ts';

export { camelUp } from './definition.ts';
export * from './rules.ts';
export { camelBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const camelModule: typeof rules = { ...rules, bot: camelBot };
