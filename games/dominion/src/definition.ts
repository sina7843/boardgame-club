import { defineGame } from '@bg/game-sdk';

// Dominion («قلمرو») — 2–4 players, deck-building with the ten-card first-game kingdom. Rules implementation: rules.ts.
export const dominion = defineGame({
  manifest: {
    gameId: 'dominion',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'dominion@1.0.0',
    assetsRef: 'dominion/1'
  },
  catalog: {
    nameFa: 'دومینیون',
    nameOriginal: 'Dominion',
    summaryFa: 'با ده کارت ساده شروع کنید و دسته‌تان را بسازید: کارت‌های کنش، گنج و زمین بخرید تا بیشترین ایالت‌ها مال شما شود.',
    rulesFa: [
      'هر نوبت پنج کارت در دست دارید. اول یک کارت کنش بازی می‌کنید (کارت‌ها ممکن است کنش، کارت یا خرید بیشتری بدهند).',
      'بعد گنج‌ها را رو می‌کنید و با سکه‌ها یک کارت از بازار می‌خرید. کارت خریده به دورریز شما می‌رود و بعداً در دسته می‌آید.',
      'آخر نوبت همهٔ کارت‌ها دور ریخته می‌شوند و پنج کارت تازه می‌کشید؛ وقتی دسته تمام شود دورریز بُر می‌خورد.',
      'وقتی ایالت‌ها یا سه دستهٔ بازار تمام شوند بازی تمام است: ملک ۱، تیول ۳ و ایالت ۶ امتیاز.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود نوبت شما بدون خرید تمام می‌شود (یا کارت‌های اضافی از دست دور ریخته می‌شوند).',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: بازی کردن آهنگری، رو کردن گنج‌ها و خرید ایالت.'
  }
});
