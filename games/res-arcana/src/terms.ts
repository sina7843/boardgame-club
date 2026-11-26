import type { Term } from '@bg/ui';

/** Res Arcana terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  essence: { fa: 'جوهر', bg: 'Essence' }, elan: { fa: 'آتش', bg: 'Elan' }, life: { fa: 'زندگی', bg: 'Life' }, calm: { fa: 'آرامش', bg: 'Calm' },
  death: { fa: 'مرگ', bg: 'Death' }, gold: { fa: 'طلا', bg: 'Gold' },
  mage: { fa: 'جادوگر', bg: 'Mage' }, mages: { fa: 'جادوگران', bg: 'Mages' }, artifact: { fa: 'آرتیفکت', bg: 'Artifact' },
  placeOfPower: { fa: 'مکان قدرت', bg: 'Place of Power' }, placesOfPower: { fa: 'مکان‌های قدرت', bg: 'Places of Power' },
  monument: { fa: 'بنا', bg: 'Monument' }, monuments: { fa: 'بناها', bg: 'Monuments' }, monumentsOf: { fa: 'بناهای', bg: 'Monuments' }, noEssence: { fa: 'بی‌جوهر', bg: 'No Essence' },
  collect: { fa: 'تولید', bg: 'Collect' }, power: { fa: 'قدرت', bg: 'Power' },
  cost: { fa: 'هزینه', bg: 'Cost' }, free: { fa: 'رایگان', bg: 'Free' }, round: { fa: 'دور', bg: 'Round' }, card: { fa: 'کارت', bg: 'Card' }, hand: { fa: 'دست شما', bg: 'Your hand' },
  table: { fa: 'میز شما', bg: 'Your tableau' }, pass: { fa: 'رد کردن', bg: 'Pass' }, passYou: { fa: 'رد کنید', bg: 'Pass' }, passed: { fa: 'رد کرد', bg: 'Passed' },
  tap: { fa: 'فعال کردن', bg: 'Tap' }, tapped: { fa: 'استفاده شد', bg: 'Tapped' }, play: { fa: 'بازی', bg: 'Play' }, playGer: { fa: 'بازی کردن', bg: 'Play' },
  buyGer: { fa: 'خریدن', bg: 'Buy' }, discard: { fa: 'دور انداختن', bg: 'Discard' }, drawYou: { fa: 'بکشید', bg: 'Draw' },
  vp: { fa: 'امتیاز', bg: 'VP' }, monumentEz: { fa: 'بنای', bg: 'Monument' }, onTable: { fa: 'روی میز', bg: 'In play' }
} satisfies Record<string, Term>;
