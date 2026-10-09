import { defineGame } from '@bg/game-sdk';

// Skull («جمجمه») — standard rules for 3–6, plus an unofficial 2-player game. Rules implementation: rules.ts.
export const skull = defineGame({
  manifest: {
    gameId: 'skull',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'skull@1.0.0',
    assetsRef: 'skull/1'
  },
  catalog: {
    nameFa: 'اسکال',
    nameOriginal: 'Skull',
    summaryFa: 'بازی بلوف خالص: سه گل و یک جمجمه؛ قول بدهید چند گل رو می‌کنید و دعا کنید به جمجمه نرسید.',
    rulesFa: [
      'هر بازیکن چهار دیسک دارد: سه گل و یک جمجمه. در شروع هر دور همه یک دیسک رو به پایین جلوی خودشان می‌گذارند.',
      'در نوبتتان یا یک دیسک دیگر روی دسته‌تان می‌گذارید، یا «پیشنهاد» می‌دهید: عددی که قول می‌دهید آن تعداد دیسک را رو کنید و فقط گل ببینید.',
      'از آن به بعد هر کس یا عدد بالاتری می‌گوید یا کنار می‌کشد. وقتی بقیه کنار کشیدند (یا عدد به کل دیسک‌های روی میز رسید)، پیشنهاددهنده اول همه دیسک‌های خودش را رو می‌کند و بعد دیسک‌های بالایی دیگران را به انتخاب خودش.',
      'اگر همه گل بودند یک امتیاز می‌گیرد؛ دو امتیاز یعنی برد. اگر به جمجمه برسد، یکی از دیسک‌هایش به‌طور تصادفی و مخفیانه حذف می‌شود؛ کسی که همه دیسک‌هایش را از دست بدهد بیرون است و آخرین نفر باقی‌مانده برنده است.',
      'بازی دونفره قانون رسمی نیست ولی رایج است.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود به جای شما یک گل گذاشته می‌شود، در رقابت کنار می‌کشید و در رو کردن اولین دسته ممکن رو می‌شود.',
    resignPolicyFa: 'انصراف یعنی کنار رفتن؛ آخرین نفر باقی‌مانده برنده است.',
    tutorialFa: 'آموزش تعاملی: گذاشتن گل، پیشنهاد و رو کردن تا امتیاز دوم.'
  }
});
