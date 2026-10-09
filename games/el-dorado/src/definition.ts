import { defineGame } from '@bg/game-sdk';

// The Quest for El Dorado («راه الدورادو») — 2–4 players, deck-building race across a hex jungle. Rules: rules.ts.
export const elDorado = defineGame({
  manifest: {
    gameId: 'el-dorado',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'el-dorado@1.0.0',
    assetsRef: 'el-dorado/1'
  },
  catalog: {
    nameFa: 'در جست‌وجوی الدورادو',
    nameOriginal: 'The Quest for El Dorado',
    summaryFa: 'گروه کاوشتان را از جنگل، رودخانه و روستاها به شهر طلایی برسانید. با کارت‌های بهتر سریع‌تر می‌روید؛ آن‌ها را با سکه بخرید.',
    rulesFa: [
      'هر نوبت چهار کارت دارید. کارت سبز (قمه) برای جنگل، آبی (پارو) برای آب و زرد (سکه) برای روستا حرکت می‌دهد؛ عدد هر خانه هزینهٔ ورود است.',
      'امتیاز یک کارت را می‌توانید میان چند خانهٔ پشت‌سرهم از همان نوع خرج کنید، اما دو کارت را برای یک خانه جمع نمی‌کنید. کوه‌ها و خانه‌های اشغال‌شده بسته‌اند.',
      'آوار با دور ریختن کارت و اردوگاه با حذف کارت از دسته رد می‌شود. یک بار در نوبت با سکه (کارت زرد یا هر کارت نیم سکه) از بازار کارت بخرید.',
      'اولین کسی که به الدورادو برسد پایان بازی را اعلام می‌کند؛ دور تمام می‌شود و هر که رسیده برنده است.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود نوبت بدون حرکت و خرید تمام می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب فاصله تا الدورادو رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: خرید کارت با سکه و رسیدن به الدورادو.'
  }
});
