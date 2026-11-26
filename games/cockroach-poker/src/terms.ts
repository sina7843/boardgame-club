import type { Term } from '@bg/ui';

/** Cockroach Poker terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  cockroach: { fa: 'سوسک', bg: 'Cockroach' }, bat: { fa: 'خفاش', bg: 'Bat' }, fly: { fa: 'مگس', bg: 'Fly' }, toad: { fa: 'وزغ', bg: 'Toad' },
  rat: { fa: 'موش', bg: 'Rat' }, scorpion: { fa: 'عقرب', bg: 'Scorpion' }, spider: { fa: 'عنکبوت', bg: 'Spider' }, stinkbug: { fa: 'سن', bg: 'Stinkbug' }
,
  card: { fa: 'کارت', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, hand: { fa: 'دست', bg: 'Hand' }, facedown: { fa: 'پشت‌ورو', bg: 'Face-down' },
  claim: { fa: 'ادعا', bg: 'Claim' }, claimEz: { fa: 'ادعای', bg: 'Claim' }, truth: { fa: 'راست', bg: 'True' }, lie: { fa: 'دروغ', bg: 'False' }, bluff: { fa: 'بلوف', bg: 'Bluff' },
  callTrue: { fa: 'راست می‌گوید', bg: 'True' }, callFalse: { fa: 'دروغ می‌گوید', bg: 'False' }, peekPass: { fa: 'نگاه کن و رد کن', bg: 'Peek & Pass' },
  giveN: { fa: 'دادن', bg: 'Give' }, giveImp: { fa: 'بده', bg: 'Give' }, passN: { fa: 'رد کردن', bg: 'Pass' }, passImp: { fa: 'رد کن', bg: 'Pass' }, passPol: { fa: 'رد کنید', bg: 'Pass' },
  danger: { fa: 'خطر', bg: 'Danger' }, front: { fa: 'جلوی میز', bg: 'In Front' }, most: { fa: 'بیشترین', bg: 'Most' }
} satisfies Record<string, Term>;
