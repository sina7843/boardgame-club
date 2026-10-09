import { defineGame } from '@bg/game-sdk';

// The Crew: Mission Deep Sea («خدمه: اعماق دریا») — cooperative trick-taking with condition tasks, 3–5 players.
export const crewDeepSea = defineGame({
  manifest: {
    gameId: 'crew-deep-sea',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly'] },
    playerCounts: { min: 3, max: 5 },
    options: [{
      key: 'mission', labelFa: 'سختی ماموریت',
      descriptionFa: 'وظیفه‌ها رو می‌شوند تا جمع سختی‌شان به این عدد برسد.',
      choices: [
        { value: '3', labelFa: 'سختی ۳' }, { value: '5', labelFa: 'سختی ۵' }, { value: '7', labelFa: 'سختی ۷' },
        { value: '9', labelFa: 'سختی ۹' }, { value: '11', labelFa: 'سختی ۱۱' }
      ],
      default: '3'
    }],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'crew-deep-sea@1.0.0',
    assetsRef: 'crew-deep-sea/1'
  },
  catalog: {
    nameFa: 'کرو: مأموریت اعماق دریا',
    nameOriginal: 'The Crew: Mission Deep Sea',
    summaryFa: 'دست‌گیری تیمی در اعماق اقیانوس: وظیفه‌ها شرط‌اند — «هیچ ۹ نبر»، «دست آخر را ببر»، «دقیقاً دو دست ببر» — و همه با هم می‌برید یا می‌بازید.',
    rulesFa: [
      'کارت‌ها و دست‌ها مثل «سیارهٔ نهم» است: پیروی از خال، موشک‌ها برنده، دارندهٔ موشک ۴ فرمانده.',
      'وظیفه‌ها رو می‌شوند تا جمع سختی‌شان به سختی ماموریت برسد؛ از فرمانده به بعد هر کس یکی برمی‌دارد.',
      'هر وظیفه شرطی برای صاحبش است. بعضی وسط بازی انجام یا شکست می‌شوند، بعضی (مثل «هیچ… نبرید») در پایان سنجیده می‌شوند.',
      'هر نفر یک بار می‌تواند بالاترین، پایین‌ترین یا تنها کارت یک رنگ را نشان دهد. همهٔ وظیفه‌ها انجام شود = پیروزی خدمه.'
    ],
    minutes: { min: 10, max: 20 },
    difficulty: 'medium',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود اولین وظیفه یا اولین کارت مجاز خودکار انتخاب می‌شود.',
    resignPolicyFa: 'انصراف یعنی شکست ماموریت برای همهٔ خدمه.',
    tutorialFa: 'آموزش تعاملی: وظیفهٔ شرطی، ارتباط و بردن دست.'
  }
});
