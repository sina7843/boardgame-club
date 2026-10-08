import { defineGame } from '@bg/game-sdk';

// Quoridor («کوریدور») — race to the far edge, block with walls. Rules implementation: rules.ts.
export const quoridor = defineGame({
  manifest: {
    gameId: 'quoridor',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [{
      key: 'firstMove', labelFa: 'شروع‌کننده',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'quoridor@1.0.0',
    assetsRef: 'quoridor/1'
  },
  catalog: {
    nameFa: 'کوریدور',
    nameOriginal: 'Quoridor',
    summaryFa: 'مسابقه رسیدن به آن سوی صفحه ۹×۹؛ با دیوارها راه حریف را طولانی کنید ولی هرگز کامل نبندید.',
    rulesFa: [
      'هر بازیکن یک مهره دارد که از وسط ضلع خودش شروع می‌کند. اولین کسی که به ضلع روبه‌رو برسد برنده است.',
      'در هر نوبت یا مهره را یک خانه (بالا، پایین، چپ یا راست) حرکت می‌دهید یا یک دیوار دوخانه‌ای بین خانه‌ها می‌گذارید. دو نفره هر کس ۱۰ دیوار دارد، سه نفره ۷ و چهار نفره ۵.',
      'دیوارها نباید روی هم بیفتند یا همدیگر را قطع کنند و هرگز نباید همه راه‌های یک مهره به هدفش را ببندند.',
      'اگر مهره حریف درست کنار شما باشد، می‌توانید از رویش بپرید؛ اگر پشتش دیوار یا لبه صفحه باشد، به یکی از دو خانه کناری او (مورب) می‌روید.',
      'بازی سه نفره قانون رسمی نیست ولی رایج است: بازیکنان از پایین، چپ و بالا شروع می‌کنند.'
    ],
    minutes: { min: 5, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود، مهره شما یک خانه در کوتاه‌ترین مسیر جلو می‌رود. سه بار پشت سر هم یعنی کنار رفتن از بازی.',
    resignPolicyFa: 'انصراف یعنی کنار رفتن؛ اگر فقط یک بازیکن بماند او برنده است.',
    tutorialFa: 'آموزش تعاملی: گذاشتن دیوار جلوی حریف و رسیدن به ردیف آخر.'
  }
});
