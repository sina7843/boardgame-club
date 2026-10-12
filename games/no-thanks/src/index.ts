import { noThanksModule as rules } from './rules.ts';
import { noThanksBot } from './bot.ts';

export { noThanks } from './definition.ts';
export * from './rules.ts';
export { noThanksBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const noThanksModule: typeof rules = { ...rules, bot: noThanksBot };
