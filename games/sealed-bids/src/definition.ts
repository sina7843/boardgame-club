import { defineGame } from '@bg/game-sdk';

// Original engine-proof fixture (docs/GAME_MODULES.md). Rules implementation: DRAGON-01.
export const sealedBids = defineGame({
  manifest: {
    gameId: 'sealed-bids',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'sealed-bids@1.0.0',
    assetsRef: 'sealed-bids/1'
  },
  catalog: {
    nameFa: 'مزایده سربسته',
    nameOriginal: 'Sealed Bids',
    summaryFa: 'بازی ۲ تا ۴ نفره با پیشنهاد پنهان و هم‌زمان؛ در پنج دور برای جایزه‌های ۱ تا ۵ امتیازی رقابت کنید.',
    rulesFa: [
      'هر بازیکن ژتون‌های ۱ تا ۵ را مخفیانه در اختیار دارد.',
      'در هر دور همه هم‌زمان یک ژتون استفاده‌نشده را مهروموم می‌کنند؛ پیشنهاد ثبت‌شده قابل تغییر نیست.',
      'پس از ثبت همه، پیشنهادها یک‌جا آشکار می‌شوند؛ بالاترین پیشنهاد یکتا امتیاز دور را می‌برد و تساوی بالاترین امتیازی ندارد.',
      'پس از دور پنجم بیشترین امتیاز برنده است؛ امتیاز برابر رتبه مشترک می‌گیرد.'
    ],
    minutes: { min: 5, max: 15 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: true,
    timeoutPolicyFa: 'اگر زمان تمام شود، کم‌ارزش‌ترین ژتون استفاده‌نشده به‌جای بازیکن ثبت می‌شود.',
    resignPolicyFa: 'پس از انصراف، در دورهای باقی‌مانده کم‌ارزش‌ترین ژتون بازیکن به‌طور خودکار ثبت می‌شود.',
    tutorialFa: 'آموزش تعاملی کوتاه: ثبت پیشنهاد پنهان و دیدن آشکارسازی هم‌زمان.'
  }
});
