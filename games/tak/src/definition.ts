import { defineGame } from '@bg/game-sdk';

// Tak («تاک») — standard rules (roads, flats, walls, capstones). Rules implementation: rules.ts.
export const tak = defineGame({
  manifest: {
    gameId: 'tak',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [
      {
        key: 'size', labelFa: 'اندازه صفحه',
        descriptionFa: '۴×۴: ۱۵ سنگ بدون سرستون؛ ۵×۵: ۲۱ سنگ و ۱ سرستون؛ ۶×۶: ۳۰ سنگ و ۱ سرستون.',
        choices: [{ value: 4, labelFa: '۴×۴' }, { value: 5, labelFa: '۵×۵' }, { value: 6, labelFa: '۶×۶' }],
        default: 5
      },
      {
        key: 'firstMove', labelFa: 'سفید',
        descriptionFa: 'سفید شروع می‌کند.',
        choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان سفید باشد' }],
        default: 'random'
      }
    ],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'tak@1.0.0',
    assetsRef: 'tak/1'
  },
  catalog: {
    nameFa: 'تاک',
    nameOriginal: 'Tak',
    summaryFa: 'بازی ساده و عمیق جاده‌سازی؛ با سنگ‌های تخت، دیوار و سرستون دو لبه روبه‌روی صفحه را به هم وصل کنید.',
    rulesFa: [
      'در اولین نوبتِ هر بازیکن، یک سنگ تختِ حریف را در خانه‌ای خالی می‌گذارید. از آن به بعد هر نوبت یکی از دو کار را انجام می‌دهید.',
      'گذاشتن: یک سنگ از ذخیره‌تان را در خانه خالی بگذارید؛ «تخت» (جزو جاده و قابل پوشاندن)، «دیوار» (ایستاده؛ جاده نیست و چیزی رویش نمی‌رود) یا «سرستون» (جزو جاده، هیچ‌چیز رویش نمی‌رود).',
      'جابه‌جایی: پشته‌ای که سنگ بالایش مال شماست را بگیرید، حداکثر به تعداد طول صفحه سنگ از بالایش بردارید و در یک خط مستقیم حرکت کنید؛ روی هر خانه دست‌کم یک سنگ بگذارید (از پایینِ دسته). سرستونی که تنها حرکت کند می‌تواند دیوار را بخواباند.',
      'هر کس جاده‌ای (زنجیره‌ای از سنگ‌های تخت و سرستون خودش، افقی یا عمودی) بین دو لبه روبه‌رو بسازد برنده است. اگر یک حرکت برای هر دو جاده بسازد، حرکت‌کننده برنده است.',
      'اگر صفحه پر شود یا سنگ‌های یکی تمام شود، هر کس سنگ تخت بیشتری در بالای پشته‌ها داشته باشد برنده است.'
    ],
    minutes: { min: 10, max: 30 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود یک سنگ تخت در خانه‌ای خالی گذاشته می‌شود؛ سه بار پشت سر هم یعنی باخت.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: بستن جاده حریف با دیوار و کامل کردن جاده خودتان.'
  }
});
