import { yahtzeeModule as rules } from './rules.ts';
import { yahtzeeBot } from './bot.ts';

export { yahtzee } from './definition.ts';
export * from './rules.ts';
export { yahtzeeBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const yahtzeeModule: typeof rules = { ...rules, bot: yahtzeeBot };
