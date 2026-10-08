import { defineGame } from '@bg/game-sdk';

// The Mind («هم‌فکر») — cooperative, 2–4 players, live only. Rules implementation: rules.ts.
export const theMind = defineGame({
  manifest: {
    gameId: 'the-mind',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live'], competition: ['friendly'] },
    playerCounts: { min: 2, max: 4 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'the-mind@1.0.0',
    assetsRef: 'the-mind/1'
  },
  catalog: {
    nameFa: 'هم‌فکر',
    nameOriginal: 'The Mind',
    summaryFa: 'بازی گروهی بی‌کلام: همه با هم کارت‌های ۱ تا ۱۰۰ را به ترتیب صعودی زمین بگذارید — بدون حرف زدن، فقط با حس زمان.',
    rulesFa: [
      'همه یک تیم هستید. در مرحلهٔ n هر نفر n کارت (از ۱ تا ۱۰۰) دارد. هر وقت فکر کردید نوبت کارت شماست، کوچک‌ترین کارتتان را زمین بگذارید. نوبتی در کار نیست و حرف زدن ممنوع!',
      'اگر کارتی زمین بیاید در حالی که کسی کارت کوچک‌تری در دست دارد، تیم یک «جان» از دست می‌دهد و همهٔ کارت‌های کوچک‌تر کنار گذاشته می‌شوند.',
      '«ستاره پرتابی»: اگر همه موافقت کنند، هر نفر کوچک‌ترین کارتش را رو می‌کند و کنار می‌گذارد.',
      'با تمام شدن کارت‌ها مرحله بعد شروع می‌شود؛ بعضی مراحل جان یا ستارهٔ اضافه جایزه می‌دهند. دو نفر ۱۲ مرحله، سه نفر ۱۰ و چهار نفر ۸ مرحله. اگر جان‌ها تمام شود تیم می‌بازد.'
    ],
    minutes: { min: 15, max: 25 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر یک دقیقه کسی کارتی نگذارد، کوچک‌ترین کارت روی میز خودکار گذاشته می‌شود.',
    resignPolicyFa: 'انصراف یعنی پایان بازی و باخت کل تیم.',
    tutorialFa: 'آموزش تعاملی: یک مرحلهٔ کوتاه دونفره.'
  }
});
