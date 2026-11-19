// برس: بیرمنگام — BGA-style table (design/games/brass: HANDOFF.md, COMPONENTS.md). Desktop game column: sticky action
// bar, «دست شما», the map box (night board, every piece placed from data/layout.json, own zoom toolbar). Player panels
// live in the shell rail (`brassSeatCard`, SEAT_CARDS); the renderer's own rail keeps the era-score card and the log.
// Phone (<900): tabs نقشه / دست / صفحهٔ من / بازیکنان, the actions sheet, a bottom dock and auto-zoom on legal build
// spots. Every piece and card is publisher art from ./art; nothing is drawn. Actions, targets, legal cards, costs and
// resource choices come from the server hints; flow = action → target → card → «ثبت», «برگرد» before it.
import './renderer.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RailSlot, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import { Icon } from '@bg/ui/bgv';
import LAYOUT from './data/layout.json' with { type: 'json' };
import IDS from './data/content-id-map.json' with { type: 'json' };
import CARD_ART from './data/cards.json' with { type: 'json' };
import {
  CARDS, INDUSTRIES, LINK, LINK_TILES, LOC, MARKET, STACK, WILD_INDUSTRY, WILD_LOCATION, linkNodes, locationLinkVp, tileDef,
  type ActionCost, type BrassView, type Industry, type Tile
} from './rules.ts';

const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
const art = (path: string) => ART[`./${path}`] ?? '';
const COLORS = LAYOUT.seatColors.order as readonly string[];
const color = (seat: number) => COLORS[seat] ?? 'grey';
const B = LAYOUT.board;
const MAT = LAYOUT.mat;
const SLOTS = B.slots as Record<string, { x: number; y: number }[]>;
const LINKS_AT = B.links as Record<string, { x: number; y: number; angle: number }>;

const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: Math.abs(n) >= 1000 }).replace(/٬/g, ',');
const gbp = (n: number) => `£${fa(n)}`;
const signed = (n: number) => (n > 0 ? `+${fa(n)}` : n < 0 ? `−${fa(-n)}` : fa(0));
/** No-break space (keeps «دست ۸» together). */
const NBSP = String.fromCharCode(160);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const IND_FA: Record<Industry, string> = { cotton: 'کارخانهٔ پنبه', manufacturer: 'تولیدی', pottery: 'سفال‌گری', coal: 'معدن زغال', iron: 'ذوب‌آهن', brewery: 'آبجوسازی' };
const IND_EN: Record<Industry, string> = { cotton: 'Cotton Mill', manufacturer: 'Manufacturer', pottery: 'Pottery', coal: 'Coal Mine', iron: 'Iron Works', brewery: 'Brewery' };
const ACTS = ['build', 'network', 'develop', 'sell', 'loan', 'scout', 'pass'] as const;
const ACT_FA: Record<string, string> = { build: 'ساخت صنعت', network: 'ساخت مسیر', develop: 'توسعه', sell: 'فروش', loan: 'وام', scout: 'پیشاهنگ', pass: 'رد کردن' };
const ACT_EN: Record<string, string> = { build: 'Build', network: 'Network', develop: 'Develop', sell: 'Sell', loan: 'Loan', scout: 'Scout', pass: 'Pass' };
const REASON: Record<string, [string, string]> = {
  NO_BUILD: ['با کارت‌های دستتان جای مجازی برای ساخت نیست.', 'No legal build spot for the cards in your hand.'],
  NO_LINK: ['خط خالی کنار شبکهٔ شما نیست یا پول/زغال کافی ندارید.', 'No empty line next to your network, or not enough money/coal.'],
  CANNOT_DEVELOP: ['کاشی قابل توسعه یا آهن/پول کافی نیست.', 'No tile to develop, or not enough iron/money.'],
  NO_SELL: ['کاشی کالای برنگشتهٔ وصل به تاجر خریدار ندارید.', 'No unflipped goods tile connected to a buying merchant.'],
  NO_LOAN: ['درآمد زیر −۱۰ می‌رود.', 'Income would drop below −10.'],
  HAS_WILD: ['کارت آزاد در دست دارید.', 'You hold a wild card.'],
  NO_WILD_LEFT: ['کپهٔ کارت آزاد خالی است.', 'A wild pile is empty.'],
  FEW_CARDS: ['سه کارت در دست ندارید.', 'You need three cards.']
};

const REASON_SHORT: Record<string, [string, string]> = {
  NO_BUILD: ['جای ساخت نیست', 'no spot'], NO_LINK: ['خط مجاز نیست', 'no line'], CANNOT_DEVELOP: ['آهن/کاشی نیست', 'no iron/tile'],
  NO_SELL: ['کالای وصل نیست', 'nothing to sell'], NO_LOAN: ['درآمد کم است', 'income too low'], HAS_WILD: ['کارت آزاد دارید', 'holding a wild'],
  NO_WILD_LEFT: ['کارت آزاد تمام', 'no wilds left'], FEW_CARDS: ['کمتر از ۳ کارت', 'under 3 cards']
};

/** Game-layer language (HANDOFF: Persian default, English optional for the game layer only). */
interface Lx { en: boolean; t: (fa: string, en: string) => string; n: (x: number) => string; gbp: (x: number) => string; sg: (x: number) => string; ind: (x: Industry) => string; loc: (id: string) => string; act: (k: string) => string }
function lx(en: boolean): Lx {
  const n = en ? (x: number) => String(x) : fa;
  return {
    en, n, t: (f, e) => (en ? e : f), gbp: (x) => `£${n(x)}`, sg: (x) => (x > 0 ? `+${n(x)}` : x < 0 ? `−${n(-x)}` : n(0)),
    ind: (x) => (en ? IND_EN[x] : IND_FA[x]), loc: (id) => (en ? LOC.get(id)?.nameEn : LOC.get(id)?.nameFa) ?? id, act: (k) => (en ? ACT_EN[k] : ACT_FA[k]) ?? k
  };
}
const FA = lx(false);

const tileArt = (industry: Industry, level: number, seat: number, flipped = false) => art(`art/industry-tiles/tile-${industry}-${level}-${color(seat)}-${flipped ? 'back' : 'front'}.webp`);
const RES_ART = { coal: art(IDS.resources.coal), iron: art(IDS.resources.iron), beer: art(IDS.resources.beer) };
const IND_ICON = (x: Industry) => art((IDS.industryIcons as Record<string, string>)[x]!);
const cardArt = (id: number) => art(CARD_ART.cards.find((c) => c.id === id)?.art ?? CARD_ART.back);
const BACK = art(CARD_ART.back);
const charArt = (s: number) => art(`art/characters/character-${color(s)}-front.webp`);
const linkName = (L: Lx, id: string) => linkNodes(LINK.get(id)!).slice(0, 2).map(L.loc).join(' ↔ ');
/** Board position (0..1000 units) → % of the board; COMPONENTS «قاعدهٔ جا». */
const at = (x: number, y: number, w?: number, extra?: CSSProperties): CSSProperties => ({ insetInlineStart: `${x / 10}%`, top: `${y / 10}%`, ...(w ? { inlineSize: `${w}%` } : {}), ...extra });

export function cardLabel(id: number, L: Lx = FA): string {
  if (id === WILD_LOCATION) return L.t('شهر آزاد', 'Wild location');
  if (id === WILD_INDUSTRY) return L.t('صنعت آزاد', 'Wild industry');
  const c = CARDS[id];
  if (!c) return L.t('کارت', 'Card');
  return c.kind === 'location' ? L.t(`کارت ${L.loc(c.loc)}`, `${L.loc(c.loc)} card`) : L.t(`کارت ${c.industries.map(L.ind).join(' / ')}`, `${c.industries.map(L.ind).join(' / ')} card`);
}

/** The page theme (root `data-theme`): the action bar is a page card, not the dark felt stage (as Gaia / TM). */
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

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}

// ---------- cost lines (from hint.cost, never recomputed) ----------

function sumCosts(cs: ActionCost[]): ActionCost | null {
  if (!cs.length) return null;
  return cs.reduce((a, c) => ({
    money: a.money + c.money, spent: a.spent + c.spent, coalMarket: a.coalMarket + c.coalMarket, ironMarket: a.ironMarket + c.ironMarket,
    income: a.income + c.income, incomeLevel: a.incomeLevel + c.incomeLevel, vp: a.vp + c.vp,
    from: [...a.from, ...c.from], flipped: [...a.flipped, ...c.flipped], beerMerchant: [...a.beerMerchant, ...c.beerMerchant], ...(c.built ? { built: c.built } : a.built ? { built: a.built } : {})
  }));
}

function costParts(c: ActionCost, who: (s: number) => string, L: Lx): ReactNode[] {
  const out: ReactNode[] = [];
  const res = (x: Industry) => (x === 'coal' ? RES_ART.coal : x === 'iron' ? RES_ART.iron : RES_ART.beer);
  if (c.built) out.push(<span key="b"><img className="br-ic" src={tileArt(c.built.industry, c.built.level, c.built.owner)} alt="" />{L.ind(c.built.industry)} {ROMAN[c.built.level]}</span>);
  for (const f of c.from) out.push(<span key={`f${f.loc}${f.slot}`}><img className="br-ic" src={res(f.industry)} alt="" />{L.t(`${L.n(f.n)} از ${L.ind(f.industry)} ${L.loc(f.loc)} (`, `${f.n} from ${L.ind(f.industry)} ${L.loc(f.loc)} (`)}<bdi>{who(f.owner)}</bdi>{L.t(')، رایگان', '), free')}</span>);
  if (c.coalMarket < 0) out.push(<span key="cm"><img className="br-ic" src={RES_ART.coal} alt="" />{L.t(`${L.n(-c.coalMarket)} از بازار`, `${-c.coalMarket} from the market`)}</span>);
  if (c.ironMarket < 0) out.push(<span key="im"><img className="br-ic" src={RES_ART.iron} alt="" />{L.t(`${L.n(-c.ironMarket)} از بازار`, `${-c.ironMarket} from the market`)}</span>);
  if (c.coalMarket > 0) out.push(<span key="sc">{L.t(`فروش به بازار: ${L.n(c.coalMarket)} زغال`, `Sold to market: ${c.coalMarket} coal`)}</span>);
  if (c.ironMarket > 0) out.push(<span key="si">{L.t(`فروش به بازار: ${L.n(c.ironMarket)} آهن`, `Sold to market: ${c.ironMarket} iron`)}</span>);
  for (const m of c.beerMerchant) out.push(<span key={`m${m.merchant}${m.space}`}><img className="br-ic" src={RES_ART.beer} alt="" />{L.t(`آبجوی تاجر ${L.loc(m.merchant)}`, `${L.loc(m.merchant)} merchant beer`)}</span>);
  if (c.flipped.length) out.push(<span key="fl">{L.t('برگشته: ', 'Flipped: ')}{c.flipped.map((t) => `${L.ind(t.industry)} ${ROMAN[t.level]}`).join(L.t('، ', ', '))}</span>);
  if (c.income) out.push(<span key="inc">{L.t('درآمد ', 'Income ')}<b className="br-num">{L.sg(c.incomeLevel)}</b></span>);
  if (c.vp) out.push(<span key="vp"><b className="br-num">{L.sg(c.vp)}</b>{L.t(' امتیاز', ' VP')}</span>);
  if (c.money + c.spent > 0) out.push(<span key="gain">{L.t('دریافت ', 'Gain ')}<b className="br-gbp">{L.gbp(c.money + c.spent)}</b></span>);
  return out;
}

// ---------- map box: zoom toolbar, drag, wheel, auto-zoom (§15, §17) ----------

interface View3 { s: number; x: number; y: number }
const ZMAX = 4;
const clampV = (v: View3, w: number): View3 => {
  const s = Math.min(ZMAX, Math.max(1, v.s));
  return { s, x: Math.min(0, Math.max(w - w * s, v.x)), y: Math.min(0, Math.max(w - w * s, v.y)) };
};

function useMapZoom(focus: { x0: number; y0: number; x1: number; y1: number } | null) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [v, setV] = useState<View3>({ s: 1, x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const key = focus ? `${focus.x0}|${focus.y0}|${focus.x1}|${focus.y1}` : '';
  useEffect(() => {
    if (!focus || !w) return;
    const s = Math.min(ZMAX, 1000 / Math.max(focus.x1 - focus.x0, focus.y1 - focus.y0, 1));
    const cx = ((focus.x0 + focus.x1) / 2 / 1000) * w * s, cy = ((focus.y0 + focus.y1) / 2 / 1000) * w * s;
    setV(clampV({ s, x: w / 2 - cx, y: w / 2 - cy }, w));
  }, [key, w]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomAt = (f: number, px = w / 2, py = w / 2) => setV((o) => {
    const s = Math.min(ZMAX, Math.max(1, o.s * f));
    return clampV({ s, x: px - ((px - o.x) / o.s) * s, y: py - ((py - o.y) / o.s) * s }, w);
  });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.x, e.clientY - r.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { if (v.s > 1) drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false }; },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      if (!d.moved) { d.moved = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      setV(clampV({ s: v.s, x: d.vx + dx, y: d.vy + dy }, w));
    },
    onPointerUp: () => { setTimeout(() => { drag.current = null; }, 0); },
    onClickCapture: (e: React.MouseEvent) => { if (drag.current?.moved) { e.stopPropagation(); e.preventDefault(); } }
  };
  return { box, v, handlers, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(1 / 1.25), fit: () => setV({ s: 1, x: 0, y: 0 }) };
}

// ---------- the board (§1–8, §14) ----------

interface Targets {
  slots: { loc: string; slot: number; picked: boolean; hint: boolean; label: string; onPick: () => void }[];
  links: { id: string; picked: boolean; hint: boolean; onPick: () => void }[];
  merchants: { m: string; space: number; picked: boolean; onPick: () => void }[];
  ghost: { loc: string; slot: number; industry: Industry; level: number; owner: number } | null;
  ghostLinks: { id: string; owner: number }[];
  tip: { x: number; y: number; body: ReactNode } | null;
}

/** Several markers on one track space sit side by side, 7 units inward from the board edge (layout.json trackMarkers). */
function trackPos(space: number, k: number): [number, number] {
  const p = (B.track as Record<string, number[]>)[String(((space % 100) + 100) % 100)] ?? [0, 0];
  const [x, y] = [p[0]!, p[1]!];
  const d = k * B.trackMarkers.stackOffset;
  return x < 100 ? [x + d, y] : x > 900 ? [x - d, y] : y < 100 ? [x, y + d] : [x, y - d];
}

/** Era-end overlay on the board (B5): points on links / flipped tiles, level-I tiles fading out. */
interface Marks { links?: boolean; tiles?: boolean; leaving?: boolean }

function Board({ view, who, t, L, marks }: { view: BrassView; who: (s: number) => string; t: Targets; L: Lx; marks?: Marks }) {
  const era = view.era === 'canal' ? 'canal' : 'rail';
  const tiles: ReactNode[] = [];
  for (const [loc, row] of Object.entries(view.board)) row.forEach((tile, slot) => {
    const sp = SLOTS[loc]?.[slot];
    if (!tile || !sp) return;
    const label = `${L.ind(tile.industry)} ${ROMAN[tile.level]} ${who(tile.owner)}${tile.flipped ? L.t('، برگشته', ', flipped') : ''}`;
    if (marks?.tiles && tile.flipped) tiles.push(<b key={`p${loc}${slot}`} className="br-at br-pts" style={at(sp.x, sp.y - 30)}>+{L.n(tileDef(tile.industry, tile.level).vp)}</b>);
    tiles.push(<img key={`t${loc}${slot}`} className={['br-at br-tile', marks?.leaving && tile.level === 1 ? 'is-leaving' : ''].join(' ')} style={at(sp.x, sp.y)} src={tileArt(tile.industry, tile.level, tile.owner, tile.flipped)} alt={label}
      data-flip={`tile-${loc}-${slot}`} data-br-piece="tile" data-flip-from={`seat-${tile.owner}`} draggable={false} />);
    if (tile.cubes > 0) {
      const src = tile.industry === 'coal' ? RES_ART.coal : tile.industry === 'iron' ? RES_ART.iron : RES_ART.beer;
      tiles.push(<span key={`c${loc}${slot}`} className="br-oncubes" style={at(sp.x, sp.y + B.slot.cubesOffsetY)} aria-hidden>
        {Array.from({ length: tile.cubes }, (_, i) => <img key={i} src={src} alt="" className={tile.industry === 'brewery' ? 'is-beer' : ''} />)}
      </span>);
    }
  });
  const linkImg = (id: string, owner: number, ghost = false) => {
    const l = LINKS_AT[id];
    return l ? <img key={`l${id}`} className={['br-at br-link', ghost ? 'is-ghost' : ''].join(' ')} style={at(l.x, l.y, undefined, { transform: `translate(-50%,-50%) rotate(${l.angle}deg)` })}
      src={art(`art/links/link-${color(owner)}-${era}.webp`)} alt={`${era === 'canal' ? L.t('کانال', 'Canal') : L.t('ریل', 'Rail')} ${who(owner)}: ${linkName(L, id)}`} data-flip={`link-${id}`} draggable={false} /> : null;
  };
  const cubes = (kind: 'coal' | 'iron', n: number) => {
    const prices = MARKET[kind].prices;
    const xs = kind === 'coal' ? B.markets.coalX : B.markets.ironX;
    return prices.map((p, i) => (i >= prices.length - n ? <img key={`${kind}${i}`} className="br-at br-mcube" style={at(xs[i % 2]!, (B.markets.rowY as Record<string, number>)[String(p)]!)} src={RES_ART[kind]} alt="" /> : null));
  };
  const onSpace = new Map<number, number>();
  const stack = (space: number) => { const k = onSpace.get(space) ?? 0; onSpace.set(space, k + 1); return k; };
  const seats = view.vp.map((_, s) => s);
  const piles = [
    { key: 'deck', src: BACK, n: view.deckCount, label: L.t(`دسته: ${L.n(view.deckCount)} کارت`, `Deck: ${view.deckCount} cards`) },
    { key: 'wildLocation', src: art('art/cards-wild/card-wild-location.webp'), n: view.wild.location, label: `${L.t('شهر آزاد', 'Wild location')}: ${L.n(view.wild.location)}` },
    { key: 'wildIndustry', src: art('art/cards-wild/card-wild-industry.webp'), n: view.wild.industry, label: `${L.t('صنعت آزاد', 'Wild industry')}: ${L.n(view.wild.industry)}` }
  ];
  return (
    <div className="br-board br__map" dir="ltr">
      <img className="br-base" src={art(IDS.boards.map)} alt={L.t('نقشهٔ بیرمنگام، روی شب', 'Birmingham board, night side')} draggable={false} />
      {Object.entries(view.links).map(([id, owner]) => linkImg(id, owner))}
      {t.ghostLinks.map((g) => linkImg(g.id, g.owner, true))}
      {tiles}
      {t.ghost && (() => { const sp = SLOTS[t.ghost.loc]?.[t.ghost.slot]; return sp ? <img className="br-at br-tile is-ghost" style={at(sp.x, sp.y)} src={tileArt(t.ghost.industry, t.ghost.level, t.ghost.owner)} alt="" /> : null; })()}
      {Object.entries(view.merchants).map(([m, st]) => {
        const g = (B.merchants as Record<string, { spaces: number[][]; beer: number[][] }>)[m];
        if (!g) return null;
        return st.tiles.map((id, i) => {
          const sp = g.spaces[i], bp = g.beer[i];
          return [
            id && sp ? <img key={`m${m}${i}`} className="br-at br-merch" style={at(sp[0]!, sp[1]!)} src={art((IDS.merchantTiles as Record<string, string>)[id] ?? '')} alt={L.t(`تاجر ${L.loc(m)}`, `${L.loc(m)} merchant`)} /> : null,
            st.beer[i] && bp ? <img key={`b${m}${i}`} className="br-at br-beer" style={at(bp[0]!, bp[1]!)} src={RES_ART.beer} alt={L.t(`آبجوی تاجر ${L.loc(m)}`, `${L.loc(m)} merchant beer`)} data-flip={`beer-${m}-${i}`} /> : null
          ];
        });
      })}
      {cubes('coal', view.coal)}
      {cubes('iron', view.iron)}
      {piles.map((p) => {
        const f = (B.cardFrames as Record<string, number[]>)[p.key]!;
        return <span key={p.key} className={['br-pile', p.n ? '' : 'is-empty'].join(' ')} style={at(f[0]!, f[1]!)} {...(p.key === 'deck' ? { 'data-flip-anchor': 'deck' } : {})}>
          <img src={p.src} alt={p.label} /><b aria-hidden>{L.n(p.n)}</b>
        </span>;
      })}
      {view.order.map((s, i) => { const p = B.turnOrder[i]; return p ? <img key={`ch${s}`} className={['br-at br-char', view.current === s ? 'is-turn' : ''].join(' ')} style={at(p[0]!, p[1]!)} src={charArt(s)} alt={L.t(`نفر ${L.n(i + 1)} این دور: ${who(s)}`, `Turn ${i + 1}: ${who(s)}`)} /> : null; })}
      {seats.map((s) => { const [x, y] = trackPos(view.vp[s]!, stack(view.vp[s]! % 100)); return <img key={`vp${s}`} className="br-at br-vpm" style={at(x, y)} src={art(`art/markers/vp-${color(s)}.webp`)} alt={`${who(s)}: ${L.n(view.vp[s]!)} ${L.t('امتیاز', 'VP')}`} />; })}
      {seats.map((s) => { const [x, y] = trackPos(view.income[s]!, stack(view.income[s]!)); return <img key={`in${s}`} className="br-at br-incm" style={at(x, y)} src={art(`art/markers/income-${color(s)}.webp`)} alt={`${who(s)}: ${L.t('درآمد', 'income')} ${L.sg(view.incomeLevels[s]!)}`} />; })}
      {t.links.map((l) => {
        const g = LINKS_AT[l.id];
        return g ? <button key={`lb${l.id}`} type="button" className={['br-linkbtn', l.hint ? 'br-hint' : ''].join(' ')} data-link={l.id} aria-pressed={l.picked} aria-label={linkName(L, l.id)}
          style={at(g.x, g.y, undefined, { transform: `translate(-50%,-50%) rotate(${g.angle}deg)` })} onClick={l.onPick} /> : null;
      })}
      {t.slots.map((s) => {
        const sp = SLOTS[s.loc]?.[s.slot];
        return sp ? <button key={`sb${s.loc}${s.slot}`} type="button" className={['br-slot', s.hint ? 'br-hint' : ''].join(' ')} data-loc={s.loc} data-slot={s.slot} aria-pressed={s.picked} aria-label={s.label} style={at(sp.x, sp.y)} onClick={s.onPick} /> : null;
      })}
      {t.merchants.map((m) => {
        const sp = (B.merchants as Record<string, { spaces: number[][] }>)[m.m]?.spaces[m.space];
        return sp ? <button key={`mb${m.m}${m.space}`} type="button" className="br-mbtn" data-merchant={m.m} data-space={m.space} aria-pressed={m.picked} aria-label={L.t(`تاجر ${L.loc(m.m)}`, `${L.loc(m.m)} merchant`)} style={at(sp[0]!, sp[1]!)} onClick={m.onPick} /> : null;
      })}
      {marks?.links && Object.keys(view.links).map((id) => { const g = LINKS_AT[id]; return g ? <b key={`lp${id}`} className="br-at br-pts" style={at(g.x, g.y)}>+{L.n(linkNodes(LINK.get(id)!).reduce((n, x) => n + locationLinkVp(view, x), 0))}</b> : null; })}
      {t.tip && <div className="br-tip" dir={L.en ? 'ltr' : 'rtl'} style={at(Math.min(t.tip.x + 30, 760), Math.min(t.tip.y + 20, 900))} role="note">{t.tip.body}</div>}
    </div>
  );
}

// ---------- player panel body (§11): shell rail card and the phone «بازیکنان» tab ----------

function seatStyle(s: number): CSSProperties { return { ['--pc' as string]: `var(--br-${color(s)})`, ['--pc-ink' as string]: `var(--br-${color(s)}-ink)` }; }

interface PanelData {
  seat: number; vp: number; money: number; income: number; spent: number; cards: number; linksLeft: number; tiles: number; era: 'canal' | 'rail';
  discard: number | null; nextTiles: Partial<Record<Industry, { level: number; left: number } | null>>;
}
function panelFromView(v: BrassView, s: number, discard: number | null | undefined): PanelData {
  return {
    seat: s, vp: v.vp[s]!, money: v.money[s]!, income: v.incomeLevels[s]!, spent: v.spent[s]!, cards: v.handCounts[s]!, era: v.era,
    linksLeft: LINK_TILES - Object.values(v.links).filter((o) => o === s).length, tiles: Object.values(v.board).flat().filter((t) => t?.owner === s).length, discard: discard ?? null,
    nextTiles: Object.fromEntries(INDUSTRIES.map((x) => { const rest = STACK[x].slice(v.mat[s]![x]); const t = rest[0]; return [x, t ? { level: t.level, left: rest.filter((u) => u.level === t.level).length } : null]; }))
  };
}
const openMat = (seat: number) => window.dispatchEvent(new CustomEvent('br:mat', { detail: seat }));

function Discard({ d }: { d: PanelData }) {
  const facedown = d.era === 'canal' && d.discard == null;
  return d.discard != null
    ? <img className="br-disc" src={cardArt(d.discard)} alt={`آخرین کارت دورریخته: ${cardLabel(d.discard)}`} data-flip={`card-${d.discard}`} key={d.discard} />
    : <img className="br-disc" src={BACK} alt={facedown ? '۱ کارت رو به پایین' : 'کارتی دور ریخته نشده'} title={facedown ? '۱ کارت رو به پایین' : undefined} />;
}

function PanelBody({ d, status, me, head = true }: { d: PanelData; status?: string; me?: boolean; head?: boolean }) {
  const moneyPop = usePop(d.money);
  const s = d.seat;
  const lvl = d.income;
  return (
    <div className={['br-sc br-pl', me ? 'br-pl--me' : ''].join(' ')} style={seatStyle(s)} data-seat={s} data-flip-anchor={`seat-${s}`}>
      {head && <div className="br-panel__head">{status && <small className="br-panel__status">{status}</small>}<Discard d={d} /></div>}
      <div className="br-panel__row">
        <span className="br-box br-box--vp"><span className="br-vp"><b>{fa(d.vp)}</b></span><small>امتیاز</small></span>
        <span className="br-box"><span className={`br-box__v ${moneyPop}`} key={`m${d.money}`}><img src={art(IDS.coins['1'])} alt="" /><span className="br-gbp">{gbp(d.money)}</span></span><small>پول</small></span>
        <span className={['br-box', lvl < 0 ? 'is-neg' : ''].join(' ')}><span className="br-box__v"><img src={art(`art/markers/income-${color(s)}.webp`)} alt="" /><span className="br-num">{signed(lvl)}</span></span><small>درآمد</small></span>
        <span className="br-box"><span className="br-box__v"><span className="br-gbp">{gbp(d.spent)}</span></span><small>خرج دور</small></span>
      </div>
      <div className="br-panel__row2">
        <span className="br-stat" title="کارت در دست"><img src={BACK} alt="" /><b>{fa(d.cards)}</b><small>کارت</small></span>
        <span className="br-stat" title="مسیر باقی"><img className="br-stat__link" src={art(`art/links/link-${color(s)}-${d.era}.webp`)} alt="" /><b>{fa(d.linksLeft)}</b><small>مسیر</small></span>
        <span className="br-stat" title="کاشی روی نقشه"><img src={tileArt('cotton', 1, s)} alt="" /><b>{fa(d.tiles)}</b><small>کاشی</small></span>
      </div>
      <ol className="br-itrack" dir="ltr" aria-label={`سطح درآمد ${signed(lvl)}`}>
        {Array.from({ length: 7 }, (_, i) => Math.min(24, Math.max(-10, lvl - 3)) + i).map((n) => (
          <li key={n} className={n === lvl ? 'is-on' : ''}>{n === lvl ? <img src={art(`art/markers/income-${color(s)}.webp`)} alt="" /> : null}<span className="br-num">{signed(n)}</span></li>
        ))}
      </ol>
      <div className="br-ntiles">
        <ul aria-label="کاشی بعدی هر صنعت">
          {INDUSTRIES.map((x) => {
            const t = d.nextTiles[x];
            return <li key={x} title={t ? `${IND_FA[x]} ${ROMAN[t.level]}: ${fa(t.left)} کاشی` : `${IND_FA[x]}: تمام شد`}>
              {t ? <><img src={tileArt(x, t.level, s)} alt={`${IND_FA[x]} ${ROMAN[t.level]}`} /><i aria-hidden>{Array.from({ length: Math.min(t.left, 4) }, (_, k) => <b key={k} />)}</i></> : <span className="br-ntiles__gone" aria-label={`${IND_FA[x]}: تمام شد`} />}
            </li>;
          })}
        </ul>
        <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm br-matbtn" aria-haspopup="dialog" aria-label="صفحهٔ صنعت" onClick={(e) => { e.stopPropagation(); openMat(s); }}>+</button>
      </div>
    </div>
  );
}

/** Shell rail panel (SEAT_CARDS): the BGA body of COMPONENTS §11 from the public summary (`stats` + `detail`). */
export function brassSeatCard(seat: { seat: number; primary?: { value: number }; stats?: { key: string; value: number | string }[]; detail?: object }) {
  const st = (k: string) => Number(seat.stats?.find((x) => x.key === k)?.value ?? 0);
  const det = (seat.detail ?? {}) as { linksLeft?: number; tilesOnBoard?: number; discardTop?: number | null; nextTiles?: PanelData['nextTiles']; era?: 'canal' | 'rail' };
  const d: PanelData = {
    seat: seat.seat, vp: seat.primary?.value ?? 0, money: st('money'), income: st('income'), spent: st('spent'), cards: st('cards'),
    linksLeft: det.linksLeft ?? LINK_TILES, tiles: det.tilesOnBoard ?? 0, era: det.era ?? 'canal', discard: det.discardTop ?? null, nextTiles: det.nextTiles ?? {}
  };
  return {
    stats: undefined,
    // VP lives in the body's first tile; the turn pill is the only clock; portrait as the avatar; top discard in the header
    score: <span className="br-sc br-hdisc"><Discard d={d} /></span>, scoreLabel: undefined, clock: undefined, badge: undefined,
    avatar: { src: charArt(seat.seat), name: `شخصیت ${['قرمز', 'زرد', 'بنفش', 'خاکستری'][seat.seat] ?? ''}`, className: 'br-sc br-avatar', style: seatStyle(seat.seat) },
    detail: <PanelBody d={d} head={false} />
  };
}

// ---------- industry mat (§10, §12) ----------

function MatBody({ view, s, me, L }: { view: BrassView; s: number; me: boolean; L: Lx }) {
  const disc = view.discardTop[s];
  return (
    <div className="br-matwrap">
      <div className="br-mat" dir="ltr">
        <img className="br-base" src={art(IDS.boards.mat)} alt="" />
        {INDUSTRIES.map((x) => {
          const rest = STACK[x].slice(view.mat[s]![x]);
          const next = rest[0]?.level;
          return Object.entries((MAT.frames as Record<string, Record<string, number[]>>)[x] ?? {}).map(([lv, p]) => {
            const n = rest.filter((u) => u.level === Number(lv)).length;
            if (!n) return null;
            const top = (y: number) => `${(y / MAT.matHeight) * 100}%`;
            return [
              <img key={`${x}${lv}`} className={['br-mtile', n > 1 ? 'is-stack' : '', me && Number(lv) === next ? 'is-next' : ''].join(' ')} data-industry={x} data-level={lv}
                style={{ insetInlineStart: `${p[0]! / 10}%`, top: top(p[1]!) }} src={tileArt(x, Number(lv), s)} alt={`${L.ind(x)} ${ROMAN[Number(lv)]}: ${L.n(n)}`} />,
              n > 1 ? <span key={`${x}${lv}n`} className="br-mcount" style={{ insetInlineStart: `${(p[0]! + MAT.countBadgeOffset[0]!) / 10}%`, top: top(p[1]! + MAT.countBadgeOffset[1]!) }}>×{L.n(n)}</span> : null
            ];
          });
        })}
      </div>
      <aside className="br-side">
        <figure>{disc != null ? <img className="br-disc br-disc--lg" src={cardArt(disc)} alt={cardLabel(disc, L)} /> : <img className="br-disc br-disc--lg" src={BACK} alt="" />}<figcaption>{L.t('آخرین کارت دورریخته', 'Top discard')}</figcaption></figure>
        <figure className="br-linkstack"><img src={art(`art/links/link-${color(s)}-${view.era}.webp`)} alt="" /><b>×{L.n(LINK_TILES - Object.values(view.links).filter((o) => o === s).length)}</b><figcaption>{L.t('مسیر باقی', 'Links left')}</figcaption></figure>
      </aside>
    </div>
  );
}

function AreaHead({ view, s, who, L, children }: { view: BrassView; s: number; who: string; L: Lx; children?: ReactNode }) {
  const lvl = view.incomeLevels[s]!;
  return (
    <header className="br-ahead" style={seatStyle(s)}>
      <span className="br-ahead__name"><img src={charArt(s)} alt="" /><bdi>{who}</bdi></span>
      <span className="br-vp"><b>{L.n(view.vp[s]!)}</b><small>{L.t('امتیاز', 'VP')}</small></span>
      <span className="br-chip"><img src={art(IDS.coins['5'])} alt="" /><span><b className="br-gbp">{L.gbp(view.money[s]!)}</b><small>{L.t('پول', 'Money')}</small></span></span>
      <span className={['br-chip', lvl < 0 ? 'is-neg' : ''].join(' ')}><img src={art(`art/markers/income-${color(s)}.webp`)} alt="" /><span><b className="br-num">{L.sg(lvl)}</b><small>{L.t('درآمد هر دور', 'Income')}</small></span></span>
      <span className="br-chip"><span><b className="br-gbp">{L.gbp(view.spent[s]!)}</b><small>{L.t('خرج این دور', 'Spent')}</small></span></span>
      <span className="br-chip"><img src={BACK} alt="" /><span><b>{L.n(view.handCounts[s]!)}</b><small>{L.t('کارت', 'Cards')}</small></span></span>
      {children && <span className="br-ahead__end">{children}</span>}
    </header>
  );
}

function MatDialog({ view, s, who, me, L, onClose, onStep }: { view: BrassView; s: number; who: string; me: boolean; L: Lx; onClose: () => void; onStep: (d: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, [s]);
  return (
    <div className="br-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={L.t(`صفحهٔ صنعت ${who}`, `${who}: industry mat`)} className="bgv-dialog br-matdialog" style={seatStyle(s)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') onStep(1); if (e.key === 'ArrowRight') onStep(-1); }}>
        <AreaHead view={view} s={s} who={who} L={L}>
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بازیکن قبلی', 'Previous player')} onClick={() => onStep(-1)}>→</button>
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بازیکن بعدی', 'Next player')} onClick={() => onStep(1)}>←</button>
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بستن', 'Close')} onClick={onClose}>×</button>
        </AreaHead>
        <MatBody view={view} s={s} me={me} L={L} />
      </section>
    </div>
  );
}

// ---------- era / game end scoring (§18), computed from the last view of the era ----------

interface EraScore { era: 'canal' | 'rail'; rows: { seat: number; links: number; tiles: number }[] }
function eraScore(v: BrassView): EraScore {
  const rows = v.vp.map((_, seat) => ({ seat, links: 0, tiles: 0 }));
  for (const [id, owner] of Object.entries(v.links)) rows[owner]!.links += linkNodes(LINK.get(id)!).reduce((n, x) => n + locationLinkVp(v, x), 0);
  for (const row of Object.values(v.board)) for (const t of row) if (t?.flipped) rows[t.owner]!.tiles += tileDef(t.industry, t.level).vp;
  return { era: v.era, rows };
}

const actionsOfTurn = (v: BrassView) => (v.era === 'canal' && v.round === 1 ? 1 : 2);
const firstAction = (v: BrassView) => Math.max(1, actionsOfTurn(v) - v.actionsLeft + 1);

// ---------- renderer ----------

type Choice = { loc: string; slot: number; owner: number };
type Hint = GameAction & { cost?: ActionCost; choices?: { coal?: Choice[]; iron?: Choice[]; beer?: Choice[]; barrel?: boolean } };
type Src = { loc: string; slot: number } | { merchant: true };
type Tab = 'map' | 'hand' | 'mat' | 'players';
type EraStage = 'income' | 'links' | 'tiles' | 'level1' | 'beer' | 'hand';
const NO_TARGETS: Targets = { slots: [], links: [], merchants: [], ghost: null, ghostLinks: [], tip: null };

export default function BrassRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<BrassView>) {
  const root = useRef<HTMLDivElement>(null);
  const phone = useMedia('(max-width: 899px)');
  const [en, setEn] = useState(false);
  const L = useMemo(() => lx(en), [en]);
  const pageTheme = usePageTheme();
  const zoneRef = useRef<HTMLElement>(null);
  const pvCards = !queued ? [] : queued.type === 'scout' ? (queued.cards as number[]) : typeof queued.card === 'number' ? [queued.card] : [];
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const who = (s: number) => (s === mySeat ? L.t('شما', 'You') : seatName(s));
  const all = legalActions as Hint[];
  const types = useMemo(() => new Set(all.map((a) => a.type)), [all]);
  const myTurn = !queued && ACTS.some((a) => types.has(a));
  const [kind, setKind] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [rawSales, setSales] = useState<number[]>([]);
  const [devBonus, setDevBonus] = useState<Industry | ''>('');
  const [card, setCard] = useState<number | null>(null);
  const [scout, setScout] = useState<number[]>([]);
  const [src, setSrc] = useState<{ coal?: Src; iron?: Src; beer: Record<number, Src> }>({ beer: {} });
  const [matSeat, setMatSeat] = useState<number | null>(null);
  const [aid, setAid] = useState(false);
  const [shortPick, setShortPick] = useState<number[]>([]);
  const [tab, setTab] = useState<Tab>('map');
  const [matTab, setMatTab] = useState<number | null>(null);
  const reset = () => { setPick(null); setSales([]); setCard(null); setScout([]); setDevBonus(''); setSrc({ beer: {} }); };
  useEffect(() => { setKind(null); reset(); setShortPick([]); }, [view.seq]);
  useEffect(() => {
    const f = (e: Event) => setMatSeat((e as CustomEvent<number>).detail);
    window.addEventListener('br:mat', f);
    return () => window.removeEventListener('br:mat', f);
  }, []);

  // Session log and era-end scoring: built from the views this client saw (the server keeps only `last`).
  const prev = useRef<BrassView | null>(null);
  const [score, setScore] = useState<EraScore | null>(null);
  const [eraSeq, setEraSeq] = useState<{ prev: BrassView; stages: EraStage[]; i: number } | null>(null);
  const endSeq = () => { setEraSeq((q) => { if (q) setScore(eraScore(q.prev)); return null; }); };
  useEffect(() => {
    if (!eraSeq) return;
    const id = setTimeout(() => { if (eraSeq.i + 1 >= eraSeq.stages.length) endSeq(); else setEraSeq({ ...eraSeq, i: eraSeq.i + 1 }); }, 1800);
    return () => clearTimeout(id);
  }, [eraSeq]);
  useEffect(() => {
    const p = prev.current;
    if (p && (p.era !== view.era || (!p.outcome && view.outcome))) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
      if (reduced) setScore(eraScore(p));
      else setEraSeq({ prev: p, stages: p.era === 'canal' ? ['income', 'links', 'tiles', 'level1', 'beer', 'hand'] : ['links', 'tiles'], i: 0 });
    }
    prev.current = view;
  }, [view]);

  const hints = all.filter((a) => a.type === kind);
  const sales = rawSales.filter((i) => hints[i] !== undefined);
  const chosen = pick !== null ? hints[pick] : undefined;
  const hand = (view.hand ?? []).filter((c) => !pvCards.includes(c));
  const exp = expected;
  const needsTarget = kind === 'build' || kind === 'network' || kind === 'develop' || kind === 'sell';
  const targetDone = kind === 'sell' ? sales.length > 0 : needsTarget ? !!chosen : true;

  // Concrete action from the selection; picked resource sources only when the player changed them (RULES E2).
  const srcArr = (x?: Src) => (x ? [x] : undefined);
  let action: GameAction | null = null;
  if (kind === 'scout') action = scout.length === 3 ? { type: 'scout', cards: scout } : null;
  else if (card !== null && targetDone) {
    if (kind === 'build' && chosen) action = { type: 'build', card, industry: chosen.industry, loc: chosen.loc, slot: chosen.slot, ...(src.coal ? { coal: srcArr(src.coal) } : {}), ...(src.iron ? { iron: srcArr(src.iron) } : {}) };
    else if (kind === 'network' && chosen) action = { type: 'network', card, links: chosen.links, ...(src.coal ? { coal: srcArr(src.coal) } : {}) };
    else if (kind === 'develop' && chosen) action = { type: 'develop', card, industries: chosen.industries, ...(src.iron ? { iron: srcArr(src.iron) } : {}) };
    else if (kind === 'sell') {
      let used = false;
      action = { type: 'sell', card, sales: sales.map((i) => {
        const h = hints[i]!;
        const dev = h.merchant === 'gloucester' && devBonus && !used ? (used = true, devBonus) : undefined;
        return { loc: h.loc, slot: h.slot, merchant: h.merchant, ...(dev ? { develop: dev } : {}), ...(src.beer[i] ? { beer: [src.beer[i]] } : {}) };
      }) };
    } else if (kind === 'loan' || kind === 'pass') action = { type: kind, card };
  }
  const cardChoices = kind === 'build' ? ((chosen?.cards as number[] | undefined) ?? []) : hand;
  const cost = kind === 'sell' ? sumCosts(sales.map((i) => hints[i]!.cost!).filter(Boolean)) : (chosen ?? (kind && !needsTarget ? hints[0] : undefined))?.cost ?? null;
  const same = (a: GameAction, b: GameAction) => JSON.stringify(a) === JSON.stringify(b);
  const core = (h: GameAction) => { const { cards: _c, card: _d, cost: _e, choices: _f, ...rest } = h as Hint & { cards?: unknown; card?: unknown }; void _c; void _d; void _e; void _f; return rest; };
  const isExp = (h: Hint) => !!exp && exp.type === h.type && (h.type === 'sell'
    ? (exp.sales as { loc: string; slot: number; merchant?: string }[]).some((x) => x.loc === h.loc && x.slot === h.slot && x.merchant === h.merchant)
    : same(core(exp), core(h)));
  const expCards = !exp ? [] : exp.type === 'scout' ? (exp.cards as number[]) : [exp.card as number];

  const choose = (i: number) => { setPick(i); setCard(null); setSrc({ beer: {} }); };
  const toggleSale = (i: number) => {
    const h = hints[i]!;
    setSales(sales.includes(i) ? sales.filter((j) => j !== i) : [...sales.filter((j) => hints[j]!.loc !== h.loc || hints[j]!.slot !== h.slot), i]);
    setCard(null);
  };
  const back = () => {
    if (card !== null || scout.length) { setCard(null); setScout([]); return; }
    if (pick !== null || sales.length) { setPick(null); setSales([]); setDevBonus(''); setSrc({ beer: {} }); return; }
    setKind(null);
  };
  const pickKind = (k: string) => { setKind(k); reset(); };

  // Phone: the tab follows the step (map for a target, hand for the card); the player can still switch.
  const step = !kind ? 'kind' : kind === 'scout' ? 'card' : needsTarget && !targetDone ? 'target' : card === null ? 'card' : 'confirm';
  useEffect(() => {
    if (!phone || !myTurn) return;
    if (step === 'target' && kind !== 'develop') setTab('map');
    if (step === 'card') setTab('hand');
  }, [phone, myTurn, step, kind]);

  // Map targets of the current step (COMPONENTS §14).
  const targets: Targets = { slots: [], links: [], merchants: [], ghost: null, ghostLinks: [], tip: null };
  const hintOn = (i: number) => !!exp && isExp(hints[i]!) && (kind === 'sell' ? !sales.includes(i) : pick !== i);
  if (myTurn && kind === 'build') {
    const bySlot = new Map<string, number[]>();
    hints.forEach((h, i) => { const k = `${h.loc}:${h.slot}`; bySlot.set(k, [...(bySlot.get(k) ?? []), i]); });
    for (const [k, idx] of bySlot) {
      const [loc, slot] = [k.split(':')[0]!, Number(k.split(':')[1])];
      const cur = pick !== null ? idx.indexOf(pick) : -1;
      targets.slots.push({ loc, slot, picked: cur >= 0, hint: idx.some(hintOn), label: L.t(`${L.loc(loc)} خانهٔ ${L.n(slot + 1)}`, `${L.loc(loc)} space ${slot + 1}`), onPick: () => choose(idx[(cur + 1) % idx.length]!) }); // tap again: next industry of a two-icon slot
    }
    if (chosen && mySeat !== null) {
      const t = STACK[chosen.industry as Industry][view.mat[mySeat]![chosen.industry as Industry]];
      if (t) targets.ghost = { loc: chosen.loc as string, slot: chosen.slot as number, industry: t.industry, level: t.level, owner: mySeat };
    }
  }
  if (myTurn && kind === 'network') {
    const picked = (chosen?.links as string[] | undefined) ?? [];
    hints.forEach((h, i) => {
      const ls = h.links as string[];
      if (ls.length === 1) targets.links.push({ id: ls[0]!, picked: picked.includes(ls[0]!), hint: hintOn(i), onPick: () => choose(i) });
    });
    if (picked.length) hints.forEach((h, i) => { const ls = h.links as string[]; if (ls.length === 2 && ls[0] === picked[0] && !targets.links.some((x) => x.id === ls[1])) targets.links.push({ id: ls[1]!, picked: false, hint: false, onPick: () => choose(i) }); });
    if (mySeat !== null) targets.ghostLinks = picked.map((id) => ({ id, owner: mySeat }));
  }
  if (myTurn && kind === 'sell') {
    const tiles = new Map<string, number[]>();
    hints.forEach((h, i) => { const k = `${h.loc}:${h.slot}`; tiles.set(k, [...(tiles.get(k) ?? []), i]); });
    for (const [k, idx] of tiles) {
      const [loc, slot] = [k.split(':')[0]!, Number(k.split(':')[1])];
      const on = idx.find((i) => sales.includes(i));
      targets.slots.push({ loc, slot, picked: on !== undefined, hint: idx.some(hintOn), label: L.t(`فروش کاشی ${L.loc(loc)} خانهٔ ${L.n(slot + 1)}`, `Sell ${L.loc(loc)} space ${slot + 1}`), onPick: () => toggleSale(on ?? idx[0]!) });
      if (on !== undefined) for (const i of idx) targets.merchants.push({ m: hints[i]!.merchant as string, space: hints[i]!.cost?.beerMerchant[0]?.space ?? 0, picked: i === on, onPick: () => toggleSale(i) });
    }
  }
  const costNodes = cost ? costParts(cost, who, L) : [];
  if (chosen && (kind === 'build' || kind === 'network') && cost) {
    const p = kind === 'build' ? SLOTS[chosen.loc as string]?.[chosen.slot as number] : LINKS_AT[(chosen.links as string[]).at(-1)!];
    if (p) targets.tip = { x: p.x, y: p.y, body: <><b>{kind === 'build' ? L.t(`${L.loc(chosen.loc as string)} خانهٔ ${L.n((chosen.slot as number) + 1)}`, `${L.loc(chosen.loc as string)} space ${(chosen.slot as number) + 1}`) : (chosen.links as string[]).map((id) => linkName(L, id)).join(' + ')}</b><span className="br-gbp">{L.gbp(cost.spent)}</span>{costNodes.map((n, i) => <span key={i}>{n}</span>)}</> };
  }
  // Phone build: auto-zoom to the box of the legal spots, 40 units margin (COMPONENTS §15).
  const focus = phone && myTurn && kind === 'build' && targets.slots.length ? (() => {
    const ps = targets.slots.map((s) => SLOTS[s.loc]?.[s.slot]).filter((p): p is { x: number; y: number } => !!p);
    return { x0: Math.min(...ps.map((p) => p.x)) - 40, y0: Math.min(...ps.map((p) => p.y)) - 40, x1: Math.max(...ps.map((p) => p.x)) + 40, y1: Math.max(...ps.map((p) => p.y)) + 40 };
  })() : null;
  const zoom = useMapZoom(focus);

  // Action buttons with their cost pill and disabled reason (COMPONENTS §13).
  const pill = (k: string): ReactNode => {
    const hs = all.filter((h) => h.type === k);
    if (!hs.length) return '';
    if (k === 'build') return L.t(`${L.n(new Set(hs.map((h) => `${h.loc}${h.slot}`)).size)} جا، از ${L.gbp(Math.min(...hs.map((h) => h.cost?.spent ?? 0)))}`, `${new Set(hs.map((h) => `${h.loc}${h.slot}`)).size} spots, from ${L.gbp(Math.min(...hs.map((h) => h.cost?.spent ?? 0)))}`);
    if (k === 'network') return view.era === 'canal' ? L.gbp(3) : `${L.gbp(5)} + ${L.t('زغال', 'coal')}`;
    if (k === 'develop') return <><img className="br-ic" src={RES_ART.iron} alt={L.t('آهن', 'iron')} />{L.t(`هر کاشی، از ${L.gbp(Math.min(...hs.map((h) => h.cost?.spent ?? 0)))}`, `per tile, from ${L.gbp(Math.min(...hs.map((h) => h.cost?.spent ?? 0)))}`)}</>;
    if (k === 'sell') return L.t(`${L.n(new Set(hs.map((h) => `${h.loc}${h.slot}`)).size)} کاشی`, `${new Set(hs.map((h) => `${h.loc}${h.slot}`)).size} tiles`);
    if (k === 'loan') return L.t(`+${L.gbp(30)}، درآمد −۳`, `+${L.gbp(30)}, income −3`);
    if (k === 'scout') return L.t('۳ → ۲ آزاد', '3 → 2 wild');
    return phone ? L.t('فقط یک کارت دور', 'discard one card') : '';
  };
  const reason = (k: string): string => {
    if (k === 'build') return 'NO_BUILD';
    if (k === 'network') return 'NO_LINK';
    if (k === 'develop') return 'CANNOT_DEVELOP';
    if (k === 'sell') return 'NO_SELL';
    if (k === 'loan') return 'NO_LOAN';
    if (k === 'scout') return (view.hand ?? []).some((c) => c >= WILD_LOCATION) ? 'HAS_WILD' : view.wild.location < 1 || view.wild.industry < 1 ? 'NO_WILD_LEFT' : 'FEW_CARDS';
    return '';
  };
  const stepsOf = (k: string) => (k === 'scout' ? [L.t('۳ کارت', '3 cards')] : k === 'loan' || k === 'pass' ? [L.t('کارت', 'Card')] : [k === 'build' ? L.t('جا', 'Spot') : k === 'network' ? L.t('مسیر', 'Line') : k === 'develop' ? L.t('صنعت', 'Industry') : L.t('کاشی و تاجر', 'Tile & merchant'), L.t('کارت', 'Card')]);
  const curStep = !kind ? -1 : kind === 'scout' ? (scout.length === 3 ? 1 : 0) : needsTarget ? (!targetDone ? 0 : card === null ? 1 : 2) : card === null ? 0 : 1;
  const gloucester = kind === 'sell' && sales.some((i) => hints[i]!.merchant === 'gloucester' && (hints[i]!.cost?.beerMerchant.length ?? 0) > 0);
  const placeOf = (s: number) => view.outcome?.placements.find((x) => x.seat === s)?.place;
  const seats = view.order;
  const eraFa = view.era === 'canal' ? L.t('دورهٔ کانال', 'Canal Era') : L.t('دورهٔ راه‌آهن', 'Rail Era');
  const roundsOf = view.players === 2 ? 10 : view.players === 3 ? 9 : 8;
  const coalBuy = view.coal > 0 ? MARKET.coal.prices[MARKET.coal.prices.length - view.coal]! : MARKET.coal.empty;
  const ironBuy = view.iron > 0 ? MARKET.iron.prices[MARKET.iron.prices.length - view.iron]! : MARKET.iron.empty;
  const turnText = <><b>{L.t('نوبت شماست:', 'Your turn:')}</b> {L.t(`اقدام ${L.n(firstAction(view))} از ${L.n(actionsOfTurn(view))} در دور ${L.n(view.round)} ${eraFa}.`, `action ${firstAction(view)} of ${actionsOfTurn(view)}, round ${view.round}, ${eraFa}.`)}</>;
  const helpText = !kind ? L.t('یک اقدام انتخاب کنید؛ هر اقدام یک کارت از دستتان را دور می‌اندازد.', 'Pick an action; each action discards one card.')
    : kind === 'scout' ? L.t(`سه کارت برای دور انداختن انتخاب کنید (${L.n(scout.length)} از ۳).`, `Pick three cards to discard (${scout.length} of 3).`)
    : !targetDone ? L.t('هدف را روی نقشه یا از فهرست بزنید.', 'Pick the target on the board or in the list.')
    : card === null ? L.t('کارتی را که دور می‌اندازید بزنید؛ کارت‌های مجاز حلقهٔ کهربایی دارند.', 'Pick the card to discard; legal cards have the amber ring.')
    : L.t('تا «ثبت» با «برگرد» همه‌چیز عوض می‌شود؛ بعد از ثبت برگشت نیست.', 'Until «Confirm», «Back» changes everything; no undo after it.');

  const kindButtons = (
    <div className="br-kinds" role="group" aria-label={L.t('نوع اقدام', 'Action')}>
      {ACTS.map((k) => {
        const ok = types.has(k);
        const why = ok ? '' : reason(k);
        const p = pill(k);
        return <button key={k} type="button" className={['bgv-btn bgv-btn--sm', exp?.type === k && kind !== k ? 'br-hint' : ''].join(' ')} data-act={k}
          aria-label={L.act(k)} {...(ok ? { 'aria-pressed': kind === k } : {})} disabled={busy || !ok} {...(why ? { 'data-reason': why, title: REASON[why]![en ? 1 : 0] } : {})}
          onClick={() => pickKind(k)}>{L.act(k)}{p ? <span className="br-pill">{p}</span> : why ? <span className="br-pill br-pill--why">{REASON_SHORT[why]![en ? 1 : 0]}</span> : null}</button>;
      })}
    </div>
  );
  const stepsRow = kind && (
    <ol className="br-steps" aria-label={L.t('مراحل', 'Steps')}>
      <li className="br-step is-done">{L.act(kind)}</li>
      {stepsOf(kind).map((x, i) => <li key={x} className={['br-step', i < curStep ? 'is-done' : i === curStep ? 'is-cur' : ''].join(' ')}>{x}</li>)}
      <li className={['br-step', action ? 'is-cur' : ''].join(' ')}>{L.t('ثبت', 'Confirm')}</li>
    </ol>
  );
  const targetList = needsTarget && (
    <div className="br-targets" role="listbox" aria-label={L.t('هدف', 'Target')} aria-multiselectable={kind === 'sell'}>
      {hints.map((h, i) => {
        const on = kind === 'sell' ? sales.includes(i) : pick === i;
        return <button key={i} type="button" role="option" aria-selected={on} disabled={busy} className={['br-target', on ? 'is-on' : '', hintOn(i) ? 'br-hint' : ''].join(' ')}
          onClick={() => (kind === 'sell' ? toggleSale(i) : choose(i))}>
          {h.type === 'build' && mySeat !== null && (() => { const t = STACK[h.industry as Industry][view.mat[mySeat]![h.industry as Industry]]; return t ? <img src={tileArt(t.industry, t.level, mySeat)} alt="" /> : null; })()}
          {h.type === 'develop' && (h.industries as Industry[]).map((x, k) => <img key={k} src={IND_ICON(x)} alt="" />)}
          {h.type === 'sell' && (() => { const t = view.board[h.loc as string]?.[h.slot as number]; return t ? <img src={tileArt(t.industry, t.level, t.owner)} alt="" /> : null; })()}
          <span>{targetText(view, mySeat, h, L)}</span>
          {h.cost && h.cost.spent > 0 && <b className="br-gbp">{L.gbp(h.cost.spent)}</b>}
        </button>;
      })}
    </div>
  );
  // Source rows (RULES E2): only when the server says there is a real choice.
  const srcRow = (label: string, res: 'coal' | 'iron' | 'beer', list: Choice[], cur: Src | undefined, set: (x: Src | undefined) => void, barrel = false) => (
    <div key={`${label}${res}`} className="br-targets br-src" role="group" aria-label={label}>
      <span className="br-src__label"><img className="br-ic" src={RES_ART[res]} alt="" />{label}</span>
      <button type="button" className={['br-target', !cur ? 'is-on' : ''].join(' ')} aria-pressed={!cur} onClick={() => set(undefined)}>{L.t('پیش‌فرض سرور', 'Server default')}</button>
      {barrel && <button type="button" className={['br-target', cur && !('loc' in cur) ? 'is-on' : ''].join(' ')} aria-pressed={!!cur && !('loc' in cur)} onClick={() => set({ merchant: true })}>{L.t('بشکهٔ تاجر', 'Merchant barrel')}</button>}
      {list.map((c) => {
        const t = view.board[c.loc]?.[c.slot];
        const on = !!cur && 'loc' in cur && cur.loc === c.loc && cur.slot === c.slot;
        return <button key={`${c.loc}${c.slot}`} type="button" className={['br-target', on ? 'is-on' : ''].join(' ')} aria-pressed={on} onClick={() => set({ loc: c.loc, slot: c.slot })}>
          {t && <img src={tileArt(t.industry, t.level, t.owner, t.flipped)} alt="" />}<span>{L.loc(c.loc)} (<bdi>{who(c.owner)}</bdi>)</span>
        </button>;
      })}
    </div>
  );
  const ch = chosen?.choices;
  const srcRows = [
    ...(ch?.coal && kind !== 'sell' ? [srcRow(L.t('منبع زغال', 'Coal source'), 'coal', ch.coal, src.coal, (x) => setSrc({ ...src, ...(x ? { coal: x } : { coal: undefined }) }))] : []),
    ...(ch?.iron && kind !== 'sell' ? [srcRow(L.t('منبع آهن', 'Iron source'), 'iron', ch.iron, src.iron, (x) => setSrc({ ...src, ...(x ? { iron: x } : { iron: undefined }) }))] : []),
    ...(kind === 'sell' ? sales.filter((i) => hints[i]!.choices?.beer).map((i) => srcRow(L.t(`منبع آبجو: ${targetText(view, mySeat, hints[i]!, L)}`, `Beer: ${targetText(view, mySeat, hints[i]!, L)}`), 'beer', hints[i]!.choices!.beer!, src.beer[i],
      (x) => { const beer = { ...src.beer }; if (x) beer[i] = x; else delete beer[i]; setSrc({ ...src, beer }); }, !!hints[i]!.choices!.barrel)) : [])
  ];
  const custom = !!(src.coal || src.iron || Object.keys(src.beer).length);
  const gloucesterRow = gloucester && mySeat !== null && (
    <div className="br-targets" role="group" aria-label={L.t('پاداش گلاستر: توسعهٔ رایگان', 'Gloucester bonus: free develop')}>
      {INDUSTRIES.map((x) => { const t = STACK[x][view.mat[mySeat]![x]]; const ok = !!t && !t.noDevelop; return (
        <button key={x} type="button" className={['br-target', devBonus === x ? 'is-on' : ''].join(' ')} aria-pressed={devBonus === x} disabled={!ok || busy} onClick={() => setDevBonus(devBonus === x ? '' : x)}>
          {t && <img src={tileArt(x, t.level, mySeat)} alt="" />}{L.ind(x)}
        </button>); })}
    </div>
  );
  const sumRow = cost && (
    <div className="br-sum" aria-live="polite">
      {costNodes}
      {custom && <span className="br-sum__note">{L.t('هزینه با منبع پیش‌فرض؛ سرور منبع انتخابی شما را اعمال می‌کند.', 'Cost shown with the default source; the server applies your pick.')}</span>}
      <span className="br-sum__total">{L.t('جمع', 'Total')} <b className="br-gbp">{L.gbp(cost.spent)}</b></span>
    </div>
  );
  const btns = (
    <>
      {kind && <button type="button" className="bgv-btn bgv-btn--sm" disabled={busy} onClick={back}>{L.t('برگرد', 'Back')}</button>}
      <button type="button" className={['bgv-btn bgv-btn--primary bgv-btn--sm', action && exp && same(action, exp) ? 'br-hint' : ''].join(' ')} data-act="confirm" disabled={busy || !action} onClick={() => action && onAction(action)}>{L.t('ثبت', 'Confirm')}</button>
    </>
  );

  // Income shortfall (RULES E1, Brass-Prompts §1): pick own tiles for half their cost until the debt is covered.
  const short = queued ? undefined : (all.find((h) => h.type === 'shortfall') as (Hint & { owed: number; options: { loc: string; slot: number; industry: Industry; level: number; value: number }[] }) | undefined);
  const shortGot = short ? shortPick.reduce((n, i) => n + (short.options[i]?.value ?? 0), 0) : 0;
  const shortDone = !!short && (shortGot >= short.owed || shortPick.length === short.options.length);
  const shortBar = short && mySeat !== null ? (
    <section className={phone ? 'bgv-actiondock br-dock br__actions' : 'bgv-card br-bar br__actions'} data-theme={pageTheme} aria-label={L.t('کسری پول', 'Shortfall')}>
      <p className="br-bar__text"><b>{L.t('کسری پول:', 'Shortfall:')}</b> {L.t(`بعد از درآمد ${L.gbp(short.owed)} کم دارید. کاشی‌های صنعتتان را به ترتیب بردارید؛ هر کاشی نصف هزینه‌اش را برمی‌گرداند و با جبران کسری باید بایستید.`, `After income you are ${L.gbp(short.owed)} short. Remove industry tiles in order; each returns half its cost; stop once covered.`)}</p>
      <div className="br-targets" role="listbox" aria-multiselectable="true" aria-label={L.t('کاشی‌های قابل برداشتن', 'Tiles to remove')}>
        {short.options.map((o, i) => {
          const on = shortPick.includes(i);
          return <button key={i} type="button" role="option" aria-selected={on} disabled={busy || (!on && shortGot >= short.owed)} className={['br-target', on ? 'is-on' : ''].join(' ')}
            onClick={() => setShortPick(on ? shortPick.filter((j) => j !== i) : [...shortPick, i])}>
            <img src={tileArt(o.industry, o.level, mySeat)} alt="" /><span>{L.ind(o.industry)} {ROMAN[o.level]} {L.t('در', 'in')} {L.loc(o.loc)}</span><b className="br-gbp">+{L.gbp(o.value)}</b>
          </button>;
        })}
      </div>
      <div className="br-sum" aria-live="polite"><span>{L.t('برداشته‌شده: ', 'Removed: ')}<b className="br-gbp">{L.gbp(shortGot)}</b></span>{shortDone && shortGot < short.owed && <span>{L.t(`کسری باقی: ${L.n(short.owed - shortGot)} امتیاز کم می‌شود`, `Still short: lose ${short.owed - shortGot} VP`)}</span>}<span className="br-sum__total">{L.t('کسری', 'Owed')} <b className="br-gbp">{L.gbp(short.owed)}</b></span></div>
      <div className="br-bar__row">
        <p className="br-bar__hint">{L.t('اگر وقت تمام شود، سرور از ارزان‌ترین کاشی شروع می‌کند.', 'On timeout the server removes the cheapest tiles first.')}</p>
        {shortPick.length > 0 && <button type="button" className="bgv-btn bgv-btn--sm" disabled={busy} onClick={() => setShortPick(shortPick.slice(0, -1))}>{L.t('برگرد', 'Back')}</button>}
        <button type="button" className="bgv-btn bgv-btn--primary bgv-btn--sm" data-act="confirm" disabled={busy || !shortDone}
          onClick={() => onAction({ type: 'shortfall', tiles: shortPick.map((i) => ({ loc: short.options[i]!.loc, slot: short.options[i]!.slot })) })}>{L.t('ثبت', 'Confirm')}</button>
      </div>
    </section>
  ) : null;

  const waitText = view.shortfall?.seats.length ? <>{L.t('منتظر انتخاب کاشی برای کسری پول ', 'Waiting for the shortfall choice of ')}<bdi>{who(view.shortfall.seats[0]!)}</bdi>.</>
    : view.outcome ? L.t('بازی تمام شد.', 'Game over.') : queued ? L.t('حرکت شما در حال ثبت است…', 'Sending your move…')
    : view.current !== null ? <>{L.t('نوبت ', 'Turn: ')}<bdi>{who(view.current)}</bdi>{L.t(` است: اقدام ${L.n(firstAction(view))} از ${L.n(actionsOfTurn(view))}، دور ${L.n(view.round)} ${eraFa}.`, `, action ${firstAction(view)} of ${actionsOfTurn(view)}, round ${view.round}, ${eraFa}.`)}</> : '';

  // Desktop action bar (§13).
  const langToggle = (
    <span className="br-lang" role="group" aria-label={L.t('زبان بازی', 'Game language')}>
      <button type="button" aria-pressed={!en} onClick={() => setEn(false)}>فا</button>
      <button type="button" aria-pressed={en} onClick={() => setEn(true)} lang="en">EN</button>
    </span>
  );
  const bar = shortBar ?? (myTurn ? (
    <section className="bgv-card br-bar br__actions" data-theme={pageTheme} aria-label={L.t('اقدام', 'Action')}>
      <div className="br-bar__row"><p className="br-bar__text">{turnText} {L.t('هر اقدام یک کارت از دستتان را دور می‌اندازد.', 'Each action discards one card.')}</p>{langToggle}<span className="br-clock" data-shell-clock /></div>
      {kindButtons}{stepsRow}{targetList}{srcRows}{gloucesterRow}{sumRow}
      <div className="br-bar__row"><p className="br-bar__hint">{helpText}</p>{btns}</div>
    </section>
  ) : <section className="bgv-card br-bar is-waiting" data-theme={pageTheme} aria-live="polite"><div className="br-bar__row"><p className="br-bar__text">{waitText}</p>{langToggle}<span className="br-clock" data-shell-clock /></div></section>);

  // Phone: actions sheet at the start of the turn, then the dock (§15).
  const sheet = phone && myTurn && !kind && !short ? (
    <section className="bgv-actiondock br-dock br-sheet br__actions" data-theme={pageTheme} aria-label={L.t('اقدام‌ها', 'Actions')}>
      <p className="br-sheet__head">{turnText}</p>
      {kindButtons}
      <p className="br-bar__hint">{helpText}</p>
    </section>
  ) : null;
  const dock = phone && !short ? (myTurn && kind ? (
    <section className="bgv-actiondock br-dock br__actions" data-theme={pageTheme} aria-label={L.t('اقدام شما', 'Your action')}>
      {stepsRow}{targetList}{srcRows}{gloucesterRow}{sumRow}
      <p className="br-bar__hint">{helpText}</p>
      <div className="br-bar__row br-dock__btns">{btns}<button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm bgv-btn--ghost" aria-label={L.t('لغو اقدام', 'Cancel action')} disabled={busy} onClick={() => { setKind(null); reset(); }}>×</button></div>
    </section>
  ) : null) : null; // off-turn on phones: the status row and the shell turn pill say whose turn it is

  const handZone = view.hand && (
    <section className="bgv-felt br-zone br__hand" aria-label={L.t('دست شما', 'Your hand')}>
      <header className="br-zone__head"><h2>{L.t('دست شما', 'Your hand')}</h2><small>{L.t(`${L.n(hand.length)} کارت؛ ${view.deckCount ? `${L.n(view.deckCount)} کارت در دسته` : 'دسته خالی است، پس دست دیگر پر نمی‌شود'}.`, `${hand.length} cards; ${view.deckCount ? `${view.deckCount} in the deck` : 'the deck is empty, the hand is not refilled'}.`)}</small></header>
      <div className="br-hand">
        {hand.map((c) => {
          const usable = myTurn && !!kind && (kind === 'scout' || (targetDone && cardChoices.includes(c)));
          const on = kind === 'scout' ? scout.includes(c) : card === c;
          const hint = !!exp && kind === exp.type && !on && expCards.includes(c) && targetDone;
          return (
            <button key={c} type="button" className={['br-card', on ? 'br-card--on' : '', hint ? 'br-hint' : ''].join(' ')} data-flip={`card-${c}`} data-flip-from="deck" data-flip-exit={`seat-${mySeat}`}
              data-pick={on ? 'picked' : usable ? 'selectable' : 'none'} aria-pressed={on} aria-label={cardLabel(c, L)} disabled={busy || !usable}
              onClick={() => (kind === 'scout' ? setScout(on ? scout.filter((x) => x !== c) : scout.length < 3 ? [...scout, c] : scout) : setCard(on ? null : c))}>
              <img src={cardArt(c)} alt="" draggable={false} />
              {on && <span className="br-check" aria-hidden><Icon name="check" size="sm" /></span>}
            </button>
          );
        })}
      </div>
    </section>
  );

  const stage = eraSeq?.stages[eraSeq.i];
  const seqBoard = eraSeq ? (stage === 'beer' || stage === 'hand' ? { ...eraSeq.prev, links: {}, merchants: view.merchants, board: view.board } : stage === 'level1' ? { ...eraSeq.prev, links: {} } : stage === 'tiles' ? { ...eraSeq.prev, links: {} } : eraSeq.prev) : null;
  const seqMarks: Marks = { links: stage === 'links', tiles: stage === 'tiles', leaving: stage === 'level1' };
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void zoneRef.current?.requestFullscreen?.(); };
  const fullBtn = <button type="button" className={phone ? 'bgv-btn bgv-btn--icon' : 'bgv-btn bgv-btn--icon bgv-btn--sm'} aria-label={L.t('تمام‌صفحه', 'Full screen')} onClick={toggleFull}><Icon name="maximize" size="sm" /></button>;
  const aidBtn = <button type="button" className={phone ? 'bgv-btn bgv-btn--icon' : 'bgv-btn bgv-btn--icon bgv-btn--sm'} aria-haspopup="dialog" aria-label={L.t('راهنمای بازیکن', 'Player aid')} onClick={() => setAid(true)}><Icon name="book-open" size="sm" /></button>;
  const mapZone = (
    <section ref={zoneRef} className="bgv-felt br-zone br-mapzone" aria-label={L.t('نقشه', 'Board')}>
      {!phone && <div className="br-maptools">
        <span className="br-maptools__zoom" role="group" aria-label={L.t('بزرگ‌نمایی', 'Zoom')}>
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('کوچک‌تر', 'Zoom out')} disabled={zoom.v.s <= 1} onClick={zoom.zoomOut}>−</button>
          <span className="br-zoomv" aria-live="polite">{L.n(Math.round(zoom.v.s * 100))}٪</span>
          <button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بزرگ‌تر', 'Zoom in')} disabled={zoom.v.s >= ZMAX} onClick={zoom.zoomIn}>+</button>
          <button type="button" className="bgv-btn bgv-btn--sm" aria-label={L.t('کل نقشه', 'Whole board')} disabled={zoom.v.s === 1} onClick={zoom.fit}>{L.t('کل نقشه', 'Whole board')}</button>
        </span>
        <span className="br-eraplate">
          <img src={art(`art/links/link-grey-${view.era}.webp`)} alt="" />
          <b>{eraFa}</b><span>{L.t(`دور ${L.n(view.round)} از ${L.n(roundsOf)}`, `Round ${view.round} of ${roundsOf}`)}</span>
          <span className="br-eraplate__more"><img src={BACK} alt={L.t('دسته', 'Deck')} />{L.n(view.deckCount)}</span>
          <span className="br-eraplate__more"><img src={RES_ART.coal} alt={L.t('زغال', 'Coal')} /><span className="br-gbp">{L.gbp(coalBuy)}</span></span>
          <span className="br-eraplate__more"><img src={RES_ART.iron} alt={L.t('آهن', 'Iron')} /><span className="br-gbp">{L.gbp(ironBuy)}</span></span>
        </span>
        <span className="br-maptools__end">
          {fullBtn}{aidBtn}
        </span>
      </div>}
      {focus && <span className="br-mapinfo" aria-live="polite">{L.t(`بزرگ‌نمایی خودکار: ${L.n(targets.slots.length)} جای مجاز`, `Auto-zoom: ${targets.slots.length} legal spots`)}</span>}
      <div className="br-mapwrap">
      {phone && <span className="br-zoomfloat" data-theme={pageTheme} role="group" aria-label={L.t('بزرگ‌نمایی', 'Zoom')}>
        <button type="button" className="bgv-btn bgv-btn--icon" aria-label={L.t('بزرگ‌تر', 'Zoom in')} disabled={zoom.v.s >= ZMAX} onClick={zoom.zoomIn}>+</button>
        <button type="button" className="bgv-btn bgv-btn--icon" aria-label={L.t('کوچک‌تر', 'Zoom out')} onClick={zoom.zoomOut}>−</button>
        {fullBtn}
      </span>}
      <div ref={zoom.box} className={['br-mapbox', zoom.v.s > 1 ? 'is-zoomed' : ''].join(' ')} role="group" aria-label={L.t('نقشهٔ بیرمنگام', 'Birmingham board')} {...zoom.handlers}>
        <div className="br-mapbox__in" style={{ transform: `translate(${zoom.v.x}px, ${zoom.v.y}px) scale(${zoom.v.s})` }}>
          {eraSeq ? <Board view={seqBoard!} who={who} t={NO_TARGETS} L={L} marks={seqMarks} /> : <Board view={view} who={who} t={targets} L={L} />}
        </div>
      </div>
      </div>
    </section>
  );

  const seqScore = eraSeq ? eraScore(eraSeq.prev) : null;
  const STAGE_FA: Record<EraStage, [string, string]> = {
    income: ['درآمد', 'Income'], links: ['امتیاز مسیرها', 'Link points'], tiles: ['امتیاز کاشی‌های برگشته', 'Flipped tiles'],
    level1: ['حذف سطح I', 'Level I removed'], beer: ['پر شدن آبجوی تاجرها', 'Merchant beer refilled'], hand: ['دست تازه', 'New hand']
  };
  const seqCard = eraSeq && seqScore && stage && (
    <section className="bgv-card br-eraseq" aria-live="polite" aria-label={L.t('پایان دوره', 'Era end')}>
      <header><b>{eraSeq.prev.era === 'canal' ? L.t('پایان دورهٔ کانال', 'End of the Canal Era') : L.t('پایان دورهٔ راه‌آهن', 'End of the Rail Era')}</b>
        <button type="button" className="bgv-btn bgv-btn--ghost bgv-btn--sm" onClick={endSeq}>{L.t('رد شدن', 'Skip')}</button></header>
      <ol className="br-steps">{eraSeq.stages.map((x, k) => <li key={x} className={['br-step', k < eraSeq.i ? 'is-done' : k === eraSeq.i ? 'is-cur' : ''].join(' ')}>{L.t(...STAGE_FA[x])}</li>)}</ol>
      <ul className="br-eraseq__rows">
        {seqScore.rows.map((r) => {
          const val = stage === 'income' ? <span className="br-gbp">{L.sg(eraSeq.prev.incomeLevels[r.seat]!)}</span>
            : stage === 'links' ? L.sg(r.links) : stage === 'tiles' ? L.sg(r.tiles) : L.sg(r.links + r.tiles);
          return <li key={r.seat} style={seatStyle(r.seat)}><img src={charArt(r.seat)} alt="" /><bdi>{who(r.seat)}</bdi><b className="br-num">{val}</b></li>;
        })}
      </ul>
    </section>
  );
  const scoreCard = score && (
    <section className="bgv-card br-score" aria-label={L.t('امتیازشماری پایان دوره', 'Era scoring')}>
      <header><b>{score.era === 'canal' ? L.t('امتیازشماری پایان دورهٔ کانال', 'Canal Era scoring') : L.t('امتیازشماری پایان دورهٔ راه‌آهن', 'Rail Era scoring')}</b><button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بستن', 'Close')} onClick={() => setScore(null)}>×</button></header>
      <table><thead><tr><th>{L.t('بازیکن', 'Player')}</th><th>{L.t('مسیرها', 'Links')}</th><th>{L.t('کاشی‌ها', 'Tiles')}</th><th>{L.t('کل', 'Total')}</th>{view.outcome && <th>{L.t('رتبه', 'Place')}</th>}</tr></thead>
        <tbody>{score.rows.map((r) => <tr key={r.seat} style={seatStyle(r.seat)} className={r.seat === mySeat ? 'is-you' : ''}><td><bdi>{who(r.seat)}</bdi></td><td>{L.sg(r.links)}</td><td>{L.sg(r.tiles)}</td><td><b>{L.sg(r.links + r.tiles)}</b></td>{view.outcome && <td>{L.n(placeOf(r.seat) ?? 0)} <small>({L.n(view.vp[r.seat]!)})</small></td>}</tr>)}</tbody>
      </table>
      {score.era === 'canal' && <p>{L.t('کاشی‌های سطح I حذف شدند، بشکه‌های تاجرها پر شد و هر نفر ۸ کارت تازه گرفت.', 'Level I tiles left the board, merchant beer was refilled and everyone drew 8 new cards.')}</p>}
    </section>
  );
  const mats = (s: number) => (
    <div className="br-mview">
      <div className="br-subtabs" role="tablist" aria-label={L.t('صفحهٔ بازیکن', 'Player mat')}>
        {seats.map((k) => <button key={k} type="button" role="tab" aria-selected={k === s} onClick={() => setMatTab(k)}><img src={charArt(k)} alt="" /><bdi>{who(k)}</bdi></button>)}
      </div>
      <AreaHead view={view} s={s} who={who(s)} L={L} />
      <MatBody view={view} s={s} me={s === mySeat} L={L} />
    </div>
  );
  const status = (s: number) => (view.outcome ? (placeOf(s) ? L.t(`رتبهٔ ${L.n(placeOf(s)!)}`, `Place ${placeOf(s)}`) : '') : view.current === s ? L.t(`در نوبت، اقدام ${L.n(firstAction(view))} از ${L.n(actionsOfTurn(view))}`, `To play, action ${firstAction(view)} of ${actionsOfTurn(view)}`) : L.t(`نفر ${L.n(view.order.indexOf(s) + 1)} این دور`, `Turn ${view.order.indexOf(s) + 1} this round`));

  if (phone) {
    const tabs: [Tab, string][] = [['map', L.t('نقشه', 'Board')], ['hand', L.t(`دست${NBSP}${L.n(hand.length)}`, `Hand${NBSP}${hand.length}`)], ['mat', L.t('صفحهٔ من', 'My mat')], ['players', L.t('بازیکنان', 'Players')]];
    return (
      <div className="br br--phone" ref={root} data-seq={view.seq} data-era={view.era} data-round={view.round} lang={en ? 'en' : 'fa'}>
        <ul className="br-strip" aria-label={L.t('بازیکنان', 'Players')}>
          {seats.map((s) => <li key={s} className={['br-chipp', view.current === s ? 'is-turn' : '', s === mySeat ? 'is-you' : ''].join(' ')} style={seatStyle(s)}>
            <img src={charArt(s)} alt="" />
            <span className="br-chipp__id"><bdi>{who(s)}</bdi><small><span className="br-gbp">{L.gbp(view.money[s]!)}</span><span className="bgv-sep" />{L.t('درآمد', 'income')} <span className="bgv-num--signed">{L.sg(view.incomeLevels[s]!)}</span></small></span>
            <b className="br-chipp__vp">{L.n(view.vp[s]!)}<small>{L.t('امتیاز', 'VP')}</small></b>
          </li>)}
        </ul>
        {seqCard}{scoreCard}
        <div className="br-status" data-theme={pageTheme}>
          <span className="br-status__info"><b>{eraFa}</b><span className="bgv-sep" />{L.t(`دور ${L.n(view.round)}`, `Round ${view.round}`)}<span className="bgv-sep" />{L.t(`اقدام ${L.n(firstAction(view))}/${L.n(actionsOfTurn(view))}`, `Action ${firstAction(view)}/${actionsOfTurn(view)}`)}</span>
          <span className="br-clock" data-shell-clock />
          {aidBtn}
        </div>
        <div className="br-tabs" role="tablist" aria-label={L.t('بخش‌ها', 'Sections')}>
          {tabs.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
        </div>
        <div dir={en ? 'ltr' : 'rtl'}>
          {/* every tab stays mounted (hidden) so previews, flips and e2e hooks survive a tab switch */}
          <div role="tabpanel" hidden={tab !== 'map'}>{mapZone}</div>
          <div role="tabpanel" hidden={tab !== 'hand'}>{handZone}</div>
          <div role="tabpanel" hidden={tab !== 'mat'}>{mats(matTab ?? mySeat ?? seats[0]!)}</div>
          <div role="tabpanel" hidden={tab !== 'players'}>
            <div className="br-mview">
              <ul className="br__players" aria-label={L.t('بازیکنان', 'Players')}>
                {seats.map((s) => <li key={s} className={['bgv-pcard br-panel', view.current === s ? 'is-turn' : '', s === mySeat ? 'is-you' : ''].join(' ')}>
                  <span className="br-panel__id" style={seatStyle(s)}><img className="br-panel__char" src={charArt(s)} alt="" /><b><bdi>{who(s)}</bdi></b></span>
                  <PanelBody d={panelFromView(view, s, s === mySeat && pvCards.length ? pvCards.at(-1) : view.discardTop[s])} status={status(s)} me={s === mySeat} />
                </li>)}
              </ul>
            </div>
          </div>
        </div>
        {shortBar}{sheet}{dock}
        {matSeat !== null && <MatDialog view={view} s={matSeat} who={who(matSeat)} me={matSeat === mySeat} L={L} onClose={() => setMatSeat(null)} onStep={(d) => setMatSeat(seats[(seats.indexOf(matSeat) + d + seats.length) % seats.length]!)} />}
        {aid && <AidDialog L={L} onClose={() => setAid(false)} extra={phone ? langToggle : null} />}
      </div>
    );
  }

  return (
    <div className="br" ref={root} data-seq={view.seq} data-era={view.era} data-round={view.round} lang={en ? 'en' : 'fa'}>
      <div className="br-main" dir={en ? 'ltr' : 'rtl'}>
        {bar}
        {seqCard}{scoreCard}
        {view.outcome && <p className="bgv-card br__result" role="status">{L.t('بازی تمام شد. برنده: ', 'Game over. Winner: ')}{view.outcome.placements.filter((x) => x.place === 1).map((x) => who(x.seat)).join(L.t('، ', ', '))}</p>}
        {handZone}
        {mapZone}
      </div>
      {!view.log?.length && <RailSlot><section className="bgv-card br-sc br-log" aria-label={L.t('گزارش بازی', 'Game log')}><h3>{eraFa}، {L.t(`دور ${L.n(view.round)}`, `round ${view.round}`)}</h3><p>{L.t('هنوز حرکتی ثبت نشده است.', 'No moves yet.')}</p></section></RailSlot>}
      {matSeat !== null && <MatDialog view={view} s={matSeat} who={who(matSeat)} me={matSeat === mySeat} L={L} onClose={() => setMatSeat(null)} onStep={(d) => setMatSeat(seats[(seats.indexOf(matSeat) + d + seats.length) % seats.length]!)} />}
      {aid && <AidDialog L={L} onClose={() => setAid(false)} extra={phone ? langToggle : null} />}
    </div>
  );
}

function AidDialog({ L, onClose, extra }: { L: Lx; onClose: () => void; extra?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="br-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={L.t('راهنمای بازیکن', 'Player aid')} className="bgv-dialog br-aiddialog" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <header className="br-aiddialog__head"><b>{L.t('راهنمای بازیکن', 'Player aid')}</b>{extra}<button type="button" className="bgv-btn bgv-btn--icon bgv-btn--sm" aria-label={L.t('بستن', 'Close')} onClick={onClose}>×</button></header>
        <img src={art('art/player-aids/player-aid-back.webp')} alt={L.t('راهنمای بازیکن: جدول کارت‌ها', 'Player aid: card table')} />
      </section>
    </div>
  );
}

function targetText(view: BrassView, seat: number | null, h: GameAction, L: Lx): string {
  switch (h.type) {
    case 'build': { const t = seat !== null ? STACK[h.industry as Industry][view.mat[seat]![h.industry as Industry]] : undefined; return L.t(`${L.ind(h.industry as Industry)} ${ROMAN[t?.level ?? 0]} در ${L.loc(h.loc as string)}، خانهٔ ${L.n((h.slot as number) + 1)}`, `${L.ind(h.industry as Industry)} ${ROMAN[t?.level ?? 0]} in ${L.loc(h.loc as string)}, space ${(h.slot as number) + 1}`); }
    case 'network': return (h.links as string[]).map((id) => linkName(L, id)).join(' + ');
    case 'develop': return (h.industries as Industry[]).map(L.ind).join(' + ');
    case 'sell': { const t: Tile | null | undefined = view.board[h.loc as string]?.[h.slot as number]; return `${t ? `${L.ind(t.industry)} ${ROMAN[t.level]} ` : ''}${L.loc(h.loc as string)} → ${L.loc(h.merchant as string)}`; }
    default: return L.act(h.type);
  }
}
