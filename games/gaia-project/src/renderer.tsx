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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, fa, useFlip, type GameAction, type GameRendererProps } from '@bg/ui';
import {
  BUILDING_FA, BUILD_COST, CONTENT, POWER_ACTIONS, RESEARCH_COST, RES_FA, BASE_CONVERSIONS, TRACKS, TRACK_FA, buildMap, gaiaProjectModule, minePlan,
  type Building, type Gain, type GaiaAction, type GaiaState, type GaiaView, type Track
} from './rules.ts';
import LAYOUT from './design/layout.json' with { type: 'json' };
import IDS from './design/content-id-map.json' with { type: 'json' };

// ---------------- art ----------------

const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
/** Web URL of a file under art/ (paths as in content-id-map.json, e.g. `art/boards/research-board.webp`). */
const art = (path: string) => ART[`./${path}`] ?? '';
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
const techFa = (id: string) => CONTENT.techs[id]?.labelFa ?? id;
const boosterFa = (id: string) => CONTENT.boosters[id]?.labelFa ?? id;
const fedFa = (id: string) => CONTENT.feds[id]?.labelFa ?? id;
const factionFa = (id: string) => CONTENT.factions[id]?.nameFa ?? id;
const CONV_FA: Record<string, string> = Object.fromEntries([...BASE_CONVERSIONS, ...Object.values(CONTENT.factions).flatMap((f) => f.effects?.conversions ?? [])]
  .map((c) => [c.id, c.labelFa]));
const CHOICE_FA: Record<string, string> = {
  accept: 'پذیرفتن', decline: 'رد کردن', 'token-first': 'اول ژتون، بعد شارژ', 'charge-first': 'اول شارژ، بعد ژتون',
  yes: 'بله', no: 'نه', done: 'تمام', q: '۱ QIC', k: '۱ دانش', o: '۱ سنگ معدن', c: '۱ اعتبار'
};
/** Engine error codes → short reason under a disabled button (COMPONENTS.md 8.7). */
const REASON_FA: Record<string, string> = {
  NOT_ENOUGH_RESOURCES: 'منابع کافی ندارید', NO_PIECES: 'سازهٔ آزاد ندارید', ILLEGAL_PLACEMENT: 'خانهٔ مجازی در برد شما نیست',
  CELL_OCCUPIED: 'خانه پر است', GAIA_NOT_READY: 'گایاساز آزاد ندارید', RESEARCH_BLOCKED: 'هیچ مسیری جا ندارد', FEDERATION_INVALID: 'فدراسیون ممکنی ندارید',
  TOKEN_UNAVAILABLE: 'توکن فدراسیون نمانده', ACTION_TAKEN: 'این دور گرفته شده', ILLEGAL_CHOICE: 'ممکن نیست', WRONG_PHASE: 'الان ممکن نیست', NOT_YOUR_TURN: 'نوبت شما نیست'
};
const REASON_ORDER = ['NOT_ENOUGH_RESOURCES', 'NO_PIECES', 'GAIA_NOT_READY', 'RESEARCH_BLOCKED', 'TOKEN_UNAVAILABLE', 'FEDERATION_INVALID', 'CELL_OCCUPIED', 'ILLEGAL_PLACEMENT', 'ACTION_TAKEN', 'ILLEGAL_CHOICE', 'WRONG_PHASE'];

function specialFa(key: string): string {
  if (key === 'ac2') return 'اقدام آکادمی QIC';
  const [kind, id] = key.split(':') as [string, string];
  if (kind === 'faction') return `${factionFa(id)}: ${CONTENT.factions[id]?.effects?.action?.labelFa ?? key}`;
  if (kind === 'booster') return `بوستر: ${CONTENT.boosters[id]?.effects?.action?.labelFa ?? key}`;
  if (kind === 'tech') return `فناوری: ${CONTENT.techs[id]?.effects.action?.labelFa ?? key}`;
  return key;
}

function decisionTitle(view: GaiaView, who: (s: number) => string): string {
  const d = view.decision!;
  switch (d.kind) {
    case 'leech': return `${who(d.from)} کنار ${who(d.seat)} ساخت: ${fa(d.amount)} قدرت شارژ؟ هزینه یک امتیاز کمتر از قدرت شارژشده`;
    case 'tech': return `${who(d.seat)}: یک کاشی فناوری انتخاب کنید`;
    case 'cover': return `${who(d.seat)}: یک کاشی فناوری استاندارد را زیر ${techFa(d.adv)} بپوشانید`;
    case 'research': return `${who(d.seat)}: یک گام پژوهش رایگان`;
    case 'lostPlanet': return `${who(d.seat)}: جای سیارهٔ گمشده را روی نقشه انتخاب کنید`;
    case 'custom': return `${who(d.seat)}: ${d.labelFa}`;
  }
}

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
    case 'faction': return `جناح ${factionFa(a.faction as string)}`;
    case 'place': return 'سازهٔ شروع';
    case 'booster': return `بوستر: ${boosterFa(a.booster as string)}`;
    case 'mine': return 'ساخت معدن';
    case 'upgrade': return `ارتقا به ${BUILDING_FA[a.to as Building]}`;
    case 'gaiaform': return 'پروژهٔ گایا';
    case 'federation': return `فدراسیون: ${fedFa(a.token as string)}`;
    case 'research': return `پژوهش: ${TRACK_FA[a.track as Track]}`;
    case 'power': { const pa = POWER_ACTIONS.find((x) => x.id === a.id); return pa ? `${gainFa(pa.cost)}: ${pa.labelFa}` : String(a.id); }
    case 'special': return specialFa(a.id as string);
    case 'pass': return a.booster ? `پاس، ${boosterFa(a.booster as string)}` : 'پاس';
    case 'convert': return CONV_FA[a.id as string] ?? convFa(a.id as string);
    case 'burn': return 'سوزاندن قدرت';
    case 'decide': return choiceFa(view, a.choice as string);
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
  const { decision, income, ...rest } = structuredClone(v);
  void decision; void income;
  return { ...rest, ins: 0, turnDone: false } as GaiaState;
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
    ...(faction ? { sub: <span className="gp-panel__faction" data-faction={fid}><img className="gp-planet" src={art(`art/planet-art/planet-${COLORS[faction.home]}.webp`)} alt="" />{faction.nameFa}</span> } : {}),
    score: <span className="gp-side">
      <span className="gp-vp" title="امتیاز" data-vp={seat.primary?.value ?? 0}><b>{fa(seat.primary?.value ?? 0)}</b></span>
      {seat.turnOrder !== undefined && <span className={turn ? 'gp-order is-turn' : 'gp-order'} title="ترتیب نوبت در این دور">{fa(seat.turnOrder)}</span>}
    </span>,
    detail: <div className="gp-panel">
      <div className="gp-panel__res">
        {PANEL_RES.map(([k, label]) => <span key={k} className="gp-r" title={label} data-res={k}>
          <span><img className="gp-ic" src={RES_ICON[k]} alt="" />{fa(stat(k))}</span>
          {inc && <small>{plus(inc[k])}</small>}
        </span>)}
      </div>
      {pow && <div className="gp-panel__pow" title="چرخهٔ قدرت: ناحیهٔ گایا و کاسه‌های I، II، III">
        {PANEL_BOWLS.map(([k, label]) => <span key={k} data-bowl={k} className={`gp-bowl${k === 'gaia' ? ' gp-bowl--g' : ''}${k === 'b3' && (pow[k] ?? 0) >= POWER_READY ? ' is-ready' : ''}`}><i>{label}</i><b>{fa(pow[k] ?? 0)}</b></span>)}
      </div>}
      {inc && <div className="gp-panel__inc"><img className="gp-ic" src={RES_ICON.pw} alt="" />شارژ قدرت <b>{plus(inc.pwCharge)}</b><span>ژتون قدرت <b>{plus(inc.pwTokens)}</b></span></div>}
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
}

const M = LAYOUT.map;
const HX = M.sector.hex.colPitch, HY = M.sector.hex.h, HW = M.sector.hex.w;
const [SCX, SCY] = M.hexCentresInSector[9] as [number, number];
const CORNERS = [[HW / 2, 0], [HW / 4, HY / 2], [-HW / 4, HY / 2], [-HW / 2, 0], [-HW / 4, -HY / 2], [HW / 4, -HY / 2]] as const;
const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;

/** Space map (COMPONENTS.md §3): sector art on the hex grid, outer sector strokes, pieces, selectable hexes. */
function SpaceMap({ c }: { c: Ctx }) {
  const { view } = c;
  const [zoom, setZoom] = useState(1);
  const xy = (h: { q: number; r: number }) => ({ x: HX * h.q, y: HY * (h.r + h.q / 2) });
  const cs = view.hexes.map(xy);
  const minX = Math.min(...cs.map((p) => p.x)) - HW / 2, maxX = Math.max(...cs.map((p) => p.x)) + HW / 2;
  const minY = Math.min(...cs.map((p) => p.y)) - HY / 2, maxY = Math.max(...cs.map((p) => p.y)) + HY / 2;
  const W = maxX - minX, H = maxY - minY;
  const P = (p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY });
  const scale = (pct: number) => (pct * M.frame.w) / W; // layout widths are % of the 4-player frame
  const original = buildMap(view.placements);
  const idx = new Map(view.hexes.map((h, i) => [`${h.q},${h.r}`, i]));
  const outline = view.hexes.flatMap((h, i) => NB.flatMap(([dq, dr], k) => {
    const j = idx.get(`${h.q + dq},${h.r + dr}`);
    if (j !== undefined && view.hexes[j]!.sector === h.sector) return [];
    const p = P(cs[i]!), a = CORNERS[k]!, b = CORNERS[(k + 1) % 6]!;
    return [`M${p.x + a[0]},${p.y + a[1]}L${p.x + b[0]},${p.y + b[1]}`];
  })).join('');
  const sw = (b: Building) => scale(b === 'station' ? M.pieceWidthPct.GF * 0.8 : (M.pieceWidthPct as Record<string, number>)[STRUCT[b]] ?? 6);

  return (
    <div className="gp-mapbox" data-gp-board="map">
      <div className="gp-zoom" role="group" aria-label="بزرگ‌نمایی نقشه">
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="بزرگ‌تر" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>+</button>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="کوچک‌تر" onClick={() => setZoom((z) => Math.max(1, z - 0.25))}>−</button>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label="جا شدن" onClick={() => setZoom(1)}>⤢</button>
      </div>
      <div className="gp-mapscroll" dir="ltr">
        <div className="gp-map" role="group" aria-label="نقشهٔ فضا" style={{ aspectRatio: `${W} / ${H}`, width: `${zoom * 100}%` }}>
          {view.placements.map((p) => {
            const n = p.sector.replace(/[AB]/, '');
            const back = p.sector.endsWith('B');
            const o = P(xy({ q: p.center[0], r: p.center[1] }));
            return <img key={p.sector} className="gp-sector" src={art(`art/space-sectors/sector-${n}${back ? 'outlined' : ''}.webp`)} alt="" draggable={false}
              style={{ left: `${((o.x - SCX) / W) * 100}%`, top: `${((o.y - SCY) / H) * 100}%`, width: `${(M.sector.w / W) * 100}%`,
                transformOrigin: `${(SCX / M.sector.w) * 100}% ${(SCY / M.sector.h) * 100}%`, transform: `rotate(${60 * p.rotation}deg)` }} />;
          })}
          <svg className="gp-outline" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={outline} /></svg>
          {view.hexes.map((h, i) => {
            const p = P(cs[i]!);
            const pieces: ReactNode[] = [];
            if (h.planet === 'g' && original[i]?.planet === 'm') pieces.push(<img key="gt" className="gp-at gp-piece" data-gp-piece="token" data-hex={i} src={art(IDS.pieces.gaiaPlanetToken)} alt="" style={at(p.x, p.y, W, H, scale(4.6))} />);
            if (h.planet === 'l') pieces.push(<img key="lost" className="gp-at gp-piece" data-gp-piece="lost" data-hex={i} src={art(IDS.pieces.lostPlanet)} alt="سیارهٔ گمشده" style={at(p.x, p.y, W, H, scale(4.6))} />);
            if (h.building && h.owner !== null) {
              const own = h.owner === c.me && h.building !== 'gf';
              pieces.push(<img key="b" data-flip={`st-${i}-${h.building}`} className={`gp-at gp-piece${own ? ' gp-piece--own' : ''}`} data-gp-piece={h.building === 'gf' ? 'GF' : STRUCT[h.building]} data-hex={i} data-seat={h.owner}
                src={structArt(h.building, colorOf(view, h.owner))} alt={`${BUILDING_FA[h.building]} ${c.who(h.owner)}`} title={`${c.who(h.owner)}: ${BUILDING_FA[h.building]}`}
                style={{ ...at(p.x, p.y, W, H, sw(h.building)), ...(own ? { '--own': OWN[colorOf(view, h.owner)] } : {}) } as CSSProperties} />);
            }
            if (h.extra !== null) pieces.push(<img key="x" data-flip={`ex-${i}`} className={`gp-at gp-piece${h.extra === c.me ? ' gp-piece--own' : ''}`} data-gp-piece="MI" data-hex={i} data-seat={h.extra}
              src={structArt('mine', colorOf(view, h.extra))} alt={`معدن ${c.who(h.extra)}`} title={`${c.who(h.extra)}: معدن`} style={{ ...at(p.x + 42, p.y - 34, W, H, sw('mine') * 0.7), '--own': OWN[colorOf(view, h.extra)] } as CSSProperties} />);
            h.sats.forEach((s, k) => pieces.push(<img key={`s${s}`} data-flip={`sat-${i}-${s}`} className="gp-at gp-piece" data-gp-piece="sat" data-hex={i} data-seat={s}
              src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt={`ماهوارهٔ ${c.who(s)}`} title={`ماهوارهٔ ${c.who(s)}`} style={at(p.x - 30 + k * 30, p.y + (k % 2) * 20, W, H, scale(3.2))} />));
            const acts = c.pickHex.get(i);
            const picked = c.pickedHex === i;
            const hinted = c.expectedHex === i;
            const label = `${h.planet === 'e' ? 'فضای خالی' : h.planet}، بخش ${fa(h.sector)}${h.building && h.owner !== null ? `، ${BUILDING_FA[h.building]} ${c.who(h.owner)}` : ''}`;
            const cost = acts && !picked ? c.costOf(i) : null;
            return [
              ...pieces,
              acts || picked ? <button key="h" type="button" className={`gp-hex${hinted ? ' gp-hex--hint' : ''}`} data-pick={picked ? 'picked' : 'selectable'} aria-pressed={picked} data-hex={i}
                aria-label={label} style={{ ...at(p.x, p.y, W, H, (HW / W) * 100), height: `${(HY / H) * 100}%` }} onClick={() => c.onHex(i)}>{picked && <span className="gp-check" aria-hidden="true">✓</span>}</button>
                : hinted ? <span key="h" className="gp-hex gp-hex--hint" aria-hidden="true" style={{ ...at(p.x, p.y, W, H, (HW / W) * 100), height: `${(HY / H) * 100}%` }} /> : null,
              cost ? <span key="t" className="gp-at gp-tag" style={at(p.x, p.y + HY * 0.42, W, H, scale(6))}><CostPill g={cost} /></span> : null
            ];
          })}
        </div>
      </div>
    </div>
  );
}

const RB = LAYOUT.researchBoard;
const SB = LAYOUT.scoringBoard;
const FB = LAYOUT.factionBoard;
const CLUSTER = RB.playerMarker.cluster.offsets as Record<string, number[][]>;

/** Research board (§4) with the federation supply under it. */
function ResearchBoard({ c }: { c: Ctx }) {
  const { view } = c;
  const W = RB.w, H = RB.h;
  const tile = (id: string | null, x: number, y: number, w: number, kind: 'adv' | 'std', slot: number) => {
    if (!id) return null;
    const a = c.legal.find((x) => x.type === 'decide' && x.choice === id);
    const style = at(x, y, W, H, w);
    const img = <img src={techArt(id)} alt={techFa(id)} draggable={false} />;
    return a ? <button key={id} type="button" className={`gp-at gp-tile${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-gp-piece={kind} data-id={id} data-slot={slot} title={techFa(id)} style={style} onClick={() => c.tryAct(a)}>{img}</button>
      : <span key={id} className="gp-at gp-tile gp-zoomable" tabIndex={0} data-gp-piece={kind} data-id={id} data-slot={slot} title={techFa(id)} style={style}>{img}</span>;
  };
  const markers = TRACKS.flatMap((t, ti) => [0, 1, 2, 3, 4, 5].flatMap((lvl) => {
    const seats = view.pl.flatMap((p, s) => (p.faction && p.research[t] === lvl ? [s] : []));
    const off = CLUSTER[String(Math.min(4, seats.length))] ?? [[0, 0]];
    return seats.map((s, k) => {
      const [ox, oy] = off[k % off.length] as [number, number];
      const x = 15 + 298 * ti + 80 + ox * RB.playerMarker.cluster.pitchX, y = (RB.playerMarker.levelMidY as Record<string, number>)[String(lvl)]! + oy * RB.playerMarker.cluster.pitchY;
      return <img key={`${t}-${s}`} data-flip={`rs-${s}-${t}`} className="gp-at gp-piece" data-gp-piece="sat" data-track={ti} data-level={lvl} data-seat={s} title={`${c.who(s)}: ${TRACK_FA[t]} ${fa(lvl)}`}
        src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" style={at(x, y, W, H, RB.playerMarker.widthPct)} />;
    });
  }));
  // Research step targets: the next level cell of each track (main action or free research decision).
  const steps = TRACKS.map((t, ti) => {
    const a = c.legal.find((x) => (x.type === 'research' && x.track === t) || (x.type === 'decide' && view.decision?.kind === 'research' && x.choice === t));
    if (!a || c.me === null) return null;
    const lvl = Math.min(5, (view.pl[c.me]?.research[t] ?? 0) + 1);
    return <button key={t} type="button" className={`gp-at gp-step-target${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-move="research" data-track={ti} aria-label={`${TRACK_FA[t]} سطح ${fa(lvl)}`}
      style={{ ...at(15 + 298 * ti + 149, (RB.playerMarker.levelMidY as Record<string, number>)[String(lvl)]!, W, H, 14), height: '6%' }} onClick={() => c.tryAct(a)} />;
  });
  const action = (id: string, x: number, y: number, bw: number, bh: number, used: number) => {
    const list = c.legal.filter((a) => a.type === 'power' && a.id === id);
    const pa = POWER_ACTIONS.find((p) => p.id === id);
    const taken = view.powerUsed.includes(id);
    const hint = list.some(c.hint);
    return (
      <span key={id}>
        <button type="button" className={`gp-at gp-act${list.length ? ' is-avail' : ''}${hint ? ' gp-hint' : ''}`} data-gp-action={id} disabled={!list.length}
          aria-label={pa ? `${gainFa(pa.cost)}: ${pa.labelFa}${taken ? ' (گرفته‌شده)' : ''}` : id} title={pa ? `${gainFa(pa.cost)} ← ${pa.labelFa}، هر دور یک بار` : id}
          style={{ ...at(x, y, W, H, bw), height: `${bh}%` }} onClick={() => list.length && c.tryAct(list[0]!)} />
        {taken && <img className="gp-at gp-piece" data-gp-piece="token" data-id={id} src={art(IDS.pieces.actionToken)} alt="" style={at(x, y, W, H, used)} />}
      </span>
    );
  };
  return (
    <div className="gp-col">
      <div className="gp-board" data-gp-board="research" style={{ aspectRatio: `${W} / ${H}` }}>
        <img className="gp-board__img" src={art(IDS.boards.research)} alt="صفحهٔ پژوهش" draggable={false} />
        {view.techBoard.adv.map((id, i) => { const [x, y] = RB.advancedTech.centres[i] as [number, number]; return tile(id, x, y, RB.advancedTech.widthPct, 'adv', i); })}
        {view.techBoard.std.map((id, i) => {
          const [x, y] = (i < 6 ? RB.standardTech.centres[i] : RB.standardTechBottom.centres[i - 6]) as [number, number];
          return tile(id, x, y, RB.standardTech.widthPct, 'std', i);
        })}
        {view.terraFed && <img className="gp-at gp-piece" data-gp-piece="fed" data-id={view.terraFed} src={fedArt(view.terraFed)} alt={fedFa(view.terraFed)} title={fedFa(view.terraFed)} style={at(95, 75, W, H, 7)} />}
        {markers}
        {steps}
        {RB.powerActions.ids.map((id, i) => { const [x, y] = RB.powerActions.centres[i] as [number, number]; return action(id, x, y, RB.powerActions.buttonPct.w, RB.powerActions.buttonPct.h, RB.powerActions.usedTokenWidthPct); })}
        {RB.qicActions.ids.map((id, i) => { const [x, y] = RB.qicActions.centres[i] as [number, number]; return action(id, x, y, RB.qicActions.buttonPct.w, RB.qicActions.buttonPct.h, RB.qicActions.usedTokenWidthPct); })}
      </div>
      <ul className="gp-fedsupply" data-gp-board="fedsupply" aria-label="ذخیرهٔ توکن‌های فدراسیون">
        {Object.entries(view.fedSupply).map(([id, n]) => {
          const a = c.legal.find((x) => x.type === 'federation' && x.token === id && c.pickHex.size === 0);
          return (
            <li key={id} className={n ? undefined : 'is-empty'} data-gp-piece="fed" data-id={id} title={fedFa(id)}>
              <img src={fedArt(id)} alt={fedFa(id)} draggable={false} className={a ? 'is-avail' : undefined} />
              <small>×{fa(n)}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Scoring board (§5) and the booster row (§6). */
function ScoringBoard({ c }: { c: Ctx }) {
  const { view, state } = c;
  const W = SB.w, H = SB.h;
  const seats = view.pl.flatMap((p, s) => (p.faction ? [s] : []));
  const counters = Object.entries(SB.planetCounters.centres).flatMap(([color, [x, y]]) => {
    const code = color === 'gaia' ? 'g' : Object.keys(COLORS).find((k) => COLORS[k] === color);
    const list = seats.map((s) => ({ s, n: view.hexes.filter((h) => h.planet === code && (h.owner === s || h.extra === s) && h.building !== 'gf' && h.building !== 'station').length })).filter((e) => e.n > 0);
    return list.map(({ s, n }, k) => (
      <span key={`${color}-${s}`} className="gp-at gp-cnt" data-gp-piece="cnt" data-seat={s} data-id={color} title={`${c.who(s)}: ${fa(n)}`} style={at(x! + (k - (list.length - 1) / 2) * 70, y!, W, H, SB.planetCounters.widthPct)}>
        <img className="gp-piece" src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" /><b>{fa(n)}</b>
      </span>
    ));
  });
  const all = [...new Set([...view.boosters, ...view.pl.flatMap((p) => (p.booster ? [p.booster] : []))])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return (
    <div className="gp-col">
      <div className="gp-board" data-gp-board="scoring" style={{ aspectRatio: `${W} / ${H}` }}>
        <img className="gp-board__img" src={art(IDS.boards.scoring)} alt="صفحهٔ امتیاز" draggable={false} />
        {view.roundTiles.map((id, i) => {
          const [x, y, rot] = SB.roundTiles.centres[i] as [number, number, number];
          const played = i + 1 < view.round && view.phase !== 'faction' && view.phase !== 'setup' && view.phase !== 'booster';
          return <img key={id + i} className="gp-at gp-zoomable" tabIndex={0} data-gp-piece="rnd" data-id={id} data-slot={i} src={art(played ? IDS.roundScoring.back : (IDS.roundScoring as Record<string, string>)[id] ?? '')}
            alt={CONTENT.rounds[id]?.labelFa ?? id} title={`دور ${fa(i + 1)}: ${CONTENT.rounds[id]?.labelFa ?? id}`} style={at(x, y, W, H, SB.roundTiles.widthPct, rot)} />;
        })}
        {view.finalTiles.map((id, i) => {
          const [x, y] = SB.finalTiles.centres[i] as [number, number];
          return <img key={id} className="gp-at gp-zoomable" tabIndex={0} data-gp-piece="fin" data-id={id} data-slot={i} src={pick(IDS.finalScoring, id)} alt={CONTENT.finals[id]?.labelFa ?? id} title={CONTENT.finals[id]?.labelFa ?? id} style={at(x, y, W, H, SB.finalTiles.widthPct)} />;
        })}
        {view.finalTiles.flatMap((id, row) => seats.map((s, k) => {
          const v = Math.max(0, Math.min(10, CONTENT.finals[id]?.value(state, s) ?? 0));
          return <img key={`${id}-${s}`} className="gp-at gp-piece" data-gp-piece="sat" data-seat={s} data-level={v} title={`${c.who(s)}: ${fa(v)}`}
            src={art(`art/tokens-markers/satellite-${markerOf(view, s)}.webp`)} alt="" style={at(342 + 61.6 * v, (row ? 1190 : 878) + 52 * k, W, H, SB.finalTrackMarkers.widthPct)} />;
        }))}
        {counters}
      </div>
      <div className="gp-boosters" data-gp-board="boosters">
        {all.map((b) => {
          const owner = view.pl.findIndex((p) => p.booster === b);
          const a = c.legal.find((x) => (x.type === 'booster' || x.type === 'pass') && x.booster === b);
          const img = <img src={boosterArt(b)} alt={boosterFa(b)} draggable={false} />;
          return a
            ? <button key={b} type="button" className={`gp-boost ${a.type === 'pass' ? 'gp-pass-pick' : 'gp-booster-pick'}${c.hint(a) ? ' gp-hint' : ''}`} data-pick="selectable" data-gp-piece="booster" data-id={b} title={boosterFa(b)} onClick={() => c.tryAct(a)}>{img}</button>
            : <span key={b} className={`gp-boost gp-zoomable${owner >= 0 ? ' is-taken' : ''}`} tabIndex={0} data-gp-piece="booster" data-id={b} title={boosterFa(b)}>{img}
              {owner >= 0 && <span className={`bgv-avatar bgv-avatar--sm seat-${owner + 1}`} title={c.who(owner)}>{c.who(owner).charAt(0)}</span>}</span>;
        })}
      </div>
      <p className="gp-note">{view.round >= 6 ? 'دور ۶: پاس بدون بوستر.' : UI.boostersNote[0]}</p>
    </div>
  );
}

/** Faction board of one player (§7), own booster beside it, owned tiles under it. */
function FactionBoardView({ c, seat }: { c: Ctx; seat: number }) {
  const { view } = c;
  const p = view.pl[seat]!;
  const fid = p.faction!;
  const color = colorOf(view, seat);
  const W = FB.w, H = FB.h;
  const own = seat === c.me;
  const built = (b: Building[]) => view.hexes.filter((h) => h.owner === seat && b.includes(h.building!)).length + (b.includes('mine') ? view.hexes.filter((h) => h.extra === seat).length : 0);
  const slots = (Object.entries(FB.slots) as [string, { centres: number[][]; widthPct: number }][]).flatMap(([k, def]) => {
    const kinds: Building[] = k === 'MI' ? ['mine'] : k === 'TS' ? ['ts'] : k === 'RL' ? ['lab'] : k === 'PI' ? ['pi'] : ['ac1', 'ac2'];
    const b = built(kinds);
    return def.centres.slice(b).map(([x, y], i) => <img key={`${k}${i}`} className={`gp-at gp-piece gp-slot${own ? ' gp-piece--own' : ''}`} data-gp-piece={k} data-slot={b + i} data-seat={seat}
      src={structArt(kinds[0]!, color)} alt="" style={{ ...at(x!, y!, W, H, def.widthPct), ...(own ? { '--own': OWN[color] } : {}) } as CSSProperties} />);
  });
  const bowls = FB.powerBowls;
  const scatter = (n: number, [cx, cy]: number[], key: string) => Array.from({ length: n }, (_, k) => {
    const r = 26 * Math.sqrt(k), t = k * 2.4;
    return <img key={`${key}${k}`} className="gp-at gp-piece" data-gp-piece="ptok" src={art(IDS.resources.powerToken)} alt="" style={at(cx! + r * Math.cos(t), cy! + r * 0.8 * Math.sin(t), W, H, bowls.tokenWidthPct)} />;
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
          <img className="gp-board__img" src={art(FACTIONS[fid]?.board ?? '')} alt={`صفحهٔ ${factionFa(fid)}`} draggable={false} />
          {slots}
          {scatter(p.power.gaia, bowls.gaia, 'g')}{scatter(p.power.b1, bowls.I, 'a')}{scatter(p.power.b2, bowls.II, 'b')}{scatter(p.power.b3, bowls.III, 'c')}
          {brain !== null && <img className="gp-at gp-piece" data-gp-piece="ptok" data-id="brainstone" src={art(IDS.pieces.brainstone)} alt="سنگ مغز"
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
            : <span className={`gp-boost gp-zoomable${p.used.includes(`booster:${p.booster}`) ? ' is-used' : ''}`} tabIndex={0} data-gp-piece="booster" data-id={p.booster} title={boosterFa(p.booster)}><img src={boosterArt(p.booster)} alt={boosterFa(p.booster)} />
              {p.used.includes(`booster:${p.booster}`) && <img className="gp-used" src={art(IDS.pieces.actionToken)} alt="" />}</span>)}
        </div>
      </div>
      <div className="gp-owned" aria-label={UI.owned[0]}>
        {p.techs.map((t) => {
          const list = special(`tech:${t.id}`);
          const used = p.used.includes(`tech:${t.id}`);
          const img = <img src={techArt(t.id)} alt={techFa(t.id)} draggable={false} />;
          return list.length
            ? <button key={t.id} type="button" className={`gp-own is-avail${c.hint(list[0]!) ? ' gp-hint' : ''}`} data-gp-piece={CONTENT.techs[t.id]?.kind ?? 'std'} data-id={t.id} data-gp-action={`special-tech:${t.id}`} title={techFa(t.id)} onClick={() => c.tryAct(list[0]!)}>{img}</button>
            : <span key={t.id} className={`gp-own gp-zoomable${t.covered ? ' is-covered' : ''}`} tabIndex={0} data-gp-piece={CONTENT.techs[t.id]?.kind ?? 'std'} data-id={t.id} title={techFa(t.id)}>{img}{used && <img className="gp-used" src={art(IDS.pieces.actionToken)} alt="" />}</span>;
        })}
        {p.feds.map((f, k) => <span key={`${f.id}${k}`} className="gp-own gp-zoomable" tabIndex={0} data-gp-piece="fed" data-id={f.id} title={`${fedFa(f.id)}${f.green ? '' : ' (خرج‌شده)'}`}><img src={fedArt(f.id, !f.green)} alt={fedFa(f.id)} /></span>)}
        {own && orange.map((key) => {
          const list = special(key);
          return <Button key={key} size="sm" className={`gp-orange${list.some(c.hint) ? ' gp-hint' : ''}`} data-gp-action={`special-${key}`} onClick={() => c.tryAct(list[0]!)}>{specialFa(key)}</Button>;
        })}
      </div>
    </div>
  );
}

// ---------------- the table ----------------

type Mode = { kind: 'mine' | 'upgrade' | 'gaiaform' | 'federation' | 'pass' | 'research'; id?: undefined } | { kind: 'power' | 'special'; id: string };
type Tab = 'map' | 'research' | 'scoring' | 'board';

export default function GaiaProjectRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<GaiaView>) {
  const root = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Lang>(() => { try { return localStorage.getItem('gp.lang') === 'en' ? 'en' : 'fa'; } catch { return 'fa'; } });
  const t = (k: UiKey) => UI[k][lang === 'en' ? 1 : 0];
  const [draft, setDraft] = useState<GameAction[]>([]);
  const [outbox, setOutbox] = useState<GameAction[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [hexSel, setHexSel] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('map');
  const [sheet, setSheet] = useState(false);
  const [boardSeat, setBoardSeat] = useState<number | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);

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
  const drafting = mySeat !== null && !served.outcome && !served.pending.length && served.current === mySeat && legalActions.some((a) => a.type !== 'resign');
  const sim = simulate(served, mySeat, [...outbox, ...(drafting ? draft : [])]);
  const state = sim.s;
  const view = sim.n ? gaiaProjectModule.project(state, mySeat === null ? { kind: 'spectator' } : { kind: 'player', seat: mySeat }) : served;
  useEffect(() => { if (drafting && sim.n < outbox.length + draft.length) setDraft((d) => d.slice(0, Math.max(0, sim.n - outbox.length))); }, [drafting, sim.n, outbox.length, draft.length]);
  useEffect(() => { if (!drafting) { setDraft([]); setMode(null); setHexSel(null); } }, [drafting]);
  useFlip(root, `${view.seq}|${draft.length}`);

  const who = (s: number) => (s === mySeat ? t('you') : seatName(s));
  const legal = (sending ? [] : drafting
    ? gaiaProjectModule.legalActions(state, { kind: 'player', seat: mySeat! })
    : legalActions).filter((a) => a.type !== 'resign') as GameAction[];
  const myDecision = mySeat !== null && view.decision?.seat === mySeat;
  const hasMain = draft.some((a) => !FREE.has(a.type) && a.type !== 'decide');
  const canConfirm = drafting && hasMain && !myDecision;
  const actionsTurn = legal.some((a) => a.type === 'pass');
  const hint = (a: GameAction) => same(expected, a);

  const add = (a: GameAction) => {
    if (busy || sending) return;
    if (!drafting) { onAction(a); return; } // out of turn (leech) and decisions already open on the server
    setDraft((d) => [...d, a]);
    setMode(null); setHexSel(null); setSheet(false);
  };
  const back = () => { if (mode || hexSel !== null) { setMode(null); setHexSel(null); } else setDraft((d) => d.slice(0, -1)); };
  const cancel = () => { setDraft([]); setMode(null); setHexSel(null); };
  const confirm = () => { if (!canConfirm) return; setOutbox(draft); setDraft([]); setSheet(false); };

  // What a hex does in the current step.
  const ofMode = (a: GameAction) => (mode ? (mode.kind === 'power' || mode.kind === 'special' ? a.type === mode.kind && a.id === mode.id : a.type === mode.kind) : true);
  const pickHex = new Map<number, GameAction[]>();
  if (!sending && !(mode && (mode.kind === 'research' || mode.kind === 'pass' || mode.kind === 'federation'))) {
    for (const a of legal) {
      const hx = typeof a.hex === 'number' ? a.hex : a.type === 'decide' && view.decision?.kind === 'lostPlanet' ? Number(a.choice) : null;
      if (hx === null || !ofMode(a)) continue;
      if (!mode && (a.type === 'power' || a.type === 'special')) continue; // board actions start from their piece
      pickHex.set(hx, [...(pickHex.get(hx) ?? []), a]);
    }
  }
  const onHex = (i: number) => {
    const list = pickHex.get(i) ?? [];
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
    if (mySeat === null || mode?.kind !== 'mine') return null;
    const plan = minePlan(state, mySeat, i);
    return typeof plan === 'string' ? null : plan.cost;
  };
  const expectedHex = typeof expected?.hex === 'number' && !draft.length ? expected.hex : null;
  const c: Ctx = { view, state, me: mySeat, who, legal, pickHex, pickedHex: hexSel, onHex, tryAct, hint, expectedHex, costOf };

  // Main-action buttons: legal from the engine, or disabled with the engine's reason.
  const reason = (cands: GaiaAction[]) => {
    if (mySeat === null) return 'NOT_YOUR_TURN';
    const codes = cands.map((a) => gaiaProjectModule.validate(state, { kind: 'player', seat: mySeat }, a)).flatMap((r) => (r.ok ? [] : [r.errorCode]));
    return REASON_ORDER.find((x) => codes.includes(x)) ?? codes[0] ?? 'WRONG_PHASE';
  };
  const hexIds = view.hexes.map((_, i) => i);
  const MAIN: { kind: 'mine' | 'upgrade' | 'gaiaform' | 'research' | 'federation'; label: UiKey; cost?: Gain; cands: () => GaiaAction[] }[] = [
    { kind: 'mine', label: 'mine', cost: BUILD_COST.mine, cands: () => hexIds.filter((i) => view.hexes[i]!.planet !== 'e').map((hex) => ({ type: 'mine', hex })) },
    { kind: 'upgrade', label: 'upgrade', cands: () => hexIds.filter((i) => view.hexes[i]!.owner === mySeat).flatMap((hex) => (['ts', 'lab', 'pi', 'ac1', 'ac2'] as const).map((to) => ({ type: 'upgrade', hex, to }))) },
    { kind: 'research', label: 'research', cost: { k: RESEARCH_COST }, cands: () => TRACKS.map((track) => ({ type: 'research', track })) },
    { kind: 'gaiaform', label: 'gaiaform', cands: () => hexIds.filter((i) => view.hexes[i]!.planet === 'm').map((hex) => ({ type: 'gaiaform', hex })) },
    { kind: 'federation', label: 'federation', cands: () => [{ type: 'federation', hexes: [0], token: Object.keys(view.fedSupply)[0] ?? 'fed1' }] }
  ];
  const startMain = (k: 'mine' | 'upgrade' | 'gaiaform' | 'research' | 'federation' | 'pass') => {
    const list = legal.filter((a) => a.type === k);
    if (k === 'research' || k === 'federation' || k === 'pass') { if (k === 'pass' && list.length === 1) { add(list[0]!); return; } setMode({ kind: k }); if (k === 'research') setTab('research'); if (k === 'pass') setTab('scoring'); return; }
    setMode({ kind: k as 'mine' | 'upgrade' | 'gaiaform' }); setTab('map'); setSheet(false);
  };
  const convs = legal.filter((a) => a.type === 'convert' || a.type === 'burn');
  const decisions = legal.filter((a) => a.type === 'decide');
  const me = mySeat !== null ? view.pl[mySeat] : undefined;
  const leech = view.decision?.kind === 'leech' && myDecision && !drafting ? view.decision : null;

  // Auto-charge setting (server, per player and table). Hidden in tutorials (scripted moves only).
  const auto = me?.auto ?? { mode: 'free' as const };
  const autoLabel = auto.mode === 'ask' ? 'همیشه بپرس' : auto.mode === 'free' ? 'رایگان (۱) خودکار' : auto.mode === 'upto' ? `تا ${fa(auto.n ?? 1)} امتیاز خودکار` : 'همه را رد کن';
  const setAuto = (m: { mode: 'ask' | 'free' | 'upto' | 'decline'; n?: number; lastRound?: boolean }) => { if (!busy) onAction({ type: 'autoCharge', mode: m.mode, ...(m.mode === 'upto' ? { n: m.n ?? 1 } : {}), ...(m.lastRound ? { lastRound: true } : {}) }); };
  const autoPanel = autoOpen && me && !expected && (
    <fieldset className="gp-auto" aria-label={t('auto')}>
      {([['ask', undefined, 'همیشه بپرس'], ['free', undefined, 'شارژ رایگان (۱) خودکار، بقیه بپرس'], ['upto', 1, 'تا ۱ امتیاز خودکار'], ['upto', 2, 'تا ۲ امتیاز خودکار'], ['upto', 3, 'تا ۳ امتیاز خودکار'], ['decline', undefined, 'همه را رد کن']] as const).map(([m, n, label]) => (
        <label key={`${m}${n ?? ''}`}><input type="radio" name="gp-auto" checked={auto.mode === m && (m !== 'upto' || auto.n === n)} disabled={busy} onChange={() => setAuto({ mode: m, n, lastRound: auto.lastRound })} />{label}</label>
      ))}
      <label><input type="checkbox" checked={!!auto.lastRound} disabled={busy} onChange={(e) => setAuto({ ...auto, lastRound: e.target.checked })} />در دور آخر همیشه بپرس</label>
    </fieldset>
  );

  const waitingFor = view.decision ? view.decision.seat : view.current;
  const flowSteps = draft.map((a, i) => <li key={i} className="gp-step is-done">{stepFa(view, a)}</li>);
  const prompt = myDecision && view.decision ? decisionTitle(view, who)
    : mode?.kind === 'research' ? t('pickTrack') : mode?.kind === 'pass' ? t('pickBooster') : mode?.kind === 'federation' ? t('pickFed')
      : hexSel !== null ? t('pickTo') : mode ? `${mode.kind === 'power' || mode.kind === 'special' ? stepFa(view, { type: mode.kind, id: mode.id }) : t(mode.kind)}: ${t('pickHex')}`
        : view.phase === 'faction' ? t('pickFaction') : view.phase === 'setup' ? t('place') : view.phase === 'booster' ? t('boosterPhase')
          : canConfirm ? t('ready') : t('pickAction');
  const options: GameAction[] = hexSel !== null ? (pickHex.get(hexSel) ?? [])
    : mode?.kind === 'research' ? legal.filter((a) => a.type === 'research') : mode?.kind === 'federation' ? legal.filter((a) => a.type === 'federation')
      : mode?.kind === 'pass' ? legal.filter((a) => a.type === 'pass') : mode?.kind === 'power' && mode.id === 'qic2' ? legal.filter((a) => a.type === 'power' && a.id === 'qic2')
        : myDecision && view.decision?.kind !== 'lostPlanet' ? decisions
          : drafting && view.phase === 'booster' && !draft.length ? legal.filter((a) => a.type === 'booster') : [];
  const optionFa = (a: GameAction) => (a.type === 'federation' ? `${fa((a.hexes as number[]).length)} خانه: ${fedFa(a.token as string)}` : a.type === 'power' && a.pick ? fedFa(a.pick as string)
    : a.type === 'upgrade' ? BUILDING_FA[a.to as Building] : stepFa(view, a));

  const clock = <span className="gp-turnline">{view.phase === 'actions' ? `${t('round')} ${fa(view.round)} ${t('of6')}` : ''}</span>;
  const bar = (
    <div className={`gp-actbar${drafting || leech ? '' : ' is-waiting'}${sheet ? ' is-open' : ''}`} data-gp-actbar data-gp-pending={view.decision?.kind}>
      <div className="gp-actbar__row1">
        <p className="gp-actbar__say">{view.outcome ? 'بازی تمام شد'
          : sending ? t('sending')
            : drafting || myDecision ? <><b>{myDecision ? t('decide') : t('yourTurn')}</b>: {prompt}</>
              : mySeat === null ? `${t('spectating')}: ${t('turnOf')} ${who(waitingFor)}` : `${t('turnOf')} ${who(waitingFor)}`}</p>
        {clock}
        {me && !expected && <Button size="sm" variant="ghost" className="gp-autobtn" aria-expanded={autoOpen} onClick={() => setAutoOpen(!autoOpen)}>{t('auto')}: {autoLabel}</Button>}
        <button type="button" className="gp-lang" aria-label="زبان لایهٔ بازی" onClick={() => { const n = lang === 'fa' ? 'en' : 'fa'; setLang(n); try { localStorage.setItem('gp.lang', n); } catch { /* storage blocked */ } }}>{lang === 'fa' ? 'EN' : 'فا'}</button>
        {(drafting || myDecision) && <Button size="sm" className="gp-sheetbtn" onClick={() => setSheet(!sheet)}>{sheet ? t('close') : t('actions')}</Button>}
      </div>
      {autoPanel}
      {leech && (
        <div className="gp-leech" data-gp-pending="leech">
          <p>{decisionTitle(view, who)}</p>
          <div className="gp-btnrow">
            {decisions.map((a) => <Button key={String(a.choice)} size="sm" variant={a.choice === 'decline' ? 'secondary' : 'primary'} className={hint(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => add(a)}>
              {a.choice === 'accept' ? `شارژ ${fa(leech.amount)} قدرت` : a.choice === 'decline' ? 'رد' : choiceFa(view, String(a.choice))}</Button>)}
            {decisions.some((a) => a.choice === 'accept') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setAuto({ mode: 'upto', n: Math.max(1, Math.min(3, leech.amount - 1)) }); }}>دفعهٔ بعد نپرس</Button>}
          </div>
        </div>
      )}
      {(drafting || (myDecision && !leech)) && (
        <div className="gp-actbar__rows">
          {(draft.length > 0 || mode || hexSel !== null || myDecision || options.length > 0) && (
            <div className="gp-flow" data-gp-pending={myDecision ? view.decision?.kind : undefined}>
              {flowSteps.length > 0 && <ol className="gp-steps">{flowSteps}{!canConfirm && <li className="gp-step is-now">…</li>}</ol>}
              {options.length > 0 && <div className="gp-btnrow">{options.map((a, k) => <Button key={k} size="sm" variant="secondary" data-option={a.type} className={`${a.type === 'pass' ? 'gp-pass-pick' : ''}${hint(a) ? ' gp-hint' : ''}`} disabled={busy} onClick={() => add(a)}>{optionFa(a)}</Button>)}</div>}
              <div className="gp-btnrow">
                <Button size="sm" className={`gp-confirm${canConfirm && expected && draft.some((a) => same(expected, a)) ? ' gp-hint' : ''}`} disabled={!canConfirm || busy} onClick={confirm}>{t('confirm')}</Button>
                <Button size="sm" variant="secondary" className="gp-undo" disabled={!draft.length && !mode && hexSel === null} onClick={back}>{t('back')}</Button>
                <Button size="sm" variant="ghost" disabled={!draft.length && !mode} onClick={cancel}>{t('cancel')}</Button>
              </div>
            </div>
          )}
          {drafting && view.phase === 'actions' && !hasMain && !mode && hexSel === null && !myDecision && (
            <div className="gp-main">
              {MAIN.map((m) => {
                const ok = legal.some((a) => a.type === m.kind);
                const code = ok ? null : reason(m.cands());
                return <span key={m.kind} className="gp-mainbtn">
                  <Button size="sm" variant="secondary" data-move={m.kind} data-reason={code ?? undefined} disabled={!ok || busy} title={code ? REASON_FA[code] : undefined}
                    className={expected?.type === m.kind ? 'gp-hint' : undefined} onClick={() => startMain(m.kind)}>{t(m.label)}{m.cost && <CostPill g={m.cost} plus={m.kind === 'mine'} />}</Button>
                  {code && <small className="gp-reason">{REASON_FA[code]}</small>}
                </span>;
              })}
              <span className="gp-spacer" />
              <Button size="sm" variant="secondary" className={`gp-pass${expected?.type === 'pass' ? ' gp-hint' : ''}`} data-move="pass" disabled={!actionsTurn || busy} onClick={() => startMain('pass')}>{t('pass')}</Button>
            </div>
          )}
          {drafting && view.phase === 'actions' && !hasMain && !mode && !myDecision && convs.length > 0 && (
            <div className="gp-free" aria-label={t('free')}>
              <small>{t('free')}</small>
              {convs.map((a) => <button key={a.type === 'burn' ? 'burn' : String(a.id)} type="button" className={`gp-chipbtn${hint(a) ? ' gp-hint' : ''}`} data-move={a.type} disabled={busy} onClick={() => add(a)}>{a.type === 'burn' ? t('burn') : CONV_FA[a.id as string] ?? convFa(a.id as string)}</button>)}
            </div>
          )}
          {drafting && view.phase === 'actions' && !hasMain && !mode && <p className="gp-hintline">{t('hint')}</p>}
        </div>
      )}
    </div>
  );

  const facPick = drafting && view.phase === 'faction' && !draft.length && (
    <section className="gp-zone gp-factions" aria-label={t('pickFaction')}>
      {legal.filter((a) => a.type === 'faction').map((a) => {
        const f = CONTENT.factions[a.faction as string]!;
        return (
          <article key={f.id} className="gp-faccard" data-faction={f.id}>
            <img className="gp-faccard__art" src={art(FACTIONS[f.id]?.portrait ?? '')} alt="" />
            <header><img className="gp-planet" src={art(`art/planet-art/planet-${COLORS[f.home]}.webp`)} alt="" /><strong>{lang === 'en' ? FACTIONS[f.id]?.nameEn : f.nameFa}</strong> <bdi>{lang === 'en' ? f.nameFa : f.nameEn}</bdi></header>
            <p>{f.abilityFa}</p>
            <p><small>مؤسسه: {f.piFa}</small></p>
            <Button size="sm" className={`gp-faction-pick${hint(a) ? ' gp-hint' : ''}`} disabled={busy} onClick={() => add(a)}>انتخاب {f.nameFa}</Button>
          </article>
        );
      })}
    </section>
  );

  const seats = view.pl.flatMap((p, s) => (p.faction ? [s] : []));
  const shown = boardSeat !== null && seats.includes(boardSeat) ? boardSeat : mySeat !== null && seats.includes(mySeat) ? mySeat : seats[0];
  const tabOrder = mySeat !== null && seats.includes(mySeat) ? [mySeat, ...seats.filter((s) => s !== mySeat)] : seats;

  return (
    <div className="gp" ref={root} data-seq={served.seq} data-round={view.round} data-phase={view.phase} data-turn={sending ? 'sending' : drafting ? 'draft' : myDecision ? 'decide' : 'wait'} data-tab={tab} lang={lang} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      {bar}
      <nav className="gp-tabs" role="tablist" aria-label="صفحه‌ها">
        {(['map', 'research', 'scoring', 'board'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(k === 'map' ? 'map' : k === 'research' ? 'tracks' : k === 'scoring' ? 'scoring' : 'mine2')}</button>)}
      </nav>
      {facPick}
      <section className="gp-zone" data-zone="map"><SpaceMap c={c} /></section>
      <section className="gp-zone gp-zone--mid">
        <div data-zone="research"><ResearchBoard c={c} /></div>
        <div data-zone="scoring"><ScoringBoard c={c} /></div>
      </section>
      {shown !== undefined && (
        <section className="gp-zone" data-zone="board">
          <div className="gp-ptabs" role="tablist" aria-label="صفحهٔ بازیکن‌ها">
            {tabOrder.map((s) => <button key={s} type="button" role="tab" aria-selected={s === shown} onClick={() => setBoardSeat(s)}><i className={`bgv-seat seat-${s + 1}`} />{s === mySeat ? `${seatName(s)}، ${t('you')}` : seatName(s)}</button>)}
          </div>
          <FactionBoardView c={c} seat={shown} />
        </section>
      )}
      <details className="gp-log">
        <summary>رویدادهای اخیر</summary>
        <ol>{view.log.slice(-12).reverse().map((e) => <li key={e.seq}>{logFa(e, who)}</li>)}</ol>
      </details>
    </div>
  );
}

function logFa(e: GaiaView['log'][number], who: (s: number) => string): string {
  switch (e.t) {
    case 'faction': return `${who(e.seat)} جناح ${factionFa(e.faction)} را برداشت`;
    case 'place': return `${who(e.seat)} ${BUILDING_FA[e.building]} شروع را گذاشت`;
    case 'booster': return `${who(e.seat)} بوستر برداشت: ${boosterFa(e.booster)}`;
    case 'round': return `دور ${fa(e.round)} آغاز شد`;
    case 'mine': return `${who(e.seat)} معدن ساخت${e.steps ? ` (${fa(e.steps)} گام زمین‌سازی)` : ''}`;
    case 'upgrade': return `${who(e.seat)} به ${BUILDING_FA[e.to]} ارتقا داد`;
    case 'gaiaform': return `${who(e.seat)} پروژهٔ گایا را شروع کرد`;
    case 'federation': return `${who(e.seat)} فدراسیون ساخت: ${fedFa(e.token)}`;
    case 'research': return `${who(e.seat)} در ${TRACK_FA[e.track]} به سطح ${fa(e.level)} رسید`;
    case 'power': return `${who(e.seat)} اقدام قدرت: ${POWER_ACTIONS.find((p) => p.id === e.action)?.labelFa ?? e.action}`;
    case 'special': return `${who(e.seat)} اقدام ویژه: ${specialFa(e.action)}`;
    case 'convert': return `${who(e.seat)} تبدیل: ${e.id === 'burn' ? 'سوزاندن قدرت' : CONV_FA[e.id] ?? convFa(e.id)}`;
    case 'leech': return `${who(e.seat)} ${fa(e.amount)} قدرت گرفت (${fa(e.vp)} امتیاز)`;
    case 'decline': return `${who(e.seat)} قدرت را نپذیرفت`;
    case 'tech': return `${who(e.seat)} کاشی گرفت: ${techFa(e.tech)}`;
    case 'pass': return `${who(e.seat)} پاس داد`;
    case 'vp': return `${who(e.seat)} ${fa(e.n)} امتیاز`;
    case 'final': return `امتیاز نهایی ${who(e.seat)}: ${fa(e.vp)}`;
    case 'timeout': return `زمان ${who(e.seat)} تمام شد`;
    case 'left': return `${who(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌علت تأخیر خارج شد'}`;
  }
}

