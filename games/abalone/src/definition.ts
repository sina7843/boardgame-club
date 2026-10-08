import { defineGame } from '@bg/game-sdk';

// Abalone («آبالون») — standard layout, sumito pushes, six off wins. Rules implementation: rules.ts.
export const abalone = defineGame({
  manifest: {
    gameId: 'abalone',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{
      key: 'firstMove', labelFa: 'مهره سیاه',
      descriptionFa: 'سیاه حرکت اول را انجام می‌دهد.',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان سیاه باشد' }],
      default: 'random'
    }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'abalone@1.0.0',
    assetsRef: 'abalone/1'
  },
  catalog: {
    nameFa: 'آبالون',
    nameOriginal: 'Abalone',
    summaryFa: 'نبرد گوی‌ها روی صفحه شش‌ضلعی؛ با برتری عددی گوی‌های حریف را هل بدهید و شش‌تا را از صفحه بیرون بیندازید.',
    rulesFa: [
      'هر بازیکن ۱۴ گوی دارد و سیاه شروع می‌کند. در هر نوبت یک، دو یا سه گوی هم‌خطِ خودتان را با هم یک خانه جابه‌جا می‌کنید.',
      'حرکت در امتداد خط («پشت سر هم») یا از پهلو (همه خانه‌های مقصد باید خالی باشند) ممکن است.',
      'هل دادن («سومیتو») فقط در امتداد خط و با برتری عددی: ۲ گوی ۱ گوی را و ۳ گوی ۱ یا ۲ گوی را هل می‌دهند؛ به شرطی که پشت گوی‌های حریف خالی یا بیرون صفحه باشد.',
      'گوی‌ای که از لبه صفحه هل داده شود از بازی خارج می‌شود. اولین کسی که شش گوی حریف را بیرون بیندازد برنده است.',
      'برای جلوگیری از بازی بی‌پایان، بعد از ۲۰۰ حرکت هر کس گوی بیشتری بیرون انداخته باشد برنده است (برابر یعنی مساوی).'
    ],
    minutes: { min: 15, max: 40 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود یک حرکت مجاز به جای شما انجام می‌شود؛ سه بار پشت سر هم یعنی باخت.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: حرکت سه گوی با هم و هل دادن گوی حریف به بیرون.'
  }
});
