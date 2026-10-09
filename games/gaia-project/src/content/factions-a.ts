// Chunk "factions-a": Terrans, Lantids, Ivits. Owned by one chunk agent; see README.md for the API.
// Numbers follow the official faction boards (cross-checked with the boardgamers gaia-engine board data).
import { gain, hasPI, joinFederation, log, pushDecision, qicFor } from '../core.ts';
import type { ContentBundle, FactionDef, X } from '../types.ts';

// ---------- Terrans PI: gaia-phase power budget spent on the free power conversions ----------
const TERRANS_SPEND: Record<string, { pw: number; g: { q?: number; k?: number; o?: number; c?: number } }> = {
  q: { pw: 4, g: { q: 1 } },
  k: { pw: 4, g: { k: 1 } },
  o: { pw: 3, g: { o: 1 } },
  c: { pw: 1, g: { c: 1 } }
};
const SPEND_FA: Record<string, string> = { q: 'QIC', k: 'دانش', o: 'سنگ معدن', c: 'اعتبار' };
export const terransBudget = (x: X) => Number(x.s.pl[x.seat]!.mark.terransPw ?? 0);

function askTerrans(x: X) {
  const left = terransBudget(x);
  if (left <= 0) { delete x.s.pl[x.seat]!.mark.terransPw; return; }
  // 'done' first: the timeout default ends the spending safely.
  const options = ['done', ...Object.keys(TERRANS_SPEND).filter((k) => TERRANS_SPEND[k]!.pw <= left)];
  pushDecision(x.s, {
    kind: 'custom', seat: x.seat, source: 'faction:terrans', key: 'spend', options, data: left,
    labelFa: `${left} قدرت از ناحیهٔ گایا: ۴→QIC، ۴→دانش، ۳→سنگ معدن، ۱→اعتبار`
  });
}

const terrans: FactionDef = {
  id: 'terrans', nameFa: 'ترن‌ها', nameEn: 'Terrans', home: 'r',
  // Official board: 4 tokens in bowl I and 4 in bowl II (not the default 2/4); gaia project level 1 (one gaiaformer).
  start: { research: { gaia: 1 }, b1: 4 },
  flags: { gaiaToBowl2: true },
  effects: {
    onGaiaPhase: (x) => {
      const n = x.s.pl[x.seat]!.power.gaia;
      if (!hasPI(x.s, x.seat) || n <= 0) return;
      x.s.pl[x.seat]!.mark.terransPw = n;
      askTerrans(x);
    },
    decide: {
      spend: (x, choice) => {
        const p = x.s.pl[x.seat]!;
        const opt = TERRANS_SPEND[choice];
        if (!opt) { delete p.mark.terransPw; return; } // 'done': the rest of the budget is lost
        p.mark.terransPw = terransBudget(x) - opt.pw;
        gain(x.s, x.seat, opt.g);
        log(x.s, { t: 'convert', seat: x.seat, id: `terrans-${choice}` });
        askTerrans(x);
      }
    }
  },
  abilityFa: 'شروع در سطح ۱ پروژهٔ گایا (یک گایاساز) با ۴ ژتون در کاسهٔ I و ۴ ژتون در کاسهٔ II. در مرحلهٔ گایا ژتون‌های ناحیهٔ گایا به کاسهٔ II برمی‌گردند، نه کاسهٔ I.',
  piFa: `با مؤسسهٔ سیاره‌ای، در مرحلهٔ گایا به‌ازای هر ژتونی که از ناحیهٔ گایا به کاسهٔ II می‌رود ۱ قدرت می‌گیرید که فقط با نرخ تبدیل‌های قدرت خرج می‌شود: ۴ → ۱ ${SPEND_FA.q}، ۴ → ۱ ${SPEND_FA.k}، ۳ → ۱ ${SPEND_FA.o}، ۱ → ۱ ${SPEND_FA.c} (نه اقدام‌های قدرت). قدرت خرج‌نشده از بین می‌رود.`
};

const lantids: FactionDef = {
  id: 'lantids', nameFa: 'لانتیدها', nameEn: 'Lantids', home: 'r',
  start: { c: 13, b1: 4, b2: 0 },
  // Official board: the PI gives only 4 power charge (no power token).
  buildings: { pi: { pw: 4 } },
  flags: { sharePlanets: true },
  effects: { on: { mine: (x, e) => { if (e.extra && hasPI(x.s, x.seat)) gain(x.s, x.seat, { k: 2 }); } } },
  abilityFa: 'شروع با ۱۳ اعتبار و ۴ ژتون در کاسهٔ I (کاسهٔ II خالی). می‌توانید روی سیاره‌ای که بازیکن دیگری مستعمره کرده معدن بسازید: بدون زمین‌سازی، با هزینهٔ عادی ۲ اعتبار و ۱ سنگ معدن (و QIC برای برد). روی گایاساز نمی‌شود.',
  piFa: 'مؤسسهٔ سیاره‌ای ۴ شارژ قدرت درآمد می‌دهد (بدون ژتون). هر بار روی سیارهٔ بازیکن دیگری معدن بسازید ۲ دانش می‌گیرید.'
};

/** Ivits space-station targets: empty space, no structure, not in the Ivits federation, reachable with the QIC held. */
const stationTargets = (x: X) => x.s.hexes.flatMap((h, i) =>
  (h.planet === 'e' && h.owner === null && !h.feds.includes(x.seat) && !h.sats.includes(x.seat)
    && qicFor(x.s, x.seat, i) <= x.s.pl[x.seat]!.q ? [i] : []));

const ivits: FactionDef = {
  id: 'ivits', nameFa: 'آیویت‌ها', nameEn: 'Ivits', home: 'o',
  // Official board: bowls 2/2/0, no starting research, base income 1 ore + 1 knowledge + 1 QIC
  // (the board's extra QIC is income, not a start bonus). PI income is the standard 4 charge + 1 token.
  start: { b2: 2 },
  income: { o: 1, k: 1, q: 1 },
  setupMines: 0,
  setupPI: true,
  flags: { singleFederation: true, satelliteQic: true },
  effects: {
    fedThreshold: (x) => 7 * (x.s.pl[x.seat]!.feds.length + 1),
    action: {
      labelFa: 'ساخت ایستگاه فضایی روی یک خانهٔ خالی در برد ناوبری',
      // Official board: the station itself is free; QIC is paid only to extend range (as for a mine),
      // not a flat 1 QIC.
      can: (x) => hasPI(x.s, x.seat) && stationTargets(x).length > 0,
      targets: stationTargets,
      run: (x, hex) => {
        const q = qicFor(x.s, x.seat, hex!);
        x.s.pl[x.seat]!.q -= q;
        const h = x.s.hexes[hex!]!;
        h.owner = x.seat; h.building = 'station';
        log(x.s, { t: 'place', seat: x.seat, hex: hex!, building: 'station' });
        joinFederation(x.s, x.seat, hex!);
      }
    }
  },
  abilityFa: 'در آماده‌سازی معدن نمی‌گذارید؛ پس از همه مؤسسهٔ سیاره‌ای را روی یک سیارهٔ اکسید می‌گذارید. درآمد پایه ۱ QIC بیشتر دارد. ماهواره‌ها به‌جای ژتون قدرت ۱ QIC هزینه دارند. همهٔ فدراسیون‌ها یک فدراسیون رو به رشدند و هر فدراسیون تازه ارزش قدرت ۷ × (تعداد توکن‌های فدراسیون شما + ۱) لازم دارد.',
  piFa: 'اقدام ویژه (هر دور یک بار): یک ایستگاه فضایی روی یک خانهٔ خالی فضا در برد ناوبری بگذارید (برای برد بیشتر QIC بدهید). ایستگاه فقط در فدراسیون ارزش قدرت ۱ دارد، برد شما را گسترش می‌دهد و برای کاشی پایانی ماهواره شمرده می‌شود.'
};

export const factionsA: ContentBundle = { factions: [terrans, lantids, ivits] };
