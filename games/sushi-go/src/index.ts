import { sushiGoModule as rules } from './rules.ts';
import { sushiGoBot } from './bot.ts';

export { sushiGo } from './definition.ts';
export * from './rules.ts';
export { sushiGoBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const sushiGoModule: typeof rules = { ...rules, bot: sushiGoBot };
