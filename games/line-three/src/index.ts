import { lineThreeModule as rules } from './rules.ts';
import { lineThreeBot } from './bot.ts';

export { lineThree } from './definition.ts';
export * from './rules.ts';
export { lineThreeBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const lineThreeModule: typeof rules = { ...rules, bot: lineThreeBot };
