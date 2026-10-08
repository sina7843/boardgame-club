import { defineGame } from '@bg/game-sdk';

// Sushi Go! («سوشی گردان») — 2–5 players. Rules implementation: rules.ts.
export const sushiGo = defineGame({
  manifest: {
    gameId: 'sushi-go',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'sushi-go@1.0.0',
    assetsRef: 'sushi-go/1'
  },
  catalog: {
    nameFa: 'سوشی گردان',
    nameOriginal: 'Sushi Go!',
    summaryFa: 'بشقاب‌ها دور میز می‌چرخند: از هر دست یک کارت بردارید، بقیه را رد کنید و بهترین ترکیب سوشی را بچینید.',
    rulesFa: [
      'سه دور بازی می‌شود. هر نوبت همه هم‌زمان و مخفیانه یک کارت از دستشان برمی‌دارند، رو می‌کنند و باقی دست را به نفر بعدی می‌دهند.',
      'امتیازها: دو تمپورا ۵؛ سه ساشیمی ۱۰؛ دامپلینگ ۱، ۳، ۶، ۱۰، ۱۵؛ نیگیری تخم‌مرغ ۱، سالمون ۲، ماهی مرکب ۳ — روی واسابی سه برابر.',
      'ماکی: بیشترین تعداد رول ۶ امتیاز و دومی ۳ (در تساوی تقسیم می‌شود). چاپستیک بعداً اجازه می‌دهد در یک نوبت دو کارت بردارید.',
      'پودینگ‌ها تا آخر بازی می‌مانند: بیشترین +۶ و کمترین −۶ (در بازی دونفره منفی ندارد). در تساوی امتیاز، پودینگ بیشتر برنده است.'
    ],
    minutes: { min: 15, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود اولین کارت دستتان برداشته می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: واسابی، نیگیری و رد کردن دست.'
  }
});
