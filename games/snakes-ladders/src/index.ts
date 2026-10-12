import { snakesModule as rules } from './rules.ts';
import { snakesBot } from './bot.ts';

export { snakesLadders } from './definition.ts';
export * from './rules.ts';
export { snakesBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const snakesModule: typeof rules = { ...rules, bot: snakesBot };
