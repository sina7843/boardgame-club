import { defineGame } from '@bg/game-sdk';

// Race for the Galaxy («رقابت کهکشانی») — 2–4 players, simultaneous phase selection, tableau building.
export const raceGalaxy = defineGame({
  manifest: {
    gameId: 'race-galaxy',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'race-galaxy@1.0.0',
    assetsRef: 'race-galaxy/1'
  },
  catalog: {
    nameFa: 'رقابت کهکشانی',
    nameOriginal: 'Race for the Galaxy',
    summaryFa: 'امپراتوری کهکشانی‌تان را با جهان‌ها و پیشرفت‌ها بسازید. هر دور همه پنهانی یک مرحله انتخاب می‌کنند و فقط مرحله‌های انتخاب‌شده اجرا می‌شوند.',
    rulesFa: [
      'هر دور همه هم‌زمان و پنهانی یکی از پنج مرحله را انتخاب می‌کنند: کاوش، توسعه، استقرار، مصرف یا تولید. هر مرحله‌ای که کسی انتخاب کرده برای همه اجرا می‌شود؛ انتخاب‌کننده پاداش می‌گیرد.',
      'کارت‌ها هم پول‌اند: برای گذاشتن یک پیشرفت یا جهان به اندازهٔ هزینه‌اش کارت از دست دور می‌ریزید. جهان‌های نظامی با قدرت نظامی (بدون کارت) گرفته می‌شوند.',
      'جهان‌های تولیدی در مرحلهٔ تولید کالا می‌گیرند و در مرحلهٔ مصرف کالاها امتیاز می‌شوند.',
      'وقتی کسی ۱۲ کارت روی میز داشته باشد یا امتیازهای بانک تمام شود، دور آخر است. امتیاز کارت‌ها و نشان‌ها جمع می‌شود.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'hard',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود مرحلهٔ تولید انتخاب می‌شود، اولین کارت نگه داشته و از گذاشتن کارت صرف‌نظر می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: انتخاب مرحلهٔ استقرار، پرداخت با کارت و پایان بازی با ۱۲ کارت.'
  }
});
