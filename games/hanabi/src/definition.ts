import { defineGame } from '@bg/game-sdk';

// Hanabi («آتش‌بازی») — cooperative, 2–5 players. Rules implementation: rules.ts.
export const hanabi = defineGame({
  manifest: {
    gameId: 'hanabi',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'hanabi@1.0.0',
    assetsRef: 'hanabi/1'
  },
  catalog: {
    nameFa: 'هانابی',
    nameOriginal: 'Hanabi',
    summaryFa: 'بازی گروهی: کارت‌های خودتان را نمی‌بینید ولی کارت هم‌تیمی‌ها را می‌بینید. با سرنخ دادن کمک کنید فشفشه‌های پنج رنگ به ترتیب ۱ تا ۵ آتش شوند.',
    rulesFa: [
      'کارت‌هایتان را برعکس در دست دارید: خودتان نمی‌بینید، بقیه می‌بینند. پنج رنگ و از هر رنگ عددهای ۱ (سه کارت)، ۲، ۳، ۴ (هر کدام دو کارت) و ۵ (یک کارت).',
      'در نوبتتان یکی از این کارها را می‌کنید: با خرج یک ژتون سرنخ به یک هم‌تیمی می‌گویید کدام کارت‌هایش یک رنگ یا یک عدد مشخص است؛ یک کارت را دور می‌اندازید و یک ژتون سرنخ پس می‌گیرید؛ یا یک کارت را بازی می‌کنید.',
      'کارت بازی‌شده باید عدد بعدی همان رنگ روی میز باشد؛ وگرنه یک فیوز می‌سوزد. با سه فیوز سوخته تیم می‌بازد. کامل کردن یک رنگ (۵) یک ژتون سرنخ برمی‌گرداند.',
      'وقتی دسته تمام شود، هر کس یک نوبت دیگر دارد. امتیاز تیم جمع بالاترین عدد هر رنگ است (حداکثر ۲۵).'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما قدیمی‌ترین کارت دور انداخته می‌شود (یا با ژتون کامل یک سرنخ داده می‌شود).',
    resignPolicyFa: 'انصراف یعنی پایان بازی و باخت کل تیم.',
    tutorialFa: 'آموزش تعاملی: سرنخ دادن و بازی کردن کارتی که درباره‌اش سرنخ گرفته‌اید.'
  }
});
