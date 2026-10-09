import { defineGame } from '@bg/game-sdk';

// King of Tokyo («غول‌های شهر») — 2–6 players. Rules implementation: rules.ts.
export const kingOfTokyo = defineGame({
  manifest: {
    gameId: 'king-of-tokyo',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'king-of-tokyo@1.0.0',
    assetsRef: 'king-of-tokyo/1'
  },
  catalog: {
    nameFa: 'کینگ آف توکیو',
    nameOriginal: 'King of Tokyo',
    summaryFa: 'غول بزرگ شهرید: تاس بریزید، چنگ بزنید، انرژی جمع کنید و قدرت‌های عجیب بخرید. اولین کسی که ۲۰ امتیاز بگیرد — یا آخرین غول زنده — شاه شهر است.',
    rulesFa: [
      'در نوبتتان شش تاس را تا سه بار می‌ریزید و هر بار هر کدام را بخواهید نگه می‌دارید. سه تا ۱، ۲ یا ۳ یعنی همان‌قدر امتیاز (هر تاس اضافه +۱)، قلب جان می‌دهد، صاعقه انرژی و چنگ ضربه.',
      'اگر بیرون شهر باشید چنگ‌ها به غول داخل شهر می‌خورد؛ اگر داخل شهر باشید به همهٔ بیرونی‌ها. داخل شهر نمی‌شود جان گرفت. غولی که ضربه بخورد می‌تواند شهر را ترک کند و ضربه‌زننده جایش برود. ورود به شهر ۱ امتیاز و شروع نوبت در شهر ۲ امتیاز دارد.',
      'با انرژی کارت قدرت می‌خرید (۲ انرژی برای عوض کردن سه کارت بازار). اولین کسی که به ۲۰ امتیاز برسد یا آخرین غول زنده بماند برنده است.',
      'در بازی پنج و شش‌نفره هم فقط یک جای شهر داریم (ساده‌سازی).'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود تاس‌ها همان‌طور که هستند حساب می‌شوند، از شهر بیرون نمی‌روید و چیزی نمی‌خرید.',
    resignPolicyFa: 'انصراف یعنی بیرون رفتن غول شما؛ آخرین غول زنده برنده است.',
    tutorialFa: 'آموزش تعاملی: ریختن تاس، حساب کردن و خرید کارت پیروزی.'
  }
});
