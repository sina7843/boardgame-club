import { defineGame } from '@bg/game-sdk';

// 6 nimmt! («گاو شش») — standard rules for 2–10 players. Rules implementation: rules.ts.
export const sixNimmt = defineGame({
  manifest: {
    gameId: 'six-nimmt',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 10 },
    options: [{
      key: 'length', labelFa: 'طول بازی',
      choices: [{ value: 'to66', labelFa: 'تا ۶۶ گاو (استاندارد)' }, { value: 'oneRound', labelFa: 'یک دست' }],
      default: 'to66'
    }],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'six-nimmt@1.0.0',
    assetsRef: 'six-nimmt/1'
  },
  catalog: {
    nameFa: 'شش نیمت!',
    nameOriginal: '6 nimmt!',
    summaryFa: 'همه با هم کارت می‌گذارند و هیچ‌کس نمی‌خواهد ششمین کارت ردیف باشد؛ تا ۱۰ نفر، شلوغ و خنده‌دار.',
    rulesFa: [
      '۱۰۴ کارت با عدد و گاو (امتیاز منفی) داریم: ۵۵ هفت گاو، مضرب‌های ۱۱ پنج گاو، مضرب‌های ۱۰ سه گاو، مضرب‌های ۵ دو گاو و بقیه یک گاو. هر بازیکن ۱۰ کارت دارد و چهار ردیف با یک کارت شروع می‌شوند.',
      'در هر نوبت همه با هم و مخفیانه یک کارت انتخاب می‌کنند. کارت‌ها رو می‌شوند و از کوچک به بزرگ چیده می‌شوند: هر کارت پشت ردیفی می‌رود که آخرین کارتش بزرگ‌ترین عددِ کوچک‌تر از آن است.',
      'کسی که ششمین کارت یک ردیف را بگذارد، پنج کارت قبلی را برمی‌دارد و کارتش شروع ردیف تازه می‌شود.',
      'اگر کارتتان از آخرِ همه ردیف‌ها کوچک‌تر باشد، یک ردیف دلخواه را برمی‌دارید و کارتتان جایش می‌نشیند.',
      'بعد از ۱۰ نوبت گاوها شمرده می‌شوند. بازی تا وقتی کسی به ۶۶ گاو برسد ادامه دارد (یا به انتخاب میزبان فقط یک دست)؛ کمترین گاو برنده است.'
    ],
    minutes: { min: 15, max: 45 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود کوچک‌ترین کارت شما بازی می‌شود و در انتخاب ردیف، کم‌گاوترین ردیف برداشته می‌شود.',
    resignPolicyFa: 'انصراف یعنی رتبه آخر و پایان بازی.',
    tutorialFa: 'آموزش تعاملی: انتخاب کارت، برداشتن ردیف و دیدن ششمین کارت.'
  }
});
