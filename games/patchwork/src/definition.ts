import { defineGame } from '@bg/game-sdk';

// Patchwork («چهل‌تکه») — two players. Rules implementation: rules.ts.
export const patchwork = defineGame({
  manifest: {
    gameId: 'patchwork',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'patchwork@1.0.0',
    assetsRef: 'patchwork/1'
  },
  catalog: {
    nameFa: 'پچ‌ورک',
    nameOriginal: 'Patchwork',
    summaryFa: 'لحاف چهل‌تکه بدوزید: تکه‌پارچه بخرید، زمان صرف کنید و صفحهٔ ۹×۹ را طوری پر کنید که دکمه بیشتری درآمد داشته باشید و جای خالی کمتری بماند.',
    rulesFa: [
      'تکه‌ها دور یک دایره چیده شده‌اند. در نوبتتان یکی از سه تکهٔ جلوی مهره را با دکمه می‌خرید، می‌چرخانید یا برمی‌گردانید و روی لحافتان می‌دوزید، و به اندازهٔ زمان آن تکه روی مسیر زمان جلو می‌روید.',
      'یا به‌جای خرید، درست یک خانه جلوتر از حریف می‌روید و به ازای هر خانه یک دکمه می‌گیرید. همیشه کسی بازی می‌کند که روی مسیر زمان عقب‌تر است.',
      'با رد شدن از خانه‌های دکمه، به اندازهٔ دکمه‌های روی تکه‌های لحافتان درآمد می‌گیرید. اولین کسی که از خانه‌های تکهٔ چرمی رد شود، یک تکهٔ ۱×۱ مجانی می‌گیرد.',
      'اولین کسی که یک مربع ۷×۷ کامل بدوزد ۷ امتیاز پاداش دارد. وقتی هر دو به آخر مسیر برسند: دکمه‌ها منهای دو برابر خانه‌های خالی لحاف.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما جلو رفته و دکمه گرفته می‌شود (تکهٔ چرمی در اولین خانهٔ خالی دوخته می‌شود).',
    resignPolicyFa: 'انصراف یعنی باختن بازی.',
    tutorialFa: 'آموزش تعاملی: خریدن و دوختن یک تکه و رسیدن به پایان مسیر.'
  }
});
