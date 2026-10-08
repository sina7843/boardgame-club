import { defineGame } from '@bg/game-sdk';

// Go («گو») — area scoring, positional superko. Rules implementation: rules.ts.
export const go = defineGame({
  manifest: {
    gameId: 'go',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [
      {
        key: 'size', labelFa: 'اندازه صفحه',
        descriptionFa: '۹×۹ سریع و مناسب گوشی است؛ ۱۹×۱۹ صفحه استاندارد مسابقات است.',
        choices: [{ value: 9, labelFa: '۹×۹' }, { value: 13, labelFa: '۱۳×۱۳' }, { value: 19, labelFa: '۱۹×۱۹' }],
        default: 9
      },
      {
        key: 'komi', labelFa: 'کومی (امتیاز جبرانی سفید)',
        choices: [{ value: 7.5, labelFa: '۷٫۵' }, { value: 6.5, labelFa: '۶٫۵' }, { value: 5.5, labelFa: '۵٫۵' }, { value: 0.5, labelFa: '۰٫۵' }],
        default: 7.5
      },
      {
        key: 'firstMove', labelFa: 'سنگ سیاه',
        choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان سیاه باشد' }],
        default: 'random'
      }
    ],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'go@1.0.0',
    assetsRef: 'go/1'
  },
  catalog: {
    nameFa: 'گو',
    nameOriginal: 'Go',
    summaryFa: 'کهن‌ترین بازی استراتژی جهان؛ با سنگ‌های سیاه و سفید قلمرو بسازید و سنگ‌های حریف را محاصره کنید.',
    rulesFa: [
      'سیاه اول بازی می‌کند و بازیکنان به نوبت یک سنگ روی یک تقاطع خالی می‌گذارند. سنگ‌ها جابه‌جا نمی‌شوند.',
      'نقطه‌های خالی کنار یک سنگ (بالا، پایین، چپ، راست) «آزادی» آن هستند؛ سنگ‌های هم‌رنگ متصل یک گروه‌اند و آزادی مشترک دارند. گروهی که آزادی نداشته باشد از صفحه برداشته می‌شود.',
      'گذاشتن سنگی که خودش بی‌آزادی بماند (خودکشی) مجاز نیست، مگر اینکه با آن سنگ‌های حریف گرفته شوند. هیچ حرکتی نباید وضعیت قبلی صفحه را تکرار کند (قانون «کو»).',
      'به جای حرکت می‌توانید «پاس» بدهید. دو پاس پشت سر هم یعنی شمارش: گروه‌های مرده را علامت بزنید و هر دو تأیید کنید؛ اگر اختلاف بود، بازی را ادامه دهید.',
      'امتیاز هر رنگ = سنگ‌های زنده روی صفحه + نقطه‌های خالی‌ای که فقط با آن رنگ احاطه شده‌اند (شمارش منطقه‌ای). سفید کومی می‌گیرد.'
    ],
    minutes: { min: 15, max: 60 },
    difficulty: 'hard',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود به جای شما پاس داده می‌شود؛ سه بار پشت سر هم یعنی باخت. در مرحله شمارش، اتمام زمان یعنی پذیرفتن شمارش فعلی.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: آزادی‌ها، گرفتن سنگ‌ها، پاس و شمارش.'
  }
});
