import { defineGame } from '@bg/game-sdk';

// Jaipur («کاروان») — two players. Rules implementation: rules.ts.
export const jaipur = defineGame({
  manifest: {
    gameId: 'jaipur',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'length', labelFa: 'طول بازی',
      choices: [{ value: 'best3', labelFa: 'دو برد از سه دست (استاندارد)' }, { value: 'one', labelFa: 'یک دست' }],
      default: 'best3'
    }],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'jaipur@1.0.0',
    assetsRef: 'jaipur/1'
  },
  catalog: {
    nameFa: 'کاروان',
    nameOriginal: 'Jaipur',
    summaryFa: 'دو تاجر در بازار: کالا بخرید، با شتر معاوضه کنید و درست به‌موقع بفروشید — اولین فروشنده بهترین قیمت را می‌گیرد.',
    rulesFa: [
      'در بازار پنج کارت رو است. در نوبتتان یکی از این کارها را می‌کنید: یک کالا بردارید؛ همهٔ شترها را بردارید؛ چند کالای بازار را با همان تعداد کارت از دست یا شترهایتان عوض کنید؛ یا کالا بفروشید.',
      'فروش: هر تعداد کارت از یک نوع کالا؛ برای الماس، طلا و نقره دست‌کم دو کارت. به ازای هر کارت یک سکه از کپهٔ آن کالا برمی‌دارید (سکه‌های اول گران‌ترند) و فروش سه، چهار یا پنج‌تایی سکهٔ پاداش هم دارد.',
      'بیشتر از هفت کارت (بدون شتر) در دست نمی‌گیرید. دست وقتی تمام می‌شود که سکه‌های سه کالا تمام شود یا دسته برای پر کردن بازار کم بیاید؛ صاحب شترهای بیشتر ۵ سکه جایزه می‌گیرد.',
      'برندهٔ هر دست یک نشان افتخار می‌گیرد؛ اولین کسی که دو نشان بگیرد بازی را می‌برد.'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما شترها (یا یک کالا) برداشته می‌شود.',
    resignPolicyFa: 'انصراف یعنی باختن بازی.',
    tutorialFa: 'آموزش تعاملی: خرید نقره و فروش جفت که دست را تمام می‌کند.'
  }
});
