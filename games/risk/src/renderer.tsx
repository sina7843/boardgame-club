// RISK renderer: wood-framed parchment world map (territories, sea lanes, continent banners, 3D army tokens, last
// battle arrow) in a ZoomBoard, plus panels driven by the phase and legal actions: placement, cards, attack with dice
// tray, occupation, fortification, players and log. Shows only the projection: other hands are counts.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import {
  CARD_FA, CONTINENTS, CONTINENT_OF, T, TERRITORY_FA, TERRITORY_IDS, cardKind, cardTerritory, isSet, setValue,
  type TerritoryId
} from './board.ts';
import { COASTS, CONTINENT_LABEL, MAP_H, MAP_W, REGIONS, SEA_LANES, WRAP_LANE, type Pt } from './geometry.ts';
import { ArmyToken, CardIcon, Compass, DieFace, MapDefs, SEAT_COLOR, SEAT_FA } from './art.tsx';
import { income, ownsContinent, territoriesOf, type LogEntry, type Phase, type RiskView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
/** Isolate a (possibly Latin) player name inside Persian text. */
const iso = (s: string) => `⁨${s}⁩`;
const tFa = (t: number) => TERRITORY_FA[TERRITORY_IDS[t]!];
type Hint = { type: string; [k: string]: unknown };

const PHASE_FA: Record<Phase, string> = { setup: 'چیدن ارتش آغازین', reinforce: 'نیروی کمکی', attack: 'حمله', occupy: 'اشغال', fortify: 'جابه‌جایی' };

function describe(e: LogEntry, name: (s: number) => string): string {
  const n = (s: number) => iso(name(s));
  switch (e.t) {
    case 'start': return `بازی شروع شد؛ ${n(e.first)} اول ارتش می‌چیند. هدف: ${e.goal === 'world' ? 'گرفتن هر ۴۲ قلمرو' : '۳۰ قلمرو در پایان نوبت'}.`;
    case 'setup': return `${n(e.seat)} ${fa(e.armies)} ارتش آغازین چید.`;
    case 'turn': return `نوبت ${fa(e.turn)}: ${n(e.seat)} — ${fa(e.income)} نیروی کمکی.`;
    case 'trade': return `${n(e.seat)} دسته (${e.cards.map((c) => CARD_FA[cardKind(c)]).join('، ')}) را با ${fa(e.value)} ارتش معاوضه کرد${e.bonus !== null ? ` و ۲ ارتش اضافه در ${tFa(e.bonus)} گرفت` : ''}.`;
    case 'place': return `${n(e.seat)} ${fa(e.armies)} ارتش در ${e.at.slice(0, 3).map(tFa).join('، ')}${e.at.length > 3 ? ' و …' : ''} چید.`;
    case 'battle': return `${n(e.seat)} از ${tFa(e.from)} به ${tFa(e.to)} (${n(e.defender)}) ${e.blitz ? `حمله سریع کرد (${fa(e.rounds)} دور)` : 'حمله کرد'}: ${e.att.map(fa).join('،')} در برابر ${e.def.map(fa).join('،')}؛ مهاجم ${fa(e.lossA)} و مدافع ${fa(e.lossD)} ارتش از دست داد${e.conquered ? ' — فتح شد!' : '.'}`;
    case 'occupy': return `${n(e.seat)} ${fa(e.armies)} ارتش وارد ${tFa(e.to)} کرد.`;
    case 'eliminate': return `${n(e.seat)} به دست ${n(e.by)} حذف شد${e.cards ? ` و ${fa(e.cards)} کارتش به او رسید` : ''}.`;
    case 'fortify': return `${n(e.seat)} ${fa(e.armies)} ارتش از ${tFa(e.from)} به ${tFa(e.to)} برد.`;
    case 'card': return `${n(e.seat)} برای فتح در این نوبت یک کارت گرفت.`;
    case 'timeout': return `زمان ${n(e.seat)} تمام شد.`;
    case 'left': return `${n(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}؛ ارتش‌هایش روی نقشه می‌ماند.`;
    case 'win': return `${n(e.seat)} برد! ${{ world: 'تسلط بر هر ۴۲ قلمرو.', majority: '۳۰ قلمرو در پایان نوبت.', last: 'تنها بازیکن باقی‌مانده.' }[e.reason]}`;
  }
}

// ---------- map ----------

interface MapState {
  targets: Set<number>;
  selected: number | null;
  target: number | null;
  hinted: Set<number>;
  draft: Record<number, number>;
  label: (t: number) => string;
}

const curve = (p: Pt, q: Pt, bend = 0.18) => {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];
  return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${(mx - dy * bend).toFixed(1)} ${(my + dx * bend).toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
};
const xMost = (t: number, dir: 1 | -1): Pt => REGIONS[t]!.poly.reduce((a, b) => (b[0] * dir > a[0] * dir ? b : a));

function WorldMap({ view, ms, onPick }: { view: RiskView; ms: MapState; onPick: (t: number) => void }) {
  const key = (t: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); } };
  const battle = view.lastBattle && view.lastBattle.turn === view.turn ? view.lastBattle : null;
  const wa = xMost(WRAP_LANE[0], -1), wk = xMost(WRAP_LANE[1], 1);
  return (
    <svg className="rk-map" viewBox={`-22 -22 ${MAP_W + 44} ${MAP_H + 44}`} role="group" aria-label="نقشه جهان ریسک" style={{ direction: 'ltr' }}>
      <MapDefs />
      <g aria-hidden="true" pointerEvents="none">
        <rect x="-22" y="-22" width={MAP_W + 44} height={MAP_H + 44} rx="14" className="rk-frame" fill="url(#rkm-wood)" />
        <rect x="-22" y="-22" width={MAP_W + 44} height={MAP_H + 44} rx="14" fill="url(#rkm-grain)" />
        {[[-11, -11], [MAP_W + 11, -11], [-11, MAP_H + 11], [MAP_W + 11, MAP_H + 11]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" className="rk-stud" fill="url(#rkm-brass)" />)}
        <rect width={MAP_W} height={MAP_H} className="rk-sea" fill="url(#rkm-sea)" />
        <rect width={MAP_W} height={MAP_H} fill="url(#rkm-waves)" />
        {[100, 200, 300, 400, 500].map((y) => <line key={`la${y}`} x1="0" x2={MAP_W} y1={y} y2={y} className="rk-grid" />)}
        {[125, 250, 375, 500, 625, 750, 875].map((x) => <line key={`lo${x}`} y1="0" y2={MAP_H} x1={x} x2={x} className="rk-grid" />)}
        <g transform="translate(410 548)"><Compass /></g>
        {SEA_LANES.map((l) => <path key={`${l.a}-${l.b}`} d={curve(l.p, l.q)} className="rk-lane" />)}
        {/* Alaska–Kamchatka wraps around the edge of the map. */}
        <path d={`M${wa[0].toFixed(1)} ${wa[1].toFixed(1)} Q${(wa[0] / 2).toFixed(1)} 30 0 22`} className="rk-lane" />
        <path d={`M${wk[0].toFixed(1)} ${wk[1].toFixed(1)} Q${((wk[0] + MAP_W) / 2).toFixed(1)} 30 ${MAP_W} 22`} className="rk-lane" />
        <text x="5" y="14" className="rk-lane__wrap">← {TERRITORY_FA.kamchatka}</text>
        <text x={MAP_W - 5} y="14" className="rk-lane__wrap rk-lane__wrap--end">{TERRITORY_FA.alaska} →</text>
        {COASTS.map((d, i) => <path key={i} d={d} className="rk-coast" />)}
        {COASTS.map((d, i) => <path key={`l${i}`} d={d} className="rk-land" filter="url(#rkm-land)" />)}
      </g>

      {REGIONS.map((r, t) => {
        const target = ms.targets.has(t);
        const cls = ['rk-terr', target ? 'rk-target' : '', ms.selected === t ? 'rk-selected' : '', ms.target === t ? 'rk-aimed' : '', ms.hinted.has(t) ? 'rk-hint' : ''].join(' ');
        const props = target
          ? { role: 'button', tabIndex: 0, 'aria-label': ms.label(t), 'aria-pressed': ms.selected === t || ms.target === t, onClick: () => onPick(t), onKeyDown: key(t) }
          : { role: 'img', 'aria-label': ms.label(t) };
        return (
          <g key={r.id} className={cls} {...props}>
            <clipPath id={`rkm-clip-${t}`}><path d={r.d} /></clipPath>
            <path d={r.d} className="rk-terr__fill" fill={`url(#rkm-c-${CONTINENT_OF[t]})`} />
            <path d={r.d} fill="url(#rkm-paper)" pointerEvents="none" />
            <path d={r.d} clipPath={`url(#rkm-clip-${t})`} className="rk-terr__owner" stroke={SEAT_COLOR[view.owner[t]!]} pointerEvents="none" />
            <path d={r.d} className="rk-terr__edge" pointerEvents="none" />
          </g>
        );
      })}

      <g aria-hidden="true" pointerEvents="none">
        {CONTINENTS.map((c) => {
          const [x, y] = CONTINENT_LABEL[c.id];
          const owner = view.owner.find((_, t) => CONTINENT_OF[t] === c.id)!;
          const held = ownsContinent(view, owner, c.id);
          return (
            <g key={c.id} transform={`translate(${x} ${y})`} className={held ? 'rk-banner rk-banner--held' : 'rk-banner'}>
              <rect x="-58" y="-13" width="116" height="26" rx="5" fill={`url(#rkm-c-${c.id})`} />
              <rect x="-58" y="-13" width="116" height="26" rx="5" fill="url(#rkm-paper)" />
              <text y="4.5" className="rk-banner__t">{c.nameFa} +{fa(c.bonus)}</text>
              {held && <circle cx="58" cy="-13" r="7" fill={SEAT_COLOR[owner]} stroke="#14110d" strokeWidth="1" />}
            </g>
          );
        })}
        {battle && (
          <path className={battle.conquered ? 'rk-arrow rk-arrow--won' : 'rk-arrow'} d={curve(REGIONS[battle.from]!.center, REGIONS[battle.to]!.center, 0.22)} markerEnd="url(#rkm-arrow)" />
        )}
        {REGIONS.map((r, t) => {
          const [x, y] = r.center;
          const draft = ms.draft[t] ?? 0;
          return (
            <g key={r.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={battle && (battle.from === t || battle.to === t) ? 'rk-piece rk-piece--battle' : 'rk-piece'}>
              <g key={`${view.owner[t]}-${view.armies[t]}`} className="rk-piece__token"><ArmyToken seat={view.owner[t]!} n={view.armies[t]! + draft} big={view.armies[t]! + draft >= 10} /></g>
              {draft > 0 && <text x="0" y="-15" className="rk-draft">+{fa(draft)}</text>}
              <text y="22" className="rk-terr__name">{TERRITORY_FA[r.id]}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ---------- small controls ----------

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className="rk-step" role="group" aria-label={label}>
      <button type="button" aria-label={`کمتر: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{fa(value)}</output>
      <button type="button" aria-label={`بیشتر: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

const Panel = ({ title, children, tone }: { title: string; children: ReactNode; tone?: 'decide' }) => (
  <section className={tone ? 'rk-panel rk-panel--decide' : 'rk-panel'} aria-label={title}><h3>{title}</h3>{children}</section>
);

function DiceTray({ view, name }: { view: RiskView; name: (s: number) => string }) {
  const b = view.lastBattle;
  if (!b) return null;
  const pairs = Math.min(b.att.length, b.def.length);
  const res = (i: number, side: 'att' | 'def') => (i >= pairs ? null : (b.att[i]! > b.def[i]!) === (side === 'att') ? 'win' : 'loss');
  const row = (side: 'att' | 'def', dice: number[], seat: number) => (
    <div className={`rk-tray__row rk-tray__row--${side}`}>
      <span className="rk-tray__who"><span className="rk-swatch" style={{ ['--pc' as string]: SEAT_COLOR[seat] }} aria-hidden="true">{fa(seat + 1)}</span><bdi>{name(seat)}</bdi> <small>{side === 'att' ? `مهاجم · ${tFa(b.from)}` : `مدافع · ${tFa(b.to)}`}</small></span>
      <span className="rk-tray__dice">
        {dice.map((d, i) => {
          const r = res(i, side);
          return (
            <span key={`${b.lossA}${b.lossD}${b.rounds}${i}`} className={['rk-tray__die', r ? `rk-tray__die--${r}` : ''].join(' ')}>
              <DieFace value={d} side={side} />
              <span className="rk-mark">{r === 'win' ? '✓' : r === 'loss' ? '✗' : '–'}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
  const text = `آخرین نبرد: مهاجم ${b.att.map(fa).join('، ')}؛ مدافع ${b.def.map(fa).join('، ')}. مهاجم ${fa(b.lossA)} و مدافع ${fa(b.lossD)} ارتش از دست داد${b.rounds > 1 ? ` در ${fa(b.rounds)} دور` : ''}${b.conquered ? '؛ قلمرو فتح شد' : ''}.`;
  return (
    <section className="rk-tray" aria-label={text}>
      <h3>آخرین نبرد{b.rounds > 1 ? ` (حمله سریع، ${fa(b.rounds)} دور)` : ''}</h3>
      {row('att', b.att, b.seat)}
      {row('def', b.def, b.defender)}
      <p className="rk-help">تلفات: مهاجم {fa(b.lossA)} · مدافع {fa(b.lossD)}{b.conquered ? ' · فتح شد' : ''}</p>
    </section>
  );
}

// ---------- renderer ----------

export default function RiskRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<RiskView>) {
  const hints = legalActions as Hint[];
  const has = (t: string) => hints.some((h) => h.type === t);
  const myTurn = mySeat !== null && view.current === mySeat && !view.outcome;
  const exp = expected as Hint | null;

  const attacks = useMemo(() => hints.filter((h) => h.type === 'attack').map((h) => ({ from: T[h.from as TerritoryId], to: T[h.to as TerritoryId], maxDice: h.maxDice as number })), [hints]);
  const forts = useMemo(() => hints.filter((h) => h.type === 'fortify').map((h) => ({ from: T[h.from as TerritoryId], to: (h.to as TerritoryId[]).map((x) => T[x]), max: h.max as number })), [hints]);
  const placeHint = hints.find((h) => h.type === 'place');
  const tradeSets = useMemo(() => hints.filter((h) => h.type === 'trade').map((h) => h.cards as number[]), [hints]);

  // Local UI state; reset when the turn or phase moves on.
  const [sel, setSel] = useState<number | null>(null);
  const [aim, setAim] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [dice, setDice] = useState(3);
  const [moveN, setMoveN] = useState(1);
  const [picked, setPicked] = useState<number[]>([]);
  const phaseKey = `${view.turn}|${view.phase}|${view.current}|${view.available}`;
  useEffect(() => { setSel(null); setAim(null); setDraft({}); setPicked([]); }, [phaseKey]);
  useEffect(() => { setPicked([]); }, [view.myHand?.length]);
  const occ = view.occupy;
  const occMin = occ?.min ?? null;
  useEffect(() => { if (occMin !== null) setMoveN(occMin); }, [occMin, occ?.to]);

  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const act = (a: Hint) => { if (!busy) onAction(a); };

  const placing = myTurn && !!placeHint;
  const available = placing ? (placeHint!.available as number) : 0;
  const drafted = Object.values(draft).reduce((a, b) => a + b, 0);
  const attackFrom = new Set(attacks.map((a) => a.from));
  const attackTo = sel === null ? new Set<number>() : new Set(attacks.filter((a) => a.from === sel).map((a) => a.to));
  const fortFrom = new Set(forts.map((f) => f.from));
  const fortTo = sel === null ? new Set<number>() : new Set(forts.find((f) => f.from === sel)?.to ?? []);
  const maxDice = attacks.find((a) => a.from === sel && a.to === aim)?.maxDice ?? 0;
  const fortMax = forts.find((f) => f.from === sel)?.max ?? 0;

  const targets = new Set<number>();
  if (placing) view.owner.forEach((o, t) => { if (o === mySeat) targets.add(t); });
  if (myTurn && view.phase === 'attack') { attackFrom.forEach((t) => targets.add(t)); attackTo.forEach((t) => targets.add(t)); }
  if (myTurn && view.phase === 'fortify') { fortFrom.forEach((t) => targets.add(t)); fortTo.forEach((t) => targets.add(t)); }

  const pick = (t: number) => {
    if (busy) return;
    if (placing) {
      if (drafted < available) setDraft((d) => ({ ...d, [t]: (d[t] ?? 0) + 1 }));
      setSel(t);
    } else if (view.phase === 'attack') {
      if (sel !== null && attackTo.has(t)) { setAim(t); const m = attacks.find((a) => a.from === sel && a.to === t)!.maxDice; setDice(m); }
      else if (attackFrom.has(t)) { setSel(t); setAim(null); }
    } else if (view.phase === 'fortify') {
      if (sel !== null && fortTo.has(t)) { setAim(t); setMoveN(fortMax); }
      else if (fortFrom.has(t)) { setSel(t); setAim(null); }
    }
  };

  const hinted = new Set<number>();
  if (exp?.type === 'place') Object.keys(exp.armies as object).forEach((id) => hinted.add(T[id as TerritoryId]));
  if (exp && typeof exp.from === 'string') hinted.add(T[exp.from as TerritoryId]);
  if (exp && typeof exp.to === 'string') hinted.add(T[exp.to as TerritoryId]);

  const ownerLabel = (t: number) => {
    const o = view.owner[t]!;
    return `${iso(seatName(o))} (${SEAT_FA[o]}، صندلی ${fa(o + 1)}${o === mySeat ? '، شما' : ''})`;
  };
  const label = (t: number) => {
    const base = `${tFa(t)}، ${ownerLabel(t)}، ${fa(view.armies[t]!)} ارتش`;
    if (!targets.has(t)) return base;
    if (placing) return `${base}، افزودن ۱ ارتش${draft[t] ? ` (تاکنون ${fa(draft[t]!)})` : ''}`;
    if (view.phase === 'attack') return `${base}، ${attackTo.has(t) ? 'هدف حمله' : 'حمله از این‌جا'}`;
    return `${base}، ${fortTo.has(t) ? 'مقصد جابه‌جایی' : 'جابه‌جایی از این‌جا'}`;
  };

  // Status line.
  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    if (!myTurn) status = { tone: 'wait', text: `نوبت ${iso(seatName(view.current))} — ${PHASE_FA[view.phase]}` };
    else if (view.phase === 'setup') status = { tone: 'mine', text: `${fa(view.available)} ارتش آغازین را روی قلمروهایتان بچینید` };
    else if (view.phase === 'reinforce') status = { tone: 'mine', text: view.mustTrade ? 'اول باید یک دسته کارت معاوضه کنید' : `${fa(view.available)} ارتش کمکی را بچینید` };
    else if (view.phase === 'attack') status = { tone: 'mine', text: 'از قلمرو خود به همسایه دشمن حمله کنید یا حمله را تمام کنید' };
    else if (view.phase === 'occupy') status = { tone: 'mine', text: 'قلمرو فتح شد؛ تعداد ارتش‌های ورودی را تعیین کنید' };
    else status = { tone: 'mine', text: 'یک بار ارتش جابه‌جا کنید یا نوبت را تمام کنید' };
  }

  const myCount = mySeat !== null ? territoriesOf(view, mySeat) : 0;
  const pickedOk = picked.length === 3 && isSet(picked) && tradeSets.some((s) => s.every((c) => picked.includes(c)));

  return (
    <div className="rk">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="rk__meta">
        <span>نوبت {fa(view.turn)} · {PHASE_FA[view.phase]}</span>
        <span>هدف: {view.goal === 'world' ? 'هر ۴۲ قلمرو' : '۳۰ قلمرو در پایان نوبت'}</span>
        <span>دسته بعدی: {fa(view.nextSetValue)} ارتش</span>
        <span>کارت در دسته: {fa(view.deckCount)}</span>
        <span>جابه‌جایی: {view.fortifyMode === 'connected' ? 'زنجیره‌ای' : 'فقط همسایه'}</span>
      </div>

      <div className="rk-main">
        <div className="rk-board-wrap">
          <ZoomBoard label="نقشه جهان">
            <WorldMap view={view} onPick={pick} ms={{ targets, selected: sel, target: aim, hinted, draft: placing ? draft : {}, label }} />
          </ZoomBoard>
          <DiceTray view={view} name={seatName} />
        </div>

        <div className="rk-side">
          {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

          {myTurn && (view.phase === 'setup' || view.phase === 'reinforce') && (
            <Panel title={view.phase === 'setup' ? 'چیدن ارتش آغازین' : view.elimTrade ? 'معاوضه پس از حذف بازیکن' : 'نیروی کمکی'} tone="decide">
              {view.phase === 'reinforce' && !view.elimTrade && mySeat !== null && (
                <p className="rk-help">
                  {fa(myCount)} قلمرو ÷ ۳ = {fa(Math.max(3, Math.floor(myCount / 3)))}{Math.floor(myCount / 3) < 3 ? ' (حداقل ۳)' : ''}
                  {CONTINENTS.filter((c) => ownsContinent(view, mySeat, c.id)).map((c) => ` + ${c.nameFa} ${fa(c.bonus)}`).join('')}
                  {' '}= {fa(income(view, mySeat))}
                </p>
              )}
              {view.elimTrade && <p className="rk-help">کارت‌های بازیکن حذف‌شده به شما رسید؛ تا ۴ کارت یا کمتر بماند معاوضه کنید و ارتش‌ها را بچینید.</p>}
              {view.mustTrade && <p className="rk-warn" role="alert">باید پیش از چیدن، یک دسته کارت معاوضه کنید (پایین، کارت‌های شما).</p>}
              {placing && (
                <>
                  <p className="rk-big"><strong>{fa(available - drafted)}</strong> از {fa(available)} ارتش باقی است. روی قلمروهای خودتان بزنید (هر ضربه ۱ ارتش).</p>
                  {Object.keys(draft).length > 0 && (
                    <ul className="rk-draftlist">
                      {Object.entries(draft).filter(([, k]) => k > 0).map(([t, k]) => (
                        <li key={t} className={Number(t) === sel ? 'rk-draftlist--sel' : ''}>
                          <span>{tFa(Number(t))}</span>
                          <Stepper label={tFa(Number(t))} value={k} min={0} max={k + available - drafted} onChange={(v) => setDraft((d) => ({ ...d, [t]: v }))} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="row">
                    {sel !== null && drafted < available && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDraft((d) => ({ ...d, [sel]: (d[sel] ?? 0) + available - drafted }))}>همه باقی‌مانده در {tFa(sel)}</Button>}
                    {drafted > 0 && <Button size="sm" variant="ghost" onClick={() => setDraft({})}>پاک کردن</Button>}
                  </div>
                  <Button className={exp?.type === 'place' ? 'rk-hintbtn' : ''} disabled={busy || drafted !== available}
                    onClick={() => act({ type: 'place', armies: Object.fromEntries(Object.entries(draft).filter(([, k]) => k > 0).map(([t, k]) => [TERRITORY_IDS[Number(t)]!, k])) })}>
                    ثبت جای‌گذاری
                  </Button>
                </>
              )}
            </Panel>
          )}

          {myTurn && view.phase === 'attack' && (
            <Panel title="حمله">
              <p className="rk-help">
                {sel === null ? 'قلمرو مبدأ (دست‌کم ۲ ارتش) را روی نقشه انتخاب کنید.' : aim === null ? `از ${tFa(sel)}: یک همسایه دشمن را انتخاب کنید.` : `${tFa(sel)} (${fa(view.armies[sel]!)}) ← ${tFa(aim)} (${fa(view.armies[aim]!)}، مدافع با ${fa(Math.min(2, view.armies[aim]!))} تاس)`}
              </p>
              {aim !== null && sel !== null && (
                <fieldset className="rk-dice-pick">
                  <legend>تعداد تاس حمله</legend>
                  {[1, 2, 3].map((k) => (
                    <button key={k} type="button" className="rk-chip" aria-pressed={dice === k} disabled={k > maxDice} onClick={() => setDice(k)}>{fa(k)} تاس</button>
                  ))}
                </fieldset>
              )}
              <div className="row">
                <Button className={exp?.type === 'attack' ? 'rk-hintbtn' : ''} disabled={busy || sel === null || aim === null || dice > maxDice}
                  onClick={() => act({ type: 'attack', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!], dice })}>حمله</Button>
                <Button variant="secondary" disabled={busy || sel === null || aim === null || !has('blitz')}
                  onClick={() => act({ type: 'blitz', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!] })}>حمله سریع</Button>
                <Button variant="ghost" className={exp?.type === 'endAttack' ? 'rk-hintbtn' : ''} disabled={busy || !has('endAttack')} onClick={() => act({ type: 'endAttack' })}>پایان حمله</Button>
              </div>
              <p className="rk-help">حمله سریع با بیشترین تاس تکرار می‌شود تا قلمرو فتح شود یا ۱ ارتش بماند.</p>
            </Panel>
          )}

          {myTurn && view.phase === 'occupy' && occ && (
            <Panel title={`اشغال ${tFa(occ.to)}`} tone="decide">
              <p className="rk-help">دست‌کم {fa(occ.min)} (تاس‌های آخرین حمله) و حداکثر {fa(occ.max)} ارتش از {tFa(occ.from)} وارد می‌شود.</p>
              <Stepper label="ارتش ورودی" value={moveN} min={occ.min} max={occ.max} onChange={setMoveN} />
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => setMoveN(occ.max)}>همه ({fa(occ.max)})</Button>
                <Button className={exp?.type === 'occupy' ? 'rk-hintbtn' : ''} disabled={busy || moveN < occ.min || moveN > occ.max} onClick={() => act({ type: 'occupy', armies: moveN })}>تأیید اشغال</Button>
              </div>
            </Panel>
          )}

          {myTurn && view.phase === 'fortify' && (
            <Panel title="جابه‌جایی پایان نوبت">
              <p className="rk-help">
                {sel === null ? `قلمرو مبدأ را انتخاب کنید (${view.fortifyMode === 'connected' ? 'مقصد باید از راه قلمروهای خودتان وصل باشد' : 'فقط به قلمرو همسایه'}).` : aim === null ? `از ${tFa(sel)} به کجا؟` : `${tFa(sel)} ← ${tFa(aim)}`}
              </p>
              {sel !== null && aim !== null && <Stepper label="ارتش‌های جابه‌جاشونده" value={Math.min(moveN, fortMax)} min={1} max={fortMax} onChange={setMoveN} />}
              <div className="row">
                <Button className={exp?.type === 'fortify' ? 'rk-hintbtn' : ''} disabled={busy || sel === null || aim === null || moveN < 1}
                  onClick={() => act({ type: 'fortify', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!], armies: Math.min(moveN, fortMax) })}>جابه‌جایی</Button>
                <Button variant="secondary" className={exp?.type === 'endTurn' ? 'rk-hintbtn' : ''} disabled={busy || !has('endTurn')} onClick={() => act({ type: 'endTurn' })}>پایان نوبت</Button>
              </div>
            </Panel>
          )}

          {view.myHand && !view.outcome && (
            <section className="rk-hand" aria-label="کارت‌های شما">
              <h3>کارت‌های شما ({fa(view.myHand.length)})</h3>
              {view.myHand.length === 0 ? <p className="rk-help">کارتی ندارید. با فتح دست‌کم یک قلمرو در نوبت، در پایانش یک کارت می‌گیرید.</p> : (
                <ul className="rk-cards">
                  {view.myHand.map((c) => {
                    const k = cardKind(c), t = cardTerritory(c);
                    const on = picked.includes(c);
                    const owned = t !== null && view.owner[t] === mySeat;
                    const text = `${CARD_FA[k]}${t !== null ? `، ${tFa(t)}${owned ? ' (قلمرو شما)' : ''}` : ''}`;
                    return (
                      <li key={c}>
                        <button type="button" className={`rk-card rk-card--${k}`} aria-pressed={on} aria-label={text} disabled={busy || tradeSets.length === 0}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : p.length < 3 ? [...p, c] : p))}>
                          <span className="rk-card__art" aria-hidden="true"><CardIcon kind={k} /></span>
                          <span className="rk-card__kind">{CARD_FA[k]}</span>
                          {t !== null && <span className="rk-card__terr">{tFa(t)}{owned ? ' ★' : ''}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {tradeSets.length > 0 && (
                <div className="row">
                  <Button size="sm" variant="ghost" onClick={() => setPicked(tradeSets[0]!)}>انتخاب یک دسته</Button>
                  <Button className={exp?.type === 'trade' ? 'rk-hintbtn' : ''} disabled={busy || !pickedOk} onClick={() => { act({ type: 'trade', cards: picked }); setPicked([]); }}>
                    معاوضه دسته (+{fa(view.nextSetValue)})
                  </Button>
                </div>
              )}
              <p className="rk-help">دسته: سه هم‌شکل، یکی از هر شکل، یا دو کارت با جوکر. ★ یعنی قلمرو کارت مال شماست (۲ ارتش اضافه، یک بار در نوبت). ارزش دسته بعدی {fa(view.nextSetValue)} و بعدی {fa(setValue(view.trades + 1))}.</p>
            </section>
          )}

          <ul className="rk-players" aria-label="بازیکنان">
            {Array.from({ length: view.players }, (_, s) => {
              const turn = view.current === s && !view.outcome;
              const terr = territoriesOf(view, s);
              const armies = view.armies.reduce((a, k, t) => a + (view.owner[t] === s ? k : 0), 0);
              const conts = CONTINENTS.filter((c) => ownsContinent(view, s, c.id));
              return (
                <li key={s} className={['rk-player', turn ? 'rk-player--turn' : '', view.status[s] !== 'active' ? 'rk-player--out' : ''].join(' ')} style={{ ['--pc' as string]: SEAT_COLOR[s] }}>
                  <span className="rk-player__head">
                    <span className="rk-swatch" aria-hidden="true">{fa(s + 1)}</span>
                    <bdi className="rk-player__name">{seatName(s)}</bdi>
                    <span className="rk-player__color">({SEAT_FA[s]}{s === mySeat ? '، شما' : ''})</span>
                    {turn && <span className="rk-badge">نوبت</span>}
                    {view.status[s] === 'abandoned' && <span className="rk-badge rk-badge--out">کنار رفته</span>}
                    {view.status[s] === 'out' && <span className="rk-badge rk-badge--out">حذف شد</span>}
                  </span>
                  <span className="rk-player__counts">{fa(terr)} قلمرو · {fa(armies)} ارتش · {fa(view.handCounts[s] ?? 0)} کارت</span>
                  {conts.length > 0 && <span className="rk-player__conts">{conts.map((c) => <span key={c.id} className={`rk-badge rk-badge--c rk-badge--${c.id}`}>{c.nameFa} +{fa(c.bonus)}</span>)}</span>}
                </li>
              );
            })}
          </ul>

          <details className="rk-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-10).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>
        </div>
      </div>
    </div>
  );
}
