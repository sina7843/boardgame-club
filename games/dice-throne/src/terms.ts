import type { Term } from '@bg/ui';

/** Dice Throne terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Hero and ability names come from the rules data. */
export const terms = {
  combatPoints: { fa: 'امتیاز رزم', bg: 'Combat Points' }, stun: { fa: 'گیجی', bg: 'Stun' }, shield: { fa: 'سپر', bg: 'Shield' },
  undefendable: { fa: 'دفاع‌ناپذیر', bg: 'Undefendable' }, defense: { fa: 'دفاع', bg: 'Defense' }
} satisfies Record<string, Term>;
