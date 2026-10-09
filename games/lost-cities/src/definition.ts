import { defineGame } from '@bg/game-sdk';

// Lost Cities («کاوشگران») — two players. Rules implementation: rules.ts.
export const lostCities = defineGame({
  manifest: {
    gameId: 'lost-cities',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'length', labelFa: 'طول بازی',
      choices: [{ value: 'three', labelFa: 'سه دست (استاندارد)' }, { value: 'one', labelFa: 'یک دست' }],
      default: 'three'
    }],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'lost-cities@1.0.0',
    assetsRef: 'lost-cities/1'
  },
  catalog: {
    nameFa: 'لاست سیتیز',
    nameOriginal: 'Lost Cities',
    summaryFa: 'دو کاوشگر، پنج سفر پرخطر: کارت‌ها را به ترتیب صعودی بچینید، روی سفرهای خوب شرط ببندید و سفری را که خرجش درنمی‌آید شروع نکنید.',
    rulesFa: [
      'پنج مسیر سفر هست (صحرا، دریا، کوهستان، جنگل، آتشفشان) با کارت‌های ۲ تا ۱۰ و سه کارت «شرط» در هر رنگ. هر کدام هشت کارت در دست دارید.',
      'در نوبتتان یک کارت را یا روی سفر خودتان در آن رنگ می‌گذارید (فقط بزرگ‌تر از کارت قبلی؛ شرط‌ها فقط قبل از عددها) یا روی کپه دور ریختهٔ آن رنگ؛ بعد یک کارت از دسته یا از بالای یکی از کپه‌های دور ریخته برمی‌دارید (نه همانی که الان انداختید).',
      'وقتی آخرین کارت دسته برداشته شود دست تمام است. هر سفر شروع‌شده: جمع اعداد منهای ۲۰، ضرب در یک به‌علاوهٔ تعداد شرط‌ها؛ سفر هشت‌کارتی یا بیشتر ۲۰ امتیاز جایزه دارد. سفر شروع‌نشده صفر است.',
      'جمع امتیاز سه دست برنده را مشخص می‌کند.'
    ],
    minutes: { min: 20, max: 40 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود کمترین کارت دستتان دور ریخته می‌شود و از دسته برمی‌دارید.',
    resignPolicyFa: 'انصراف یعنی باختن بازی.',
    tutorialFa: 'آموزش تعاملی: کامل کردن یک سفر با شرط و پایان دسته.'
  }
});
