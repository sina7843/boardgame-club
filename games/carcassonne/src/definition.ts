import { defineGame } from '@bg/game-sdk';

// Carcassonne («قلعه‌سازان») — 2–5 players, base game without farmers. Rules implementation: rules.ts.
export const carcassonne = defineGame({
  manifest: {
    gameId: 'carcassonne',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'carcassonne@1.0.0',
    assetsRef: 'carcassonne/1'
  },
  catalog: {
    nameFa: 'کارکاسون',
    nameOriginal: 'Carcassonne',
    summaryFa: 'کاشی به کاشی سرزمین بسازید: جاده بکشید، شهرهای بارودار را کامل کنید و صومعه بسازید. پیروان خود را به‌موقع بگذارید و به‌موقع پس بگیرید.',
    rulesFa: [
      'در نوبتتان یک کاشی می‌کشید و کنار کاشی‌های روی میز می‌گذارید؛ لبه‌ها باید جور باشند (جاده با جاده، شهر با شهر، زمین با زمین). اگر جایی برایش نباشد کنار گذاشته می‌شود.',
      'بعد می‌توانید یکی از هفت پیروتان را روی جاده، شهر یا صومعهٔ همان کاشی بگذارید — اگر آن جاده یا شهر صاحب پیرو نداشته باشد.',
      'جادهٔ کامل هر کاشی ۱ امتیاز، شهر کامل هر کاشی ۲ (و هر نشان ۲)، صومعهٔ محاصره‌شده ۹ امتیاز. صاحب بیشترین پیرو امتیاز را می‌گیرد (در تساوی همه) و پیروها برمی‌گردند.',
      'وقتی کاشی‌ها تمام شود، کارهای نیمه‌تمام هم امتیاز کمتری می‌گیرند (شهر هر کاشی و نشان ۱). کشاورزها در این نسخه نیستند.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود کاشی در اولین جای ممکن و بدون پیرو گذاشته می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: کامل کردن شهر و گذاشتن پیرو روی صومعه.'
  }
});
