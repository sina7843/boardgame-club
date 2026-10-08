import { defineGame } from '@bg/game-sdk';

// Checkers («چکرز») — English/American draughts by default, Brazilian (8×8 international) as an option. Rules: rules.ts.
export const checkers = defineGame({
  manifest: {
    gameId: 'checkers',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [
      {
        key: 'variant', labelFa: 'قوانین',
        descriptionFa: 'انگلیسی: مهره‌ها فقط رو به جلو می‌زنند و شاه یک خانه حرکت می‌کند. برزیلی: مهره‌ها به عقب هم می‌زنند، شاه پرنده است و باید بیشترین تعداد مهره را زد.',
        choices: [{ value: 'english', labelFa: 'انگلیسی (استاندارد)' }, { value: 'brazilian', labelFa: 'برزیلی (بین‌المللی ۸×۸)' }],
        default: 'english'
      },
      {
        key: 'firstMove', labelFa: 'مهره تیره',
        descriptionFa: 'مهره‌های تیره حرکت اول را انجام می‌دهند.',
        choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان تیره باشد' }],
        default: 'random'
      }
    ],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'checkers@1.0.0',
    assetsRef: 'checkers/1'
  },
  catalog: {
    nameFa: 'چکرز',
    nameOriginal: 'Checkers',
    summaryFa: 'دوز قطری کلاسیک روی صفحه ۸×۸؛ از روی مهره‌های حریف بپرید، شاه بگیرید و همه را بزنید.',
    rulesFa: [
      'هر بازیکن ۱۲ مهره روی خانه‌های تیره سه ردیف اول دارد. تیره اول حرکت می‌کند و بازیکنان به نوبت یک حرکت انجام می‌دهند.',
      'مهره ساده یک خانه قطری رو به جلو می‌رود. اگر مهره حریف کنار شما باشد و خانه پشتش خالی، از رویش می‌پرید و آن را می‌زنید.',
      'زدن اجباری است و اگر بعد از پرش باز هم بتوانید بزنید، باید ادامه دهید (پرش چندتایی). اگر چند راه زدن هست، هر کدام را می‌توانید انتخاب کنید.',
      'مهره‌ای که به ردیف آخر برسد «شاه» می‌شود و حرکتش تمام می‌شود. شاه قطری به جلو و عقب حرکت می‌کند و می‌زند.',
      'برنده کسی است که همه مهره‌های حریف را بزند یا حریف هیچ حرکتی نداشته باشد. تکرار سه‌باره یک وضعیت یا ۴۰ حرکت هر طرف بدون زدن و بدون حرکت مهره ساده مساوی است.',
      'قوانین برزیلی (اختیاری): مهره ساده به عقب هم می‌زند، شاه چند خانه می‌رود (پرنده) و زدن بیشترین تعداد مهره اجباری است.'
    ],
    minutes: { min: 10, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود می‌بازید.',
    resignPolicyFa: 'انصراف به معنای باخت شماست.',
    tutorialFa: 'آموزش تعاملی: زدن اجباری، پرش دوتایی و بردن بازی.'
  }
});
