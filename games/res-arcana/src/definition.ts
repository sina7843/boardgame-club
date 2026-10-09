import { defineGame } from '@bg/game-sdk';

// Res Arcana («آرکانا») — 2–4 players, essence engine-building race to 10 points. Rules implementation: rules.ts.
export const resArcana = defineGame({
  manifest: {
    gameId: 'res-arcana',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'res-arcana@1.0.0',
    assetsRef: 'res-arcana/1'
  },
  catalog: {
    nameFa: 'رس آرکانا',
    nameOriginal: 'Res Arcana',
    summaryFa: 'جادوگری با هشت شیء جادویی. جوهرهای آتش، زندگی، آرامش، مرگ و طلا را جمع کنید، اشیا را فعال کنید و مکان‌های قدرت و بناهای یادبود بخرید تا به ۱۰ امتیاز برسید.',
    rulesFa: [
      'هر دور اول همهٔ کارت‌های روی میز شما جوهر تولید می‌کنند. بعد به نوبت یک کار انجام می‌دهید تا همه رد کنند.',
      'کارها: بازی یک شیء از دست (با پرداخت هزینه)، فعال کردن یک کارت (یک بار در دور)، خرید مکان قدرت یا بنای یادبود، یا دور انداختن کارت برای ۱ طلا یا ۲ جوهر.',
      'وقتی رد می‌کنید یک کارت می‌کشید؛ اولین کسی که رد کند دور بعد را شروع می‌کند.',
      'امتیاز از مکان‌های قدرت، بناها و نشان‌های امتیازی می‌آید. پایان دوری که کسی به ۱۰ برسد، بیشترین امتیاز برنده است.'
    ],
    minutes: { min: 20, max: 40 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به‌جای شما رد می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: بازی یک شیء، خرید بنای یادبود و پایان دور.'
  }
});
