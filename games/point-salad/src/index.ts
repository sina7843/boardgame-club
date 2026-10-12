import { pointSaladModule as rules } from './rules.ts';
import { pointSaladBot } from './bot.ts';

export { pointSalad } from './definition.ts';
export * from './rules.ts';
export { pointSaladBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const pointSaladModule: typeof rules = { ...rules, bot: pointSaladBot };
