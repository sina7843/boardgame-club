import { defineGame } from '@bg/game-sdk';

// Machi Koro («شهر تاس») — 2–4 players. Rules implementation: rules.ts.
export const machiKoro = defineGame({
  manifest: {
    gameId: 'machi-koro',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'machi-koro@1.0.0',
    assetsRef: 'machi-koro/1'
  },
  catalog: {
    nameFa: 'شهر تاس',
    nameOriginal: 'Machi Koro',
    summaryFa: 'شهردار شده‌اید: با تاس درآمد بگیرید، مزرعه و نانوایی و کارخانه بسازید و اولین کسی باشید که چهار بنای بزرگ شهر را تمام می‌کند.',
    rulesFa: [
      'در نوبتتان تاس می‌ریزید. هر کارت مغازه یک عدد دارد: کارت‌های آبی در نوبت همه درآمد می‌دهند، سبزها فقط در نوبت خودتان، قرمزها از کسی که تاس ریخته پول می‌گیرند و بنفش‌ها در نوبت خودتان از بقیه.',
      'بعد می‌توانید یک مغازه بخرید یا یکی از چهار بنای بزرگ را بسازید: ایستگاه قطار (ریختن دو تاس)، مرکز خرید (+۱ برای قهوه‌خانه/رستوران و نانوایی/بقالی)، شهربازی (جفت آمدن یعنی نوبت دوباره) و برج رادیو (یک بار دوباره ریختن).',
      'اولین کسی که هر چهار بنای بزرگ را بسازد برنده است.'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما یک تاس ریخته می‌شود و چیزی ساخته نمی‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب تعداد بناهای بزرگ و سکه رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: ریختن تاس و ساختن آخرین بنای بزرگ.'
  }
});
