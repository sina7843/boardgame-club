import { defineGame } from '@bg/game-sdk';

// Santorini («سانتورینی») — base game for two, without god powers. Rules implementation: rules.ts.
export const santorini = defineGame({
  manifest: {
    gameId: 'santorini',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'firstMove', labelFa: 'شروع‌کننده',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'santorini@1.0.0',
    assetsRef: 'santorini/1'
  },
  catalog: {
    nameFa: 'سانتورینی',
    nameOriginal: 'Santorini',
    summaryFa: 'روی جزیره‌ای یونانی برج بسازید و زودتر از حریف یکی از کارگرانتان را به طبقه سوم برسانید.',
    rulesFa: [
      'هر بازیکن دو کارگر دارد. شروع‌کننده اول هر دو کارگرش را روی صفحه ۵×۵ می‌گذارد، بعد حریف؛ سپس شروع‌کننده اولین نوبت را بازی می‌کند.',
      'هر نوبت دو بخش دارد: یکی از کارگرها را به یک خانه کناری (هشت جهت) ببرید که خالی و بی‌گنبد باشد؛ بالا رفتن حداکثر یک طبقه در هر حرکت است ولی پایین آمدن هر چند طبقه آزاد است.',
      'بعد کنار همان کارگر یک طبقه بسازید (روی خانه خالی بی‌گنبد). روی طبقه سوم گنبد گذاشته می‌شود و دیگر کسی آنجا نمی‌رود.',
      'هر کس کارگرش را به طبقه سوم ببرد فوراً برنده است. بازیکنی که در نوبتش نتواند هم حرکت کند و هم بسازد می‌بازد.',
      'قدرت خدایان (کارت‌های ویژه نسخه اصلی) در این نسخه نیست.'
    ],
    minutes: { min: 10, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود سرور به جای شما یک حرکت مجاز انجام می‌دهد؛ سه بار پشت سر هم یعنی باخت.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: حرکت، ساختن طبقه سوم و بالا رفتن برای پیروزی.'
  }
});
