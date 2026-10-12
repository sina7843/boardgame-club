import { lostCitiesModule as rules } from './rules.ts';
import { lostCitiesBot } from './bot.ts';

export { lostCities } from './definition.ts';
export * from './rules.ts';
export { lostCitiesBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const lostCitiesModule: typeof rules = { ...rules, bot: lostCitiesBot };
