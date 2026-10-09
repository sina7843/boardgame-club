import { defineGame } from '@bg/game-sdk';

// The Crew: The Quest for Planet Nine («خدمه: سیارهٔ نهم») — cooperative trick-taking, 3–5 players. Rules: rules.ts.
export const theCrew = defineGame({
  manifest: {
    gameId: 'the-crew',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly'] },
    playerCounts: { min: 3, max: 5 },
    options: [{
      key: 'mission', labelFa: 'ماموریت',
      descriptionFa: 'تعداد وظیفه‌ها و نشان‌های ترتیب با شمارهٔ ماموریت بیشتر می‌شود.',
      choices: [
        { value: '1', labelFa: '۱ — یک وظیفه' }, { value: '2', labelFa: '۲ — دو وظیفه' }, { value: '3', labelFa: '۳ — دو وظیفه به ترتیب' },
        { value: '4', labelFa: '۴ — سه وظیفه' }, { value: '5', labelFa: '۵ — سه وظیفه، یکی اول' }, { value: '6', labelFa: '۶ — سه وظیفه، یکی آخر' },
        { value: '7', labelFa: '۷ — چهار وظیفه' }, { value: '8', labelFa: '۸ — سه وظیفه به ترتیب' }, { value: '9', labelFa: '۹ — چهار وظیفه، اول و آخر' },
        { value: '10', labelFa: '۱۰ — پنج وظیفه' }
      ],
      default: '1'
    }],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'the-crew@1.0.0',
    assetsRef: 'the-crew/1'
  },
  catalog: {
    nameFa: 'کرو: در جست‌وجوی سیارهٔ نهم',
    nameOriginal: 'The Crew: The Quest for Planet Nine',
    summaryFa: 'بازی دست‌گیری تیمی: همه با هم می‌برید یا می‌بازید. هر کس باید کارت‌های وظیفه‌اش را در دست‌ها ببرد، بی‌آنکه حرف بزنید.',
    rulesFa: [
      'همهٔ کارت‌ها پخش می‌شوند؛ دارندهٔ موشک ۴ فرمانده است. کارت‌های وظیفه رو می‌شوند و از فرمانده به بعد هر کس یکی برمی‌دارد.',
      'در هر دست باید از خال کارت اول پیروی کنید؛ اگر ندارید هر کارتی، حتی موشک، مجازید. موشک‌ها برنده‌اند و بعد بزرگ‌ترین کارت خال اول.',
      'وظیفه وقتی انجام می‌شود که صاحبش دستی را ببرد که کارت وظیفه در آن است. اگر کس دیگری ببرد، ماموریت شکست می‌خورد. نشان‌های ترتیب باید رعایت شوند.',
      'هر نفر یک بار در ماموریت (بین دست‌ها) می‌تواند یک کارت را نشان دهد: بالاترین، پایین‌ترین یا تنها کارت آن رنگ در دستش.'
    ],
    minutes: { min: 10, max: 20 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود اولین وظیفه یا اولین کارت مجاز خودکار انتخاب می‌شود.',
    resignPolicyFa: 'انصراف یعنی شکست ماموریت برای همهٔ خدمه.',
    tutorialFa: 'آموزش تعاملی: برداشتن وظیفه، ارتباط و بردن کارت وظیفه.'
  }
});
