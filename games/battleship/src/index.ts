import { bsModule as rules } from './rules.ts';
import { bsBot } from './bot.ts';

export { battleship } from './definition.ts';
export * from './rules.ts';
export { bsBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const bsModule: typeof rules = { ...rules, bot: bsBot };
