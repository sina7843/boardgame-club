import { defineGame } from '@bg/game-sdk';

// Dice Throne («نبرد تاس») — two-player dice duel with asymmetric heroes. Rules implementation: rules.ts.
export const diceThrone = defineGame({
  manifest: {
    gameId: 'dice-throne',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'dice-throne@1.0.0',
    assetsRef: 'dice-throne/1'
  },
  catalog: {
    nameFa: 'نبرد تاس',
    nameOriginal: 'Dice Throne',
    summaryFa: 'یک قهرمان انتخاب کنید و با پنج تاس ترکیب‌های حمله بسازید. سه بار بریزید، تاس‌های خوب را نگه دارید و جان حریف را از ۳۰ به صفر برسانید.',
    rulesFa: [
      'هر کدام یک قهرمان برمی‌دارید؛ هر قهرمان تاس‌ها و توانایی‌های خودش را دارد. جان هر کدام ۳۰ است.',
      'در نوبتتان پنج تاس را تا سه بار می‌ریزید و هر بار هر تاسی را بخواهید نگه می‌دارید. با ۲ امتیاز رزم (CP) یک ریختن اضافه دارید.',
      'بعد یکی از توانایی‌هایی را که ترکیب تاس‌هایتان می‌سازد انتخاب می‌کنید. حریف با تاس‌های دفاعی‌اش ضربه را کم یا برمی‌گرداند (توانایی نهایی دفاع‌ناپذیر است).',
      'وضعیت‌ها: «زخم» هر نوبت ۱ جان می‌گیرد، «گیجی» نوبت بعد را از بین می‌برد و «سپر» ۳ آسیب بعدی را خنثی می‌کند.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود قهرمان اول، ریختن تاس و بهترین حملهٔ ممکن خودکار انتخاب می‌شود.',
    resignPolicyFa: 'انصراف یعنی باخت؛ حریف برنده می‌شود.',
    tutorialFa: 'آموزش تعاملی: ریختن، نگه داشتن تاس‌ها و حملهٔ پنج شمشیر.'
  }
});
