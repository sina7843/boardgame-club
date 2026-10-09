import { defineGame } from '@bg/game-sdk';

// Space Base («پایگاه فضایی») — 2–5 players, dice-driven engine building. Rules implementation: rules.ts.
export const spaceBase = defineGame({
  manifest: {
    gameId: 'space-base',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'space-base@1.0.0',
    assetsRef: 'space-base/1'
  },
  catalog: {
    nameFa: 'اسپیس بیس',
    nameOriginal: 'Space Base',
    summaryFa: 'دو تاس، دوازده بخش. ناو بخرید و در بخش‌ها بگذارید؛ ناوهای قدیمی به مأموریت می‌روند و در نوبت دیگران هم برایتان درآمد می‌آورند.',
    rulesFa: [
      'در نوبتتان دو تاس می‌ریزید و انتخاب می‌کنید: دو بخش جدا (هر تاس یک بخش) یا یک بخش با جمع دو تاس.',
      'ناو اصلی هر بخش شما (آبی) در نوبت خودتان پاداش می‌دهد؛ ناوهای اعزام‌شدهٔ همان بخش (قرمز) در نوبت دیگران وقتی آن بخش فعال شود.',
      'بعد یک ناو از بازار می‌خرید و در بخش خودش می‌گذارید؛ ناو قبلی آن بخش اعزام می‌شود. بعضی ناوها هنگام خرید درآمد دائمی یا امتیاز می‌دهند.',
      'در پایان نوبت اگر اعتبارتان از درآمدتان کمتر باشد تا درآمد بالا می‌رود. اولین کسی که به ۴۰ امتیاز برسد پایان بازی را رقم می‌زند.'
    ],
    minutes: { min: 30, max: 50 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود تاس ریخته می‌شود، جمع دو تاس انتخاب و بدون خرید نوبت تمام می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: ریختن تاس، انتخاب جمع و خرید ناو.'
  }
});
