// Gaia Project table, BGA style (design/games/gaia-project HANDOFF.md, COMPONENTS.md). Every piece is the publisher's
// flat art placed by layout.json (source-image pixels → % of the board), never drawn with CSS. Desktop: sticky action
// bar, then three felt zones (map; research + scoring + boosters; player boards). Phone: the same zones behind four
// tabs, the action bar collapsed at the bottom with an actions sheet.
//
// A turn is a local draft until «تأیید»: every step (free conversions, the main action, its decisions) runs through the
// engine's own validate/apply/legalActions on a copy of the public state, so buttons, costs and disabled reasons come
// from the rules, and «برگرد» removes the last step. Confirm sends the steps one by one; after that there is no undo.
// Out-of-turn power charges (leech) and the auto-charge setting are sent at once.
import './renderer.css';
import { memo, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Button, fa, getTermsLang, tx, useTermsLang, type GameAction, type GameRendererProps, type Term } from '@bg/ui';
import { terms, tf } from './terms.ts';
import { FeltPlate, PlayerCard } from '@bg/ui/bgv';
import {
  BUILDING_FA as BUILDING_FA0, BUILD_COST, CONTENT, POWER_ACTIONS, RESEARCH_COST, RES_FA as RES_FA0, BASE_CONVERSIONS, TRACKS, TRACK_FA as TRACK_FA0, WHEEL, buildMap, conversions, qicFor, fedCandidates, fedCheck, fedPlan, fedTokensAvailable, gaiaformPlan, gaiaProjectModule, incomeResults, leechAmount, minePlan, upgradeCost,
  type Bowls, type Building, type Gain, type GaiaAction, type GaiaState, type GaiaView, type Track
} from './rules.ts';
import { TERRANS_SPEND } from './content/factions-a.ts';
import LAYOUT from './design/layout.json' with { type: 'json' };
import IDS from './design/content-id-map.json' with { type: 'json' };

// Read-through label tables for «فارسی بردگیمی»: entries with a Term follow the current terms language, the rest stay as the engine's Persian.
const tp = <K extends string>(base: Record<K, string>, m: Partial<Record<K, Term>>): Record<K, string> => new Proxy(base, { get: (o, k) => { const x = m[k as K]; return x ? tx(x) : o[k as K]; } });
const RES_FA = tp(RES_FA0, { c: terms.credits, o: terms.ore, k: terms.knowledge, pw: terms.powerCharge, t: terms.powerToken });
const BUILDING_FA = tp(BUILDING_FA0, { mine: terms.mine, ts: terms.tradingStation, lab: terms.researchLab, pi: terms.planetaryInstitute, ac1: terms.knowledgeAcademy, ac2: terms.qicAcademy, gf: terms.gaiaformer, station: terms.spaceStation });
const TRACK_FA = tp(TRACK_FA0, { terra: terms.terraforming, nav: terms.navigation, ai: terms.ai, gaia: terms.gaiaProject, eco: terms.economy, sci: terms.science });
/** Read-through proxy over a Persian string table: every value goes through `tf` (all game words, also inside sentences). */
const tfp = (base: Record<string, string>): Record<string, string> => new Proxy(base, { get: (o, k) => (typeof k === 'string' && k in o ? tf(o[k]!) : undefined) });

// ---------------- art ----------------

const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
/** Web URL of a file under art/ (paths as in content-id-map.json, e.g. `art/boards/research-board.webp`). */
const art = (path: string) => ART[`./${path}`] ?? '';
/** Half-size copies of the big boards and sectors (art-sm/, same paths) for phones. */
const ART_SM = import.meta.glob<string>('./art-sm/**/*.webp', { eager: true, import: 'default' });
const srcSet = (path: string, w: number) => { const sm = ART_SM[`./art-sm/${path.slice(4)}`]; return sm ? `${sm} ${Math.round(w / 2)}w, ${art(path)} ${w}w` : undefined; };
/** A board image: intrinsic size known (no layout shift), decoded off the main thread, half size on phones. */
function BoardImg({ path, w, h, alt, sizes, lazy }: { path: string; w: number; h: number; alt: string; sizes: string; lazy?: boolean }) {
  return <img className="gp-board__img" src={art(path)} srcSet={srcSet(path, w)} sizes={sizes} width={w} height={h} alt={alt} decoding="async" loading={lazy ? 'lazy' : undefined} draggable={false} />;
}

/** Kit 2 zoom: hover (300 ms) or focus on desktop shows the piece 2x with its rule text; on the phone the same block is
 *  a dock at the bottom (tap). Never always-open; Esc closes it (blur). */
function Tip({ img, title, text }: { img?: string; title: string; text?: ReactNode }) {
  return <span className="gp-tip" role="tooltip">{img && <img src={img} alt="" loading="lazy" />}<b>{title}</b>{text && <small>{text}</small>}</span>;
}
type FactionIds = Record<string, { nameEn: string; color: string; board: string; portrait: string }>;
const FACTIONS = IDS.factions as FactionIds;
const pick = (table: Record<string, string>, id: string) => art(table[id] ?? '');
const techArt = (id: string) => pick({ ...IDS.techStandard, ...IDS.techAdvanced } as Record<string, string>, id);
const boosterArt = (id: string) => pick(IDS.boosters, id);
const fedArt = (id: string, spent = false) => {
  const f = (IDS.federations as Record<string, string>)[id] ?? '';
  return art(spent && id !== 'fed1' ? f.replace('.webp', '-back.webp') : f);
};
const COLORS = LAYOUT.colors as Record<string, string>;
/** Faction colour (home planet): structures `grey`, markers/gaiaformers `gray` (HANDOFF.md «هنر»). */
const colorOf = (v: GaiaView, seat: number) => COLORS[CONTENT.factions[v.pl[seat]?.faction ?? '']?.home ?? ''] ?? 'grey';
const markerOf = (v: GaiaView, seat: number) => colorOf(v, seat).replace('grey', 'gray');
/** `--own` for the viewer's stroke layer. */
const ownVar = (v: GaiaView, me: number | null) => (me !== null && v.pl[me]?.faction ? { '--own': OWN[colorOf(v, me)] } as CSSProperties : undefined);
const OWN: Record<string, string> = { red: '#F0624F', blue: '#5AA9F0', orange: '#F59A3C', yellow: '#F5D04A', brown: '#C98B55', grey: '#B8C2CC', white: '#FFFFFF' };
const STRUCT: Record<Building, string> = { mine: 'MI', ts: 'TS', lab: 'RL', pi: 'PI', ac1: 'AC', ac2: 'AC', gf: 'GF', station: 'station' };
const structArt = (b: Building, color: string) => (b === 'gf' ? art(`art/tokens-markers/player-token-${color.replace('grey', 'gray')}.webp`)
  : b === 'station' ? art(IDS.pieces.spaceStation) : art(`art/structures/${STRUCT[b]}-${color}.webp`));
const RES_ICON: Record<string, string> = Object.fromEntries(['c', 'o', 'k', 'q', 'pw'].map((k) => [k, art((IDS.resources as Record<string, string>)[k]!)]));

/** Absolutely placed piece: centre at (x, y) source pixels of a W×H board, width in % of the board width. */
const at = (x: number, y: number, W: number, H: number, wPct: number, rotate?: number): CSSProperties => ({
  left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${wPct}%`, ...(rotate ? { transform: `translate(-50%, -50%) rotate(${rotate}deg)` } : {})
});

// ---------------- language (game layer only, HANDOFF.md «زبان») ----------------

type Lang = 'fa' | 'en';
const UI = {
  yourTurn: ['نوبت شماست', 'Your turn'], pickAction: ['یک کنش انتخاب کنید، یا اقدام ویژه را روی صفحه بزنید.', 'Choose an action, or tap a special action on a board.'],
  turnOf: ['نوبت', 'Turn:'], mine: ['ساخت معدن', 'Build mine'], upgrade: ['ارتقای سازه', 'Upgrade'], research: ['پژوهش', 'Research'],
  gaiaform: ['پروژهٔ گایا', 'Gaia project'], federation: ['تشکیل فدراسیون', 'Federation'], pass: ['پاس', 'Pass'],
  free: ['تبدیل رایگان (تا «تأیید» موقت است)', 'Free actions (pending until Confirm)'], burn: ['سوزاندن قدرت II→III', 'Burn power II→III'],
  hint: ['اقدام‌های بنفش، سبز و نارنجی روی خود صفحه‌ها هستند: صفحهٔ پژوهش، بوستر و صفحهٔ جناح.', 'Purple, green and orange actions sit on the boards: research board, booster and faction board.'],
  confirm: ['تأیید', 'Confirm'], back: ['برگرد', 'Undo'], cancel: ['لغو کنش', 'Cancel'], actions: ['کنش‌ها', 'Actions'], close: ['بستن', 'Close'],
  pickHex: ['خانهٔ مقصد را روی نقشه انتخاب کنید.', 'Pick a hex on the map.'], pickTrack: ['مسیر پژوهش را انتخاب کنید.', 'Pick a research track.'],
  pickBooster: ['بوستر دور بعد را انتخاب کنید.', 'Pick a booster for the next round.'], pickFed: ['یکی از فدراسیون‌های پیشنهادی را انتخاب کنید.', 'Pick a suggested federation.'],
  pickTo: ['ارتقا به:', 'Upgrade to:'], ready: ['همهٔ مرحله‌ها پر است. «تأیید» نوبت را ثبت می‌کند.', 'All steps done. Confirm ends your turn.'],
  sending: ['در حال ثبت…', 'Sending…'], auto: ['شارژ خودکار', 'Auto-charge'], map: ['نقشه', 'Map'], tracks: ['پژوهش', 'Research'],
  scoring: ['امتیاز', 'Scoring'], mine2: ['صفحهٔ من', 'My board'], round: ['دور', 'Round'], of6: ['از ۶', 'of 6'],
  boostersNote: ['هنگام پاس، بوستر خود را برمی‌گردانید و یکی از بوسترهای آزاد را برمی‌دارید.', 'When you pass, return your booster and take a free one.'],
  owned: ['فناوری / فدراسیون / اقدام استفاده‌شده', 'Tech / federations / used actions'], you: ['شما', 'you'],
  pickFaction: ['یک جناح انتخاب کنید', 'Choose a faction'], place: ['سازهٔ شروع را روی سیارهٔ خانگی بگذارید.', 'Place a starting structure on your home planet.'],
  boosterPhase: ['یک بوستر دور انتخاب کنید.', 'Choose a round booster.'], decide: ['تصمیم با شماست', 'Your decision'], spectating: ['تماشا', 'Watching']
} as const satisfies Record<string, readonly [string, string]>;
type UiKey = keyof typeof UI;

// ---------------- labels ----------------

const gainFa = (g: Gain) => Object.entries(g).filter(([, v]) => v).map(([k, v]) => `${fa(v as number)} ${RES_FA[k as keyof Gain]}`).join('، ') || '—';
const techFa = (id: string) => tf(CONTENT.techs[id]?.labelFa ?? id);
const boosterFa = (id: string) => tf(CONTENT.boosters[id]?.labelFa ?? id);
const fedFa = (id: string) => tf(CONTENT.feds[id]?.labelFa ?? id);
const factionFa = (id: string) => (getTermsLang() === 'fa-bg' ? CONTENT.factions[id]?.nameEn : CONTENT.factions[id]?.nameFa) ?? id;
const CONV_FA: Record<string, string> = Object.fromEntries([...BASE_CONVERSIONS, ...Object.values(CONTENT.factions).flatMap((f) => f.effects?.conversions ?? [])]
  .map((c) => [c.id, c.labelFa]));
const CHOICE_FA = tfp({
  accept: 'پذیرفتن', decline: 'رد کردن', 'token-first': 'اول ژتون، بعد شارژ', 'charge-first': 'اول شارژ، بعد ژتون',
  yes: 'بله', no: 'نه', done: 'تمام', q: '۱ QIC', k: '۱ دانش', o: '۱ سنگ معدن', c: '۱ اعتبار'
});
/** Engine error codes → short reason under a disabled button (COMPONENTS.md 8.7). */
const REASON_FA = tfp({
  NOT_ENOUGH_RESOURCES: 'منابع کافی ندارید', NO_PIECES: 'سازهٔ آزاد ندارید', ILLEGAL_PLACEMENT: 'خانهٔ مجازی در برد شما نیست',
  CELL_OCCUPIED: 'خانه پر است', GAIA_NOT_READY: 'گایاساز آزاد ندارید', RESEARCH_BLOCKED: 'هیچ مسیری جا ندارد', FEDERATION_INVALID: 'فدراسیون ممکنی ندارید',
  TOKEN_UNAVAILABLE: 'توکن فدراسیون نمانده', ACTION_TAKEN: 'این دور گرفته شده', ILLEGAL_CHOICE: 'ممکن نیست', WRONG_PHASE: 'الان ممکن نیست', NOT_YOUR_TURN: 'نوبت شما نیست'
});
const REASON_ORDER = ['NOT_ENOUGH_RESOURCES', 'NO_PIECES', 'GAIA_NOT_READY', 'RESEARCH_BLOCKED', 'TOKEN_UNAVAILABLE', 'FEDERATION_INVALID', 'CELL_OCCUPIED', 'ILLEGAL_PLACEMENT', 'ACTION_TAKEN', 'ILLEGAL_CHOICE', 'WRONG_PHASE'];

function specialFa(key: string): string {
  if (key === 'ac2') return tf('اقدام آکادمی QIC');
  const [kind, id] = key.split(':') as [string, string];
  if (kind === 'faction') return `${factionFa(id)}: ${tf(CONTENT.factions[id]?.effects?.action?.labelFa ?? key)}`;
  if (kind === 'booster') return `${tx(terms.booster)}: ${tf(CONTENT.boosters[id]?.effects?.action?.labelFa ?? key)}`;
  if (kind === 'tech') return `${tf('فناوری')}: ${tf(CONTENT.techs[id]?.effects.action?.labelFa ?? key)}`;
  return key;
}

function decisionTitle(view: GaiaView, who: (s: number) => string): string {
  const d = view.decision!;
  switch (d.kind) {
    case 'leech': return `${who(d.from)} ${tf('کنار')} ${who(d.seat)} ${tf(`ساخت: ${fa(d.amount)} قدرت شارژ؟ هزینه یک امتیاز کمتر از قدرت شارژشده`)}`;
    case 'tech': return `${who(d.seat)}: ${tf('یک کاشی فناوری انتخاب کنید')}`;
    case 'cover': return `${who(d.seat)}: ${tf('یک کاشی فناوری استاندارد را زیر')} ${techFa(d.adv)} ${tf('بپوشانید')}`;
    case 'research': return `${who(d.seat)}: ${tf('یک گام پژوهش رایگان')}`;
    case 'lostPlanet': return `${who(d.seat)}: ${tx(terms.lostPlanet)} ${tf('را روی یک خانهٔ خالی در دسترس بگذارید')}`;
    case 'income': return `${who(d.seat)}: ${tf('درآمد دور')} ${fa(view.round)}: ${fa(d.pw)} ${RES_FA.pw} و ${fa(d.t)} ${RES_FA.t}. کدام اول؟`;
    case 'custom': return `${who(d.seat)}: ${tf(d.labelFa)}`;
  }
}
/** Federation problems (core fedCheck codes) as one Persian sentence (Gaia-Prompts 3). */
const FED_FA: Record<string, (v: number, need: number) => string> = {
  FED_EMPTY: () => 'سازه‌ها و خانه‌های ماهواره را روی نقشه بزنید.',
  FED_BAD_HEX: () => 'ماهواره فقط روی فضای خالی می‌رود.',
  FED_IN_FED: () => 'یکی از خانه‌ها در فدراسیون دیگر شما یا کنار آن است.',
  FED_NO_STRUCTURE: () => 'دست‌کم یک سازهٔ بیرون از فدراسیون لازم است.',
  FED_NOT_CONNECTED: () => 'سازه‌ها به هم وصل نیستند: خانهٔ ماهواره کم است.',
  FED_LOW_VALUE: (v, need) => `ارزش قدرت ${fa(v)} است و دست‌کم ${fa(need)} لازم است.`,
  FED_EXTRA_SAT: () => 'یک ماهواره اضافه است: بدون آن هم سازه‌ها وصل‌اند.',
  FED_REDUNDANT: () => 'بدون یک سازه و یک ماهواره هم معتبر است؛ کوچک‌ترش کنید.',
  NOT_ENOUGH_RESOURCES: () => 'برای ماهواره‌ها ژتون قدرت (آیویت‌ها: QIC) کافی ندارید.'
};
/** Bowls I / II / III as a short line: «کاسهٔ I: ۱، II: ۰، III: ۶». */
const bowlsFa = (p: { b1: number; b2: number; b3: number }) => `${tf('کاسهٔ')} I: ${fa(p.b1)}، II: ${fa(p.b2)}، III: ${fa(p.b3)}`;

function choiceFa(view: GaiaView, choice: string): string {
  const d = view.decision;
  if (!d) return choice;
  if (d.kind === 'tech' || d.kind === 'cover') return techFa(choice);
  if (d.kind === 'research') return TRACK_FA[choice as Track] ?? choice;
  if (d.kind === 'lostPlanet') return 'اینجا';
  return CHOICE_FA[choice] ?? choice;
}

/** One step of the draft, as the flow line shows it. */
function stepFa(view: GaiaView, a: GameAction): string {
  switch (a.type) {
    case 'faction': return `${tf('جناح')} ${factionFa(a.faction as string)}`;
    case 'place': return tf('سازهٔ شروع');
    case 'booster': return `${tx(terms.booster)}: ${boosterFa(a.booster as string)}`;
    case 'mine': return tx(terms.buildMine);
    case 'upgrade': return `${tf('ارتقا')} به ${BUILDING_FA[a.to as Building]}`;
    case 'gaiaform': return tx(terms.gaiaProject);
    case 'federation': return `${tx(terms.federation)}: ${fedFa(a.token as string)}`;
    case 'research': return `${tx(terms.research)}: ${TRACK_FA[a.track as Track]}`;
    case 'power': { const pa = POWER_ACTIONS.find((x) => x.id === a.id); return pa ? `${gainFa(pa.cost)}: ${tf(pa.labelFa)}` : String(a.id); }
    case 'special': return specialFa(a.id as string);
    case 'pass': return a.booster ? `${tx(terms.pass)}، ${boosterFa(a.booster as string)}` : tx(terms.pass);
    case 'convert': return tf(CONV_FA[a.id as string] ?? convFa(a.id as string));
    case 'burn': return tf('سوزاندن قدرت');
    case 'decide': return choiceFa(view, a.choice as string);
    case 'end': return 'پایان نوبت';
    default: return a.type;
  }
}
const convFa = (id: string) => ({ 'pw-q': '۴ قدرت → QIC', 'pw-o': '۳ قدرت → سنگ', 'pw-k': '۴ قدرت → دانش', 'pw-c': '۱ قدرت → اعتبار', 'q-o': 'QIC → سنگ', 'o-t': 'سنگ → ژتون قدرت', 'k-c': 'دانش → اعتبار', 'o-c': 'سنگ → اعتبار' } as Record<string, string>)[id] ?? id;

const sortKeys = (v: unknown): unknown => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v);
const same = (a: GameAction | null | undefined, b: GameAction) => !!a && JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

/** Cost as icons: «۲ [اعتبار] ۱ [سنگ]». */
function CostPill({ g, plus }: { g: Gain; plus?: boolean }) {
  const parts = Object.entries(g).filter(([k, v]) => v && RES_ICON[k === 't' ? 'pw' : k]);
  if (!parts.length) return null;
  return <span className="gp-costpill">{parts.map(([k, v]) => <span key={k}>{fa(v as number)}<img className="gp-ic" src={RES_ICON[k === 't' ? 'pw' : k]} alt={RES_FA[k as keyof Gain]} /></span>)}{plus && ' +'}</span>;
}

// ---------------- local engine (draft) ----------------

const FREE = new Set(['convert', 'burn']);
const toState = (v: GaiaView): GaiaState => {
  const { decision, income, held, ...rest } = structuredClone(v);
  void decision; void income;
  return { ...rest, ins: 0, turnDone: !!held } as GaiaState;
};
const NO_RNG = { rng: null as never, logicalTime: 0 };
/** Apply the steps that the rules accept, in order; stops at the first one they reject. */
function simulate(v: GaiaView, seat: number | null, steps: GameAction[]): { s: GaiaState; n: number } {
  let s = toState(v);
  if (seat === null) return { s, n: 0 };
  const actor = { kind: 'player' as const, seat };
  let n = 0;
  for (const a of steps) {
    if (!gaiaProjectModule.validate(s, actor, a as GaiaAction).ok) break;
    s = gaiaProjectModule.apply(s, actor, a as GaiaAction, NO_RNG).nextState;
    n++;
  }
  return { s, n };
}

// ---------------- player panel in the shell rail (COMPONENTS.md §2) ----------------

/** Public HUD data of one seat (contracts PublicSummaryView seat), as far as the Gaia panel reads it. */
interface SummarySeat {
  primary?: { value: number };
  stats?: Array<{ key: string; value: number | string }>;
  badges?: Array<{ key: string; label: string }>;
  turnOrder?: number;
  income?: Record<string, number>;
  power?: Record<string, number>;
  status?: string;
}
const PANEL_RES = [['c', 'اعتبار'], ['o', 'سنگ معدن'], ['k', 'دانش'], ['q', 'QIC']] as const;
const PANEL_BOWLS = [['gaia', 'G'], ['b1', 'I'], ['b2', 'II'], ['b3', 'III']] as const;
const POWER_READY = Math.min(...POWER_ACTIONS.map((x) => x.cost.pw ?? Infinity));
const plus = (n: number | undefined) => `+${fa(n ?? 0)}`;

/**
 * Gaia player panel in the table rail: faction + home planet, VP badge, turn order, the four resources with income,
 * the power bowls and power income. Returned as PlayerCard props; the shell keeps the DS head (avatar, name, league,
 * clock, strikes).
 */
export function gaiaSeatCard(seat: SummarySeat, turn: boolean) {
  const fid = seat.badges?.find((b) => b.key.startsWith('faction:'))?.key.slice(8);
  const faction = fid ? CONTENT.factions[fid] : undefined;
  const stat = (k: string) => seat.stats?.find((x) => x.key === k)?.value ?? 0;
  const inc = seat.income;
  const pow = seat.power;
  return {
    stats: undefined,
    badge: undefined,
    done: undefined,
    // VP plaque + turn-order circle in the head (no unit label under them).
    scoreLabel: undefined,
    // Head end (reference gp-panel__head): VP plaque, then the neutral turn-order circle at the outer edge.
    score: <span className="gp-side">
      <span className="gp-vp" title={tx(terms.vp)} aria-label={`${fa(seat.primary?.value ?? 0)} ${tx(terms.vp)}`} data-vp={seat.primary?.value ?? 0}><b>{fa(seat.primary?.value ?? 0)}</b></span>
      {seat.turnOrder !== undefined && <span className="gp-order" data-turn={turn || undefined} title={`ترتیب نوبت در این ${tx(terms.round)}`} aria-label={`نوبت ${fa(seat.turnOrder)} در این ${tx(terms.round)}`}>{fa(seat.turnOrder)}</span>}
    </span>,
    ...(seat.status === 'passed' ? { foot: <span className="gp-panel__foot">{tf('پاس داده')}{seat.badges?.some((b) => b.key === 'firstNext') ? `؛ نفر اول ${tx(terms.round)} بعد` : ''}</span> } : {}),
    ...(faction ? { sub: <span className="gp-panel__faction" data-faction={fid}><img className="gp-planet" src={art(`art/planet-art/planet-${COLORS[faction.home]}.webp`)} alt="" />{factionFa(fid!)}</span> } : {}),
    detail: <div className="gp-panel">
      <div className="gp-panel__res">
        {PANEL_RES.map(([k, l0]) => <span key={k} className="gp-r" title={tf(l0)} data-res={k}>
          <span><img className="gp-ic" src={RES_ICON[k]} alt={tf(l0)} />{fa(stat(k))}</span>
          <small>{plus(inc?.[k])}</small>
        </span>)}
      </div>
      {pow && <div className="gp-panel__pow" title={tf('چرخهٔ قدرت: ناحیهٔ گایا و کاسه‌های I، II، III')}>
        {PANEL_BOWLS.map(([k, label]) => <span key={k} data-bowl={k} className={`gp-bowl${k === 'gaia' ? ' gp-bowl--g' : ''}${k === 'b3' && (pow[k] ?? 0) >= POWER_READY ? ' is-ready' : ''}`}><i>{label}</i><b>{fa(pow[k] ?? 0)}</b></span>)}
      </div>}
      <div className="gp-panel__inc"><img className="gp-ic" src={RES_ICON.pw} alt="" /><span>{RES_FA.pw} <b>{plus(inc?.pwCharge)}</b>، {RES_FA.t} <b>{plus(inc?.pwTokens)}</b></span></div>
    </div>
  };
}

// ---------------- boards ----------------

interface Ctx {
  view: GaiaView;
  state: GaiaState;
  me: number | null;
  who: (s: number) => string;
  legal: GameAction[];
  /** Hex / tile / booster choices of the step being picked, and what each one does. */
  pickHex: Map<number, GameAction[]>;
  pickedHex: number | null;
  onHex: (i: number) => void;
  tryAct: (a: GameAction) => void;
  hint: (a: GameAction) => boolean;
  expectedHex: number | null;
  costOf: (hex: number) => Gain | null;
  /** ' gp-new' for a piece that appeared with this state (fade in once), '' otherwise. */
  fresh: (key: string) => string;
  /** Engine error code for an action the viewer cannot take now ('' when it is legal). */
  reasonOf: (a: GameAction) => string;
  /** Hexes of the federation being picked (starts as the engine's suggestion), or null. */
  proposal: number[] | null;
  /** Federation token → action, when the picked federation is valid. */
  fedActs: Map<string, GameAction>;
}

const M = LAYOUT.map;
const HX = M.sector.hex.colPitch, HY = M.sector.hex.h, HW = M.sector.hex.w;
const [SCX, SCY] = M.hexCentresInSector[9] as [number, number];
const CORNERS = [[HW / 2, 0], [HW / 4, HY / 2], [-HW / 4, HY / 2], [-HW / 2, 0], [-HW / 4, -HY / 2], [HW / 4, -HY / 2]] as const;
const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;

/** Space map (COMPONENTS.md §3): sector art on the hex grid, outer sector strokes, pieces, selectable hexes. */
const SpaceMap = memo(function SpaceMap({ c }: { c: Ctx }) {
  useTermsLang();
  const { view } = c;
  const phoneMap = useMedia('(max-width: 760px)');
  // Phone: open zoomed (hex ≥44px at 360–390 wide, COMPONENTS 9.9); pan by scrolling. Desktop: fit.
  const [zoom, setZoom] = useState(() => (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches ? 2 : 1));
  const scroller = useRef<HTMLDivElement>(null);
  const pickKey = [...c.pickHex.keys()].join(',');
  useEffect(() => { // phone: bring the first pickable hex into the middle of the map view
    const box = scroller.current;
    const el = phoneMap && pickKey ? box?.querySelector<HTMLElement>('.gp-hex[data-pick]') : null;
    if (box && el) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2, top: el.offsetTop - box.clientHeight / 2 });
  }, [phoneMap, pickKey]);
  const xy = (h: { q: number; r: number }) => ({ x: HX * h.q, y: HY * (h.r + h.q / 2) });
  const cs = view.hexes.map(xy);
  const minX = Math.min(...cs.map((p) => p.x)) - HW / 2, maxX = Math.max(...cs.map((p) => p.x)) + HW / 2;
  const minY = Math.min(...cs.map((p) => p.y)) - HY / 2, maxY = Math.max(...cs.map((p) => p.y)) + HY / 2;
  const W = maxX - minX, H = maxY - minY;
  const P = (p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY });
  const scale = (pct: number) => (pct * M.frame.w) / W; // layout widths are % of the 4-player frame
  const original = useMemo(() => buildMap(view.placements), [view.placements]);
  const idx = new Map(view.hexes.map((h, i) => [`${h.q},${h.r}`, i]));
  const outline = view.hexes.flatMap((h, i) => NB.flatMap(([dq, dr], k) => {
    const j = idx.get(`${h.q + dq},${h.r + dr}`);
    if (j !== undefined && view.hexes[j]!.sector === h.sector) return [];
    const p = P(cs[i]!), a = CORNERS[k]!, b = CORNERS[(k + 1) % 6]!;
    return [`M${p.x + a[0]},${p.y + a[1]}L${p.x + b[0]},${p.y + b[1]}`];
  })).join('');
  const sw = (b: Building) => scale(b === 'station' ? M.pieceWidthPct.GF * 0.8 : (M.pieceWidthPct as Record<string, number>)[STRUCT[b]] ?? 6);
  // Pieces go into two stroke layers (one CSS filter per layer, not per piece): everyone's, and the viewer's own
  // with the second faction-colour stroke. Keys start with the hex so a new piece never remounts its neighbours.
  const pieces: ReactNode[] = [], ownPieces: ReactNode[] = [];
  view.hexes.forEach((h, i) => {
    const p = P(cs[i]!);
    const put = (own: boolean, key: string, el: (k: string, cls: string) => ReactNode) => (own ? ownPieces : pieces).push(el(key, c.fresh(key)));
    if (h.planet === 'g' && original[i]?.planet === 'm') put(false, `${i}gt`, (k, f) => <img key={k} className={`gp-at${f}`} data-gp-piece="token" data-hex={i} src={art(IDS.pieces.gaiaPlanetToken)} alt="" loading="lazy" decoding="async" style={at(p.x, p.y, W, H, scale(4.6))} />);
    if (h.planet === 'l') put(false, `${i}lost`, (k, f) => <img key={k} className={`gp-at${f}`} data-gp-piece="lost" data-hex={i} src={art(IDS.pieces.lostPlanet)} alt={tx(terms.lostPlanet)} decoding="async" style={at(p.x, p.y, W, H, scale(4.6))} />);
    if (h.building && h.owner !== null) {
      const b = h.building, o = h.owner;
      put(o === c.me && b !== 'gf', `${i}b`, (k, f) => <img key={k} className={`gp-at${f}`} data-gp-piece={b === 'gf' ? 'GF' : STRUCT[b]} data-hex={i} data-seat={o}
        src={structArt(b, colorOf(view, o))} alt={`${BUILDING_FA[b]} ${c.who(o)}`} title={`${c.who(o)}: ${BUILDING_FA[b]}`} decoding="async" style={at(p.x, p.y, W, H, sw(b))} />);
    }
    if (h.extra !== null) {
      const o = h.extra;
      put(o === c.me, `${i}x`, (k, f) => <img key={k} className={`gp-at${f}`} data-gp-piece="MI" data-hex={i} data-seat={o} src={structArt('mine', colorOf(view, o))} alt={`${tx(terms.mine)} ${c.who(o)}`}
        title={`${c.who(o)}: ${tx(terms.mine)}`} decoding="async" style={at(p.x + 42, p.y - 34, W, H, sw('mine') * 0.7)} />);
    }
    h.sats.forEach((s, n) => put(false, `${i}s${s}`, (k, f) => <img key={k} className={`gp-at${f}`} data-gp-piece="sat" data-hex={i} data-seat={s}
      src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt={`${tf('ماهوارهٔ')} ${c.who(s)}`} title={`${tf('ماهوارهٔ')} ${c.who(s)}`} decoding="async" style={at(p.x - 30 + n * 30, p.y + (n % 2) * 20, W, H, scale(3.2))} />));
  });

  return (
    <div className="gp-mapbox" data-gp-board="map">
      <div className="gp-zoom" role="group" aria-label={tf('بزرگ‌نمایی نقشه')}>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="بزرگ‌تر" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>+</button>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="کوچک‌تر" onClick={() => setZoom((z) => Math.max(1, z - 0.25))}>−</button>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="جا شدن" onClick={() => setZoom(1)}>⤢</button>
      </div>
      <div className="gp-mapscroll" dir="ltr" ref={scroller}>
        <div className="gp-map" role="group" aria-label={tf('نقشهٔ فضا')} style={{ aspectRatio: `${W} / ${H}`, width: `${zoom * 100}%` }}>
          {view.placements.map((p) => {
            const n = p.sector.replace(/[AB]/, '');
            const back = p.sector.endsWith('B');
            const o = P(xy({ q: p.center[0], r: p.center[1] }));
            const file = `art/space-sectors/sector-${n}${back ? 'outlined' : ''}.webp`;
            return <img key={p.sector} className="gp-sector" src={art(file)} srcSet={srcSet(file, M.sector.w)} sizes="(max-width: 760px) 50vw, 25vw" width={M.sector.w} height={M.sector.h} decoding="async" alt="" draggable={false}
              style={{ left: `${((o.x - SCX) / W) * 100}%`, top: `${((o.y - SCY) / H) * 100}%`, width: `${(M.sector.w / W) * 100}%`,
                transformOrigin: `${(SCX / M.sector.w) * 100}% ${(SCY / M.sector.h) * 100}%`, transform: `rotate(${60 * p.rotation}deg)` }} />;
          })}
          <svg className="gp-outline" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={outline} /></svg>
          <div className="gp-layer">{pieces}</div>
          <div className="gp-layer gp-layer--own" style={ownVar(view, c.me)}>{ownPieces}</div>
          {view.hexes.map((h, i) => {
            const p = P(cs[i]!);
            const acts = c.pickHex.get(i);
            const prop = !!c.proposal?.includes(i);
            const picked = c.pickedHex === i || (!!acts && prop);
            const hinted = c.expectedHex === i;
            if (!acts && !picked && !hinted && !prop) return null;
            const label = `${h.planet === 'e' ? tf('فضای خالی') : h.planet}، ${tf('بخش')} ${fa(h.sector)}${h.building && h.owner !== null ? `، ${BUILDING_FA[h.building]} ${c.who(h.owner)}` : ''}`;
            const cost = acts && !picked ? c.costOf(i) : null;
            const box = { ...at(p.x, p.y, W, H, (HW / W) * 100), height: `${(HY / H) * 100}%` };
            return [
              acts || picked ? <button key={`h${i}`} type="button" className={`gp-hex${hinted ? ' gp-hex--hint' : ''}`} data-pick={picked ? 'picked' : 'selectable'} aria-pressed={picked} data-hex={i}
                aria-label={label} style={box} onClick={() => c.onHex(i)}>{picked && <span className="gp-check" aria-hidden="true">✓</span>}</button>
                : <span key={`h${i}`} className={prop ? 'gp-hex' : 'gp-hex gp-hex--hint'} data-pick={prop ? 'picked' : undefined} data-hex={i} aria-hidden="true" style={box} />,
              cost ? <span key={`t${i}`} className="gp-at gp-tag" style={at(p.x, p.y + HY * 0.42, W, H, scale(6))}><CostPill g={cost} /></span> : null
            ];
          })}
        </div>
      </div>
    </div>
  );
});

const RB = LAYOUT.researchBoard;
const SB = LAYOUT.scoringBoard;
const FB = LAYOUT.factionBoard;
const CLUSTER = RB.playerMarker.cluster.offsets as Record<string, number[][]>;
/** Bescods: the printed board swaps the PI and academy spaces (rulebook p. 21, RULES E9); centres measured on
 *  art/boards/faction-Bescods.webp (1753×999), widths as the shared template. */
const BESCODS_SLOTS = { PI: { centres: [[895, 487]], widthPct: FB.slots.PI.widthPct }, AC: { centres: [[250, 483], [440, 483]], widthPct: FB.slots.AC.widthPct } };

/** Research board (§4) with the federation supply under it. */
const ResearchBoard = memo(function ResearchBoard({ c }: { c: Ctx }) {
  useTermsLang();
  const { view } = c;
  const W = RB.w, H = RB.h;
  const tile = (id: string | null, x: number, y: number, w: number, kind: 'adv' | 'std', slot: number) => {
    if (!id) return null;
    const a = c.legal.find((x) => x.type === 'decide' && x.choice === id);
    const style = at(x, y, W, H, w);
    const img = <img src={techArt(id)} alt={techFa(id)} draggable={false} />;
    const tip = <Tip img={techArt(id)} title={kind === 'adv' ? tx(terms.techAdv) : tx(terms.techStd)} text={techFa(id)} />;
    return a ? <button key={id} type="button" className={`gp-at gp-tile${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-gp-piece={kind} data-id={id} data-slot={slot} aria-label={techFa(id)} style={style} onClick={() => c.tryAct(a)}>{img}{tip}</button>
      : <span key={id} className="gp-at gp-tile" tabIndex={0} data-gp-piece={kind} data-id={id} data-slot={slot} aria-label={techFa(id)} style={style}>{img}{tip}</span>;
  };
  const markers = TRACKS.flatMap((t, ti) => [0, 1, 2, 3, 4, 5].flatMap((lvl) => {
    const seats = view.pl.flatMap((p, s) => (p.faction && p.research[t] === lvl ? [s] : []));
    const off = CLUSTER[String(Math.min(4, seats.length))] ?? [[0, 0]];
    return seats.map((s, k) => {
      const [ox, oy] = off[k % off.length] as [number, number];
      const x = 15 + 298 * ti + 80 + ox * RB.playerMarker.cluster.pitchX, y = (RB.playerMarker.levelMidY as Record<string, number>)[String(lvl)]! + oy * RB.playerMarker.cluster.pitchY;
      return <img key={`${t}-${s}`} className="gp-at" data-gp-piece="sat" data-track={ti} data-level={lvl} data-seat={s} title={`${c.who(s)}: ${TRACK_FA[t]} ${fa(lvl)}`}
        src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" decoding="async" style={at(x, y, W, H, RB.playerMarker.widthPct)} />;
    });
  }));
  // Research step targets: the next level cell of each track (main action or free research decision).
  const steps = TRACKS.map((t, ti) => {
    const a = c.legal.find((x) => (x.type === 'research' && x.track === t) || (x.type === 'decide' && view.decision?.kind === 'research' && x.choice === t));
    if (!a || c.me === null) return null;
    const lvl = Math.min(5, (view.pl[c.me]?.research[t] ?? 0) + 1);
    return <button key={t} type="button" className={`gp-at gp-step-target${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-move="research" data-track={ti} aria-label={`${TRACK_FA[t]} ${tx(terms.level)} ${fa(lvl)}`}
      style={{ ...at(15 + 298 * ti + 149, (RB.playerMarker.levelMidY as Record<string, number>)[String(lvl)]!, W, H, 14), height: '6%' }} onClick={() => c.tryAct(a)} />;
  });
  const action = (id: string, x: number, y: number, bw: number, bh: number, used: number) => {
    const list = c.legal.filter((a) => a.type === 'power' && a.id === id);
    const pa = POWER_ACTIONS.find((p) => p.id === id);
    const taken = view.powerUsed.includes(id);
    const hint = list.some(c.hint);
    return (
      <span key={id}>
        <button type="button" className={`gp-at gp-act${list.length ? ' is-avail' : ''}${hint ? ' gp-hint' : ''}`} data-gp-action={id} aria-disabled={!list.length}
          aria-label={pa ? `${gainFa(pa.cost)}: ${tf(pa.labelFa)}${taken ? ' (گرفته‌شده)' : ''}` : id} data-reason={list.length ? undefined : c.reasonOf({ type: 'power', id })}
          style={{ ...at(x, y, W, H, bw), height: `${bh}%` }} onClick={() => list.length && c.tryAct(list[0]!)}>
          {pa && <Tip title={`${tf(pa.cost.q ? 'اقدام QIC' : 'اقدام قدرت')}: ${tf(pa.labelFa)}`} text={<>{tf('هزینه')}: {gainFa(pa.cost)}، هر {tx(terms.round)} یک بار{taken ? `؛ این ${tx(terms.round)} گرفته شده` : ''}
            {c.me !== null && !pa.cost.q && <><br />{tf('قدرت فعلی کاسهٔ')} III: {fa(view.pl[c.me]?.power.b3 ?? 0)}</>}
            {!list.length && !taken && <><br />{REASON_FA[c.reasonOf({ type: 'power', id })] ?? ''}</>}</>} />}
        </button>
        {taken && <img className={`gp-at gp-token${c.fresh(`used-${id}`)}`} data-gp-piece="token" data-id={id} src={art(IDS.pieces.actionToken)} alt="" style={at(x, y, W, H, used)} />}
      </span>
    );
  };
  return (
    <div className="gp-col">
      <div className="gp-board" data-gp-board="research" style={{ aspectRatio: `${W} / ${H}` }}>
        <BoardImg path={IDS.boards.research} w={W} h={H} alt={tf('صفحهٔ پژوهش')} sizes="(max-width: 760px) 100vw, 40vw" lazy />
        {view.techBoard.adv.map((id, i) => { const [x, y] = RB.advancedTech.centres[i] as [number, number]; return tile(id, x, y, RB.advancedTech.widthPct, 'adv', i); })}
        {view.techBoard.std.map((id, i) => {
          const [x, y] = (i < 6 ? RB.standardTech.centres[i] : RB.standardTechBottom.centres[i - 6]) as [number, number];
          return tile(id, x, y, RB.standardTech.widthPct, 'std', i);
        })}
        {view.terraFed && <img className="gp-at" data-gp-piece="fed" data-id={view.terraFed} src={fedArt(view.terraFed)} alt={fedFa(view.terraFed)} title={fedFa(view.terraFed)} style={at(95, 75, W, H, 7)} />}
        <div className="gp-layer">{markers}</div>
        {steps}
        {RB.powerActions.ids.map((id, i) => { const [x, y] = RB.powerActions.centres[i] as [number, number]; return action(id, x, y, RB.powerActions.buttonPct.w, RB.powerActions.buttonPct.h, RB.powerActions.usedTokenWidthPct); })}
        {RB.qicActions.ids.map((id, i) => { const [x, y] = RB.qicActions.centres[i] as [number, number]; return action(id, x, y, RB.qicActions.buttonPct.w, RB.qicActions.buttonPct.h, RB.qicActions.usedTokenWidthPct); })}
      </div>
    </div>
  );
});

/** Federation token supply (§4.8): beside the scoring board and boosters (HANDOFF decision 11). */
const FedSupply = memo(function FedSupply({ c }: { c: Ctx }) {
  useTermsLang();
  const { view } = c;
  return (
    <div className="gp-fedbox">
    <h4 className="gp-fedbox__title">{tx(terms.fedTokens)}</h4>
    <ul className="gp-fedsupply" data-gp-board="fedsupply" aria-label={tf('ذخیرهٔ توکن‌های فدراسیون')}>
        {Object.entries(view.fedSupply).map(([id, n]) => {
          const a = c.fedActs.get(id);
          const img = <img src={fedArt(id)} alt={fedFa(id)} draggable={false} />;
          return (
            <li key={id} className={n ? undefined : 'is-empty'} data-gp-piece="fed" data-id={id}>
              {a ? <button type="button" className={`gp-fedbtn${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" aria-label={fedFa(id)} onClick={() => c.tryAct(a)}>{img}</button>
                : <span className="gp-fedbtn" tabIndex={0} aria-label={fedFa(id)}>{img}<Tip img={fedArt(id)} title={tx(terms.fedToken)} text={fedFa(id)} /></span>}
              <small>×{fa(n)}</small>
            </li>
          );
        })}
    </ul>
    </div>
  );
});

/** Scoring board (§5) and the booster row (§6). */
const ScoringBoard = memo(function ScoringBoard({ c }: { c: Ctx }) {
  useTermsLang();
  const { view, state } = c;
  const W = SB.w, H = SB.h;
  const seats = view.pl.flatMap((p, s) => (p.faction ? [s] : []));
  const counters = Object.entries(SB.planetCounters.centres).flatMap(([color, [x, y]]) => {
    const code = color === 'gaia' ? 'g' : Object.keys(COLORS).find((k) => COLORS[k] === color);
    const list = seats.map((s) => ({ s, n: view.hexes.filter((h) => h.planet === code && (h.owner === s || h.extra === s) && h.building !== 'gf' && h.building !== 'station').length })).filter((e) => e.n > 0);
    return list.map(({ s, n }, k) => (
      <span key={`${color}-${s}`} className="gp-at gp-cnt" data-gp-piece="cnt" data-seat={s} data-id={color} title={`${c.who(s)}: ${fa(n)}`} style={at(x! + (k - (list.length - 1) / 2) * 70, y!, W, H, SB.planetCounters.widthPct)}>
        <img src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" decoding="async" /><b>{fa(n)}</b>
      </span>
    ));
  });
  const finals = useMemo(() => view.finalTiles.flatMap((id, row) => seats.map((s, k) => {
    const v = Math.max(0, Math.min(10, CONTENT.finals[id]?.value(state, s) ?? 0));
    return <img key={`${id}-${s}`} className="gp-at" data-gp-piece="sat" data-seat={s} data-level={v} title={`${c.who(s)}: ${fa(v)}`} decoding="async"
      src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" style={at(342 + 61.6 * v, (row ? 1190 : 878) + 52 * k, W, H, SB.finalTrackMarkers.widthPct)} />;
  })), [state]); // eslint-disable-line react-hooks/exhaustive-deps -- everything here derives from state
  const all = [...new Set([...view.boosters, ...view.pl.flatMap((p) => (p.booster ? [p.booster] : []))])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return (
    <div className="gp-col">
      <div className="gp-board" data-gp-board="scoring" style={{ aspectRatio: `${W} / ${H}` }}>
        <BoardImg path={IDS.boards.scoring} w={W} h={H} alt={tf('صفحهٔ امتیاز')} sizes="(max-width: 760px) 100vw, 40vw" lazy />
        {view.roundTiles.map((id, i) => {
          const [x, y, rot] = SB.roundTiles.centres[i] as [number, number, number];
          const played = i + 1 < view.round && view.phase !== 'faction' && view.phase !== 'setup' && view.phase !== 'booster';
          const face = art((IDS.roundScoring as Record<string, string>)[id] ?? '');
          return <span key={id + i} className="gp-at" tabIndex={0} data-gp-piece="rnd" data-id={id} data-slot={i} data-rot={rot} aria-label={`${tx(terms.round)} ${fa(i + 1)}: ${tf(CONTENT.rounds[id]?.labelFa ?? id)}`} style={at(x, y, W, H, SB.roundTiles.widthPct)}>
            <img src={played ? art(IDS.roundScoring.back) : face} alt="" style={{ transform: `rotate(${rot}deg)` }} />
            <Tip img={face} title={`${tf('کاشی امتیاز دور')} ${fa(i + 1)}${played ? ' (تمام‌شده)' : ''}`} text={tf(CONTENT.rounds[id]?.labelFa ?? id)} />
          </span>;
        })}
        {view.finalTiles.map((id, i) => {
          const [x, y] = SB.finalTiles.centres[i] as [number, number];
          return <span key={id} className="gp-at" tabIndex={0} data-gp-piece="fin" data-id={id} data-slot={i} aria-label={CONTENT.finals[id]?.labelFa ?? id} style={at(x, y, W, H, SB.finalTiles.widthPct)}>
            <img src={pick(IDS.finalScoring, id)} alt="" /><Tip img={pick(IDS.finalScoring, id)} title={tf('امتیاز پایانی')} text={`${tf(CONTENT.finals[id]?.labelFa ?? id)}: ۱۸ / ۱۲ / ۶ ${tx(terms.vp)}`} />
          </span>;
        })}
        <div className="gp-layer">{finals}</div>
        {counters}
      </div>
      <div className="gp-boosters" data-gp-board="boosters">
        {all.map((b) => {
          const owner = view.pl.findIndex((p) => p.booster === b);
          const a = c.legal.find((x) => (x.type === 'booster' || x.type === 'pass') && x.booster === b);
          const img = <><img src={boosterArt(b)} alt={boosterFa(b)} draggable={false} /><Tip img={boosterArt(b)} title={owner >= 0 ? `${tx(terms.booster)} ${c.who(owner)}` : `${tx(terms.booster)} آزاد`} text={boosterFa(b)} /></>;
          return a
            ? <button key={b} type="button" className={`gp-boost ${a.type === 'pass' ? 'gp-pass-pick' : 'gp-booster-pick'}${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-gp-piece="booster" data-id={b} aria-label={boosterFa(b)} onClick={() => c.tryAct(a)}>{img}</button>
            : <span key={b} className={`gp-boost${owner >= 0 ? ' is-taken' : ''}`} tabIndex={0} data-gp-piece="booster" data-id={b} aria-label={boosterFa(b)}>{img}
              {owner >= 0 && <span className={`bgv-avatar bgv-avatar--sm seat-${owner + 1}`} title={c.who(owner)}>{c.who(owner).charAt(0)}</span>}</span>;
        })}
      </div>
      <p className="gp-note">{view.round >= 6 ? `${tx(terms.round)} ۶: ${tf('پاس بدون بوستر.')}` : tf(UI.boostersNote[0])}</p>
    </div>
  );
});

/** Faction board of one player (§7), own booster beside it, owned tiles under it. */
const FactionBoardView = memo(function FactionBoardView({ c, seat }: { c: Ctx; seat: number }) {
  useTermsLang();
  const { view } = c;
  const p = view.pl[seat]!;
  const fid = p.faction!;
  const color = colorOf(view, seat);
  const W = FB.w, H = FB.h;
  const own = seat === c.me;
  const built = (b: Building[]) => view.hexes.filter((h) => h.owner === seat && b.includes(h.building!)).length + (b.includes('mine') ? view.hexes.filter((h) => h.extra === seat).length : 0);
  const slots = (Object.entries(fid === 'bescods' ? { ...FB.slots, ...BESCODS_SLOTS } : FB.slots) as [string, { centres: number[][]; widthPct: number }][]).flatMap(([k, def]) => {
    const kinds: Building[] = k === 'MI' ? ['mine'] : k === 'TS' ? ['ts'] : k === 'RL' ? ['lab'] : k === 'PI' ? ['pi'] : ['ac1', 'ac2'];
    const b = built(kinds);
    return def.centres.slice(b).map(([x, y], i) => <img key={`${k}${b + i}`} className="gp-at gp-slot" data-gp-piece={k} data-slot={b + i} data-seat={seat}
      src={structArt(kinds[0]!, color)} alt="" decoding="async" style={at(x!, y!, W, H, def.widthPct)} />);
  });
  const bowls = FB.powerBowls;
  const scatter = (n: number, [cx, cy]: number[], key: string) => Array.from({ length: n }, (_, k) => {
    const r = 26 * Math.sqrt(k), t = k * 2.4;
    return <img key={`${key}${k}`} className={`gp-at${c.fresh(`${seat}${key}${k}`)}`} data-gp-piece="ptok" src={art(IDS.resources.powerToken)} alt="" decoding="async" style={at(cx! + r * Math.cos(t), cy! + r * 0.8 * Math.sin(t), W, H, bowls.tokenWidthPct)} />;
  });
  const brain = p.power.brain;
  const conv = FB.conversions;
  const special = (key: string) => c.legal.filter((a) => a.type === 'special' && a.id === key);
  const boost = p.booster ? special(`booster:${p.booster}`) : [];
  const orange = [...new Set(c.legal.filter((a) => a.type === 'special' && (String(a.id).startsWith('faction:') || a.id === 'ac2')).map((a) => String(a.id)))];
  return (
    <div className="gp-fboard-wrap">
      <div className="gp-fboard-grid">
        <div className="gp-board" data-gp-board="faction" data-faction={fid} data-seat={seat} style={{ aspectRatio: `${W} / ${H}` }}>
          <BoardImg path={FACTIONS[fid]?.board ?? ''} w={W} h={H} alt={`${tf('صفحهٔ')} ${factionFa(fid)}`} sizes="(max-width: 760px) 100vw, 60vw" lazy />
          <div className={own ? 'gp-layer gp-layer--own' : 'gp-layer'} style={own ? ownVar(view, seat) : undefined}>{slots}</div>
          <div className="gp-layer">
            {scatter(p.power.gaia, bowls.gaia, 'g')}{scatter(p.power.b1, bowls.I, 'a')}{scatter(p.power.b2, bowls.II, 'b')}{scatter(p.power.b3, bowls.III, 'c')}
          </div>
          {brain !== null && <img className="gp-at" data-gp-piece="ptok" data-id="brainstone" src={art(IDS.pieces.brainstone)} alt={tx(terms.brainStone)}
            style={at(...((brain === 0 ? bowls.gaia : brain === 1 ? bowls.I : brain === 2 ? bowls.II : bowls.III) as [number, number]), W, H, bowls.tokenWidthPct * 1.3)} />}
          {own && conv.ids.map((id, i) => {
            const a = c.legal.find((x) => x.type === 'convert' && x.id === id);
            return <button key={id} type="button" className={`gp-conv${a ? ' is-avail' : ''}${a && c.hint(a) ? ' gp-hint' : ''}`} data-gp-action={`conv-${id}`} disabled={!a} title={convFa(id)} aria-label={convFa(id)}
              style={{ insetInlineStart: undefined, left: `${conv.leftPct}%`, top: `${conv.topPct[i]}%`, width: `${conv.widthPct}%`, height: `${conv.heightPct}%` }} onClick={() => a && c.tryAct(a)} />;
          })}
        </div>
        <div className="gp-ownbooster">
          {p.booster && (boost.length
            ? <button type="button" className={`gp-boost is-avail${c.hint(boost[0]!) ? ' gp-hint' : ''}`} data-gp-piece="booster" data-gp-action={`special-booster:${p.booster}`} title={specialFa(`booster:${p.booster}`)} onClick={() => c.tryAct(boost[0]!)}><img src={boosterArt(p.booster)} alt={boosterFa(p.booster)} /></button>
            : <span className={`gp-boost${p.used.includes(`booster:${p.booster}`) ? ' is-used' : ''}`} tabIndex={0} data-gp-piece="booster" data-id={p.booster} aria-label={boosterFa(p.booster)}><img src={boosterArt(p.booster)} alt={boosterFa(p.booster)} />
              <Tip img={boosterArt(p.booster)} title={`${tx(terms.booster)} این ${tx(terms.round)}`} text={boosterFa(p.booster)} />
              {p.used.includes(`booster:${p.booster}`) && <img className="gp-used" src={art(IDS.pieces.actionToken)} alt="" />}</span>)}
        </div>
      </div>
      <div className="gp-owned" aria-label={tf(UI.owned[0])}>
        <small className="gp-owned__cap">{tf(UI.owned[0])}</small>
        {p.techs.map((t) => {
          const list = special(`tech:${t.id}`);
          const used = p.used.includes(`tech:${t.id}`);
          const img = <><img src={techArt(t.id)} alt={techFa(t.id)} draggable={false} /><Tip img={techArt(t.id)} title={t.covered ? tf('فناوری (پوشیده)') : tf('فناوری')} text={techFa(t.id)} /></>;
          return list.length
            ? <button key={t.id} type="button" className={`gp-own is-avail${c.hint(list[0]!) ? ' gp-hint' : ''}`} data-gp-piece={CONTENT.techs[t.id]?.kind ?? 'std'} data-id={t.id} data-gp-action={`special-tech:${t.id}`} title={techFa(t.id)} onClick={() => c.tryAct(list[0]!)}>{img}</button>
            : <span key={t.id} className={`gp-own${t.covered ? ' is-covered' : ''}`} tabIndex={0} data-gp-piece={CONTENT.techs[t.id]?.kind ?? 'std'} data-id={t.id} title={techFa(t.id)}>{img}{used && <img className="gp-used" src={art(IDS.pieces.actionToken)} alt="" />}</span>;
        })}
        {p.feds.map((f, k) => <span key={`${f.id}${k}`} className="gp-own" tabIndex={0} data-gp-piece="fed" data-id={f.id} aria-label={`${fedFa(f.id)}${f.green ? '' : ' (خرج‌شده)'}`}><img src={fedArt(f.id, !f.green)} alt={fedFa(f.id)} />
          <Tip img={fedArt(f.id, !f.green)} title={f.green ? tx(terms.fedToken) : `${tx(terms.fedToken)} (خرج‌شده)`} text={fedFa(f.id)} /></span>)}
        {own && orange.map((key) => {
          const list = special(key);
          return <Button key={key} size="sm" className={`gp-orange${list.some(c.hint) ? ' gp-hint' : ''}`} data-gp-action={`special-${key}`} onClick={() => c.tryAct(list[0]!)}>{specialFa(key)}</Button>;
        })}
      </div>
    </div>
  );
});

// ---------------- the table ----------------

type Mode = { kind: 'mine' | 'upgrade' | 'gaiaform' | 'federation' | 'pass' | 'research'; id?: undefined } | { kind: 'power' | 'special'; id: string };
type Tab = 'map' | 'research' | 'scoring' | 'board';

/** The page theme (root `data-theme`): the action bar is a page card, outside the dark felt stage. */
function usePageTheme(): 'light' | 'dark' {
  const read = (): 'light' | 'dark' => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const o = new MutationObserver(() => setTheme(read()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);
  return theme;
}

/** Live media query (phone layout renders only the open tab). */
function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const fn = () => setOn(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}

export default function GaiaProjectRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<GaiaView>) {
  useTermsLang(); // re-render when the terms language changes (module-level helpers read it through tx)
  const [lang, setLang] = useState<Lang>(() => { try { return localStorage.getItem('gp.lang') === 'en' ? 'en' : 'fa'; } catch { return 'fa'; } });
  const t = (k: UiKey) => (lang === 'en' ? UI[k][1] : tf(UI[k][0]));
  const [draft, setDraft] = useState<GameAction[]>([]);
  const [outbox, setOutbox] = useState<GameAction[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [hexSel, setHexSel] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('map');
  const [sheet, setSheet] = useState(false);
  const [boardSeat, setBoardSeat] = useState<number | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [fedIdx, setFedIdx] = useState(0);
  const [fedSel, setFedSel] = useState<number[]>([]);
  const [brainSpend, setBrainSpend] = useState(false);
  const [lostSel, setLostSel] = useState<number | null>(null);
  // Phone zoom dock (9.7): a tap focuses a piece; its tip node is cloned here (no HTML parsing), the close button empties it.
  const dock = useRef<HTMLDivElement>(null);
  const showTip = (e: React.FocusEvent) => {
    const tip = phone ? (e.target as HTMLElement).querySelector(':scope > .gp-tip') : null;
    if (tip && dock.current) dock.current.firstElementChild!.replaceChildren(tip.cloneNode(true));
  };

  // Confirmed steps go out one at a time; each new snapshot sends the next. A snapshot that never comes = rejected.
  const sent = useRef<{ view: GaiaView } | null>(null);
  useEffect(() => {
    if (!outbox.length || busy) return;
    if (!sent.current) { sent.current = { view: served }; onAction(outbox[0]!); return; }
    if (sent.current.view !== served) { sent.current = null; setOutbox((o) => o.slice(1)); return; }
    const timer = setTimeout(() => { sent.current = null; setOutbox([]); }, 1500);
    return () => clearTimeout(timer);
  }, [outbox, busy, served, onAction]);

  const sending = outbox.length > 0;
  // My own turn with nothing open: everything is a local draft until «تأیید».
  // A held turn (main action done, RULES E10) belongs to its holder for free actions and to the next player for their move.
  const turnSeat = useMemo(() => gaiaProjectModule.pendingSeats(toState(served))[0], [served]);
  const drafting = mySeat !== null && !served.outcome && !served.pending.length && (served.current === mySeat || turnSeat === mySeat) && legalActions.some((a) => a.type !== 'resign');
  // The engine runs once per snapshot or draft step, never per render (hover, sheet, tab).
  const steps = useMemo(() => [...outbox, ...(drafting ? draft : [])].flatMap((a) => (a.type === 'batch' ? a.actions as GameAction[] : [a])), [outbox, draft, drafting]);
  const sim = useMemo(() => simulate(served, mySeat, steps), [served, mySeat, steps]);
  const state = sim.s;
  const view = useMemo(() => (sim.n ? gaiaProjectModule.project(state, mySeat === null ? { kind: 'spectator' } : { kind: 'player', seat: mySeat }) : served), [sim, state, served, mySeat]);
  const sentSteps = steps.length - (drafting ? draft.length : 0);
  useEffect(() => { if (drafting && sim.n < steps.length) setDraft((d) => d.slice(0, Math.max(0, sim.n - sentSteps))); }, [drafting, sim.n, steps.length, sentSteps]);
  useEffect(() => { if (!drafting) { setDraft([]); setMode(null); setHexSel(null); } }, [drafting]);
  // Gaia-Prompts 5: a Gaia Project or satellites as the last draft step: the player picks the bowls (default I, II, III).
  const bowlEdit = useMemo(() => {
    const last = drafting ? draft[draft.length - 1] : undefined;
    if (!last || mySeat === null || (last.type !== 'gaiaform' && last.type !== 'federation')) return null;
    const before = simulate(served, mySeat, [...outbox, ...draft.slice(0, -1)]).s;
    if (last.type === 'federation' && CONTENT.factions[before.pl[mySeat]!.faction ?? '']?.flags?.satelliteQic) return null;
    const plan = last.type === 'gaiaform' ? gaiaformPlan(before, mySeat, last.hex as number) : fedPlan(before, mySeat, last.hexes as number[]);
    if (typeof plan === 'string') return null;
    const n = 'tokens' in plan ? plan.tokens : plan.sats.length;
    const pw = before.pl[mySeat]!.power;
    const caps: Bowls = [pw.b1 + (pw.brain === 1 ? 1 : 0), pw.b2 + (pw.brain === 2 ? 1 : 0), pw.b3 + (pw.brain === 3 ? 1 : 0)]; // the brainstone counts in its bowl
    if (!n || caps.filter((x) => x > 0).length < 2) return null;
    let left = n;
    const def = caps.map((cap) => { const k = Math.min(cap, left); left -= k; return k; }) as Bowls;
    return { kind: last.type, n, caps, from: (last.from as Bowls | undefined) ?? def };
  }, [drafting, draft, mySeat, served, outbox]);
  /** Move one token of the pick into bowl `i` (+1) or out of it (−1), keeping the total. */
  const moveBowl = (i: number, dir: 1 | -1) => {
    if (!bowlEdit) return;
    const f = [...bowlEdit.from] as Bowls;
    const j = dir > 0 ? [2, 1, 0].find((k) => k !== i && f[k]! > 0) : [0, 1, 2].find((k) => k !== i && f[k]! < bowlEdit.caps[k]!);
    if (j === undefined || (dir > 0 ? f[i]! >= bowlEdit.caps[i]! : f[i]! <= 0)) return;
    f[i] = f[i]! + dir; f[j] = f[j]! - dir;
    setDraft((d) => [...d.slice(0, -1), { ...d[d.length - 1]!, from: f }]);
  };
  // Pieces new in this state fade in once (CSS); pieces that move glide by their own left/top transition.
  // Refs, not render-local sets: StrictMode renders twice and the memoized boards keep the first render's closure.
  const seen = useRef<{ seq: number | null; keys: Set<string>; drawn: Set<string> }>({ seq: null, keys: new Set(), drawn: new Set() });
  useEffect(() => { const s = seen.current; for (const k of s.drawn) s.keys.add(k); s.drawn.clear(); s.seq = view.seq; });
  useEffect(() => { dock.current?.firstElementChild?.replaceChildren(); }, [served.seq]); // a played move retires the zoomed piece
  const phone = useMedia('(max-width: 760px)');
  const pageTheme = usePageTheme();

  const who = (s: number) => (s === mySeat ? t('you') : seatName(s));
  const legal = useMemo(() => (sending ? [] : drafting && steps.length
    ? gaiaProjectModule.legalActions(state, { kind: 'player', seat: mySeat! })
    : legalActions).filter((a) => a.type !== 'resign') as GameAction[], [sending, drafting, steps.length, state, mySeat, legalActions]);
  const myDecision = mySeat !== null && view.decision?.seat === mySeat;
  const hasMain = draft.some((a) => !FREE.has(a.type) && a.type !== 'decide');
  /** After the draft my main action is done and only free actions remain before «تأیید» ends the turn. */
  const heldNow = drafting && state.turnDone && state.current === mySeat && !state.pending.length && !state.outcome;
  /** A main action is still possible: when everyone else passed, the held turn's holder also plays the next turn. */
  const mainLegal = legal.some((a) => !FREE.has(a.type) && a.type !== 'end' && a.type !== 'decide');
  const onlyFree = heldNow && !mainLegal;
  const canConfirm = drafting && (hasMain || (heldNow && !expected)) && !myDecision;
  const actionsTurn = legal.some((a) => a.type === 'pass');
  const hint = (a: GameAction) => same(expected, a);

  // Taklons (RULES E6): with the brainstone in bowl III, power spending says whether it is spent.
  const brainChoice = mySeat !== null && state.pl[mySeat]?.power.brain === 3;
  const add = (a: GameAction) => {
    if (busy || sending) return;
    if (brainChoice && (a.type === 'convert' || a.type === 'power') && a.brain === undefined) {
      const pick = { ...a, brain: brainSpend };
      // Keeping the brainstone is impossible when bowl III alone cannot pay: then it is spent (engine default).
      if (gaiaProjectModule.validate(state, { kind: 'player', seat: mySeat! }, pick as GaiaAction).ok) a = pick;
    }
    if (!drafting) { onAction(a); return; } // out of turn (leech) and decisions already open on the server
    setDraft((d) => [...d, a]);
    setMode(null); setHexSel(null); setSheet(false);
  };
  const back = () => { if (mode || hexSel !== null) { setMode(null); setHexSel(null); } else setDraft((d) => d.slice(0, -1)); };
  const cancel = () => { setDraft([]); setMode(null); setHexSel(null); };
  // One request per turn (atomic on the server); tutorials check each scripted step, so they go one by one.
  const confirm = () => {
    if (!canConfirm) return;
    // «تأیید» ends the turn explicitly (`end`); tutorials check each scripted step, so they send the steps alone.
    const out = !expected && heldNow ? [...draft, { type: 'end' }] : draft;
    if (!out.length) return;
    setOutbox(expected || out.length === 1 ? out : [{ type: 'batch', actions: out }]); setDraft([]); setSheet(false);
  };

  // What a hex does in the current step.
  const ofMode = (a: GameAction) => (mode ? (mode.kind === 'power' || mode.kind === 'special' ? a.type === mode.kind && a.id === mode.id : a.type === mode.kind) : true);
  const lostPlanet = view.decision?.kind === 'lostPlanet';
  useEffect(() => { if (!lostPlanet) setLostSel(null); }, [lostPlanet]);
  const pickHex = useMemo(() => {
    const out = new Map<number, GameAction[]>();
    if (sending || (mode && (mode.kind === 'research' || mode.kind === 'pass'))) return out;
    if (mode?.kind === 'federation') { if (mySeat !== null) for (const i of fedCandidates(state, mySeat)) out.set(i, []); return out; }
    for (const a of legal) {
      const hx = typeof a.hex === 'number' ? a.hex : a.type === 'decide' && lostPlanet ? Number(a.choice) : null;
      if (hx === null || !ofMode(a)) continue;
      if (!mode && (a.type === 'power' || a.type === 'special')) continue; // board actions start from their piece
      out.set(hx, [...(out.get(hx) ?? []), a]);
    }
    return out;
  }, [legal, mode, sending, lostPlanet, state, mySeat]); // eslint-disable-line react-hooks/exhaustive-deps -- ofMode reads mode
  const onHex = (i: number) => {
    if (mode?.kind === 'federation') { setFedSel((sel) => (sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i].sort((a, b) => a - b))); return; }
    const list = pickHex.get(i) ?? [];
    if (lostPlanet && list.length) { setLostSel(i); return; } // Gaia-Prompts 8: pick, then «تأیید»
    if (list.length === 1) add(list[0]!);
    else if (list.length > 1) setHexSel(i);
  };
  const tryAct = (a: GameAction) => {
    const needsHex = (a.type === 'power' || a.type === 'special') && legal.some((x) => x.type === a.type && x.id === a.id && typeof x.hex === 'number');
    if (needsHex) { setMode({ kind: a.type as 'power' | 'special', id: String(a.id) }); setTab('map'); setSheet(false); return; }
    if (a.type === 'power' && a.id === 'qic2' && legal.filter((x) => x.type === 'power' && x.id === 'qic2').length > 1) { setMode({ kind: 'power', id: 'qic2' }); return; }
    add(a);
  };
  const costOf = (i: number) => {
    if (mySeat !== null && mode?.kind === 'special' && mode.id === 'faction:ivits') { const q = qicFor(state, mySeat, i); return q ? { q } : null; }
    if (mySeat === null || mode?.kind !== 'mine') return null;
    const plan = minePlan(state, mySeat, i);
    return typeof plan === 'string' ? null : plan.cost;
  };
  const expectedHex = typeof expected?.hex === 'number' && !draft.length ? expected.hex : null;
  const reasonOf = (a: GameAction) => {
    if (mySeat === null) return 'NOT_YOUR_TURN';
    const r = gaiaProjectModule.validate(state, { kind: 'player', seat: mySeat }, a as GaiaAction);
    return r.ok ? '' : r.errorCode;
  };
  const proposals = useMemo(() => [...new Set(legal.filter((a) => a.type === 'federation').map((a) => JSON.stringify(a.hexes)))].map((x) => JSON.parse(x) as number[]), [legal]);
  const proposal = mode?.kind === 'federation' ? fedSel : null;
  // Federation by hand (Gaia-Prompts 3): the hexes picked on the map, checked by the engine as they change.
  const fc = mode?.kind === 'federation' && mySeat !== null && fedSel.length ? fedCheck(state, mySeat, fedSel) : null;
  const fedActs = useMemo(() => new Map(fc && !fc.error ? fedTokensAvailable(state).map((token): [string, GameAction] => [token, { type: 'federation', hexes: fedSel, token }]) : []),
    [fc?.error, fedSel, state]); // eslint-disable-line react-hooks/exhaustive-deps -- fc derives from fedSel + state
  const lastHex = drafting && !mode ? [...draft].reverse().find((a) => typeof a.hex === 'number')?.hex as number | undefined : undefined;
  const fresh = (k: string) => { const s = seen.current; s.drawn.add(k); return s.seq !== null && s.seq !== view.seq && !s.keys.has(k) ? ' gp-new' : ''; };
  // Stable while nothing the boards show changes, so the memoized boards skip sheet/tab/auto-charge re-renders.
  const c: Ctx = useMemo(() => ({ view, state, me: mySeat, who, legal, pickHex, pickedHex: hexSel ?? lostSel ?? lastHex ?? null, onHex, tryAct, hint, expectedHex, costOf, fresh, reasonOf, proposal, fedActs }),
    [view, state, mySeat, legal, pickHex, hexSel, lostSel, lastHex, expectedHex, mode, busy, sending, drafting, expected, lang, seatName, onAction, proposal, fedActs]); // eslint-disable-line react-hooks/exhaustive-deps -- the closures read exactly these

  // Main-action buttons: legal from the engine, or disabled with the engine's reason.
  /** Reason for a disabled main button: the engine's most relevant error code, and for a resource shortfall the exact
   *  numbers («سنگ معدن کافی نیست: ۴ لازم، ۱ دارید»), costed by the engine on a copy with unlimited resources. */
  const reason = (cands: GaiaAction[]): { code: string; text: string } => { // only for a disabled button, inside the memo below
    if (mySeat === null) return { code: 'NOT_YOUR_TURN', text: REASON_FA.NOT_YOUR_TURN! };
    const res = cands.map((a) => ({ a, r: gaiaProjectModule.validate(state, { kind: 'player', seat: mySeat }, a) }));
    const codes = res.flatMap(({ r }) => (r.ok ? [] : [r.errorCode]));
    const code = REASON_ORDER.find((x) => codes.includes(x)) ?? codes[0] ?? 'WRONG_PHASE';
    let text = REASON_FA[code] ?? code;
    if (code === 'NOT_ENOUGH_RESOURCES') {
      const rich = structuredClone(state);
      Object.assign(rich.pl[mySeat]!, { c: 99, o: 99, k: 99, q: 99 });
      const costs = res.filter(({ r }) => !r.ok && r.errorCode === code).flatMap(({ a }): Gain[] => {
        if (a.type === 'research') return [{ k: RESEARCH_COST }];
        const g = a.type === 'mine' ? minePlan(rich, mySeat, a.hex) : a.type === 'upgrade' ? upgradeCost(rich, mySeat, a.hex, a.to) : null;
        return g && typeof g !== 'string' ? [('cost' in g ? g.cost : g) as Gain] : [];
      });
      const total = (g: Gain) => (g.c ?? 0) + (g.o ?? 0) + (g.k ?? 0) + (g.q ?? 0);
      const cheapest = costs.sort((x, y) => total(x) - total(y))[0];
      const p = state.pl[mySeat]!;
      const short = cheapest && (['o', 'c', 'k', 'q'] as const).find((r) => (cheapest[r] ?? 0) > p[r]);
      if (cheapest && short) text = `${RES_FA[short]} کافی نیست: ${fa(cheapest[short]!)} لازم، ${fa(p[short])} دارید`;
    }
    return { code, text };
  };
  const hexIds = view.hexes.map((_, i) => i);
  const MAIN: { kind: 'mine' | 'upgrade' | 'gaiaform' | 'research' | 'federation'; label: UiKey; cost?: Gain; cands: () => GaiaAction[] }[] = [
    { kind: 'mine', label: 'mine', cost: BUILD_COST.mine, cands: () => hexIds.filter((i) => view.hexes[i]!.planet !== 'e').map((hex) => ({ type: 'mine', hex })) },
    { kind: 'upgrade', label: 'upgrade', cands: () => hexIds.filter((i) => view.hexes[i]!.owner === mySeat).flatMap((hex) => (['ts', 'lab', 'pi', 'ac1', 'ac2'] as const).map((to) => ({ type: 'upgrade', hex, to }))) },
    { kind: 'research', label: 'research', cost: { k: RESEARCH_COST }, cands: () => TRACKS.map((track) => ({ type: 'research', track })) },
    { kind: 'gaiaform', label: 'gaiaform', cands: () => hexIds.filter((i) => view.hexes[i]!.planet === 'm').map((hex) => ({ type: 'gaiaform', hex })) },
    { kind: 'federation', label: 'federation', cands: () => [{ type: 'federation', hexes: [0], token: Object.keys(view.fedSupply)[0] ?? 'fed1' }] }
  ];
  const reasons = useMemo(() => Object.fromEntries(MAIN.map((m) => [m.kind, legal.some((a) => a.type === m.kind) ? null : reason(m.cands())])) as Record<string, { code: string; text: string } | null>,
    [state, legal]); // eslint-disable-line react-hooks/exhaustive-deps -- MAIN and reason derive from state
  const startMain = (k: 'mine' | 'upgrade' | 'gaiaform' | 'research' | 'federation' | 'pass') => {
    const list = legal.filter((a) => a.type === k);
    // federation: open on the tutorial's proposal when there is one, else the engine's first
    const fi = k === 'federation' && expected?.type === 'federation' ? Math.max(0, proposals.findIndex((h) => JSON.stringify(h) === JSON.stringify(expected.hexes))) : 0;
    setFedIdx(fi);
    if (k === 'federation') setFedSel(proposals[fi] ?? []);
    setSheet(false); // the choices stay in the flow line and on the board; the open sheet would cover them on a phone
    if (k === 'research' || k === 'federation' || k === 'pass') { if (k === 'pass' && list.length === 1) { add(list[0]!); return; } setMode({ kind: k }); if (k === 'federation') setTab('map'); if (k === 'research') setTab('research'); if (k === 'pass') setTab('scoring'); return; }
    setMode({ kind: k as 'mine' | 'upgrade' | 'gaiaform' }); setTab('map'); setSheet(false);
  };
  // Free row (8.3): every conversion this faction has, plus burning; the ones not possible now stay visible, disabled.
  const convs: GameAction[] = mySeat !== null && view.phase === 'actions' ? [...conversions(state, mySeat).map((x) => ({ type: 'convert', id: x.id })), { type: 'burn' }] : [];
  const decisions = legal.filter((a) => a.type === 'decide');
  const me = mySeat !== null ? view.pl[mySeat] : undefined;
  const leech = view.decision?.kind === 'leech' && myDecision && !drafting ? view.decision : null;

  // Auto-charge setting (server, per player and table). Hidden in tutorials (scripted moves only).
  const auto = me?.auto ?? { mode: 'free' as const };
  const autoLabel = tf(auto.mode === 'ask' ? 'همیشه بپرس' : auto.mode === 'free' ? 'رایگان (۱)' : auto.mode === 'upto' ? `تا ${fa(auto.n ?? 1)} امتیاز` : 'همه را رد کن');
  const setAuto = (m: { mode: 'ask' | 'free' | 'upto' | 'decline'; n?: number; lastRound?: boolean }) => { if (!busy) onAction({ type: 'autoCharge', mode: m.mode, ...(m.mode === 'upto' ? { n: m.n ?? 1 } : {}), ...(m.lastRound ? { lastRound: true } : {}) }); };
  const autoPanel = autoOpen && me && !expected && (
    <fieldset className="gp-auto" aria-label={t('auto')}>
      {([['ask', undefined, 'همیشه بپرس'], ['free', undefined, tf('شارژ رایگان (۱) خودکار، بقیه بپرس')], ['upto', 1, tf('تا ۱ امتیاز خودکار')], ['upto', 2, tf('تا ۲ امتیاز خودکار')], ['upto', 3, tf('تا ۳ امتیاز خودکار')], ['decline', undefined, 'همه را رد کن']] as const).map(([m, n, label]) => (
        <label key={`${m}${n ?? ''}`}><input type="radio" name="gp-auto" checked={auto.mode === m && (m !== 'upto' || auto.n === n)} disabled={busy} onChange={() => setAuto({ mode: m, n, lastRound: auto.lastRound })} />{label}</label>
      ))}
      <label><input type="checkbox" checked={!!auto.lastRound} disabled={busy} onChange={(e) => setAuto({ ...auto, lastRound: e.target.checked })} />{`در ${tx(terms.round)} آخر همیشه بپرس`}</label>
    </fieldset>
  );

  const waitingFor = view.decision ? view.decision.seat : view.current;
  const flowSteps = draft.map((a, i) => <li key={i} className="gp-step is-done">{stepFa(view, a)}</li>);
  const prompt = myDecision && view.decision ? decisionTitle(view, who)
    : mode?.kind === 'research' ? t('pickTrack') : mode?.kind === 'pass' ? t('pickBooster') : mode?.kind === 'federation' ? t('pickFed')
      : hexSel !== null ? t('pickTo') : mode ? `${mode.kind === 'power' || mode.kind === 'special' ? stepFa(view, { type: mode.kind, id: mode.id }) : t(mode.kind)}: ${t('pickHex')}`
        : view.phase === 'faction' ? t('pickFaction') : view.phase === 'setup' ? t('place') : view.phase === 'booster' ? t('boosterPhase')
          : canConfirm ? t('ready') : t('pickAction');
  type Opt = { a: GameAction; cost?: Gain | null; reason?: string; img?: string; note?: string };
  const lvlFa = (track: Track) => { const l = me?.research[track] ?? 0; return lang === 'en' ? `${l} → ${l + 1}` : `${fa(l)}←${fa(Math.min(5, l + 1))}`; };
  const dec = myDecision ? view.decision : null;
  const income = dec?.kind === 'income' ? incomeResults(state, dec.seat, dec.pw, dec.t) : null;
  const decisionOpts = (): Opt[] => {
    // Gaia-Prompts 1: all six tracks with the step each one makes; closed tracks stay visible, disabled.
    if (dec?.kind === 'research') return TRACKS.map((track) => {
      const a: GameAction = { type: 'decide', choice: track };
      return { a, note: lvlFa(track), ...(decisions.some((x) => x.choice === track) ? {} : { reason: 'این مسیر بسته است' }) };
    });
    if (dec?.kind === 'custom' && (dec.source === 'faction:terrans' || dec.source === 'faction:itars')) return [];
    return decisions.map((a) => ({
      a,
      ...(dec?.kind === 'tech' || dec?.kind === 'cover' ? { img: techArt(String(a.choice)) } : {}),
      // Gaia-Prompts 4: preview of the bowls for each order.
      ...(income ? { note: `${tf('پس از درآمد')}: ${bowlsFa(a.choice === 'charge-first' ? income.chargeFirst : income.tokenFirst)}` } : {})
    }));
  };
  /** Small faction board beside a faction's own prompt (Gaia-Prompts 6–7). */
  const facThumb = (seat: number) => {
    const fid = view.pl[seat]?.faction;
    const path = fid ? FACTIONS[fid]?.board : undefined;
    return path ? <img className="gp-facthumb" src={ART_SM[`./art-sm/${path.slice(4)}`] ?? art(path)} alt={factionFa(fid!)} /> : null;
  };
  const decAct = (choice: string) => decisions.find((a) => a.choice === choice);
  const facPrompt = (() => {
    const row = (seat: number | null, body: ReactNode, kind: string) => <div className="gp-facprompt" data-gp-pending={kind}>{seat !== null && facThumb(seat)}<div className="gp-facprompt__body">{body}</div></div>;
    if (dec?.kind === 'custom' && dec.source === 'faction:terrans') {
      const done = decAct('done');
      return row(dec.seat, <>
        <p><b>{factionFa('terrans')}</b>: {fa(Number(dec.data ?? 0))}{tf(' قدرت از ناحیهٔ گایا به کاسهٔ II رفت. با مؤسسه، این قدرت را برای تبدیل خرج کنید.')}</p>
        <div className="gp-free">{decisions.filter((a) => a.choice !== 'done').map((a) => {
          const k = String(a.choice);
          return <button key={k} type="button" className={`gp-chipbtn${hint(a) ? ' gp-hint' : ''}`} data-option="decide" disabled={busy} onClick={() => add(a)}>
            {fa(TERRANS_SPEND[k]?.pw ?? 0)} {tf('قدرت')} → {RES_FA[k as keyof Gain] ?? k}</button>;
        })}</div>
        {done && <div className="gp-btnrow"><Button size="sm" data-option="decide" disabled={busy} onClick={() => add(done)}>تمام</Button></div>}
      </>, 'custom');
    }
    if (dec?.kind === 'custom' && dec.source === 'faction:itars') {
      const yes = decAct('yes'), no = decAct('no');
      return row(dec.seat, <>
        <p><b>{factionFa('itars')}</b>: {fa(Number(view.pl[dec.seat]?.mark.itarsAside ?? 0))}{tf(' ژتون در ناحیهٔ گایا دارید. هر ۴ ژتون یک کاشی فناوری؛ تبدیل می‌کنید؟')}</p>
        <div className="gp-btnrow">
          {yes && <Button size="sm" data-option="decide" disabled={busy} onClick={() => add(yes)}>{tf('یک کاشی (۴ ژتون)')}</Button>}
          {no && <Button size="sm" variant="secondary" data-option="decide" disabled={busy} onClick={() => add(no)}>رد</Button>}
        </div>
      </>, 'custom');
    }
    if (dec?.kind === 'lostPlanet') {
      const a = lostSel !== null ? decAct(String(lostSel)) : undefined;
      return row(null, <>
        <p><b>{tf('ناوبری')} ۵</b>: {tf('سیارهٔ گمشده را روی یک خانهٔ خالی در دسترس بگذارید. مثل ساخت معدن امتیاز می‌دهد و دیگران شارژ می‌کنند.')}</p>
        <div className="gp-btnrow">
          <Button size="sm" data-option={a ? 'decide' : undefined} disabled={busy || !a} onClick={() => a && add(a)}>{tf('تأیید: معدن روی سیارهٔ گمشده')}</Button>
          <Button size="sm" variant="secondary" disabled={lostSel === null} onClick={() => setLostSel(null)}>{t('back')}</Button>
        </div>
      </>, 'lostPlanet');
    }
    if (mode?.kind === 'special' && mode.id === 'faction:ivits' && mySeat !== null) {
      return row(mySeat, <p><b>{factionFa('ivits')}</b>: {tf('ایستگاه فضایی را روی یک خانهٔ خالی در برد بگذارید. ارزش ۱ در فدراسیون دارد و سازه نیست؛ QIC فقط برای برد بیشتر.')}</p>, 'special');
    }
    return null;
  })();
  const costIf = (g: Gain | string) => (typeof g === 'string' ? null : g);
  const options: Opt[] = hexSel !== null ? (pickHex.get(hexSel) ?? []).map((a) => ({ a, cost: a.type === 'upgrade' && mySeat !== null ? costIf(upgradeCost(state, mySeat, a.hex as number, a.to as 'ts')) : null }))
    : mode?.kind === 'research' ? TRACKS.map((track) => {
      const a: GameAction = { type: 'research', track };
      return { a, cost: { k: RESEARCH_COST }, note: lvlFa(track), ...(legal.some((x) => same(x, a)) ? {} : { reason: REASON_FA[reasonOf(a)] ?? reasonOf(a) }) };
    })
      : mode?.kind === 'federation' ? [...fedActs.values()].map((a) => ({ a, img: fedArt(String(a.token)) }))
        : mode?.kind === 'pass' ? legal.filter((a) => a.type === 'pass').map((a) => ({ a })) : mode?.kind === 'power' && mode.id === 'qic2' ? legal.filter((a) => a.type === 'power' && a.id === 'qic2').map((a) => ({ a }))
          : myDecision && view.decision?.kind !== 'lostPlanet' ? decisionOpts()
            : drafting && view.phase === 'booster' && !draft.length ? legal.filter((a) => a.type === 'booster').map((a) => ({ a })) : [];
  const optionFa = (a: GameAction) => (a.type === 'federation' ? fedFa(a.token as string) : a.type === 'power' && a.pick ? fedFa(a.pick as string)
    : a.type === 'upgrade' ? BUILDING_FA[a.to as Building] : a.type === 'research' ? TRACK_FA[a.track as Track] : stepFa(view, a));
  // What the draft has spent so far (engine state before and after), shown in the flow line.
  const spent: Gain = {};
  if (drafting && mySeat !== null && me) for (const r of ['c', 'o', 'k', 'q'] as const) { const d = (served.pl[mySeat]?.[r] ?? 0) - me[r]; if (d > 0) spent[r] = d; }

  const bar = (
    <div className={`gp-actbar${drafting || leech ? '' : ' is-waiting'}${sheet ? ' is-open' : ''}`} data-gp-actbar data-gp-pending={view.decision?.kind} data-theme={pageTheme}>
      <div className="gp-actbar__row1">
        <p className="gp-actbar__say">{view.outcome ? 'بازی تمام شد'
          : sending ? t('sending')
            : drafting || myDecision ? prompt
              : mySeat === null ? <>{t('spectating')}: {t('turnOf')} <bdi>{who(waitingFor)}</bdi></> : <>{t('turnOf')} <bdi>{who(waitingFor)}</bdi></>}</p>
        {me && !expected && <Button size="sm" variant="ghost" className="gp-autobtn" aria-expanded={autoOpen} onClick={() => setAutoOpen(!autoOpen)}>{t('auto')}: {autoLabel}</Button>}
        <button type="button" className="gp-lang" aria-label="زبان لایهٔ بازی" onClick={() => { const n = lang === 'fa' ? 'en' : 'fa'; setLang(n); try { localStorage.setItem('gp.lang', n); } catch { /* storage blocked */ } }}>{lang === 'fa' ? 'EN' : 'فا'}</button>
        {(drafting || myDecision) && <Button size="sm" className="gp-sheetbtn" onClick={() => setSheet(!sheet)}>{sheet ? t('close') : t('actions')}</Button>}
        {!phone && <span className="gp-shellclock" data-shell-clock />}
      </div>
      {autoPanel}
      {leech && (
        <div className="gp-leech" data-gp-pending="leech">
          {(() => {
            const n = leechAmount(state, leech.seat, leech.amount);
            const cost = tf(`هزینه ${fa(Math.max(0, n - 1))} امتیاز`);
            return decisions.some((a) => a.choice === 'token-first')
              ? <div className="gp-facprompt">{facThumb(leech.seat)}<p className="gp-facprompt__body"><b>{who(leech.seat)}</b> ({factionFa('taklons')}): {who(leech.from)}{tf(' کنار شما ساخت و')} {fa(n)}{tf(' قدرت شارژ می‌شود')} ({cost}).{tf(' ژتون مؤسسه را کی بگیرید؟')}</p></div>
              : <p>{`${who(leech.from)}${tf(' کنار شما ساخت.')} ${fa(n)}${tf(' قدرت شارژ می‌کنید؟')} ${cost}`}</p>;
          })()}
          <div className="gp-btnrow">
            {decisions.map((a) => <Button key={String(a.choice)} size="sm" variant={a.choice === 'decline' ? 'secondary' : 'primary'} className={hint(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => add(a)}>
              {a.choice === 'accept' ? tf(`شارژ ${fa(leechAmount(state, leech.seat, leech.amount))} قدرت`) : a.choice === 'decline' ? 'رد' : choiceFa(view, String(a.choice))}</Button>)}
            {decisions.some((a) => a.choice === 'accept') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setAuto({ mode: 'upto', n: Math.max(1, Math.min(3, leechAmount(state, leech.seat, leech.amount) - 1)) }); }}>دفعهٔ بعد نپرس</Button>}
          </div>
        </div>
      )}
      {(drafting || (myDecision && !leech)) && (
        <div className="gp-actbar__rows">
          {(draft.length > 0 || heldNow || mode || hexSel !== null || myDecision || options.length > 0) && (
            <div className="gp-flow" data-gp-pending={myDecision ? view.decision?.kind : undefined}>
              {flowSteps.length > 0 && <ol className="gp-steps">{flowSteps}{!canConfirm && <li className="gp-step is-now">…</li>}</ol>}
              {Object.keys(spent).length > 0 && <p className="gp-spent">{tf('هزینهٔ این نوبت:')} <CostPill g={spent} /></p>}
              {bowlEdit && <div className="gp-bowlpick" data-gp-pending="bowls">
                <p className="gp-spent"><b>{bowlEdit.kind === 'gaiaform' ? tx(terms.gaiaProject) : tf('ماهواره‌ها')}</b>: {fa(bowlEdit.n)} {tf('ژتون')} {bowlEdit.kind === 'gaiaform' ? tf('به ناحیهٔ گایا می‌رود') : 'از بازی بیرون می‌رود'}.{tf(' از کدام کاسه‌ها؟')}</p>
                {(['I', 'II', 'III'] as const).map((label, i) => <div key={label} className="gp-bowlrow">
                  <span>{tf('کاسهٔ')} {label} ({fa(bowlEdit.caps[i]!)} {tf('ژتون')})</span>
                  <Button size="sm" variant="secondary" aria-label={`یکی کمتر از ${tf('کاسهٔ')} ${label}`} disabled={busy || bowlEdit.from[i]! <= 0} onClick={() => moveBowl(i, -1)}>−</Button>
                  <b>{fa(bowlEdit.from[i]!)}</b>
                  <Button size="sm" variant="secondary" aria-label={`یکی بیشتر از ${tf('کاسهٔ')} ${label}`} disabled={busy || bowlEdit.from[i]! >= bowlEdit.caps[i]!} onClick={() => moveBowl(i, 1)}>+</Button>
                </div>)}
                <small>جمع {fa(bowlEdit.n)} از {fa(bowlEdit.n)}</small>
              </div>}
              {mode?.kind === 'federation' && <div className="gp-fedsel" data-gp-pending="federation">
                <p className="gp-spent">{tf('سازه‌ها و خانه‌های ماهواره را روی نقشه بزنید')}{fc && !fc.error ? tf('، سپس توکن فدراسیون را انتخاب کنید') : ''}.</p>
                {fc && <p className="gp-spent">{tf('ارزش قدرت')} <b>{fa(fc.value)} از {fa(fc.need)}</b>{fc.value >= fc.need ? ' ✓' : ''}<span className="bgv-sep" />{tf('ماهواره')} {fa(fc.sats.length)}<span className="bgv-sep" />{tf('سازه‌ها')} {fa(fc.buildings.length)}</p>}
                <div className="gp-btnrow">
                  <Button size="sm" variant="secondary" disabled={!proposals.length} onClick={() => { const n = fedIdx + 1; setFedIdx(n); setFedSel(proposals[n % proposals.length] ?? []); }}>پیشنهادها ({fa(proposals.length)})</Button>
                  <Button size="sm" variant="ghost" disabled={!fedSel.length} onClick={() => setFedSel([])}>پاک کردن</Button>
                </div>
                {fc?.error && <div className="bgv-banner bgv-banner--danger gp-fedwarn" role="status"><div className="bgv-banner__body">
                  <b className="bgv-banner__title">{tf('این فدراسیون ساخته نمی‌شود')}</b>{tf(FED_FA[fc.error]?.(fc.value, fc.need) ?? fc.error)}</div></div>}
              </div>}
              {facPrompt}
              {options.length > 0 && <div className="gp-btnrow">{options.map(({ a, cost, reason: why, img, note }, k) => <span key={k} className="gp-mainbtn">
                <Button size="sm" variant="secondary" data-option={why ? undefined : a.type} data-reason={why ? reasonOf(a) : undefined} title={why} disabled={busy || !!why}
                  className={`${a.type === 'pass' ? 'gp-pass-pick' : ''}${img ? ' gp-optbtn' : ''}${hint(a) ? ' gp-hint' : ''}`} onClick={() => add(a)}>{img && <img className="gp-optimg" src={img} alt="" />}{optionFa(a)}{note && <small className="gp-optnote">{note}</small>}{cost && <CostPill g={cost} />}</Button>
                {why && <small className="gp-reason">{why}</small>}</span>)}</div>}
              <div className="gp-btnrow">
                <Button size="sm" className={`gp-confirm${canConfirm && expected && draft.some((a) => same(expected, a)) ? ' gp-hint' : ''}`} disabled={!canConfirm || busy} onClick={confirm}>{t('confirm')}</Button>
                <Button size="sm" variant="secondary" className="gp-undo" disabled={!draft.length && !mode && hexSel === null} onClick={back}>{t('back')}</Button>
                <Button size="sm" variant="ghost" disabled={!draft.length && !mode} onClick={cancel}>{t('cancel')}</Button>
              </div>
            </div>
          )}
          {drafting && view.phase === 'actions' && !hasMain && !onlyFree && !mode && hexSel === null && !myDecision && (
            <div className="gp-main">
              {MAIN.map((m) => {
                const why = reasons[m.kind] ?? null;
                const ok = !why;
                return <span key={m.kind} className="gp-mainbtn">
                  <Button size="sm" variant="secondary" data-move={m.kind} data-reason={why?.code} disabled={!ok || busy} title={why?.text}
                    className={expected?.type === m.kind ? 'gp-hint' : undefined} onClick={() => startMain(m.kind)}>{t(m.label)}{m.cost && <CostPill g={m.cost} plus={m.kind === 'mine'} />}</Button>
                  {why && <small className="gp-reason">{why.text}</small>}
                </span>;
              })}
              <span className="gp-spacer" />
              <Button size="sm" variant="secondary" className={`gp-pass${expected?.type === 'pass' ? ' gp-hint' : ''}`} data-move="pass" disabled={!actionsTurn || busy} onClick={() => startMain('pass')}>{t('pass')}</Button>
            </div>
          )}
          {drafting && view.phase === 'actions' && (!hasMain || heldNow) && !mode && !myDecision && convs.length > 0 && (
            <div className="gp-free" aria-label={t('free')}>
              <small>{t('free')}</small>
              {brainChoice && <button type="button" className="gp-chipbtn" aria-pressed={brainSpend} title={`${tx(terms.brainStone)} ۳ ${tf('قدرت ارزش دارد و به کاسهٔ I برمی‌گردد')}`} onClick={() => setBrainSpend(!brainSpend)}>
                <img className="gp-ic" src={art(IDS.pieces.brainstone)} alt="" />{brainSpend ? `${tx(terms.brainStone)} خرج می‌شود` : `${tx(terms.brainStone)} نگه داشته می‌شود`}</button>}
              {convs.map((a) => {
                const ok = legal.some((x) => same(x, a));
                return <button key={a.type === 'burn' ? 'burn' : String(a.id)} type="button" className={`gp-chipbtn${hint(a) ? ' gp-hint' : ''}`} data-move={a.type} data-reason={ok ? undefined : reasonOf(a)}
                  title={ok ? undefined : REASON_FA[reasonOf(a)]} disabled={busy || !ok} onClick={() => add(a)}>{a.type === 'burn' ? t('burn') : CONV_FA[a.id as string] ?? convFa(a.id as string)}</button>;
              })}
            </div>
          )}
          {drafting && view.phase === 'actions' && !hasMain && !mode && <p className="gp-hintline">{t('hint')}</p>}
        </div>
      )}
    </div>
  );

  const facOpen = legal.filter((a) => a.type === 'faction');
  const facDraft = draft.find((a) => a.type === 'faction');
  const facPick = drafting && view.phase === 'faction' && (
    <section className="gp-zone gp-factions" aria-label={t('pickFaction')}>
      <p className="gp-factions__say"><b>{who(mySeat!)}</b>{tf('، جناحتان را انتخاب کنید (به ترتیب نوبت).')}</p>
      <div className="gp-facgrid">
        {Object.values(CONTENT.factions).sort((a, b) => WHEEL.indexOf(a.home) - WHEEL.indexOf(b.home)).map((f) => {
          const a = facOpen.find((x) => x.faction === f.id);
          const owner = served.pl.findIndex((p) => p.faction === f.id);
          const picked = facDraft?.faction === f.id;
          const status = picked ? 'انتخاب شما' : owner >= 0 ? who(owner) : a ? 'آزاد' : 'هم‌رنگش گرفته شد';
          const body = <>
            <img className="gp-faccard__art" src={art(FACTIONS[f.id]?.board ?? '')} srcSet={srcSet(FACTIONS[f.id]?.board ?? '', FB.w)} sizes="(max-width: 760px) 45vw, 20vw" width={FB.w} height={FB.h} alt="" loading="eager" decoding="async" />
            <strong>{lang === 'en' ? FACTIONS[f.id]?.nameEn : factionFa(f.id)}</strong><small>{status}</small>
            <Tip title={factionFa(f.id)} text={<>{tf(f.abilityFa)}<br />{tf('مؤسسه')}: {tf(f.piFa)}</>} />
          </>;
          return a && !facDraft
            ? <button key={f.id} type="button" className={`gp-faccard gp-faction-pick${hint(a) ? ' gp-hint' : ''}`} data-faction={f.id} data-pick="selectable" aria-label={`انتخاب ${factionFa(f.id)}`} disabled={busy} onClick={() => add(a)}>{body}</button>
            : <span key={f.id} className="gp-faccard" data-faction={f.id} tabIndex={0} data-pick={picked ? 'picked' : a ? undefined : 'dim'}>{body}</span>;
        })}
      </div>
      <div className="gp-btnrow">
        {facDraft ? <>
          <Button size="sm" className="gp-faction-ok" disabled={busy} onClick={confirm}>ثبت {factionFa(String(facDraft.faction))}</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={cancel}>{t('back')}</Button>
        </> : <Button size="sm" variant="secondary" disabled={busy || !facOpen.length} onClick={() => add(facOpen[Math.floor(Math.random() * facOpen.length)]!)}>تصادفی</Button>}
      </div>
    </section>
  );

  const seats = view.pl.flatMap((p, s) => (p.faction ? [s] : []));
  // Map aspect (same box as SpaceMap) so research board and map get the same height side by side.
  const mapAspect = (() => {
    const xs = view.hexes.map((h) => HX * h.q), ys = view.hexes.map((h) => HY * (h.r + h.q / 2));
    return (Math.max(...xs) - Math.min(...xs) + HW) / (Math.max(...ys) - Math.min(...ys) + HY);
  })();
  const shown = boardSeat !== null && seats.includes(boardSeat) ? boardSeat : mySeat !== null && seats.includes(mySeat) ? mySeat : seats[0];
  const tabOrder = mySeat !== null && seats.includes(mySeat) ? [mySeat, ...seats.filter((s) => s !== mySeat)] : seats;

  return (
    <div className="gp" onFocus={showTip} onKeyDown={(e) => { if (e.key === 'Escape') { (document.activeElement as HTMLElement | null)?.blur?.(); dock.current?.firstElementChild?.replaceChildren(); } }} data-seq={served.seq} data-round={view.round} data-phase={view.phase} data-turn={sending ? 'sending' : onlyFree && !draft.length ? 'held' : drafting ? 'draft' : myDecision ? 'decide' : 'wait'} data-tab={tab} lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="gp-bottom">
        {phone && <div className="gp-zoomdock" ref={dock} role="dialog" aria-label="بزرگ‌نمایی"><div className="gp-zoomdock__body" style={{ display: 'contents' }} />
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="بستن" onClick={() => dock.current?.firstElementChild?.replaceChildren()}>✕</button></div>}
        {mySeat !== null && bar}
      </div>
      {phone && <div className="gp-phonestatus"><span className="gp-shellclock" data-shell-clock />
        {view.phase === 'actions' && <FeltPlate label={t('round')} value={`${fa(view.round)} ${t('of6')}`} />}</div>}
      {phone && <div className="gp-pchips bgv-hscroll" aria-label="بازیکن‌ها" data-gp-pchips data-theme={pageTheme}>
        {view.pl.map((pl, s) => (view.active[s] || pl.faction) && <PlayerCard key={s} variant="mini" name={<bdi>{seatName(s)}</bdi>} initials={seatName(s).charAt(0)} seat={(s + 1) as ComponentProps<typeof PlayerCard>['seat']}
          you={s === mySeat} turn={s === turnSeat && !view.outcome} score={pl.vp} scoreLabel={tx(terms.vp)}
          foot={<span className="gp-pchip__lines"><span>{pl.faction ? (lang === 'en' ? FACTIONS[pl.faction]?.nameEn : factionFa(pl.faction)) : tf('بدون جناح')}</span>
            <span>{!view.active[s] ? 'خارج شد' : s === turnSeat && !view.outcome ? 'نوبت' : pl.passed && view.phase === 'actions' ? tf('پاس داده') : 'منتظر'}</span></span>}
          onClick={() => { if (pl.faction) { setBoardSeat(s); setTab('board'); } }} />)}
      </div>}
      {view.outcome && <Breakdown view={view} who={who} />}
      <nav className="gp-tabs" hidden={phone && !!facPick} role="tablist" aria-label="صفحه‌ها">
        {(['map', 'research', 'scoring', 'board'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(k === 'map' ? 'map' : k === 'research' ? 'tracks' : k === 'scoring' ? 'scoring' : 'mine2')}</button>)}
      </nav>
      {facPick}
      {!(phone && facPick) && (!phone || tab === 'research' || tab === 'map') && <section className="gp-zone gp-top" style={phone ? undefined : { gridTemplateColumns: `minmax(0, ${RB.w / RB.h}fr) minmax(0, ${mapAspect}fr)` }}>
        {(!phone || tab === 'research') && <div data-zone="research"><ResearchBoard c={c} /></div>}
        {(!phone || tab === 'map') && <div data-zone="map"><SpaceMap c={c} /></div>}
      </section>}
      {!(phone && facPick) && shown !== undefined && (!phone || tab === 'board') && (
        <section className="gp-zone" data-zone="board">
          {phone ? <>
            <div className="gp-ptabs" role="tablist" aria-label="صفحهٔ بازیکن‌ها">
              {tabOrder.map((s) => <button key={s} type="button" role="tab" aria-selected={s === shown} onClick={() => setBoardSeat(s)}><i className={`bgv-seat seat-${s + 1}`} /><bdi>{seatName(s)}</bdi>{s === mySeat ? `، ${t('you')}` : ''}</button>)}
            </div>
            <FactionBoardView c={c} seat={shown} />
          </> : <div className="gp-pboards">
            {tabOrder.map((s) => <article key={s} className="gp-pb" data-seat={s}>
              <header className="gp-pb__head"><i className={`bgv-seat seat-${s + 1}`} /><b><bdi>{seatName(s)}</bdi></b>{s === mySeat && <span className="bgv-badge bgv-badge--sm">{t('you')}</span>}
                <span className="bgv-sep" /><span>{lang === 'en' ? FACTIONS[view.pl[s]!.faction!]?.nameEn : factionFa(view.pl[s]!.faction!)}</span></header>
              <FactionBoardView c={c} seat={s} />
            </article>)}
          </div>}
        </section>
      )}
      {!(phone && facPick) && (!phone || tab === 'scoring') && <section className="gp-zone gp-split--even" data-zone="scoring">
        <ScoringBoard c={c} />
        <FedSupply c={c} />
      </section>}
    </div>
  );
}

/** End of game (Gaia-Prompts 10, inside the DS Table-Result): game points, final tiles, research (levels 3 to 5),
 *  resources (each 3), total. Ties share the rank (same total). */
function Breakdown({ view, who }: { view: GaiaView; who: (s: number) => string }) {
  useTermsLang();
  const seats = view.pl.flatMap((p, s) => (p.faction ? [s] : []));
  const order = [...seats].sort((a, b) => view.pl[b]!.vp - view.pl[a]!.vp);
  const by = (s: number, k: string) => view.pl[s]!.vpBy?.[k] ?? 0;
  const sign = (n: number) => (n > 0 ? `+${fa(n)}` : fa(n));
  return (
    <section className="gp-zone gp-result" aria-label="نتیجهٔ پایانی تفکیکی">
      <h3>نتیجهٔ پایانی تفکیکی</h3>
      <div className="gp-result__scroll"><table className="bgv-table">
        <thead><tr><th>رتبه</th><th>بازیکن</th><th>{tf('امتیاز بازی')}</th><th>{tf('کاشی‌های پایانی')}</th><th>{tf('پژوهش (۳ تا ۵)')}</th><th>منابع (هر ۳)</th><th>جمع</th></tr></thead>
        <tbody>{order.map((s) => {
          const p = view.pl[s]!;
          const fin = by(s, 'final'), res = by(s, 'research'), left = by(s, 'resources');
          const rank = 1 + seats.filter((o) => view.pl[o]!.vp > p.vp).length;
          return <tr key={s} className={s === order[0] ? 'is-top' : undefined}><td><b>{fa(rank)}</b></td>
            <td><i className={`bgv-seat seat-${s + 1}`} /> {who(s)} <small>{factionFa(p.faction!)}</small></td>
            <td>{fa(p.vp - fin - res - left)}</td><td>{sign(fin)}</td><td>{sign(res)}</td><td>{sign(left)}</td><td><b>{fa(p.vp)}</b></td></tr>;
        })}</tbody>
      </table></div>
      <p className="gp-note">{tf('کاشی‌های پایانی ۱۸، ۱۲ و ۶ امتیاز؛ تساوی جمع رتبه‌ها را تقسیم می‌کند. در بازی دونفره بازیکن خنثی هم در رتبه‌بندی کاشی‌ها هست.')}</p>
    </section>
  );
}
