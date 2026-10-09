import { defineGame } from '@bg/game-sdk';

// Bohnanza («لوبیاکاری») — 2–5 players, base bean set, one pass through the deck. Rules implementation: rules.ts.
export const bohnanza = defineGame({
  manifest: {
    gameId: 'bohnanza',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'bohnanza@1.0.0',
    assetsRef: 'bohnanza/1'
  },
  catalog: {
    nameFa: 'بوهنانزا',
    nameOriginal: 'Bohnanza',
    summaryFa: 'لوبیا بکارید، معامله کنید و به‌موقع برداشت کنید. ترتیب کارت‌های دستتان را نمی‌توانید عوض کنید؛ پس معاملهٔ خوب نجاتتان می‌دهد.',
    rulesFa: [
      'در نوبتتان باید کارت اول دستتان را در یکی از دو مزرعه بکارید و می‌توانید کارت دوم را هم بکارید. هر مزرعه فقط یک نوع لوبیا دارد.',
      'بعد دو کارت رو می‌شود. می‌توانید آن‌ها یا کارت‌های دستتان را با دیگران معامله کنید یا ببخشید؛ هر چه بگیرید باید همان موقع کاشته شود.',
      'برداشت هر مزرعه بر اساس تعداد لوبیاها سکه می‌دهد (جدول روی کارت). مزرعهٔ تک‌لوبیا را وقتی مزرعهٔ پرتری دارید نمی‌توانید برداشت کنید. با ۳ سکه مزرعهٔ سوم بخرید.',
      'در پایان نوبت سه کارت به ته دستتان اضافه می‌شود. وقتی دسته تمام شود همه مزرعه‌ها برداشت می‌شوند و بیشترین سکه می‌برد.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود کارت لازم خودکار کاشته می‌شود و معامله بسته یا پیشنهاد رد می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب سکه رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: کاشتن، رو کردن، بخشیدن کارت و کاشتن کارت‌های معامله.'
  }
});
