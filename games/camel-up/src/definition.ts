import { defineGame } from '@bg/game-sdk';

// Camel Up («مسابقهٔ شترها») — 2–8 players (2 is an unofficial variant). Rules implementation: rules.ts.
export const camelUp = defineGame({
  manifest: {
    gameId: 'camel-up',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 8 },
    options: [],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'camel-up@1.0.0',
    assetsRef: 'camel-up/1'
  },
  catalog: {
    nameFa: 'کمل آپ',
    nameOriginal: 'Camel Up',
    summaryFa: 'پنج شتر در کویر مسابقه می‌دهند و روی هم سوار می‌شوند. روی شتر برندهٔ هر مرحله و برنده و بازندهٔ کل مسابقه شرط ببندید و پولدارترین تماشاگر باشید.',
    rulesFa: [
      'در نوبتتان یکی از این کارها را می‌کنید: کارت شرط مرحله برای یک شتر برمی‌دارید (۵، ۳ یا ۲ سکه)؛ کاشی واحه (+۱) یا سراب (−۱) را روی مسیر می‌گذارید؛ از هرم یک تاس درمی‌آورید (۱ سکه می‌گیرید و شتر همان رنگ ۱ تا ۳ خانه جلو می‌رود)؛ یا مخفیانه روی برنده یا بازندهٔ نهایی شرط می‌بندید.',
      'شتری که حرکت می‌کند شترهای روی پشتش را هم می‌برد و روی شترهای خانهٔ مقصد می‌نشیند. فرود روی واحه یک خانه جلو و روی سراب یک خانه عقب می‌برد و صاحب کاشی یک سکه می‌گیرد.',
      'وقتی هر پنج تاس درآمد، مرحله تمام است: شرط روی شتر اول به اندازهٔ کارت، شتر دوم ۱ سکه و بقیه ۱ سکه منفی.',
      'وقتی شتری از خط پایان بگذرد، بازی تمام می‌شود. شرط‌های نهایی درست به ترتیب ۸، ۵، ۳، ۲، ۱ سکه و غلط ۱ سکه منفی دارند. پولدارترین بازیکن برنده است.'
    ],
    minutes: { min: 20, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان تمام شود به جای شما یک تاس از هرم درمی‌آید.',
    resignPolicyFa: 'انصراف بازی را تمام می‌کند و شما آخر می‌شوید؛ بقیه به ترتیب سکه‌های فعلی رتبه می‌گیرند.',
    tutorialFa: 'آموزش تعاملی: شرط نهایی، شرط مرحله و تاس آخر.'
  }
});
