import { defineGame } from '@bg/game-sdk';

// Kingdomino («قلمرو») — 2–4 players. Rules implementation: rules.ts.
export const kingdomino = defineGame({
  manifest: {
    gameId: 'kingdomino',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['seeded-rng'],
    clientBundleRef: 'kingdomino@1.0.0',
    assetsRef: 'kingdomino/1'
  },
  catalog: {
    nameFa: 'کینگدومینو',
    nameOriginal: 'Kingdomino',
    summaryFa: 'سرزمینی ۵×۵ دور قلعه‌تان بسازید: دومینوی گندم‌زار و جنگل و دریاچه انتخاب کنید و زمین‌های تاج‌دار را به هم وصل کنید.',
    rulesFa: [
      'هر دور چند دومینو به ترتیب شماره رو می‌شود. با مهرهٔ شاه یکی را انتخاب می‌کنید؛ دومینوی شماره‌بالاتر بهتر است ولی دور بعد دیرتر انتخاب می‌کنید.',
      'دومینوی انتخاب‌شده در دور بعد به سرزمینتان اضافه می‌شود: یک طرفش باید کنار قلعه یا کنار زمینی هم‌جنس باشد و کل سرزمین نباید از ۵×۵ بزرگ‌تر شود. اگر جا نشود دور انداخته می‌شود.',
      'در پایان هر ناحیهٔ پیوستهٔ هم‌جنس امتیازی برابر تعداد خانه‌ها ضرب در تعداد تاج‌هایش دارد.',
      'در بازی دونفره هر کس دو شاه دارد و در هر دور دو دومینو برمی‌دارد. در تساوی، بزرگ‌ترین ناحیه و بعد تاج بیشتر برنده است.'
    ],
    minutes: { min: 15, max: 25 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود دومینو در اولین جای ممکن گذاشته (یا دور انداخته) و اولین دومینوی آزاد انتخاب می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: گذاشتن آخرین دومینوها و وصل کردن زمین‌های تاج‌دار.'
  }
});
