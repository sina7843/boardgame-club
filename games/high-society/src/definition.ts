import { defineGame } from '@bg/game-sdk';

// High Society («اشرافی») — 3–5 players, plus an unofficial 2-player game. Rules implementation: rules.ts.
export const highSociety = defineGame({
  manifest: {
    gameId: 'high-society',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 5 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'high-society@1.0.0',
    assetsRef: 'high-society/1'
  },
  catalog: {
    nameFa: 'های سوسایتی',
    nameOriginal: 'High Society',
    summaryFa: 'برای تابلو، قایق تفریحی و کاخ تابستانی مزایده بدهید و از رسوایی فرار کنید — ولی کسی که آخر بازی کم‌پول‌ترین باشد، هر چه داشته باشد باخته است.',
    rulesFa: [
      'هر بازیکن یازده اسکناس دارد (۱ تا ۲۵ هزار). هر دور یک کارت رو می‌شود و به نوبت با گذاشتن اسکناس پیشنهاد بالاتر می‌دهید یا کنار می‌کشید؛ با کنار کشیدن اسکناس‌های پیشنهادتان به دستتان برمی‌گردد.',
      'کارت تجملی (۱ تا ۱۰) یا افتخار (امتیاز ×۲): آخرین نفر باقی‌مانده پولش را می‌دهد و کارت را می‌برد.',
      'کارت رسوایی (−۵، نصف شدن امتیاز، از دست دادن یک کارت تجملی) برعکس است: اولین کسی که کنار بکشد کارت را می‌گیرد و پولش برمی‌گردد؛ بقیه پولی را که گذاشته‌اند از دست می‌دهند.',
      'بازی وقتی تمام می‌شود که چهارمین کارت قاب‌قرمز (سه افتخار و یک رسوایی نصف‌کننده) رو شود. کم‌پول‌ترین بازیکن(ها) کنار می‌روند و از بقیه بالاترین امتیاز برنده است.',
      'بازی دونفره قانون رسمی نیست.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما کنار کشیده می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: مزایده یک تابلوی گران‌بها و قانون کم‌پول‌ترین.'
  }
});
