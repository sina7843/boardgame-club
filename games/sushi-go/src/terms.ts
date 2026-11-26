import type { Term } from '@bg/ui';

/** Sushi Go terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  tempura: { fa: 'تمپورا', bg: 'Tempura' }, sashimi: { fa: 'ساشیمی', bg: 'Sashimi' }, dumpling: { fa: 'دامپلینگ', bg: 'Dumpling' },
  maki1: { fa: 'ماکی ۱', bg: 'Maki 1' }, maki2: { fa: 'ماکی ۲', bg: 'Maki 2' }, maki3: { fa: 'ماکی ۳', bg: 'Maki 3' },
  salmonNigiri: { fa: 'نیگیری سالمون', bg: 'Salmon Nigiri' }, squidNigiri: { fa: 'نیگیری ماهی مرکب', bg: 'Squid Nigiri' },
  eggNigiri: { fa: 'نیگیری تخم‌مرغ', bg: 'Egg Nigiri' }, nigiri: { fa: 'نیگیری', bg: 'Nigiri' },
  pudding: { fa: 'پودینگ', bg: 'Pudding' }, wasabi: { fa: 'واسابی', bg: 'Wasabi' }, chopsticks: { fa: 'چاپستیک', bg: 'Chopsticks' }
} satisfies Record<string, Term>;
