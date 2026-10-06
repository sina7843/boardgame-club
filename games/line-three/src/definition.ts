import { defineGame } from '@bg/game-sdk';

// Original engine-proof fixture (docs/GAME_MODULES.md). Rules implementation: DRAGON-01.
export const lineThree = defineGame({
  manifest: {
    gameId: 'line-three',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'firstMove', labelFa: 'شروع‌کننده',
      descriptionFa: 'چه کسی حرکت اول را انجام می‌دهد.',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان (صندلی اول)' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'line-three@1.0.0',
    assetsRef: 'line-three/1'
  },
  catalog: {
    nameFa: 'سه‌خطی',
    nameOriginal: 'Line Three',
    summaryFa: 'بازی دونفره روی جدول ۳×۳؛ هر کس زودتر سه نشان خود را در یک ردیف، ستون یا قطر بچیند برنده است.',
    rulesFa: [
      'دو بازیکن با نشان‌های X و O بازی می‌کنند؛ شروع‌کننده به‌صورت پیش‌فرض تصادفی و ثبت‌شده تعیین می‌شود؛ میز می‌تواند شروع با میزبان را انتخاب کند.',
      'در هر نوبت، بازیکن نشان خود را در یک خانه خالی می‌گذارد.',
      'سه نشان یکسان در ردیف، ستون یا قطر برنده است؛ پرشدن جدول بدون برنده مساوی است.',
      'مختصات جدول در پوسته راست‌به‌چپ آینه نمی‌شود.'
    ],
    minutes: { min: 2, max: 5 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: true,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود، بازیکن نوبت‌دار بازنده است.',
    resignPolicyFa: 'انصراف به معنای باخت بازیکن منصرف است.',
    tutorialFa: 'آموزش تعاملی کوتاه: چیدن سه نشان و شناخت حالت مساوی.'
  }
});
