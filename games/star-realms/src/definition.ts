import { defineGame } from '@bg/game-sdk';

// Star Realms («نبرد ستاره‌ها») — two-player space deck-building duel. Rules implementation: rules.ts.
export const starRealms = defineGame({
  manifest: {
    gameId: 'star-realms',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'star-realms@1.0.0',
    assetsRef: 'star-realms/1'
  },
  catalog: {
    nameFa: 'نبرد ستاره‌ها',
    nameOriginal: 'Star Realms',
    summaryFa: 'ناوگانتان را از ردیف بازار بسازید، پایگاه برپا کنید و اقتدار حریف را از ۵۰ به صفر برسانید.',
    rulesFa: [
      'هر نوبت کارت‌های دستتان را بازی می‌کنید: ناوها سکهٔ تجارت، قدرت حمله یا اقتدار می‌دهند. پایگاه‌ها روی میز می‌مانند و هر نوبت دوباره کار می‌کنند.',
      'با تجارت از ردیف بازار (یا کاوشگر) کارت بخرید؛ کارت خریده به دورریز می‌رود. با حمله به اقتدار حریف یا پایگاه‌هایش ضربه بزنید؛ پاسگاه‌ها باید اول نابود شوند.',
      'وقتی کارت دیگری از همان جناح در بازی باشد توانایی «متحد» فعال می‌شود. برخی کارت‌ها را می‌توانید اسقاط کنید تا یک‌بار پاداش بدهند.',
      'جناح‌ها: فدراسیون (اقتدار)، هیولاها (حمله و پاک‌سازی بازار)، ماشین‌پرستان (اسقاط کارت‌های ضعیف) و امپراتوری (کشیدن کارت و دور ریختن حریف).'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود همهٔ کارت‌ها بازی می‌شوند، حمله به حریف (اگر ممکن باشد) انجام و نوبت تمام می‌شود.',
    resignPolicyFa: 'انصراف یعنی باخت؛ حریف برنده می‌شود.',
    tutorialFa: 'آموزش تعاملی: متحد شدن هیولاها، نابود کردن پاسگاه و ضربهٔ آخر.'
  }
});
