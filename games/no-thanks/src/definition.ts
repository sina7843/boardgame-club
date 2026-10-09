import { defineGame } from '@bg/game-sdk';

// No Thanks! («نه، مرسی!») — standard rules for 3–7, plus the unofficial 2-player game. Rules: rules.ts.
export const noThanks = defineGame({
  manifest: {
    gameId: 'no-thanks',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 7 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'no-thanks@1.0.0',
    assetsRef: 'no-thanks/1'
  },
  catalog: {
    nameFa: 'نو تنکس!',
    nameOriginal: 'No Thanks!',
    summaryFa: 'بازی کارتی کوتاه و پرتنش؛ کارت‌های منفی را با ژتون رد کنید یا با ژتون‌های رویش بردارید.',
    rulesFa: [
      'کارت‌های ۳ تا ۳۵ بُر می‌خورند و ۹ کارت بدون اینکه کسی ببیند کنار می‌روند. هر بازیکن ۱۱ ژتون دارد (۶ نفره ۹ و ۷ نفره ۷ ژتون) و تعداد ژتون‌ها مخفی است.',
      'در نوبتتان یا کارت وسط را با همه ژتون‌های رویش برمی‌دارید، یا یک ژتون رویش می‌گذارید و می‌گویید «نه، مرسی!» تا نوبت به نفر بعد برسد. بدون ژتون باید بردارید.',
      'کسی که کارت برمی‌دارد کارت بعدی را رو می‌کند و دوباره تصمیم می‌گیرد.',
      'پایان: وقتی کارت‌ها تمام شوند. امتیاز هر کس جمع کارت‌هایش است، ولی از هر رشته عدد پشت سر هم (مثلاً ۲۴، ۲۵، ۲۶) فقط کوچک‌ترینش حساب می‌شود؛ هر ژتون یک امتیاز کم می‌کند. کمترین امتیاز برنده است.',
      'بازی دونفره قانون رسمی نیست ولی رایج است.'
    ],
    minutes: { min: 10, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود، تا وقتی ژتون دارید به جایتان رد می‌شود؛ بدون ژتون کارت برداشته می‌شود.',
    resignPolicyFa: 'انصراف یعنی کنار رفتن و رتبه آخر؛ بقیه بازی را ادامه می‌دهند.',
    tutorialFa: 'آموزش تعاملی: کامل کردن یک رشته، رد کردن با ژتون و پایان بازی.'
  }
});
