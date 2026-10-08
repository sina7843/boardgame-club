import { defineGame } from '@bg/game-sdk';

// Othello («اتللو») — World Othello Federation rules. Rules implementation: rules.ts.
export const othello = defineGame({
  manifest: {
    gameId: 'othello',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'firstMove', labelFa: 'مهره سیاه',
      descriptionFa: 'سیاه حرکت اول را انجام می‌دهد.',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان سیاه باشد' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'othello@1.0.0',
    assetsRef: 'othello/1'
  },
  catalog: {
    nameFa: 'اتللو',
    nameOriginal: 'Othello',
    summaryFa: 'یک دقیقه برای یادگرفتن، یک عمر برای استاد شدن؛ مهره‌های حریف را محاصره کنید تا رنگشان برگردد.',
    rulesFa: [
      'صفحه ۸×۸ با چهار مهره در وسط شروع می‌شود و سیاه اول حرکت می‌کند.',
      'هر حرکت یک مهره در خانه خالی است، به شرطی که دست‌کم یک ردیف (افقی، عمودی یا مورب) از مهره‌های حریف بین مهره تازه و یکی از مهره‌های شما گیر بیفتد. همه مهره‌های گیرافتاده برمی‌گردند و رنگ شما می‌شوند.',
      'اگر حرکت مجازی ندارید نوبتتان خودکار رد می‌شود. بازی وقتی تمام می‌شود که هیچ‌کدام از دو بازیکن حرکتی نداشته باشد.',
      'هر که مهره بیشتری داشته باشد می‌برد؛ خانه‌های خالی باقی‌مانده به حساب برنده نوشته می‌شوند. تعداد برابر یعنی مساوی.'
    ],
    minutes: { min: 5, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود می‌بازید.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: محاصره و برگرداندن مهره‌ها و بردن با گرفتن همه مهره‌های حریف.'
  }
});
