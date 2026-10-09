import { defineGame } from '@bg/game-sdk';

// Battleship («نبرد دریایی») — two players, hidden fleets on a 10×10 sea. Rules implementation: rules.ts.
export const battleship = defineGame({
  manifest: {
    gameId: 'battleship',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'battleship@1.0.0',
    assetsRef: 'battleship/1'
  },
  catalog: {
    nameFa: 'بتل‌شیپ',
    nameOriginal: 'Battleship',
    summaryFa: 'ناوگانتان را پنهانی در دریا بچینید و با شلیک‌های حساب‌شده کشتی‌های حریف را پیدا و غرق کنید.',
    rulesFa: [
      'هر کدام پنج کشتی (۵، ۴، ۳، ۳ و ۲ خانه‌ای) را افقی یا عمودی روی صفحهٔ ۱۰×۱۰ خودتان می‌چینید؛ کشتی‌ها روی هم نمی‌افتند و حریف آن‌ها را نمی‌بیند.',
      'به نوبت به یک خانه از دریای حریف شلیک می‌کنید: «آب» یعنی خطا، «اصابت» یعنی به کشتی خورده است.',
      'وقتی همهٔ خانه‌های یک کشتی اصابت بخورد، آن کشتی غرق و نامش اعلام می‌شود.',
      'اولین کسی که همهٔ کشتی‌های حریف را غرق کند برنده است.'
    ],
    minutes: { min: 15, max: 25 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود ناوگان تصادفی چیده می‌شود یا به اولین خانهٔ شلیک‌نشده شلیک می‌شود.',
    resignPolicyFa: 'انصراف یعنی باخت؛ حریف برنده می‌شود.',
    tutorialFa: 'آموزش تعاملی: شلیک، اصابت و غرق کردن کشتی.'
  }
});
