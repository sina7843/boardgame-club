import type { Term } from '@bg/ui';

/** Res Arcana terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  essence: { fa: 'جوهر', bg: 'Essence' }, elan: { fa: 'آتش', bg: 'Elan' }, life: { fa: 'زندگی', bg: 'Life' }, calm: { fa: 'آرامش', bg: 'Calm' },
  death: { fa: 'مرگ', bg: 'Death' }, gold: { fa: 'طلا', bg: 'Gold' },
  mage: { fa: 'جادوگر', bg: 'Mage' }, mages: { fa: 'جادوگران', bg: 'Mages' }, artifact: { fa: 'آرتیفکت', bg: 'Artifact' },
  placeOfPower: { fa: 'مکان قدرت', bg: 'Place of Power' }, placesOfPower: { fa: 'مکان‌های قدرت', bg: 'Places of Power' },
  monument: { fa: 'بنا', bg: 'Monument' }, monuments: { fa: 'بناها', bg: 'Monuments' }, monumentsOf: { fa: 'بناهای', bg: 'Monuments' }, noEssence: { fa: 'بی‌جوهر', bg: 'No Essence' },
  collect: { fa: 'تولید', bg: 'Collect' }, power: { fa: 'قدرت', bg: 'Power' }
} satisfies Record<string, Term>;
