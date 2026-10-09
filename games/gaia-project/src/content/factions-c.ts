// Chunk "factions-c": Bescods, Itars, Nevlas. Owned by one chunk agent; see README.md for the API.
// Numbers follow the official faction boards (cross-checked against the boardgamers.space engine's standard boards).
import { conversion, gain, hasPI, pushDecision, queueResearch, queueTech, researchBlock, techOptions } from '../core.ts';
import { TRACKS, type ContentBundle, type Conversion, type Track, type X } from '../types.ts';

/** Tracks at the seat's lowest research level that can still advance. */
export function lowestTracks(x: X): Track[] {
  const lv = x.s.pl[x.seat]!.research;
  const min = Math.min(...TRACKS.map((t) => lv[t]));
  return TRACKS.filter((t) => lv[t] === min && !researchBlock(x.s, x.seat, t));
}

const afterPI = (c: Conversion): Conversion => ({ ...c, can: (x) => hasPI(x.s, x.seat) && c.can(x) });

/** Itars: tokens set aside from the gaia area while the PI decision is open go back to bowl I. */
function returnAside(x: X) {
  const p = x.s.pl[x.seat]!;
  p.power.b1 += Number(p.mark.itarsAside ?? 0);
  p.mark.itarsAside = 0;
}
const askItars = (x: X) => pushDecision(x.s, {
  kind: 'custom', seat: x.seat, source: 'faction:itars', key: 'tech', options: ['no', 'yes'],
  labelFa: '۴ ژتون ناحیهٔ گایا را کنار بگذارید و یک کاشی فناوری بگیرید؟'
});

export const factionsC: ContentBundle = {
  factions: [
    {
      id: 'bescods', nameFa: 'بسکادها', nameEn: 'Bescods', home: 't',
      // Board: base income only +1 ore (no knowledge); stations give knowledge, labs give credits.
      income: { o: 1 },
      buildings: { ts: [{ k: 1 }, { k: 1 }, { k: 1 }, { k: 1 }], lab: [{ c: 3 }, { c: 4 }, { c: 5 }], pi: { pw: 4, t: 2 } },
      effects: {
        action: {
          labelFa: 'یک سطح رایگان در پایین‌ترین مسیر پژوهش',
          can: (x) => lowestTracks(x).length > 0,
          run: (x) => queueResearch(x.s, x.seat, lowestTracks(x))
        },
        // Official PI: +1 power value for every structure on a titanium (grey) planet. The task summary said
        // "PI and academies"; the board text wins. std3 is applied here first so PI/academy on titanium + std3 = 5.
        powerValue: (x, hex, base) => {
          if (!hasPI(x.s, x.seat) || x.s.hexes[hex]!.planet !== 't') return base;
          const std3 = x.s.pl[x.seat]!.techs.some((t) => t.id === 'std3' && !t.covered);
          return (base === 3 && std3 ? 4 : base) + 1;
        }
      },
      abilityFa: 'درآمد پایه فقط ۱ سنگ معدن است؛ هر ایستگاه تجاری ۱ دانش و آزمایشگاه‌های پژوهشی ۳، ۴ و ۵ اعتبار درآمد می‌دهند. اقدام ویژه (هر دور یک بار): در یکی از مسیرهای پژوهشی که پایین‌ترین سطح شما را دارد، رایگان یک سطح جلو بروید.',
      piFa: 'مؤسسهٔ سیاره‌ای ۴ شارژ قدرت و ۲ ژتون قدرت درآمد می‌دهد و ارزش قدرت همهٔ سازه‌های شما روی سیاره‌های تیتانیومی (خاکستری) ۱ واحد بیشتر می‌شود.'
    },
    {
      id: 'itars', nameFa: 'ایتارها', nameEn: 'Itars', home: 'i',
      start: { o: 5, b1: 4 },
      income: { o: 1, k: 1, t: 1 },
      buildings: { ac1: { k: 3 } },
      flags: { burnToGaia: true },
      effects: {
        // Runs before the gaia-area tokens return: set aside every full group of 4, the decisions spend them.
        onGaiaPhase: (x) => {
          const p = x.s.pl[x.seat]!;
          if (!hasPI(x.s, x.seat) || p.power.gaia < 4 || !techOptions(x.s, x.seat).length) return;
          const n = Math.floor(p.power.gaia / 4) * 4;
          p.power.gaia -= n;
          p.mark.itarsAside = n;
          askItars(x);
        },
        decide: {
          tech: (x, choice) => {
            const p = x.s.pl[x.seat]!;
            if (choice !== 'yes') { returnAside(x); return; }
            p.mark.itarsAside = Number(p.mark.itarsAside ?? 0) - 4; // these 4 tokens leave the game
            queueTech(x.s, x.seat);
            // The queued tech decision takes one of the current options, so ask again only if another remains.
            if (Number(p.mark.itarsAside) >= 4 && techOptions(x.s, x.seat).length > 1) askItars(x);
            else returnAside(x);
          }
        }
      },
      abilityFa: 'شروع با ۵ سنگ معدن و ۴ ژتون در کاسهٔ I؛ درآمد پایه ۱ ژتون قدرت بیشتر دارد و آکادمی دانش ۳ دانش درآمد می‌دهد. هنگام سوزاندن قدرت، ژتون حذف‌شده به ناحیهٔ گایا می‌رود.',
      piFa: 'با مؤسسهٔ سیاره‌ای، در هر مرحلهٔ گایا (پیش از برگشتن ژتون‌ها) می‌توانید هر بار ۴ ژتون ناحیهٔ گایا را برای همیشه کنار بگذارید و یک کاشی فناوری بگیرید.'
    },
    {
      id: 'nevlas', nameFa: 'نِولاها', nameEn: 'Nevlas', home: 'i',
      start: { k: 2, research: { sci: 1 } },
      buildings: { lab: [{ pw: 2 }, { pw: 2 }, { pw: 2 }] },
      flags: { bowl3DoubleAfterPI: true },
      effects: {
        // After the PI a bowl-III token is worth 2: the board replaces the 1 → 1 credit and 3 → 1 ore free actions
        // (they would waste power) with the three PI conversions below.
        hideConversions: (x) => (hasPI(x.s, x.seat) ? ['pw-c', 'pw-o'] : []),
        conversions: [
          {
            id: 'nev-k', labelFa: '۱ ژتون کاسهٔ III → ناحیهٔ گایا و ۱ دانش',
            can: (x) => x.s.pl[x.seat]!.power.b3 >= 1,
            run: (x) => { const pw = x.s.pl[x.seat]!.power; pw.b3 -= 1; pw.gaia += 1; gain(x.s, x.seat, { k: 1 }); }
          },
          // After the PI one token = 2 power; these spend whole tokens without waste.
          afterPI(conversion('nev-2c', '۲ قدرت → ۲ اعتبار', { pw: 2 }, { c: 2 })),
          afterPI(conversion('nev-oc', '۴ قدرت → ۱ سنگ معدن و ۱ اعتبار', { pw: 4 }, { o: 1, c: 1 })),
          afterPI(conversion('nev-2o', '۶ قدرت → ۲ سنگ معدن', { pw: 6 }, { o: 2 }))
        ]
      },
      abilityFa: 'شروع در سطح ۱ دانش و با ۲ دانش؛ هر آزمایشگاه پژوهشی به‌جای دانش ۲ شارژ قدرت درآمد می‌دهد. اقدام آزاد: ۱ ژتون از کاسهٔ III را به ناحیهٔ گایا ببرید و ۱ دانش بگیرید.',
      piFa: 'با مؤسسهٔ سیاره‌ای، هنگام خرج کردن قدرت هر ژتون کاسهٔ III دو قدرت حساب می‌شود.'
    }
  ]
};
