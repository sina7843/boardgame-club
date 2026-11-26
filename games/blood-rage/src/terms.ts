import type { Term } from '@bg/ui';

/** Blood Rage terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  rage: { fa: 'خشم', bg: 'Rage' }, axe: { fa: 'تبر', bg: 'Axes' }, horn: { fa: 'شاخ', bg: 'Horns' }, glory: { fa: 'افتخار', bg: 'Glory' },
  age: { fa: 'عصر', bg: 'Age' }, godsGifts: { fa: 'هدایای خدایان', bg: "Gods' Gifts" }, quests: { fa: 'مأموریت‌ها', bg: 'Quests' },
  ragnarok: { fa: 'راگناروک', bg: 'Ragnarök' }, valhalla: { fa: 'والهالا', bg: 'Valhalla' }, releaseValhalla: { fa: 'آزادی از والهالا', bg: 'Release Valhalla' },
  pillage: { fa: 'غارت', bg: 'Pillage' }, march: { fa: 'لشکرکشی', bg: 'March' }, invade: { fa: 'یورش', bg: 'Invade' }, upgrade: { fa: 'ارتقا', bg: 'Upgrade' }
} satisfies Record<string, Term>;
