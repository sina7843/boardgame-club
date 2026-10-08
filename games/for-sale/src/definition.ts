import { defineGame } from '@bg/game-sdk';

// For Sale («بنگاه») — 3–6 players, plus an unofficial 2-player game. Rules implementation: rules.ts.
export const forSale = defineGame({
  manifest: {
    gameId: 'for-sale',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [],
    capabilities: ['hidden-information', 'simultaneous-actions', 'seeded-rng'],
    clientBundleRef: 'for-sale@1.0.0',
    assetsRef: 'for-sale/1'
  },
  catalog: {
    nameFa: 'بنگاه',
    nameOriginal: 'For Sale',
    summaryFa: 'اول در مزایده خانه بخرید — از کپر تا کاخ — بعد همان‌ها را به بالاترین چک بفروشید. پولدارترین بنگاه‌دار برنده است.',
    rulesFa: [
      'بازی دو مرحله دارد. در مرحله خرید هر دور به تعداد بازیکنان کارت ملک (۱ تا ۳۰) رو می‌شود و به نوبت پیشنهاد می‌دهید یا کنار می‌کشید.',
      'هر کس کنار بکشد ارزان‌ترین ملک روی میز را برمی‌دارد و نصف پیشنهادش (رو به پایین) به او برمی‌گردد. آخرین نفر گران‌ترین ملک را با تمام پیشنهادش می‌خرد و دور بعد را شروع می‌کند.',
      'در مرحله فروش هر دور به تعداد بازیکنان چک (۰ تا ۱۵ هزار) رو می‌شود؛ همه هم‌زمان و مخفیانه یک ملک انتخاب می‌کنند. بزرگ‌ترین ملک بزرگ‌ترین چک را می‌گیرد و همین‌طور تا آخر.',
      'در پایان مجموع چک‌ها به‌علاوه سکه‌های باقی‌مانده امتیاز شماست؛ در تساوی سکه بیشتر برنده است.',
      'سه یا چهار نفر: هر نفر ۱۸ سکه و چند کارت کنار گذاشته می‌شود؛ پنج یا شش نفر: ۱۴ سکه. بازی دونفره قانون رسمی نیست.'
    ],
    minutes: { min: 15, max: 25 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود در مزایده کنار می‌کشید و در فروش ارزان‌ترین ملکتان انتخاب می‌شود.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب امتیاز فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: یک دور مزایده و یک دور فروش.'
  }
});
