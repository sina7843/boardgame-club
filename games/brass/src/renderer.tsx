// برس: بیرمنگام — table renderer. A painted Midlands map (dir="ltr", zoomable) with every canal/rail line, town banners
// and their build slots (painted industry art, level, owner colour, cubes/barrels, flipped mark), merchants with their
// tiles and beer; the coal/iron markets; every player's ledger (VP, £, income, spend, cards, links left, next mat tile
// of each industry); and your own hand as compact cards. The action composer offers exactly the server's legal hints:
// pick an action, then a target (from the list or by tapping the map), the card to discard, then «ثبت».
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import mapArt from './art/map.webp';
import cottonArt from './art/cotton.webp';
import manufacturerArt from './art/manufacturer.webp';
import potteryArt from './art/pottery.webp';
import coalArt from './art/coal.webp';
import ironArt from './art/iron.webp';
import breweryArt from './art/brewery.webp';
import canalArt from './art/canal.webp';
import railArt from './art/rail.webp';
import merchantArt from './art/merchant.webp';
import beerArt from './art/beer.webp';
import coalCube from './art/coal-cube.webp';
import ironCube from './art/iron-cube.webp';
import {
  CARDS, INDUSTRIES, LINK, LINK_TILES, LOC, LOCATIONS, MARKET, MERCHANT_TILE, STACK, WILD_INDUSTRY, WILD_LOCATION, buyPrice,
  linkNodes, tileDef, type BrassView, type Industry
} from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const IND_FA: Record<Industry, string> = { cotton: 'کارخانهٔ پنبه', manufacturer: 'تولیدی', pottery: 'سفال‌گری', coal: 'معدن زغال', iron: 'ذوب‌آهن', brewery: 'آبجوسازی' };
const IND_ART: Record<Industry, string> = { cotton: cottonArt, manufacturer: manufacturerArt, pottery: potteryArt, coal: coalArt, iron: ironArt, brewery: breweryArt };
const IND_HUE: Record<Industry, string> = { cotton: '#d9c9a3', manufacturer: '#9aa4ad', pottery: '#d18a5b', coal: '#3b3631', iron: '#b5652b', brewery: '#c9a24a' };
const ACT_FA: Record<string, string> = { build: 'ساخت صنعت', network: 'ساخت مسیر', develop: 'توسعه', sell: 'فروش', loan: 'وام £۳۰', scout: 'پیشاهنگ', pass: 'رد کردن' };
const ACT_HELP: Record<string, string> = {
  build: 'پایین‌ترین کاشی آن صنعت از صفحهٔ شما ساخته می‌شود؛ هزینه، زغال و آهن کنار هر گزینه آمده است.',
  network: 'کانال £۳؛ ریل £۵ و ۱ زغال؛ دو ریل با هم £۱۵، ۲ زغال و ۱ آبجو. روی خط‌های نقشه هم می‌شود زد.',
  develop: 'هر کاشی ۱ آهن می‌خواهد؛ پایین‌ترین کاشی آن صنعت از صفحه حذف می‌شود.',
  sell: 'هر تعداد کاشی کالا را تیک بزنید؛ هر کدام آبجوی لازمش را مصرف می‌کند و برمی‌گردد.',
  loan: '£۳۰ می‌گیرید و درآمدتان ۳ سطح پایین می‌آید.',
  scout: '۳ کارت دور می‌اندازید و یک کارت شهر آزاد و یک کارت صنعت آزاد می‌گیرید.',
  pass: 'فقط یک کارت دور می‌اندازید.'
};
const SEAT_COLORS = ['#c0392b', '#2471a3', '#d4ac0d', '#7d3c98'];
const BANNER: Record<string, string> = { blue: '#3f6e9c', teal: '#2f8a84', yellow: '#b8962e', red: '#9c3b2e', purple: '#6c4a8f' };
const BONUS_FA = (id: string) => {
  const b = LOC.get(id)?.merchant?.bonus;
  if (!b) return '';
  return b.kind === 'money' ? `+£${fa(b.amount)}` : b.kind === 'vp' ? `+${fa(b.amount)} امتیاز` : b.kind === 'income' ? `+${fa(b.amount)} درآمد` : 'توسعهٔ رایگان';
};
const locName = (id: string) => LOC.get(id)?.nameFa ?? id;
const linkName = (id: string) => linkNodes(LINK.get(id)!).map(locName).join(' ↔ ');

export function cardLabel(id: number): string {
  if (id === WILD_LOCATION) return 'شهر آزاد';
  if (id === WILD_INDUSTRY) return 'صنعت آزاد';
  const c = CARDS[id];
  if (!c) return '؟';
  return c.kind === 'location' ? locName(c.loc) : c.industries.map((x) => IND_FA[x]).join(' / ');
}
const cardHelp = (id: number) =>
  id === WILD_LOCATION ? 'ساخت هر صنعت در هر شهر' : id === WILD_INDUSTRY ? 'ساخت هر صنعت در شبکهٔ شما'
    : CARDS[id]?.kind === 'location' ? 'ساخت هر صنعت در همین شهر' : 'ساخت این صنعت در شبکهٔ شما';

function Card({ id, on, hint, disabled, onClick, from, exit }: { id: number; on?: boolean; hint?: boolean; disabled?: boolean; onClick?: () => void; from: string; exit: string }) {
  const c = CARDS[id];
  const wild = id >= WILD_LOCATION;
  const isLoc = id === WILD_LOCATION || c?.kind === 'location';
  const color = c?.kind === 'location' ? BANNER[LOC.get(c.loc)?.color ?? ''] : undefined;
  const inds = c?.kind === 'industry' ? c.industries : [];
  return (
    <button type="button" data-flip={`card-${id}`} data-flip-from={from} data-flip-exit={exit} aria-pressed={on} disabled={disabled} onClick={onClick}
      className={['br-card', isLoc ? 'br-card--loc' : 'br-card--ind', wild ? 'br-card--wild' : '', on ? 'br-card--on' : '', hint ? 'br-hint' : ''].join(' ')}
      style={color ? { ['--band' as string]: color } : undefined}>
      <span className="br-card__band">{wild ? 'آزاد' : isLoc ? 'شهر' : 'صنعت'}</span>
      {inds.length > 0 && <span className="br-card__art">{inds.map((x) => <img key={x} src={IND_ART[x]} alt="" draggable={false} />)}</span>}
      <b className="br-card__name">{cardLabel(id)}</b>
      <small>{cardHelp(id)}</small>
    </button>
  );
}

const sortKeys = (v: unknown): unknown => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v);
const same = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const strip = (h: GameAction) => { const { cards: _c, card: _d, ...core } = h as GameAction & { cards?: unknown; card?: unknown }; void _c; void _d; return core; };

function buildCost(view: BrassView, seat: number | null, industry: Industry): string {
  if (seat === null) return '';
  const t = STACK[industry][view.mat[seat]![industry]];
  if (!t) return '';
  return [`£${fa(t.cost)}`, t.coal ? `${fa(t.coal)} زغال` : '', t.iron ? `${fa(t.iron)} آهن` : ''].filter(Boolean).join('، ');
}

function hintLabel(view: BrassView, seat: number | null, h: GameAction): string {
  switch (h.type) {
    case 'build': return `${IND_FA[h.industry as Industry]} ${ROMAN[STACK[h.industry as Industry][view.mat[seat ?? 0]![h.industry as Industry]]?.level ?? 0]} در ${locName(h.loc as string)} (خانهٔ ${fa((h.slot as number) + 1)}) — ${buildCost(view, seat, h.industry as Industry)}`;
    case 'network': return (h.links as string[]).map(linkName).join(' + ');
    case 'develop': return (h.industries as Industry[]).map((x) => IND_FA[x]).join(' + ');
    case 'sell': { const t = view.board[h.loc as string]?.[h.slot as number]; return `${t ? `${IND_FA[t.industry]} ${ROMAN[t.level]}` : ''} ${locName(h.loc as string)} → ${locName(h.merchant as string)}${t ? ` (${fa(tileDef(t.industry, t.level).beer)} آبجو)` : ''}`; }
    default: return ACT_FA[h.type] ?? h.type;
  }
}

function Ledger({ view, s, who, me, place, discard }: { view: BrassView; s: number; who: string; me: boolean; place?: number; discard: number | null | undefined }) {
  const vpPop = usePop(view.vp[s]);
  const moneyPop = usePop(view.money[s]);
  const links = LINK_TILES - Object.values(view.links).filter((o) => o === s).length;
  return (
    <li data-flip-anchor={`seat-${s}`} className={['br-pl', view.current === s && !view.outcome ? 'br-pl--turn' : '', me ? 'br-pl--me' : '', place === 1 ? 'br-pl--win' : ''].join(' ')} style={{ borderInlineStartColor: SEAT_COLORS[s] }}>
      <div className="br-pl__top">
        <bdi className="br-pl__name">{who}</bdi>
        {place !== undefined && <span className="br-pl__place">رتبهٔ {fa(place)}</span>}
        <b className={`br-pl__vp ${vpPop}`} key={`v${view.vp[s]}`}>{fa(view.vp[s]!)} امتیاز</b>
      </div>
      <div className="br-pl__stats">
        <span className={moneyPop} key={`m${view.money[s]}`}>£{fa(view.money[s]!)}</span>
        <span>درآمد {fa(view.incomeLevels[s]!)}</span>
        <span>خرج دور £{fa(view.spent[s]!)}</span>
        <span>{fa(view.handCounts[s]!)} کارت</span>
        <span>{fa(links)} مسیر</span>
      </div>
      <div className="br-mat" aria-label="کاشی بعدی هر صنعت">
        {INDUSTRIES.map((x) => {
          const t = STACK[x][view.mat[s]![x]];
          return (
            <span key={x} className={['br-mat__t', t ? '' : 'br-mat__t--out'].join(' ')} title={`${IND_FA[x]}${t ? ` سطح ${ROMAN[t.level]}، £${t.cost}` : ' — تمام شد'}`}>
              <img src={IND_ART[x]} alt={IND_FA[x]} draggable={false} />
              <b>{t ? ROMAN[t.level] : '—'}</b>
            </span>
          );
        })}
      </div>
      {discard != null && <span className="br-muted">آخرین کارت: <span className="br-pl__discard" data-flip={`card-${discard}`} key={discard}>{cardLabel(discard)}</span></span>}
    </li>
  );
}

export default function BrassRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<BrassView>) {
  const root = useRef<HTMLDivElement>(null);
  // Undo-window preview: my move (kept while it is in flight) is drawn at once — the card(s) leave the hand for my
  // ledger, a built tile / link appears on the map. Only what I chose is shown; nothing random is involved.
  const held = useRef<{ seq: number; a: GameAction } | null>(null);
  if (queued) held.current = { seq: view.seq, a: queued };
  const preview = queued ?? (busy && held.current?.seq === view.seq ? held.current.a : null);
  if (!preview) held.current = null;
  const pvCards = !preview ? [] : preview.type === 'scout' ? (preview.cards as number[]) : typeof preview.card === 'number' ? [preview.card] : [];
  const pvBuild = preview?.type === 'build' && mySeat !== null ? STACK[preview.industry as Industry][view.mat[mySeat]![preview.industry as Industry]] : undefined;
  const pvLinks = preview?.type === 'network' ? (preview.links as string[]) : [];
  useFlip(root, `${view.seq}|${preview ? JSON.stringify(preview) : ''}`);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const types = useMemo(() => [...new Set(legalActions.map((a) => a.type))].filter((t) => t !== 'resign'), [legalActions]);
  const [kind, setKind] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [rawSales, setSales] = useState<number[]>([]);
  const [devBonus, setDevBonus] = useState<Industry | ''>('');
  const [card, setCard] = useState<number | null>(null);
  const [scout, setScout] = useState<number[]>([]);
  const reset = () => { setPick(null); setSales([]); setCard(null); setScout([]); setDevBonus(''); };
  useEffect(() => { setKind(null); reset(); }, [view.seq]);
  const hints = legalActions.filter((a) => a.type === kind);
  // Selections index into hints; the render before the reset effect may see new hints with old indexes.
  const sales = rawSales.filter((i) => hints[i] !== undefined);
  const chosen = pick !== null ? hints[pick] : undefined;
  const hand = (view.hand ?? []).filter((c) => !pvCards.includes(c));
  const exp = expected;
  const coalPop = usePop(view.coal);
  const ironPop = usePop(view.iron);

  // Build the concrete action from the selection.
  let action: GameAction | null = null;
  if (kind === 'scout') action = scout.length === 3 ? { type: 'scout', cards: scout } : null;
  else if (card !== null) {
    if (kind === 'build' && chosen) action = { type: 'build', card, industry: chosen.industry, loc: chosen.loc, slot: chosen.slot };
    else if (kind === 'network' && chosen) action = { type: 'network', card, links: chosen.links };
    else if (kind === 'develop' && chosen) action = { type: 'develop', card, industries: chosen.industries };
    else if (kind === 'sell' && sales.length) {
      let bonusUsed = false;
      action = {
        type: 'sell', card, sales: sales.map((i) => {
          const h = hints[i]!;
          const dev = h.merchant === 'gloucester' && devBonus && !bonusUsed ? (bonusUsed = true, devBonus) : undefined;
          return { loc: h.loc, slot: h.slot, merchant: h.merchant, ...(dev ? { develop: dev } : {}) };
        })
      };
    } else if (kind === 'loan' || kind === 'pass') action = { type: kind, card };
  }
  const cardChoices = kind === 'build' ? ((chosen?.cards as number[] | undefined) ?? []) : hand;
  const needsTarget = kind === 'build' || kind === 'network' || kind === 'develop';
  const isExpTarget = (h: GameAction) => !!exp && exp.type === h.type && (h.type === 'sell'
    ? (exp.sales as { loc: string; slot: number; merchant?: string }[]).some((x) => x.loc === h.loc && x.slot === h.slot && x.merchant === h.merchant)
    : same(strip(exp), strip(h)));
  const expCards = !exp ? [] : exp.type === 'scout' ? (exp.cards as number[]) : [exp.card as number];

  // Map interaction: which slots / links are targets of the current action kind.
  const slotTargets = new Map<string, number[]>();
  const linkTargets = new Map<string, number>();
  hints.forEach((h, i) => {
    if (h.type === 'build' || h.type === 'sell') { const k = `${h.loc}:${h.slot}`; slotTargets.set(k, [...(slotTargets.get(k) ?? []), i]); }
    if (h.type === 'network' && (h.links as string[]).length === 1) linkTargets.set((h.links as string[])[0]!, i);
  });
  const tapSlot = (loc: string, slot: number) => {
    const opts = slotTargets.get(`${loc}:${slot}`) ?? [];
    if (!opts.length) return;
    if (kind === 'sell') { const i = opts[0]!; setSales(sales.includes(i) ? sales.filter((j) => j !== i) : [...sales.filter((j) => hints[j]!.loc !== loc || hints[j]!.slot !== slot), i]); return; }
    const cur = pick !== null ? opts.indexOf(pick) : -1;
    setPick(opts[(cur + 1) % opts.length]!); setCard(null); // repeated taps cycle the industries this slot accepts
  };
  const gloucesterSale = kind === 'sell' && sales.some((i) => hints[i]!.merchant === 'gloucester') && (view.merchants.gloucester?.beer ?? []).some(Boolean);

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : types.length ? { tone: 'mine' as const, text: `نوبت شما — ${fa(view.actionsLeft)} اقدام باقی است` }
      : { tone: 'wait' as const, text: view.current !== null ? `نوبت ${who(view.current)}` : '' };
  const placeOf = (s: number) => view.outcome?.placements.find((x) => x.seat === s)?.place;
  const SLOT = 3.4;

  return (
    <div className="br" ref={root} data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <header className="br__head">
        <span className={`br-era br-era--${view.era}`}><img src={view.era === 'canal' ? canalArt : railArt} alt="" />دورهٔ {view.era === 'canal' ? 'کانال' : 'راه‌آهن'} · دور {fa(view.round)}</span>
        <span className="br-deck" data-flip-anchor="deck">دسته: <b className="bg-pop" key={view.deckCount}>{fa(view.deckCount)}</b></span>
        <span className="br-market" title={`بازار زغال: ${fa(view.coal)} از ${fa(MARKET.coal.prices.length)}`}>
          <img src={coalCube} alt="زغال" /><b className={coalPop} key={`c${view.coal}`}>{fa(view.coal)}</b>/{fa(MARKET.coal.prices.length)} · خرید £{fa(buyPrice('coal', view.coal))}
        </span>
        <span className="br-market" title={`بازار آهن: ${fa(view.iron)} از ${fa(MARKET.iron.prices.length)}`}>
          <img src={ironCube} alt="آهن" /><b className={ironPop} key={`i${view.iron}`}>{fa(view.iron)}</b>/{fa(MARKET.iron.prices.length)} · خرید £{fa(buyPrice('iron', view.iron))}
        </span>
        <span>کارت آزاد: شهر {fa(view.wild.location)} · صنعت {fa(view.wild.industry)}</span>
      </header>

      <div className="br__main">
        <ZoomBoard label="نقشهٔ بیرمنگام" className="br__map">
          <div dir="ltr" className="br__mapin">
            <svg viewBox="-5 -6 110 112" role="img" aria-label="نقشهٔ بیرمنگام">
              <image href={mapArt} x={-5} y={-6} width={110} height={112} preserveAspectRatio="xMidYMid slice" opacity={0.85} />
              {[...LINK.entries()].map(([id, l]) => {
                const pts = linkNodes(l).map((n) => LOC.get(n)!.pos);
                const [a, b] = [pts[0]!, pts[1]!];
                const owner = view.links[id] ?? (pvLinks.includes(id) ? mySeat ?? undefined : undefined);
                const target = kind === 'network' ? linkTargets.get(id) : undefined;
                const on = chosen?.type === 'network' && (chosen.links as string[]).includes(id);
                return (
                  <g key={id} className={['br-link', l.canal ? '' : 'br-link--rail', l.rail ? '' : 'br-link--canal', target !== undefined ? 'br-link--target' : '', on ? 'br-link--on' : ''].join(' ')}
                    onClick={target !== undefined ? () => { setPick(target); setCard(null); } : undefined}>
                    <title>{linkName(id)}{l.canal && l.rail ? ' (کانال و ریل)' : l.canal ? ' (فقط کانال)' : ' (فقط ریل)'}</title>
                    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="br-link__bed" />
                    {pts[2] && <line x1={(a[0] + b[0]) / 2} y1={(a[1] + b[1]) / 2} x2={pts[2][0]} y2={pts[2][1]} className="br-link__bed" />}
                    {owner !== undefined && (
                      <g data-flip={`link-${id}`}>
                        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={SEAT_COLORS[owner]} className="br-link__own" />
                      </g>
                    )}
                    {target !== undefined && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="br-link__hit" />}
                  </g>
                );
              })}
              {LOCATIONS.map((l) => {
                const [x, y] = l.pos;
                if (l.kind === 'merchant') {
                  // Merchants not in play at this player count (or in the tutorial) have no entry: drawn without tiles.
                  const m = view.merchants[l.id] ?? { tiles: [], beer: [] };
                  return (
                    <g key={l.id} className="br-merchant">
                      <image href={merchantArt} x={x - 3.5} y={y - 4} width={7} height={7} />
                      <text x={x} y={y - 4.4} textAnchor="middle" className="br-name">{l.nameFa}</text>
                      <text x={x} y={y + 4.4} textAnchor="middle" className="br-sub">{BONUS_FA(l.id)}</text>
                      {m.tiles.map((t, i) => {
                        const tx = x - (m.tiles.length * 3.4) / 2 + i * 3.4, ty = y + 5.2;
                        const goods = t ? MERCHANT_TILE.get(t)!.goods : [];
                        return (
                          <g key={i}>
                            <rect x={tx} y={ty} width={3.1} height={3.1} rx={0.5} className={t ? 'br-mtile' : 'br-mtile br-mtile--none'} />
                            {goods.length === 3 ? <text x={tx + 1.55} y={ty + 2.1} textAnchor="middle" className="br-sub">همه</text>
                              : goods.map((g) => <image key={g} href={IND_ART[g]} x={tx + 0.2} y={ty + 0.2} width={2.7} height={2.7} />)}
                            {m.beer[i] && <g data-flip={`beer-${l.id}-${i}`}><image href={beerArt} x={tx + 0.6} y={ty + 3.2} width={1.9} height={1.9} /></g>}
                          </g>
                        );
                      })}
                    </g>
                  );
                }
                const slots = l.slots ?? [];
                const w = slots.length * SLOT;
                return (
                  <g key={l.id} className={`br-loc br-loc--${l.kind}`}>
                    {l.kind === 'town' && <rect x={x - Math.max(w, 9) / 2 - 0.6} y={y - 3.9} width={Math.max(w, 9) + 1.2} height={2.5} rx={0.6} fill={BANNER[l.color ?? ''] ?? '#6b2f1f'} />}
                    <text x={x} y={y - 2} textAnchor="middle" className={l.kind === 'town' ? 'br-name br-name--town' : 'br-sub'}>{l.kind === 'town' ? l.nameFa : 'آبجوسازی روستایی'}</text>
                    {slots.map((acc, i) => {
                      const t = view.board[l.id]?.[i] ?? (pvBuild && preview!.loc === l.id && preview!.slot === i
                        ? { owner: mySeat!, industry: preview!.industry as Industry, level: pvBuild.level, cubes: 0, flipped: false } : undefined);
                      const sx = x - w / 2 + i * SLOT, sy = y - 1;
                      const targets = slotTargets.get(`${l.id}:${i}`);
                      const on = (chosen?.type === 'build' && chosen.loc === l.id && chosen.slot === i) || (kind === 'sell' && sales.some((j) => hints[j]!.loc === l.id && hints[j]!.slot === i));
                      const lbl = t ? `${IND_FA[t.industry]} ${ROMAN[t.level]} ${who(t.owner)}${t.flipped ? ' برگشته' : ''}` : `خالی: ${acc.map((z) => IND_FA[z]).join(' یا ')}`;
                      return (
                        <g key={i} className={['br-slot', targets ? 'br-slot--target' : '', on ? 'br-slot--on' : ''].join(' ')} onClick={targets ? () => tapSlot(l.id, i) : undefined}>
                          <title>{`${l.nameFa} خانهٔ ${i + 1}: ${lbl}`}</title>
                          <rect x={sx} y={sy} width={SLOT - 0.3} height={SLOT - 0.3} rx={0.5} className="br-slot__bg" />
                          {!t && acc.map((z, k) => <image key={z} href={IND_ART[z]} x={sx + 0.2 + k * 1.5} y={sy + 0.2 + k * 1.3} width={acc.length > 1 ? 1.6 : 2.7} height={acc.length > 1 ? 1.6 : 2.7} opacity={0.5} />)}
                          {t && (
                            <g data-flip={`tile-${l.id}-${i}-${t.owner}-${t.industry}-${t.level}`} data-flip-from={`seat-${t.owner}`}>
                              <rect x={sx} y={sy} width={SLOT - 0.3} height={SLOT - 0.3} rx={0.5} fill={IND_HUE[t.industry]} stroke={SEAT_COLORS[t.owner]} strokeWidth={0.55} />
                              <image href={IND_ART[t.industry]} x={sx + 0.25} y={sy + 0.1} width={2.6} height={2.6} opacity={t.flipped ? 0.55 : 1} />
                              <text x={sx + 0.35} y={sy + 3} className="br-lvl">{ROMAN[t.level]}</text>
                              {t.cubes > 0 && <text x={sx + 2.8} y={sy + 3} textAnchor="end" className="br-cubes">{fa(t.cubes)}</text>}
                              {t.flipped && <text x={sx + 2.8} y={sy + 1.3} textAnchor="end" className="br-flip">✓</text>}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </ZoomBoard>

        <ul className="br__players" aria-label="بازیکنان">
          {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.order).map((s) => (
            <Ledger key={s} view={view} s={s} who={who(s)} me={s === mySeat} place={placeOf(s)} discard={s === mySeat && pvCards.length ? pvCards.at(-1) : view.discardTop[s]} />
          ))}
        </ul>
      </div>

      {view.outcome && <p className="br__result" role="status">بازی تمام شد. برنده: {view.outcome.placements.filter((x) => x.place === 1).map((x) => who(x.seat)).join('، ')}</p>}

      {view.hand && (
        <section className="br__hand" aria-label="دست شما">
          <h3>دست شما ({fa(hand.length)} کارت)</h3>
          <div className="br-cards">
            {hand.map((c) => {
              const usable = kind === 'scout' ? true : cardChoices.includes(c);
              const on = kind === 'scout' ? scout.includes(c) : card === c;
              const hint = !!exp && kind === exp.type && !on && expCards.includes(c) && (kind === 'scout' || !needsTarget || !!chosen);
              return (
                <Card key={c} id={c} from="deck" exit={`seat-${mySeat}`} on={on} hint={hint} disabled={busy || !kind || !usable || (needsTarget && !chosen)}
                  onClick={() => (kind === 'scout' ? setScout(on ? scout.filter((x) => x !== c) : scout.length < 3 ? [...scout, c] : scout) : setCard(on ? null : c))} />
              );
            })}
          </div>
        </section>
      )}

      {types.length > 0 && (
        <section className="br__actions" aria-label="اقدام">
          <div className="br-kinds" role="group" aria-label="نوع اقدام">
            {types.map((t) => (
              <Button key={t} size="sm" variant={kind === t ? 'primary' : 'secondary'} disabled={busy} className={exp?.type === t && kind !== t ? 'br-hint' : ''}
                onClick={() => { setKind(t); reset(); }}>{ACT_FA[t] ?? t}</Button>
            ))}
          </div>
          {kind && <p className="br-muted br-help">{ACT_HELP[kind]}</p>}
          {needsTarget && (
            <div className="br-targets" role="listbox" aria-label="هدف">
              {hints.map((h, i) => (
                <button key={i} type="button" role="option" aria-selected={pick === i} disabled={busy}
                  className={['br-target', pick === i ? 'br-target--on' : '', pick !== i && isExpTarget(h) ? 'br-hint' : ''].join(' ')}
                  onClick={() => { setPick(i); setCard(null); }}>
                  {h.type === 'build' && <img src={IND_ART[h.industry as Industry]} alt="" />}
                  {hintLabel(view, mySeat, h)}
                </button>
              ))}
            </div>
          )}
          {kind === 'sell' && (
            <div className="br-targets" role="group" aria-label="کاشی‌های فروش">
              {hints.map((h, i) => (
                <label key={i} className={['br-target', sales.includes(i) ? 'br-target--on' : '', !sales.includes(i) && isExpTarget(h) ? 'br-hint' : ''].join(' ')}>
                  <input type="checkbox" checked={sales.includes(i)} disabled={busy} onChange={(e) => setSales(e.target.checked ? [...sales.filter((j) => hints[j]!.loc !== h.loc || hints[j]!.slot !== h.slot), i] : sales.filter((j) => j !== i))} /> {hintLabel(view, mySeat, h)}
                </label>
              ))}
            </div>
          )}
          {gloucesterSale && mySeat !== null && (
            <label className="br-target">پاداش گلاستر — توسعهٔ رایگان:{' '}
              <select value={devBonus} disabled={busy} onChange={(e) => setDevBonus(e.target.value as Industry | '')}>
                <option value="">هیچ</option>
                {INDUSTRIES.filter((x) => { const t = STACK[x][view.mat[mySeat]![x]]; return t && !t.noDevelop; }).map((x) => <option key={x} value={x}>{IND_FA[x]}</option>)}
              </select>
            </label>
          )}
          {kind && <p className="br-muted">{kind === 'scout' ? `سه کارت برای دور انداختن انتخاب کنید (${fa(scout.length)} از ۳).` : needsTarget && !chosen ? 'اول هدف را از فهرست یا روی نقشه انتخاب کنید.' : 'کارتی را که دور می‌اندازید انتخاب کنید.'}</p>}
          <Button disabled={busy || !action} className={action && exp && same(action, exp) ? 'br-hint' : ''} onClick={() => action && onAction(action)}>ثبت</Button>
        </section>
      )}
      {view.last && (
        <p className="br-muted br__last" role="status">
          آخرین اقدام: {who(view.last.seat)} — {ACT_FA[view.last.type] ?? view.last.type}
          {view.last.loc ? ` در ${locName(view.last.loc)}` : ''}{view.last.industry ? ` (${IND_FA[view.last.industry]})` : ''}
          {view.last.links ? ` ${view.last.links.map(linkName).join('، ')}` : ''}
          {view.last.industries ? ` ${view.last.industries.map((x) => IND_FA[x]).join(' + ')}` : ''}
          {view.last.sales ? ` ${view.last.sales.map((x) => `${locName(x.loc)} → ${locName(x.merchant)}`).join('، ')}` : ''}
        </p>
      )}
    </div>
  );
}
