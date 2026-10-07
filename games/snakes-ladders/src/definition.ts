import { defineGame } from '@bg/game-sdk';

// Snakes and Ladders — traditional race game (public domain), classic 1943 layout. Rules implementation: rules.ts.
export const snakesLadders = defineGame({
  manifest: {
    gameId: 'snakes-ladders',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 6 },
    options: [
      {
        key: 'finish', labelFa: 'رسیدن به ۱۰۰',
        descriptionFa: 'اگر تاس بیشتر از فاصله تا ۱۰۰ بیاید چه شود.',
        choices: [{ value: 'exact', labelFa: 'عدد دقیق لازم است (حرکت نمی‌کنید)' }, { value: 'bounce', labelFa: 'از ۱۰۰ برمی‌گردید' }],
        default: 'exact'
      },
      {
        key: 'sixAgain', labelFa: 'جایزه ۶',
        choices: [{ value: false, labelFa: 'ندارد' }, { value: true, labelFa: 'با ۶ دوباره تاس بریزید' }],
        default: false
      }
    ],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'snakes-ladders@1.0.0',
    assetsRef: 'snakes-ladders/1'
  },
  catalog: {
    nameFa: 'مارپله',
    nameOriginal: 'Snakes and Ladders',
    summaryFa: 'بازی شانسی ۲ تا ۶ نفره؛ تاس بریزید، از نردبان‌ها بالا بروید، از مارها فرار کنید و اول به ۱۰۰ برسید.',
    rulesFa: [
      'همه از بیرون صفحه شروع می‌کنند؛ شروع‌کننده به‌صورت تصادفی تعیین می‌شود و نوبت‌ها به ترتیب صندلی می‌چرخد.',
      'در نوبت خود تاس می‌ریزید (تاس را سرور می‌ریزد) و به همان تعداد خانه جلو می‌روید. چند مهره می‌توانند در یک خانه باشند.',
      'اگر روی پای نردبان بایستید به سر آن می‌روید؛ اگر روی سر مار بایستید به دمش برمی‌گردید.',
      'اولین کسی که دقیقاً به خانه ۱۰۰ برسد برنده است؛ رتبه بقیه بر اساس جایگاهشان روی صفحه است.'
    ],
    minutes: { min: 5, max: 20 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود، تاس به‌جای شما ریخته می‌شود. پس از سه بار پیاپی، از بازی کنار گذاشته می‌شوید.',
    resignPolicyFa: 'با انصراف از بازی بیرون می‌روید و رتبه آخر را می‌گیرید؛ بازی برای بقیه ادامه دارد.',
    tutorialFa: 'آموزش تعاملی: تاس ریختن، بالا رفتن از نردبان، پایین آمدن با مار و رسیدن به ۱۰۰.'
  }
});
