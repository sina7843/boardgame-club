import type { Term } from '@bg/ui';

/** Cockroach Poker terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  cockroach: { fa: 'سوسک', bg: 'Cockroach' }, bat: { fa: 'خفاش', bg: 'Bat' }, fly: { fa: 'مگس', bg: 'Fly' }, toad: { fa: 'وزغ', bg: 'Toad' },
  rat: { fa: 'موش', bg: 'Rat' }, scorpion: { fa: 'عقرب', bg: 'Scorpion' }, spider: { fa: 'عنکبوت', bg: 'Spider' }, stinkbug: { fa: 'سن', bg: 'Stinkbug' }
} satisfies Record<string, Term>;
