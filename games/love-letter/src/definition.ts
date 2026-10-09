import { defineGame } from '@bg/game-sdk';

// Love Letter («نامه عاشقانه») — classic 16-card edition for 2–4 players. Rules implementation: rules.ts.
export const loveLetter = defineGame({
  manifest: {
    gameId: 'love-letter',
    rulesVersion: '1.0.0',
    stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 4 },
    options: [{
      key: 'length', labelFa: 'طول بازی',
      descriptionFa: 'استاندارد: ۷ / ۵ / ۴ نشان برای ۲ / ۳ / ۴ نفر. کوتاه: ۳ نشان.',
      choices: [{ value: 'standard', labelFa: 'استاندارد' }, { value: 'short', labelFa: 'کوتاه (۳ نشان)' }],
      default: 'standard'
    }],
    capabilities: ['hidden-information', 'seeded-rng'],
    clientBundleRef: 'love-letter@1.0.0',
    assetsRef: 'love-letter/1'
  },
  catalog: {
    nameFa: 'لاو لتر',
    nameOriginal: 'Love Letter',
    summaryFa: 'شانزده کارت، کلی حدس و بلوف؛ نامه‌تان را به دست شاهزاده‌خانم برسانید و رقیبان را از دربار بیرون کنید.',
    rulesFa: [
      'شانزده کارت داریم: نگهبان ×۵ (۱)، کشیش ×۲ (۲)، بارون ×۲ (۳)، ندیمه ×۲ (۴)، شاهزاده ×۲ (۵)، شاه (۶)، کنتس (۷) و شاهزاده‌خانم (۸). یک کارت مخفی کنار می‌رود (دونفره سه کارت دیگر هم رو کنار می‌روند).',
      'هر کس یک کارت در دست دارد. در نوبتتان یک کارت می‌کشید و یکی از دو کارت را بازی می‌کنید.',
      'نگهبان: کارت یک حریف (غیر از نگهبان) را حدس بزنید؛ درست باشد او حذف است. کشیش: دست یک حریف را ببینید. بارون: دست‌ها را مقایسه کنید؛ کوچک‌تر حذف است. ندیمه: تا نوبت بعدتان هدف کسی نیستید.',
      'شاهزاده: یک نفر (حتی خودتان) کارتش را دور بریزد و کارت تازه بکشد. شاه: دستتان را با یک حریف عوض کنید. کنتس: اگر شاه یا شاهزاده هم در دست دارید باید کنتس را بازی کنید. شاهزاده‌خانم: هر کس آن را دور بیندازد حذف است.',
      'دور وقتی تمام می‌شود که یک نفر بماند یا دسته تمام شود (بزرگ‌ترین کارت برنده است). برنده هر دور یک نشان می‌گیرد؛ اولین کسی که به ۷ / ۵ / ۴ نشان (۲ / ۳ / ۴ نفره) برسد برنده بازی است.'
    ],
    minutes: { min: 15, max: 30 },
    difficulty: 'easy',
    access: 'free',
    isTestGame: false,
    timeoutPolicyFa: 'اگر زمان نوبت تمام شود کوچک‌ترین کارت مجاز شما (هرگز شاهزاده‌خانم) روی یک هدف تصادفی بازی می‌شود.',
    resignPolicyFa: 'انصراف یعنی کنار رفتن از بازی؛ اگر یک نفر بماند او برنده است.',
    tutorialFa: 'آموزش تعاملی: دیدن کارت حریف با کشیش و حذف او با حدس درست نگهبان.'
  }
});
