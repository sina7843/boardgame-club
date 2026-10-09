import { defineGame } from '@bg/game-sdk';

// Cockroach Poker («بلوف حشره‌ها») — 2–6 players. Rules implementation: rules.ts.
export const cockroachPoker = defineGame({
  manifest: {
    gameId: 'cockroach-poker',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'cockroach-poker@1.0.0',
    assetsRef: 'cockroach-poker/1'
  },
  catalog: {
    nameFa: 'کاکروچ پوکر',
    nameOriginal: 'Cockroach Poker',
    summaryFa: 'کارتی را رو به پایین به کسی بدهید و بگویید «این یک سوسک است» — راست یا دروغ. کسی که چهار حشرهٔ یک‌جور جلویش جمع شود می‌بازد.',
    rulesFa: [
      'هشت نوع جانور هست (سوسک، خفاش، مگس، وزغ، موش، عقرب، عنکبوت، سن)، از هر کدام هشت کارت؛ همهٔ کارت‌ها پخش می‌شود.',
      'در نوبتتان یک کارت را رو به پایین به کسی می‌دهید و می‌گویید چیست. او یا حدس می‌زند که راست گفتید یا دروغ — اگر درست حدس بزند کارت رو جلوی شما می‌ماند و اگر غلط، جلوی خودش — یا کارت را نگاه می‌کند و با ادعای تازه به کس دیگری می‌دهد (به کسی که آن را دیده نمی‌شود داد).',
      'هر کس کارت جلویش ماند، نفر بعدی است که کارت می‌دهد.',
      'کسی که چهار کارت از یک جانور جلویش باشد (یا نوبتش برسد و کارتی در دست نداشته باشد) می‌بازد و بقیه برنده‌اند.'
    ],
    minutes: { min: 15, max: 25 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما اولین کارت با ادعای راست داده می‌شود، یا «راست می‌گوید» حدس زده می‌شود.',
    resignPolicyFa: 'انصراف یعنی باختن؛ بقیه برنده‌اند.',
    tutorialFa: 'آموزش تعاملی: حدس زدن یک بلوف و دادن کارت با دروغ.'
  }
});
