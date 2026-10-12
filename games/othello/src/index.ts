import { othelloModule as rules } from './rules.ts';
import { othelloBot } from './bot.ts';

export { othello } from './definition.ts';
export * from './rules.ts';
export { othelloBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const othelloModule: typeof rules = { ...rules, bot: othelloBot };
