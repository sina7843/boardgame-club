import { ludoModule as rules } from './rules.ts';
import { ludoBot } from './bot.ts';

export { ludo } from './definition.ts';
export * from './rules.ts';
export { ludoBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const ludoModule: typeof rules = { ...rules, bot: ludoBot };
