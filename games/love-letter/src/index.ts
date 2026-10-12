import { loveLetterModule as rules } from './rules.ts';
import { loveLetterBot } from './bot.ts';

export { loveLetter } from './definition.ts';
export * from './rules.ts';
export { loveLetterBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const loveLetterModule: typeof rules = { ...rules, bot: loveLetterBot };
