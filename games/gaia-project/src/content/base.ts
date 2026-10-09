// Architect-owned content: every round booster, round scoring tile, final scoring tile and federation token, plus
// worked examples of each effect kind — four factions (Hadsch Hallas, Xenos, Geodens, Firaks) and eight tech tiles.
// Research tracks and the power/QIC actions are engine data (core.ts / rules.ts). Other content: see README.md.
import {
  buildMine, buildingAt, countBuilding, fire, gaiaPlanets, gaiaform, gaiaformPlan, gain, hasPI, log, minePlan,
  planetTypes, queueLeech, queueResearch, sectorsOf, structuresOf, vp
} from '../core.ts';
import type {
  BoosterDef, ContentBundle, FactionDef, FedTokenDef, FinalTileDef, GaiaState, RoundTileDef, TechDef, X
} from '../types.ts';

// ---------- shared counters (also handy for chunk files) ----------
/** Mines on the map, incl. the Lost Planet and Lantids' extra mines. */
export const mineCount = (s: GaiaState, seat: number) => structuresOf(s, seat).filter((i) => buildingAt(s, seat, i) === 'mine').length;
export const bigCount = (s: GaiaState, seat: number) => countBuilding(s, seat, 'pi') + countBuilding(s, seat, 'ac');
export const stationCount = (s: GaiaState, seat: number) => s.hexes.filter((h) => h.owner === seat && h.building === 'station').length;
const hexes = (s: GaiaState, ok: (i: number) => boolean) => s.hexes.flatMap((_, i) => (ok(i) ? [i] : []));

// ---------- round boosters (10) ----------
export const BOOSTERS: BoosterDef[] = [
  { id: 'b1', labelFa: '+۱ دانش، +۱ سنگ معدن', income: { k: 1, o: 1 } },
  { id: 'b2', labelFa: '+۱ سنگ معدن، +۲ ژتون قدرت', income: { o: 1, t: 2 } },
  { id: 'b3', labelFa: '+۱ QIC، +۲ اعتبار', income: { q: 1, c: 2 } },
  {
    id: 'b4', labelFa: '+۲ اعتبار؛ اقدام: ۱ گام زمین‌سازی و ساخت معدن', income: { c: 2 },
    effects: {
      action: {
        labelFa: '۱ گام زمین‌سازی رایگان و ساخت معدن',
        targets: (x) => hexes(x.s, (i) => typeof minePlan(x.s, x.seat, i, { freeSteps: 1 }) !== 'string'),
        run: (x, hex) => buildMine(x.s, x.seat, hex!, { freeSteps: 1 })
      }
    }
  },
  {
    id: 'b5', labelFa: '+۲ شارژ قدرت؛ اقدام: +۳ برد برای ساخت معدن یا پروژهٔ گایا', income: { pw: 2 },
    effects: {
      action: {
        labelFa: '+۳ برد ناوبری برای یک معدن یا پروژهٔ گایا',
        targets: (x) => hexes(x.s, (i) => typeof minePlan(x.s, x.seat, i, { extraRange: 3 }) !== 'string'
          || typeof gaiaformPlan(x.s, x.seat, i, 3) !== 'string'),
        run: (x, hex) => (x.s.hexes[hex!]!.planet === 'm' && x.s.hexes[hex!]!.owner === null
          ? gaiaform(x.s, x.seat, hex!, 3) : buildMine(x.s, x.seat, hex!, { extraRange: 3 }))
      }
    }
  },
  { id: 'b6', labelFa: '+۱ سنگ معدن؛ هنگام پاس: ۱ امتیاز برای هر معدن', income: { o: 1 }, effects: { onPass: (x) => vp(x.s, x.seat, mineCount(x.s, x.seat), 'booster') } },
  { id: 'b7', labelFa: '+۱ سنگ معدن؛ هنگام پاس: ۲ امتیاز برای هر ایستگاه تجاری', income: { o: 1 }, effects: { onPass: (x) => vp(x.s, x.seat, 2 * countBuilding(x.s, x.seat, 'ts'), 'booster') } },
  { id: 'b8', labelFa: '+۱ دانش؛ هنگام پاس: ۳ امتیاز برای هر آزمایشگاه', income: { k: 1 }, effects: { onPass: (x) => vp(x.s, x.seat, 3 * countBuilding(x.s, x.seat, 'lab'), 'booster') } },
  { id: 'b9', labelFa: '+۴ شارژ قدرت؛ هنگام پاس: ۴ امتیاز برای مؤسسه و هر آکادمی', income: { pw: 4 }, effects: { onPass: (x) => vp(x.s, x.seat, 4 * bigCount(x.s, x.seat), 'booster') } },
  { id: 'b10', labelFa: '+۴ اعتبار؛ هنگام پاس: ۱ امتیاز برای هر سیارهٔ گایا', income: { c: 4 }, effects: { onPass: (x) => vp(x.s, x.seat, gaiaPlanets(x.s, x.seat), 'booster') } }
];

// ---------- round scoring tiles (10; 6 used, one per round) ----------
export const ROUND_TILES: RoundTileDef[] = [
  { id: 'r1', labelFa: 'هر گام زمین‌سازی: ۲ امتیاز', on: { terraform: (x, e) => vp(x.s, x.seat, 2 * e.steps, 'round') } },
  { id: 'r2', labelFa: 'هر پیشرفت پژوهش: ۲ امتیاز', on: { research: (x) => vp(x.s, x.seat, 2, 'round') } },
  { id: 'r3', labelFa: 'هر معدن: ۲ امتیاز', on: { mine: (x) => vp(x.s, x.seat, 2, 'round') } },
  { id: 'r4', labelFa: 'هر فدراسیون: ۵ امتیاز', on: { federation: (x) => vp(x.s, x.seat, 5, 'round') } },
  { id: 'r5', labelFa: 'هر ایستگاه تجاری: ۴ امتیاز', on: { upgrade: (x, e) => { if (e.to === 'ts') vp(x.s, x.seat, 4, 'round'); } } },
  { id: 'r6', labelFa: 'هر معدن روی سیارهٔ گایا: ۴ امتیاز', on: { mine: (x, e) => { if (e.gaia) vp(x.s, x.seat, 4, 'round'); } } },
  { id: 'r7', labelFa: 'مؤسسهٔ سیاره‌ای یا آکادمی: ۵ امتیاز', on: { upgrade: (x, e) => { if (e.to === 'pi' || e.to === 'ac1' || e.to === 'ac2') vp(x.s, x.seat, 5, 'round'); } } },
  { id: 'r8', labelFa: 'هر ایستگاه تجاری: ۳ امتیاز', on: { upgrade: (x, e) => { if (e.to === 'ts') vp(x.s, x.seat, 3, 'round'); } } },
  { id: 'r9', labelFa: 'هر معدن روی سیارهٔ گایا: ۳ امتیاز', on: { mine: (x, e) => { if (e.gaia) vp(x.s, x.seat, 3, 'round'); } } },
  { id: 'r10', labelFa: 'مؤسسهٔ سیاره‌ای یا آکادمی: ۵ امتیاز', on: { upgrade: (x, e) => { if (e.to === 'pi' || e.to === 'ac1' || e.to === 'ac2') vp(x.s, x.seat, 5, 'round'); } } }
];

// ---------- final scoring tiles (6; 2 used). `neutral` = the neutral player's count in 2-player games ----------
export const FINAL_TILES: FinalTileDef[] = [
  { id: 'f1', labelFa: 'بیشترین سازه روی نقشه', neutral: 11, value: (s, seat) => structuresOf(s, seat).length },
  { id: 'f2', labelFa: 'بیشترین سازه در فدراسیون‌ها', neutral: 10, value: (s, seat) => structuresOf(s, seat).filter((i) => s.hexes[i]!.feds.includes(seat)).length },
  { id: 'f3', labelFa: 'بیشترین نوع سیاره', neutral: 5, value: (s, seat) => planetTypes(s, seat) },
  { id: 'f4', labelFa: 'بیشترین سیارهٔ گایا', neutral: 4, value: (s, seat) => gaiaPlanets(s, seat) },
  { id: 'f5', labelFa: 'حضور در بیشترین بخش', neutral: 6, value: (s, seat) => sectorsOf(s, seat) },
  { id: 'f6', labelFa: 'بیشترین ماهواره', neutral: 8, value: (s, seat) => s.pl[seat]!.satellites + stationCount(s, seat) }
];

// ---------- federation tokens (green = can be spent for level 5 / advanced tiles) ----------
export const FED_TOKENS: FedTokenDef[] = [
  { id: 'fed1', labelFa: '۱۲ امتیاز', gain: { vp: 12 }, green: false, copies: 3 },
  { id: 'fed2', labelFa: '۸ امتیاز و ۱ QIC', gain: { vp: 8, q: 1 }, green: true, copies: 3 },
  { id: 'fed3', labelFa: '۸ امتیاز و ۲ ژتون قدرت', gain: { vp: 8, t: 2 }, green: true, copies: 3 },
  { id: 'fed4', labelFa: '۷ امتیاز و ۲ سنگ معدن', gain: { vp: 7, o: 2 }, green: true, copies: 3 },
  { id: 'fed5', labelFa: '۷ امتیاز و ۶ اعتبار', gain: { vp: 7, c: 6 }, green: true, copies: 3 },
  { id: 'fed6', labelFa: '۶ امتیاز و ۲ دانش', gain: { vp: 6, k: 2 }, green: true, copies: 3 },
  // Gleens' own token (gained when building their PI; never in the supply).
  { id: 'gleens', labelFa: '۱ سنگ معدن، ۱ دانش و ۲ اعتبار', gain: { o: 1, k: 1, c: 2 }, green: true, copies: 0 }
];

// ---------- worked examples: factions ----------
const credits = (id: string, labelFa: string, c: number, g: { q?: number; o?: number; k?: number }) => ({
  id, labelFa,
  can: (x: X) => hasPI(x.s, x.seat) && x.s.pl[x.seat]!.c >= c,
  run: (x: X) => { x.s.pl[x.seat]!.c -= c; gain(x.s, x.seat, g); }
});

export const WORKED_FACTIONS: FactionDef[] = [
  {
    // start + income override + conditional free actions (PI)
    id: 'hadsch-hallas', nameFa: 'هادش هالا', nameEn: 'Hadsch Hallas', home: 'o',
    start: { research: { eco: 1 } },
    income: { o: 1, k: 1, c: 3 },
    effects: {
      conversions: [
        credits('hh-q', '۴ اعتبار → ۱ QIC', 4, { q: 1 }),
        credits('hh-o', '۳ اعتبار → ۱ سنگ معدن', 3, { o: 1 }),
        credits('hh-k', '۴ اعتبار → ۱ دانش', 4, { k: 1 })
      ]
    },
    abilityFa: 'شروع در سطح ۱ اقتصاد؛ درآمد پایه ۳ اعتبار بیشتر دارد.',
    piFa: 'با مؤسسهٔ سیاره‌ای، اعتبار را آزادانه تبدیل می‌کنید: ۴ اعتبار → ۱ QIC، ۳ اعتبار → ۱ سنگ معدن، ۴ اعتبار → ۱ دانش.'
  },
  {
    // set-up deviation + PI income + passive modifier
    id: 'xenos', nameFa: 'زنوس', nameEn: 'Xenos', home: 'd',
    start: { research: { ai: 1 } },
    setupMines: 3,
    buildings: { pi: { pw: 4, q: 1 } },
    effects: { fedThreshold: (x, base) => (hasPI(x.s, x.seat) ? Math.min(base, 6) : base) },
    abilityFa: 'شروع در سطح ۱ هوش مصنوعی؛ در آماده‌سازی پس از همه یک معدن سوم می‌گذارید.',
    piFa: 'مؤسسهٔ سیاره‌ای به‌جای ژتون قدرت ۱ QIC درآمد می‌دهد و فدراسیون شما با ارزش قدرت ۶ (به‌جای ۷) تشکیل می‌شود.'
  },
  {
    // triggered effect gated by the PI
    id: 'geodens', nameFa: 'ژئودن‌ها', nameEn: 'Geodens', home: 'v',
    start: { research: { terra: 1 } },
    effects: { on: { mine: (x, e) => { if (hasPI(x.s, x.seat) && e.newType && !e.extra) gain(x.s, x.seat, { k: 3 }); } } },
    abilityFa: 'شروع در سطح ۱ زمین‌سازی.',
    piFa: 'با مؤسسهٔ سیاره‌ای، هر بار روی نوع سیاره‌ای که تا حالا نداشته‌اید معدن بسازید ۳ دانش می‌گیرید.'
  },
  {
    // special action with hex targets + follow-up decision
    id: 'firaks', nameFa: 'فیراک‌ها', nameEn: 'Firaks', home: 't',
    start: { k: 2, o: 3 },
    income: { o: 1, k: 2 },
    effects: {
      action: {
        labelFa: 'تنزل آزمایشگاه به ایستگاه تجاری و یک پیشرفت پژوهش',
        can: (x) => hasPI(x.s, x.seat) && countBuilding(x.s, x.seat, 'ts') < 4,
        targets: (x) => hexes(x.s, (i) => x.s.hexes[i]!.owner === x.seat && x.s.hexes[i]!.building === 'lab'),
        run: (x, hex) => {
          x.s.hexes[hex!]!.building = 'ts';
          log(x.s, { t: 'upgrade', seat: x.seat, hex: hex!, to: 'ts' });
          fire(x.s, x.seat, { kind: 'upgrade', hex: hex!, to: 'ts', from: 'lab' });
          queueResearch(x.s, x.seat);
          // Placing the trading station is a build: neighbours may charge power (boardgamers placeBuilding).
          queueLeech(x.s, x.seat, hex!);
        }
      }
    },
    abilityFa: 'شروع با ۲ دانش و ۳ سنگ معدن؛ درآمد پایه ۲ دانش و ۱ سنگ معدن.',
    piFa: 'اقدام ویژه (هر دور یک بار): یک آزمایشگاه پژوهشی را به ایستگاه تجاری تنزل دهید و یک سطح در هر مسیر پژوهش جلو بروید. این کار ساخت ایستگاه تجاری حساب می‌شود (کاشی دور و همسایه‌ها می‌توانند قدرت بگیرند).'
  }
];

// ---------- worked examples: tech tiles (ids: std1–std9, adv1–adv15, numbering in README) ----------
export const WORKED_TECHS: TechDef[] = [
  { id: 'std1', kind: 'std', labelFa: 'فوری: ۱ سنگ معدن و ۱ QIC', effects: { onGain: (x) => gain(x.s, x.seat, { o: 1, q: 1 }) } },
  { id: 'std3', kind: 'std', labelFa: 'ارزش قدرت مؤسسه و آکادمی‌ها ۴', effects: { powerValue: (_x, _hex, base) => (base === 3 ? 4 : base) } },
  { id: 'std5', kind: 'std', labelFa: 'درآمد: ۱ سنگ معدن و ۱ شارژ قدرت', effects: { income: { o: 1, pw: 1 } } },
  { id: 'std7', kind: 'std', labelFa: 'هر معدن روی سیارهٔ گایا: ۳ امتیاز', effects: { on: { mine: (x, e) => { if (e.gaia) vp(x.s, x.seat, 3, 'tech'); } } } },
  { id: 'std9', kind: 'std', labelFa: 'اقدام: ۴ شارژ قدرت', effects: { action: { labelFa: '۴ شارژ قدرت', run: (x) => gain(x.s, x.seat, { pw: 4 }) } } },
  { id: 'adv1', kind: 'adv', labelFa: 'هنگام پاس: ۳ امتیاز برای هر فدراسیون', effects: { onPass: (x) => vp(x.s, x.seat, 3 * x.s.pl[x.seat]!.feds.length, 'tech') } },
  { id: 'adv4', kind: 'adv', labelFa: 'فوری: ۲ امتیاز برای هر معدن', effects: { onGain: (x) => vp(x.s, x.seat, 2 * mineCount(x.s, x.seat), 'tech') } },
  { id: 'adv14', kind: 'adv', labelFa: 'هر معدن: ۳ امتیاز', effects: { on: { mine: (x) => vp(x.s, x.seat, 3, 'tech') } } }
];

export const base: ContentBundle = {
  factions: WORKED_FACTIONS,
  techs: WORKED_TECHS,
  boosters: BOOSTERS,
  rounds: ROUND_TILES,
  finals: FINAL_TILES,
  feds: FED_TOKENS
};
