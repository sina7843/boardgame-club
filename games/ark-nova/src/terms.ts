import type { Term } from '@bg/ui';

/** Ark Nova terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  animals: { fa: 'حیوانات', bg: 'Animals' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, build: { fa: 'ساخت', bg: 'Build' },
  association: { fa: 'انجمن', bg: 'Association' }, sponsors: { fa: 'حامیان', bg: 'Sponsors' },
  break: { fa: 'استراحت', bg: 'Break' }, display: { fa: 'ویترین', bg: 'Display' },
  reputation: { fa: 'اعتبار', bg: 'Reputation' }, appeal: { fa: 'جذابیت', bg: 'Appeal' },
  conservation: { fa: 'حفاظت', bg: 'Conservation' }, conservationPoints: { fa: 'امتیاز حفاظت', bg: 'Conservation Points' },
  venom: { fa: 'زهر', bg: 'Venom' }, multiplier: { fa: 'دوبرابرکننده', bg: 'Multiplier' }, constriction: { fa: 'فشار', bg: 'Constriction' },
  pilfering: { fa: 'دستبرد', bg: 'Pilfering' }, partnerZoo: { fa: 'باغ‌وحش همکار', bg: 'Partner Zoo' }, university: { fa: 'دانشگاه', bg: 'University' }
} satisfies Record<string, Term>;
