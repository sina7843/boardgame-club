import { defineGame } from '@bg/game-sdk';

// Point Salad («بازار سبزی») — 2–6 players. Rules implementation: rules.ts.
export const pointSalad = defineGame({
  manifest: {
    gameId: 'point-salad',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'point-salad@1.0.0',
    assetsRef: 'point-salad/1'
  },
  catalog: {
    nameFa: 'بازار سبزی',
    nameOriginal: 'Point Salad',
    summaryFa: 'هر کارت یا یک سبزی است یا یک دستور امتیاز. سبزی بخرید، دستورهای خوب جمع کنید و سالادی بسازید که بیشترین امتیاز را بیاورد.',
    rulesFa: [
      'هر کارت دو رو دارد: یک روی آن دستور امتیاز است و روی دیگر یکی از شش سبزی (گوجه، کاهو، هویج، کلم، فلفل، پیاز).',
      'در نوبتتان یا یک کارت دستور از بالای یکی از سه دسته برمی‌دارید، یا دو سبزی از شش سبزی بازار. بعد می‌توانید یکی از کارت‌های دستورتان را برگردانید تا سبزی شود.',
      'وقتی همهٔ کارت‌ها برداشته شد، هر دستور با سبزی‌های خودتان امتیاز می‌دهد: مثلاً هر گوجه +۲ و هر پیاز −۱، یا بیشترین کلم ۱۰ امتیاز.',
      'تعداد کارت‌ها به تعداد بازیکنان بستگی دارد (هر سبزی ۳ کارت برای هر بازیکن). بیشترین امتیاز برنده است.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما دو سبزی اول بازار (یا یک کارت دستور) برداشته می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: برداشتن دستور امتیاز و سبزی‌های مناسبش.'
  }
});
