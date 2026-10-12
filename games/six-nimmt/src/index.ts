import { sixNimmtModule as rules } from './rules.ts';
import { sixNimmtBot } from './bot.ts';

export { sixNimmt } from './definition.ts';
export * from './rules.ts';
export { sixNimmtBot } from './bot.ts';
/** The reviewed module with its computer opponent (overrides the bot-less export of rules.ts). */
export const sixNimmtModule: typeof rules = { ...rules, bot: sixNimmtBot };
