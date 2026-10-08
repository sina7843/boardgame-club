import { defineGame } from '@bg/game-sdk';

// Onitama («اونیتاما») — base game rules with the 16 standard move cards. Rules implementation: rules.ts.
export const onitama = defineGame({
  manifest: {
    gameId: 'onitama',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'onitama@1.0.0',
    assetsRef: 'onitama/1'
  },
  catalog: {
    nameFa: 'اونیتاما',
    nameOriginal: 'Onitama',
    summaryFa: 'دوئل استادان رزمی روی صفحه ۵×۵؛ با پنج کارت حرکت که دست‌به‌دست می‌چرخند، استاد حریف را بزنید یا به معبدش برسید.',
    rulesFa: [
      'هر طرف یک استاد (وسط) و چهار شاگرد دارد. از ۱۶ کارت حرکت، پنج کارت پخش می‌شود: دو کارت برای هر بازیکن و یکی کنار صفحه. رنگ کارت کناری مشخص می‌کند چه کسی شروع می‌کند.',
      'در نوبتتان یکی از دو کارتتان را انتخاب کنید و یکی از مهره‌ها را طبق یکی از خانه‌های روشن آن کارت حرکت دهید (خانه وسط کارت جای مهره است و بالای کارت رو به حریف).',
      'کارت استفاده‌شده کنار صفحه می‌رود و شما کارتی را که کنار صفحه بود برمی‌دارید؛ پس حریف در نوبت بعد کارت شما را می‌گیرد.',
      'روی مهره خودی نمی‌شود رفت؛ رفتن روی مهره حریف آن را از بازی بیرون می‌کند. اگر هیچ حرکتی ممکن نباشد فقط یک کارت را عوض می‌کنید.',
      'پیروزی: زدن استاد حریف (راه سنگ) یا رساندن استاد خودتان به معبد حریف، یعنی خانه شروع استاد او (راه رود).',
      'برای جلوگیری از بازی بی‌پایان، تکرار سه‌باره یک وضعیت (با همان کارت‌ها) مساوی حساب می‌شود.'
    ],
    minutes: { min: 10, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود می‌بازید.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: حرکت با کارت، گرفتن کارت کناری و زدن استاد حریف.'
  }
});
