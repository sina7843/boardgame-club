import { defineGame } from '@bg/game-sdk';

// Hive («کندو») — base game without expansions. Rules implementation: rules.ts.
export const hive = defineGame({
  manifest: {
    gameId: 'hive',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'firstMove', labelFa: 'سفید',
      descriptionFa: 'سفید شروع می‌کند.',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان سفید باشد' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'hive@1.0.0',
    assetsRef: 'hive/1'
  },
  catalog: {
    nameFa: 'هایو',
    nameOriginal: 'Hive',
    summaryFa: 'بازی حشرات بدون صفحه؛ با زنبور، مورچه، عنکبوت، ملخ و سوسک، ملکه حریف را از شش طرف محاصره کنید.',
    rulesFa: [
      'هر بازیکن ۱۱ مهره دارد: ۱ ملکه زنبور، ۲ عنکبوت، ۲ سوسک، ۳ ملخ و ۳ مورچه. سفید شروع می‌کند؛ مهره‌ها کنار هم یک «کندو» می‌سازند و صفحه‌ای در کار نیست.',
      'گذاشتن: مهره تازه باید فقط کنار مهره‌های خودتان باشد و کنار هیچ مهره حریف نباشد (به جز دومین مهره کل بازی). ملکه باید تا نوبت چهارم شما گذاشته شود و تا ملکه نیامده هیچ مهره‌ای حرکت نمی‌کند.',
      'حرکت: کندو هرگز نباید دو تکه شود، و مهره‌ها باید بتوانند به‌طور فیزیکی بین دو مهره سُر بخورند (از شکاف تنگ رد نمی‌شوند).',
      'ملکه: یک خانه. سوسک: یک خانه و می‌تواند روی مهره‌ها برود (مهره زیرش قفل می‌شود). ملخ: در خط راست از روی یک یا چند مهره می‌پرد. عنکبوت: دقیقاً سه خانه دور کندو. مورچه: هر چند خانه دور کندو.',
      'هر کس ملکه حریف را از شش طرف (با مهره‌های هر رنگی) محاصره کند برنده است؛ اگر هر دو ملکه با هم محاصره شوند مساوی است. اگر هیچ حرکت و گذاشتنی ممکن نباشد نوبت رد می‌شود.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود یک کار مجاز به جای شما انجام می‌شود؛ سه بار پشت سر هم یعنی باخت.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: گذاشتن مورچه و محاصره ملکه حریف با آن.'
  }
});
