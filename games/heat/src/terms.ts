import type { Term } from '@bg/ui';

/** Heat terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». `*Ez` variants carry the Persian ezafe («گرمای…») so the default text stays byte-identical. */
export const terms = {
  heat: { fa: 'گرما', bg: 'Heat' }, heatEz: { fa: 'گرمای', bg: 'Heat' }, engineHeat: { fa: 'گرمای موتور', bg: 'Engine Heat' },
  stress: { fa: 'استرس', bg: 'Stress' }, gear: { fa: 'دنده', bg: 'Gear' }, gearEz: { fa: 'دندهٔ', bg: 'Gear' },
  boost: { fa: 'بوست', bg: 'Boost' }, slipstream: { fa: 'مکش', bg: 'Slipstream' }, adrenaline: { fa: 'آدرنالین', bg: 'Adrenaline' },
  cooldown: { fa: 'خنک‌سازی', bg: 'Cooldown' }, engine: { fa: 'موتور', bg: 'Engine' }, speed: { fa: 'سرعت', bg: 'Speed' },
  corner: { fa: 'پیچ', bg: 'Corner' }, garage: { fa: 'گاراژ', bg: 'Garage' },
  deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' }, discard: { fa: 'دورریز', bg: 'Discard' }
} satisfies Record<string, Term>;
