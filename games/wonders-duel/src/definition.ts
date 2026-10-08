import { defineGame } from '@bg/game-sdk';

// 7 Wonders Duel («شگفتی‌ها: دوئل») — two players, three ages, wonders, science and military. Rules: rules.ts.
export const wondersDuel = defineGame({
  manifest: {
    gameId: 'wonders-duel',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'wonders-duel@1.0.0',
    assetsRef: 'wonders-duel/1'
  },
  catalog: {
    nameFa: 'شگفتی‌ها: دوئل',
    nameOriginal: '7 Wonders Duel',
    summaryFa: 'دو تمدن، سه دوران. از هرم کارت‌ها بردارید، شهرتان را بسازید، شگفتی بنا کنید و با دانش یا لشکر یا امتیاز پیروز شوید.',
    rulesFa: [
      'اول هر کدام چهار شگفتی انتخاب می‌کنید. هر دوران کارت‌ها به شکل هرم چیده می‌شوند و فقط کارت‌هایی را که رویشان کارتی نیست می‌توانید بردارید.',
      'با کارتی که برمی‌دارید یا آن را می‌سازید (با منابع خود یا خرید منابع با سکه؛ قیمت به تولید حریف بستگی دارد)، یا می‌فروشید (۲ سکه + ۱ به ازای هر کارت زرد)، یا با آن یکی از شگفتی‌هایتان را بنا می‌کنید.',
      'کارت‌های قرمز مهرهٔ جنگ را به سمت پایتخت حریف می‌برند؛ رسیدن به انتها یعنی پیروزی نظامی. هر جفت نماد علمی یک نشان پیشرفت می‌دهد و شش نماد متفاوت یعنی پیروزی علمی.',
      'اگر تا پایان دوران سوم کسی زودتر نبرد، امتیازها (کارت‌ها، شگفتی‌ها، نشان‌ها، جنگ و هر ۳ سکه ۱ امتیاز) شمرده می‌شود.'
    ],
    minutes: { min: 30, max: 45 },
    difficulty: 'hard',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود اولین کارت در دسترس فروخته می‌شود و انتخاب‌ها با گزینهٔ اول انجام می‌شوند.',
    resignPolicyFa: 'انصراف یعنی باخت؛ حریف برنده می‌شود.',
    tutorialFa: 'آموزش تعاملی: ساختن کارت علمی، گرفتن نشان پیشرفت و پیروزی نظامی.'
  }
});
