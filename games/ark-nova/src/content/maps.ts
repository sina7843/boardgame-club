// Ark Nova content chunk «maps»: zoo maps 0 and 1-8 (Map A is in examples.ts) — geometry, placement bonuses, the 7
// left-edge bonuses, partner/university/worker bonuses and each advanced map's special ability.
// Geometry and bonuses: .tmp-trophy/ark-nova/ref/maps.json; feature spaces read off the printed map boards.
// API: ./README.md (worked examples in ./examples.ts). Tests: packages/game-engine/test/ark-nova-maps.test.ts
import { P, afterAction, ask, build, coveredCells, discardFromHand, gain, grantAction, isSponsor, isStandard, later, log, reveal } from '../core.ts';
import { neighbors } from '../hex.ts';
import type { Bonus, ContentChunk, Ctx, MapDef, Player } from '../types.ts';

const covers = (p: Player, cells: readonly string[]) => { const cov = coveredCells(p); return cells.every((x) => cov.has(x)); };
const coveredAmong = (p: Player, cells: readonly string[]) => { const cov = coveredCells(p); return cells.filter((x) => cov.has(x)).length; };

// Left-edge bonuses shared by every map: slots 1-3 (income), 5-7 (one-time). Slot 4 differs per map.
const left = (b4: Bonus, income4: boolean, b5: Bonus = { k: 'worker' }): MapDef['left'] => [
  { b: { k: 'snap' }, income: true }, { b: { k: 'enclosure', n: 2 }, income: true }, { b: { k: 'money', n: 5 }, income: true },
  { b: b4, income: income4 }, { b: b5, income: false }, { b: { k: 'money', n: 12 }, income: false }, { b: { k: 'x', n: 3 }, income: false }
];

const MAP_0: MapDef = {
  id: '0', nameFa: 'نقشهٔ ۰', textFa: 'نقشهٔ پایه بدون توانایی ویژه و بدون ساختمان آغازین.',
  water: ['0_1', '0_3', '1_0', '1_10', '2_7', '3_0', '5_4', '7_12', '8_9', '8_11'],
  rock: ['0_11', '1_12', '2_1', '3_2', '5_8', '5_12', '6_3', '6_9', '6_11'],
  upgrade: ['6_5', '7_4'],
  bonuses: {
    '0_9': { k: 'rep', n: 2 }, '1_2': { k: 'card', n: 1 }, '2_5': { k: 'card', n: 1 }, '3_8': { k: 'x', n: 1 }, '3_12': { k: 'card', n: 1 },
    '4_1': { k: 'x', n: 1 }, '4_5': { k: 'money', n: 10 }, '5_6': { k: 'clever' }, '5_10': { k: 'x', n: 1 }, '7_2': { k: 'money', n: 5 },
    '7_10': { k: 'rep', n: 2 }, '8_7': { k: 'money', n: 5 }
  },
  left: left({ k: 'cp', n: 1 }, true),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 2 } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 2 } }, worker: { 3: { k: 'cp', n: 2 } }
};

/** Map 1: the Observation Tower stands on rock space 1_6 (one of the 4-space rock ridge on the edge). */
export const TOWER = '1_6';
const MAP_1: MapDef = {
  id: '1', nameFa: 'برج دیدبانی',
  textFa: 'هر بار که یک محوطهٔ استاندارد مجاور خانهٔ برج دیدبانی را به روی پر برمی‌گردانید، ۲ جذابیت بگیرید (پس از رهاسازی و پر کردن دوباره هم). روی محوطه‌های ویژه اثری ندارد.',
  water: ['4_5', '5_6', '5_12', '6_7', '7_6', '8_5', '8_7'],
  rock: ['0_5', '0_7', '0_9', '1_0', '1_6', '2_1', '3_0', '3_10', '3_12'],
  upgrade: ['3_4', '4_7', '5_8'],
  bonuses: {
    '0_1': { k: 'x', n: 1 }, '0_11': { k: 'money', n: 5 }, '3_6': { k: 'card', n: 1 }, '4_1': { k: 'clever' }, '4_11': { k: 'rep', n: 1 },
    '6_5': { k: 'money', n: 5 }, '7_2': { k: 'card', n: 1 }, '7_8': { k: 'x', n: 1 }, '7_12': { k: 'x', n: 1 }
  },
  left: left({ k: 'sponsor' }, true),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 2 } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 1 } }, worker: {},
  marks: { [TOWER]: 'برج دیدبانی' },
  on: {
    occupied: (c, e) => {
      if (e.seat === c.seat && e.building.cells.some((x) => neighbors(TOWER).includes(x))) { gain(c, 'appeal', 2); log(c, 'm1tower'); }
    }
  }
};

/** Map 2: the Outdoor Areas gate is printed on water space 5_8 (one of a 5-space lake). */
export const GATES = '5_8';
const MAP_2: MapDef = {
  id: '2', nameFa: 'محوطه‌های روباز',
  textFa: 'ظرفیت هر محوطهٔ استاندارد مجاور خانهٔ محوطهٔ روباز ۲ واحد بیشتر است (محوطهٔ ۱ خانه حیوان ۱ تا ۳ خانه‌ای می‌پذیرد). روی محوطه‌های ویژه اثری ندارد.',
  water: ['3_8', '4_9', '4_11', '5_8', '5_10', '6_1', '7_0'],
  rock: ['0_1', '0_3', '0_9', '0_11', '1_4', '1_10', '4_1', '5_0', '8_5'],
  upgrade: ['1_0', '2_1', '3_6', '5_6'],
  bonuses: {
    '0_5': { k: 'rep', n: 1 }, '1_2': { k: 'partner' }, '1_12': { k: 'sponsor' }, '4_7': { k: 'x', n: 1 }, '5_2': { k: 'card', n: 1 },
    '7_2': { k: 'card', n: 1 }, '7_6': { k: 'x', n: 1 }, '8_11': { k: 'clever' }
  },
  left: left({ k: 'cp', n: 1 }, false),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 2 } }, worker: { 3: { k: 'cp', n: 1 } },
  marks: { [GATES]: 'محوطهٔ روباز' },
  q: { enclosureSize: (_c, b) => (isStandard(b) && b.cells.some((x) => neighbors(GATES).includes(x)) ? 2 : 0) }
};

const MAP_3: MapDef = {
  id: '3', nameFa: 'دریاچهٔ نقره‌ای',
  textFa: 'منطقهٔ سودآور دور دریاچه: یازده خانهٔ کنار دریاچه هر کدام ۲ پول پاداش جایگذاری دارند. خانهٔ چهارم لبهٔ نقشه: یک کنش اضافه پس از پایان کنش جاری (اراده).',
  water: ['0_11', '1_6', '2_3', '2_5', '2_7', '5_10', '5_12', '6_1', '6_9'],
  rock: ['3_12', '4_11', '5_0', '6_3', '7_0', '8_5', '8_7'],
  upgrade: ['0_1', '1_0', '1_2', '1_4', '2_1'],
  bonuses: {
    '0_5': { k: 'money', n: 2 }, '0_7': { k: 'money', n: 2 }, '1_2': { k: 'money', n: 2 }, '1_4': { k: 'money', n: 2 }, '1_8': { k: 'money', n: 2 },
    '2_1': { k: 'money', n: 2 }, '2_9': { k: 'money', n: 2 }, '3_2': { k: 'money', n: 2 }, '3_4': { k: 'money', n: 2 }, '3_6': { k: 'money', n: 2 },
    '3_8': { k: 'money', n: 2 }, '0_3': { k: 'rep', n: 1 }, '1_12': { k: 'card', n: 1 }, '4_9': { k: 'rep', n: 1 }, '5_2': { k: 'clever' },
    '5_6': { k: 'card', n: 1 }, '6_11': { k: 'x', n: 1 }, '7_2': { k: 'sponsor' }, '8_9': { k: 'x', n: 1 }
  },
  left: left({ k: 'fx', fx: 'm3:determination', labelFa: 'اراده: پس از پایان کنش، یک کنش دیگر' }, false),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 1 } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 2 } }, worker: {}
};

/** Map 4: the Commercial Harbor lies off the grid at the bottom corner; its single adjacent building space is 0_11. */
export const HARBOR_LINK = '0_11';
const MAP_4: MapDef = {
  id: '4', nameFa: 'بندر تجاری',
  textFa: 'فعال وقتی خانهٔ کنار بندر ساخته شده باشد: یک بار در هر نوبت خودتان می‌توانید ۱ کارت دست را دور بریزید و ۳ پول بگیرید. در استراحت یا نوبت دیگران نه.',
  water: ['0_9', '1_4', '1_12', '2_3', '2_5', '3_4', '5_0', '8_1', '8_3'],
  rock: ['3_8', '3_10', '5_12', '6_5', '6_7', '7_2', '7_10'],
  upgrade: ['6_3', '8_5', '8_7', '8_9'],
  bonuses: {
    '0_5': { k: 'rep', n: 1 }, '1_2': { k: 'x', n: 1 }, '2_9': { k: 'clever' }, '3_2': { k: 'x', n: 1 }, '3_6': { k: 'card', n: 1 },
    '5_4': { k: 'x', n: 1 }, '6_1': { k: 'card', n: 1 }, '7_4': { k: 'multiplier' }, '8_11': { k: 'money', n: 5 }
  },
  left: left({ k: 'uni' }, false),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 1 } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 1 } }, worker: { 3: { k: 'cp', n: 1 } },
  marks: { [HARBOR_LINK]: 'اتصال بندر تجاری' },
  turn: {
    key: 'm4', labelFa: 'بندر تجاری: ۱ کارت دست را دور بریزید و ۳ پول بگیرید',
    can: (c) => covers(P(c), [HARBOR_LINK]) && P(c).hand.length > 0,
    run: (c) => ask.pick(c, { ids: [...P(c).hand], min: 1, max: 1, label: 'بندر تجاری: کارتی را برای ۳ پول دور بریزید', fx: 'm4:sell' })
  }
};

/** Map 5: the Park Restaurant is printed on space 4_5 (not a building space, not rock). */
export const RESTAURANT = '4_5';
const MAP_5: MapDef = {
  id: '5', nameFa: 'رستوران پارک',
  textFa: 'درآمد: در هر استراحت به ازای هر خانهٔ مجاور رستوران که ساختمانی روی آن است ۱ پول بگیرید (نوع و پر یا خالی بودن مهم نیست).',
  water: ['0_5', '1_4', '2_9', '4_3', '5_8', '5_10', '7_6', '8_7'],
  rock: ['1_8', '2_3', '2_5', '6_1', '6_9', '7_4'],
  blocked: [RESTAURANT],
  upgrade: ['1_2', '1_10', '5_12'],
  bonuses: {
    '1_0': { k: 'x', n: 1 }, '1_6': { k: 'x', n: 1 }, '2_7': { k: 'sponsor' }, '4_1': { k: 'clever' }, '4_9': { k: 'card', n: 1 },
    '6_3': { k: 'card', n: 1 }, '6_7': { k: 'card', n: 1 }, '6_11': { k: 'money', n: 5 }, '8_3': { k: 'rep', n: 1 }
  },
  left: left({ k: 'fx', fx: 'm5:special', labelFa: 'خانهٔ خزندگان یا قفس بزرگ پرندگان رایگان' }, false),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 2 } }, uni: { 2: { k: 'upgrade' } }, worker: { 3: { k: 'cp', n: 1 } },
  marks: { [RESTAURANT]: 'رستوران پارک' },
  income: (c) => gain(c, 'money', coveredAmong(P(c), neighbors(RESTAURANT)))
};

/** Map 6: the Research Institute lies off the grid at the bottom corner; its single adjacent building space is 0_11. */
export const INSTITUTE_LINK = '0_11';
const MAP_6: MapDef = {
  id: '6', nameFa: 'پژوهشکده',
  textFa: 'فعال وقتی خانهٔ کنار پژوهشکده ساخته شده باشد: هنگام بازی کارت حیوان ۱ شرط به انتخاب خودتان را نادیده بگیرید (نه نیاز صخره یا آب).',
  water: ['0_1', '0_3', '5_10', '5_12', '7_4', '7_6', '8_1', '8_3', '8_11'],
  rock: ['2_7', '2_9', '3_6', '3_8', '4_1', '5_0', '7_10'],
  upgrade: ['4_3', '5_4', '6_1', '7_0'],
  bonuses: {
    '1_2': { k: 'x', n: 1 }, '1_8': { k: 'clever' }, '2_5': { k: 'money', n: 5 }, '3_0': { k: 'x', n: 1 }, '3_10': { k: 'card', n: 1 },
    '5_2': { k: 'card', n: 1 }, '6_11': { k: 'rep', n: 1 }, '7_2': { k: 'uni' }, '8_7': { k: 'money', n: 5 }
  },
  left: left({ k: 'fx', fx: 'm6:clever2', labelFa: 'دو بار: یک کارت کنش به خانهٔ ۱' }, true),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 1 } }, uni: { 2: { k: 'upgrade' } }, worker: { 3: { k: 'cp', n: 2 } },
  marks: { [INSTITUTE_LINK]: 'اتصال پژوهشکده' },
  q: { ignoreConditions: (c, card) => ('cost' in card && covers(P(c), [INSTITUTE_LINK]) ? 1 : 0) }
};

/** Map 7: the three kiosk placement-bonus spaces. */
export const KIOSK_SPACES = ['1_2', '5_4', '5_10'];
const MAP_7: MapDef = {
  id: '7', nameFa: 'بستنی‌فروشی‌ها',
  textFa: 'وقتی هر سه خانهٔ پاداش کیوسک پوشانده شده باشند: در درآمد هر استراحت به ازای هر کیوسک باغ‌وحش ۱ پول اضافه بگیرید.',
  water: ['7_0', '7_4', '7_10', '8_1', '8_3', '8_5', '8_11'],
  rock: ['0_1', '0_3', '1_8', '2_9', '3_4', '4_1', '4_3', '4_9', '5_8'],
  upgrade: ['3_8', '3_10', '3_12'],
  bonuses: {
    '0_5': { k: 'rep', n: 1 }, '1_2': { k: 'kiosk' }, '1_10': { k: 'rep', n: 1 }, '3_2': { k: 'card', n: 1 }, '3_6': { k: 'sponsor' },
    '4_7': { k: 'card', n: 1 }, '4_11': { k: 'card', n: 1 }, '5_4': { k: 'kiosk' }, '5_10': { k: 'kiosk' }, '7_2': { k: 'x', n: 1 },
    '7_6': { k: 'clever' }, '7_12': { k: 'money', n: 5 }, '8_9': { k: 'x', n: 1 }
  },
  left: left({ k: 'fx', fx: 'm7:pouch', labelFa: 'کیسه ۲: تا ۲ کارت دست را زیر نقشه بگذارید، هر کدام ۲ جذابیت' }, true),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 1 } }, worker: { 3: { k: 'cp', n: 2 } },
  income: (c) => { const p = P(c); if (covers(p, KIOSK_SPACES)) gain(c, 'money', p.buildings.filter((b) => b.kind === 'kiosk').length); }
};

/** Map 8: the three Hollywood spaces (building spaces, not placement bonuses). */
export const HOLLYWOOD = ['1_10', '4_11', '6_9'];
const MAP_8: MapDef = {
  id: '8', nameFa: 'تپه‌های هالیوود',
  textFa: 'هر بار که خانهٔ هالیوود را می‌پوشانید، از دسته کارت رو کنید تا اولین حامی؛ آن را به دست بگیرید و بقیه را دور بریزید. وقتی هر ۳ خانه پوشانده شد، سطح هر حامی که بازی می‌کنید ۱ کمتر است.',
  water: ['1_0', '1_4', '2_5', '4_3', '5_2', '5_4', '6_3'],
  rock: ['0_9', '0_11', '1_12', '2_11', '3_12', '4_9', '5_12', '6_11', '7_10'],
  upgrade: ['2_7', '3_6', '3_10'],
  bonuses: {
    '0_7': { k: 'clever' }, '1_2': { k: 'x', n: 1 }, '3_0': { k: 'x', n: 1 }, '4_5': { k: 'x', n: 1 }, '6_1': { k: 'money', n: 5 },
    '7_4': { k: 'card', n: 1 }, '8_9': { k: 'rep', n: 1 }
  },
  left: left({ k: 'partner' }, false),
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 1 } }, uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 1 } }, worker: { 3: { k: 'cp', n: 1 } },
  marks: Object.fromEntries(HOLLYWOOD.map((x) => [x, 'هالیوود'])),
  on: {
    covered: (c, e) => {
      if (e.seat !== c.seat) return;
      const n = e.cells.filter((x) => HOLLYWOOD.includes(x)).length;
      for (let i = 0; i < n; i++) revealSponsor(c);
    }
  },
  q: { sponsorLevel: (c) => (covers(P(c), HOLLYWOOD) ? -1 : 0) }
};

/** Reveal deck cards until a Sponsor: it goes to the hand, the others to the discard pile (after the search). */
function revealSponsor(c: Ctx) {
  const others: number[] = [];
  let found: number | null = null;
  for (let id = reveal(c); id !== null; id = reveal(c)) {
    if (isSponsor(id)) { found = id; break; }
    others.push(id);
  }
  c.s.discard.push(...others);
  if (found !== null) P(c).hand.push(found);
  log(c, 'm8hollywood', { revealed: others.length + (found !== null ? 1 : 0) });
}

export const maps: ContentChunk = {
  maps: [MAP_0, MAP_1, MAP_2, MAP_3, MAP_4, MAP_5, MAP_6, MAP_7, MAP_8],
  fx: {
    'm3:determination': (c) => afterAction(c, 'm3:extra'),
    'm3:extra': (c) => grantAction(c, { label: 'اراده (دریاچهٔ نقره‌ای): یک کنش دیگر (اختیاری)' }),
    'm4:sell': (c, _d, ans) => { discardFromHand(c, ans.ids ?? []); gain(c, 'money', 3); log(c, 'm4harbor'); },
    'm5:special': (c) => ask.place(c, { kinds: ['rh', 'ba'], free: true, optional: true, label: 'ساخت رایگان خانهٔ خزندگان یا قفس بزرگ پرندگان', fx: 'm5:placed' }),
    'm5:placed': (c, _d, ans) => {
      if (ans.skip) return;
      build(c, ans.kind!, ans.cells!, true);
      later(c, 'core:moveAnimals', ans.kind);
    },
    'm6:clever2': (c) => { later(c, 'core:clever'); later(c, 'core:clever'); },
    'm7:pouch': (c) => ask.pick(c, { ids: [...P(c).hand], min: 0, max: 2, label: 'کیسه: تا ۲ کارت دست را زیر نقشه بگذارید (هر کدام ۲ جذابیت)', fx: 'm7:pouched', optional: true }),
    'm7:pouched': (c, _d, ans) => {
      const p = P(c);
      const ids = (ans.ids ?? []).filter((id) => p.hand.includes(id));
      for (const id of ids) p.hand.splice(p.hand.indexOf(id), 1);
      p.under.map = [...(p.under.map ?? []), ...ids];
      gain(c, 'appeal', 2 * ids.length);
    }
  }
};
