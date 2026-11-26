// RISK renderer: an antique-style world map (watercolour continents, owner washes, 3D army tokens, continent
// ribbons, last battle arrow) in a ZoomBoard, plus panels driven by the phase and legal actions: placement, cards,
// attack with dice tray, occupation, fortification, players and log. Shows only the projection: other hands are counts.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Button, Icon, RailSlot, T as Tm, TurnIndicator, ZoomBoard, tx, useFlip, useInFrame, usePop, useTermsLang, type GameRendererProps, type Term, DockSlot } from '@bg/ui';
import { cardTerm, continentTerm, territoryTerm, terms } from './terms.ts';
import {
  CONTINENTS, CONTINENT_OF, T, TERRITORY_IDS, cardKind, cardTerritory, isSet, setValue,
  type ContinentId, type TerritoryId
} from './board.ts';
import {
  CONTINENT_LABEL, MAP_H, MAP_W, REGIONS, type Pt
} from './geometry.ts';
import { ArmyToken, CARD_ART, CARD_BACK, CardIcon, DieFace, INK, MapDefs, MapImage, SEAT_COLOR, SEAT_FA, SEAT_WASH, StatIcon } from './art.tsx';
import { income, ownsContinent, territoriesOf, type LogEntry, type Phase, type RiskView } from './rules.ts';

/** Desktop frame (≥900): the rail is visible, so your cards can live there; on phones it is a collapsed line. */
function useWide() {
  const q = '(min-width: 900px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
/** Isolate a (possibly Latin) player name inside Persian text. */
const iso = (s: string) => `⁨${s}⁩`;
const tFa = (t: number) => tx(territoryTerm[TERRITORY_IDS[t]!]);
const contName = (id: ContinentId) => tx(continentTerm[id]);
type Hint = { type: string; [k: string]: unknown };

const PHASE_T: Record<Phase, Term> = { setup: terms.setupPhase, reinforce: terms.reinforcement, attack: terms.attack, occupy: terms.occupy, fortify: terms.fortify };

function describe(e: LogEntry, name: (s: number) => string): string {
  const n = (s: number) => iso(name(s));
  switch (e.t) {
    case 'start': return `بازی شروع شد؛ ${n(e.first)} اول ${tx(terms.army)} می‌چیند. هدف: ${e.goal === 'world' ? `گرفتن هر ۴۲ ${tx(terms.territory)}` : `۳۰ ${tx(terms.territory)} در پایان نوبت`}.`;
    case 'setup': return `${n(e.seat)} ${fa(e.armies)} ${tx(terms.startArmy)} چید.`;
    case 'turn': return `نوبت ${fa(e.turn)}: ${n(e.seat)} — ${fa(e.income)} ${tx(terms.reinforcement)}.`;
    case 'trade': return `${n(e.seat)} ${tx(terms.set)} (${e.cards.map((c) => tx(cardTerm[cardKind(c)])).join('، ')}) را با ${fa(e.value)} ${tx(terms.army)} ${tx(terms.trade)} کرد${e.bonus !== null ? ` و ۲ ${tx(terms.army)} اضافه در ${tFa(e.bonus)} گرفت` : ''}.`;
    case 'place': return `${n(e.seat)} ${fa(e.armies)} ${tx(terms.army)} در ${e.at.slice(0, 3).map(tFa).join('، ')}${e.at.length > 3 ? ' و …' : ''} چید.`;
    case 'battle': return `${n(e.seat)} از ${tFa(e.from)} به ${tFa(e.to)} (${n(e.defender)}) ${e.blitz ? `${tx(terms.blitz)} کرد (${fa(e.rounds)} ${tx(terms.round)})` : `${tx(terms.attack)} کرد`}: ${e.att.map(fa).join('،')} در برابر ${e.def.map(fa).join('،')}؛ ${tx(terms.attacker)} ${fa(e.lossA)} و ${tx(terms.defender)} ${fa(e.lossD)} ${tx(terms.army)} از دست داد${e.conquered ? ` — ${tx(terms.conquered)}!` : '.'}`;
    case 'occupy': return `${n(e.seat)} ${fa(e.armies)} ${tx(terms.army)} وارد ${tFa(e.to)} کرد.`;
    case 'eliminate': return `${n(e.seat)} به دست ${n(e.by)} ${tx(terms.eliminated)}${e.cards ? ` و ${fa(e.cards)} ${tx(terms.cardHis)} به او رسید` : ''}.`;
    case 'fortify': return `${n(e.seat)} ${fa(e.armies)} ${tx(terms.army)} از ${tFa(e.from)} به ${tFa(e.to)} برد.`;
    case 'card': return `${n(e.seat)} برای ${tx(terms.conquest)} در این نوبت یک ${tx(terms.card)} گرفت.`;
    case 'timeout': return `زمان ${n(e.seat)} تمام شد.`;
    case 'left': return `${n(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}؛ ${tx(terms.armiesOwn)} روی نقشه می‌ماند.`;
    case 'win': return `${n(e.seat)} برد! ${{ world: `تسلط بر هر ۴۲ ${tx(terms.territory)}.`, majority: `۳۰ ${tx(terms.territory)} در پایان نوبت.`, last: 'تنها بازیکن باقی‌مانده.' }[e.reason]}`;
  }
}

// ---------- map ----------

type Kind = 'place' | 'src' | 'attack' | 'fort';
interface MapState {
  targets: Set<number>;
  kinds: Map<number, Kind>;
  selected: number | null;
  target: number | null;
  hinted: Set<number>;
  draft: Record<number, number>;
  label: (t: number) => string;
}

const PAD = 16, VIEW_W = MAP_W + PAD * 2;
const BASE_R = 14;

/** Rendered size of one map unit in CSS pixels (changes with the window and the ZoomBoard zoom). */
function useMapScale(ref: RefObject<SVGSVGElement | null>) {
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const n = Math.round((el.getBoundingClientRect().width / VIEW_W) * 20) / 20; if (n > 0) setK((p) => (p === n ? p : n)); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const host = el.closest('.zb__content');
    const mo = new MutationObserver(measure);
    if (host) mo.observe(host, { attributes: true, attributeFilter: ['style'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [ref]);
  return k;
}

/** Push overlapping tokens apart (never far from their territory) so counts stay readable. */
function spread(home: Pt[], d: number, maxMove: number): Pt[] {
  const p = home.map((c) => [...c] as Pt);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      const dx = p[j]![0] - p[i]![0], dy = p[j]![1] - p[i]![1], dist = Math.hypot(dx, dy);
      if (dist >= d) continue;
      const ux = dist > 0.01 ? dx / dist : 1, uy = dist > 0.01 ? dy / dist : 0, push = (d - dist) / 2 + 0.05;
      p[i]![0] -= ux * push; p[i]![1] -= uy * push; p[j]![0] += ux * push; p[j]![1] += uy * push;
      moved = true;
    }
    p.forEach((q, i) => {
      const h = home[i]!, dx = q[0] - h[0], dy = q[1] - h[1], len = Math.hypot(dx, dy);
      if (len > maxMove) { q[0] = h[0] + (dx / len) * maxMove; q[1] = h[1] + (dy / len) * maxMove; }
    });
    if (!moved) break;
  }
  return p;
}

const curve = (p: Pt, q: Pt, bend = 0.18) => {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];
  return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${(mx - dy * bend).toFixed(1)} ${(my + dx * bend).toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
};
/** Hit-test anchor: a transparent box centred on the token spot so the group's bounding-box centre is a point inside the territory. */
const anchorOf = (poly: Pt[], c: Pt) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const hw = Math.max(c[0] - Math.min(...xs), Math.max(...xs) - c[0]) + 6, hh = Math.max(c[1] - Math.min(...ys), Math.max(...ys) - c[1]) + 6;
  return { x: c[0] - hw, y: c[1] - hh, width: hw * 2, height: hh * 2 };
};
const ANCHORS = REGIONS.map((r) => anchorOf(r.poly, r.center));

function Ribbon({ x, y, text, tint, held, chip }: { x: number; y: number; text: string; tint: string; held: boolean; chip: { color: string; seat: number } | null }) {
  const w = 30 + text.length * 6.3, h = 13;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={held ? 'rk-ribbon rk-ribbon--held' : 'rk-ribbon'}>
      <path d={`M${-w / 2} ${-h} H${w / 2} l8 ${h} l-8 ${h} H${-w / 2} l8 ${-h} Z`} className="rk-ribbon__shadow" transform="translate(1 2.5)" />
      <path d={`M${-w / 2} ${-h} H${w / 2} l8 ${h} l-8 ${h} H${-w / 2} l8 ${-h} Z`} fill={`url(#rkm-c-${tint})`} className="rk-ribbon__body" />
      <path d={`M${-w / 2 + 6} ${-h + 3} H${w / 2 - 6} M${-w / 2 + 6} ${h - 3} H${w / 2 - 6}`} className="rk-ribbon__rule" />
      <text y="4.6" className="rk-ribbon__t">{text}</text>
      {chip && (
        <g transform={`translate(${(w / 2 + 12).toFixed(1)} 0)`}>
          <circle r="9" fill={chip.color} stroke={held ? '#d9a62e' : INK} strokeWidth="2" />
          <text y="3.6" className="rk-ribbon__seat" fill={chip.color === SEAT_COLOR[2] || chip.color === SEAT_COLOR[4] ? '#2a2520' : '#fff'}>{fa(chip.seat + 1)}</text>
        </g>
      )}
    </g>
  );
}

/** A number that bumps when it changes (the key remounts it so the animation replays). */
function Pop({ v, className = '' }: { v: number; className?: string }) {
  return <span key={v} className={`rk-num ${className} ${usePop(v)}`.trim()}>{fa(v)}</span>;
}

function WorldMap({ view, ms, onPick }: { view: RiskView; ms: MapState; onPick: (t: number) => void }) {
  useTermsLang();
  const framed = useInFrame() !== null;
  // Every army count shown on the map; a token bumps when its own count changed (placement, fortify, occupation).
  const shown = view.armies.map((a, t) => a + (ms.draft[t] ?? 0));
  // (A token remounts when its count changes, so the class may stay on afterwards without replaying.)
  const pops = useRef({ shown, bumped: new Set<number>() });
  shown.forEach((n, t) => { if (n !== pops.current.shown[t]) pops.current.bumped.add(t); });
  pops.current.shown = shown;
  const bumped = pops.current.bumped;
  const svg = useRef<SVGSVGElement>(null);
  const k = useMapScale(svg);
  const [hover, setHover] = useState<number | null>(null);
  const key = (t: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); } };
  const battle = view.lastBattle && view.lastBattle.turn === view.turn ? view.lastBattle : null;
  // Effects only while the battle is the newest event: the defender's token shakes, a conquered one drops in.
  const fresh = battle && view.log.at(-1)?.t === 'battle' ? battle : null;

  // Tokens grow when the map is drawn small (phones) and are nudged apart where territories are tiny.
  const grow = Math.round(Math.min(1.4, Math.max(1, (0.8 / k) ** 0.5)) * 10) / 10;
  const R = BASE_R * grow;
  const pos = useMemo(() => {
    const p = spread(REGIONS.map((r) => r.center), R * 1.85, R * 1.1);
    return p.map(([x, y]) => [Math.min(MAP_W - R, Math.max(R, x)), Math.min(MAP_H - R, Math.max(R, y))] as Pt);
  }, [R]);
  const showNames = k >= 0.8;

  const arrow = battle ? (() => {
    const a = pos[battle.from]!, b = pos[battle.to]!, d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const inset = R * 1.15;
    return curve([a[0] + ((b[0] - a[0]) / d) * inset, a[1] + ((b[1] - a[1]) / d) * inset], [b[0] - ((b[0] - a[0]) / d) * inset, b[1] - ((b[1] - a[1]) / d) * inset], 0.2);
  })() : null;

  return (
    <svg ref={svg} className={showNames ? 'rk-map rk-map--names' : 'rk-map'} viewBox={`${-PAD} ${-PAD} ${VIEW_W} ${MAP_H + PAD * 2}`} role="group" aria-label={tx(terms.worldMapRisk)} style={{ direction: 'ltr' }}>
      <MapDefs />
      <g aria-hidden="true" pointerEvents="none">
        <MapImage x={-PAD} y={-PAD} w={VIEW_W} h={MAP_H + PAD * 2} />
        <text x="6" y="13" className="rk-lane__wrap">← {tFa(T.kamchatka)}</text>
        <text x={MAP_W - 6} y="13" className="rk-lane__wrap rk-lane__wrap--end">{tFa(T.alaska)} →</text>
      </g>

      {REGIONS.map((r, t) => {
        const target = ms.targets.has(t), kind = ms.kinds.get(t);
        const owner = view.owner[t]!;
        const cls = ['rk-terr', target ? 'rk-target' : '', kind ? `rk-k-${kind}` : '', ms.selected === t ? 'rk-selected' : '', ms.target === t ? 'rk-aimed' : '', ms.hinted.has(t) ? 'rk-hint' : ''].join(' ');
        const props = target
          ? { role: 'button', tabIndex: 0, 'aria-label': ms.label(t), 'aria-pressed': ms.selected === t || ms.target === t, onClick: () => onPick(t), onKeyDown: key(t) }
          : { role: 'img', 'aria-label': ms.label(t) };
        return (
          <g key={r.id} className={cls} {...props} onPointerEnter={() => setHover(t)} onPointerLeave={() => setHover((h) => (h === t ? null : h))} onFocus={() => setHover(t)} onBlur={() => setHover((h) => (h === t ? null : h))}>
            <rect {...ANCHORS[t]!} fill="none" pointerEvents="none" />
            <clipPath id={`rkm-clip-${t}`}><path d={r.d} /></clipPath>
            <path d={r.d} className="rk-terr__fill" fill="transparent" />
            {/* Frame (design): land in its continent colour; the owner is the seat-coloured army token on it. */}
            {framed ? <path d={r.d} className="rk-terr__wash" fill={`url(#rkm-c-${CONTINENT_OF[t]})`} fillOpacity={0.78} pointerEvents="none" /> : <>
              <path d={r.d} className="rk-terr__wash" fill={SEAT_COLOR[owner]} fillOpacity={SEAT_WASH[owner]} pointerEvents="none" />
              <path d={r.d} clipPath={`url(#rkm-clip-${t})`} className="rk-terr__owner" stroke={SEAT_COLOR[owner]} pointerEvents="none" />
            </>}
            <path d={r.edge} className="rk-terr__edge" pointerEvents="none" />
            <path d={r.edge} className="rk-ring" pointerEvents="none" />
          </g>
        );
      })}

      <g aria-hidden="true" pointerEvents="none">

        {!framed && CONTINENTS.map((c) => {
          const [x, y] = CONTINENT_LABEL[c.id];
          const owner = view.owner.find((_, t) => CONTINENT_OF[t] === c.id)!;
          const held = ownsContinent(view, owner, c.id);
          return <Ribbon key={c.id} x={x} y={y} text={`${contName(c.id)} +${fa(c.bonus)}`} tint={c.id} held={held} chip={held ? { color: SEAT_COLOR[owner]!, seat: owner } : null} />;
        })}

        {arrow && (
          <>
            <path className="rk-arrow-halo" d={arrow} />
            <path className={battle!.conquered ? 'rk-arrow rk-arrow--won' : 'rk-arrow'} d={arrow} markerEnd="url(#rkm-arrow)" />
          </>
        )}

        {REGIONS.map((r, t) => {
          const [x, y] = pos[t]!;
          const draft = ms.draft[t] ?? 0, n = shown[t]!;
          const inBattle = !!battle && (battle.from === t || battle.to === t);
          const named = showNames || hover === t || ms.selected === t || ms.target === t;
          return (
            <g key={r.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={['rk-piece', inBattle ? 'rk-piece--battle' : '', ms.selected === t ? 'rk-piece--sel' : ''].join(' ')}>
              {ms.kinds.get(t) && <circle r={R + 4} className={`rk-halo rk-halo--${ms.kinds.get(t)}`} />}
              <g key={`${view.owner[t]}-${n}`} className="rk-piece__token"><g className={fresh && fresh.to === t && fresh.conquered ? 'bg-land' : fresh && ((fresh.to === t && fresh.lossD > 0) || (fresh.from === t && fresh.lossA > 0)) ? 'bg-hit' : bumped.has(t) ? 'bg-pop' : ''}><ArmyToken seat={view.owner[t]!} n={n} r={R} lift={ms.selected === t} /></g></g>
              {draft !== 0 && <text x="0" y={-R - 4} className="rk-draft" fontSize={R * 0.78}>{draft > 0 ? '+' : '−'}{fa(Math.abs(draft))}</text>}
              {named && <text y={R + 12} className="rk-terr__name">{tx(territoryTerm[r.id])}</text>}
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

/** A territory's outline as a small illustration (cards). */
function Silhouette({ t }: { t: number }) {
  const r = REGIONS[t]!;
  const xs = r.poly.map((p) => p[0]), ys = r.poly.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, m = Math.max(w, h) * 0.12;
  return (
    <svg className="rk-sil" viewBox={`${x0 - m} ${y0 - m} ${w + 2 * m} ${h + 2 * m}`} aria-hidden="true" focusable="false">
      <path d={r.d} fill={`url(#rkm-c-${CONTINENT_OF[t]})`} stroke={INK} strokeWidth={Math.max(w, h) * 0.035} strokeLinejoin="round" />
    </svg>
  );
}

/** My attack while it waits in the undo window or for the server: dice tumble with no value (counts are known). */
interface Rolling { seat: number; from: number; to: number; att: number; def: number }

function DiceTray({ view, name, rolling }: { view: RiskView; name: (s: number) => string; rolling: Rolling | null }) {
  useTermsLang();
  const b = view.lastBattle;
  const rollSeq = [...view.log].reverse().find((e) => e.t === 'battle')?.seq ?? 0;
  if (rolling) {
    const row = (side: 'att' | 'def', n: number, seat: number, t: number) => (
      <div className={`rk-tray__row rk-tray__row--${side}`}>
        <span className="rk-tray__who"><span className="rk-swatch" style={{ ['--pc' as string]: SEAT_COLOR[seat] }} aria-hidden="true">{fa(seat + 1)}</span><bdi>{name(seat)}</bdi> <small>{side === 'att' ? `${tx(terms.attacker)} · ${tFa(t)}` : `${tx(terms.defender)} · ${tFa(t)}`}</small></span>
        <span className="rk-tray__dice">
          {Array.from({ length: n }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} className="rk-tray__die bg-tumble"><DieFace value={0} side={side} /><span className="rk-mark">…</span></span>)}
        </span>
      </div>
    );
    return (
      <section className="rk-tray rk-tray--rolling" aria-label={tx(terms.diceRolling)}>
        <h3><Tm t={terms.battle} />: {tFa(rolling.from)} ← {tFa(rolling.to)}</h3>
        <div className="rk-tray__felt">
          {row('att', rolling.att, rolling.seat, rolling.from)}
          {row('def', rolling.def, view.owner[rolling.to]!, rolling.to)}
        </div>
      </section>
    );
  }
  if (!b) return null;
  const pairs = Math.min(b.att.length, b.def.length);
  const res = (i: number, side: 'att' | 'def') => (i >= pairs ? null : (b.att[i]! > b.def[i]!) === (side === 'att') ? 'win' : 'loss');
  const row = (side: 'att' | 'def', dice: number[], seat: number) => (
    <div className={`rk-tray__row rk-tray__row--${side}`}>
      <span className="rk-tray__who"><span className="rk-swatch" style={{ ['--pc' as string]: SEAT_COLOR[seat] }} aria-hidden="true">{fa(seat + 1)}</span><bdi>{name(seat)}</bdi> <small>{side === 'att' ? `${tx(terms.attacker)} · ${tFa(b.from)}` : `${tx(terms.defender)} · ${tFa(b.to)}`}</small></span>
      <span className="rk-tray__dice">
        {dice.map((d, i) => {
          const r = res(i, side);
          return (
            <span key={`${rollSeq}-${i}`} style={{ ['--i' as string]: i }} className={['rk-tray__die bg-roll', r ? `rk-tray__die--${r}` : ''].join(' ')}>
              <DieFace value={d} side={side} />
              <span className="rk-mark">{r === 'win' ? '✓' : r === 'loss' ? '−۱' : '–'}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
  const text = `${tx(terms.lastBattle)}: ${tx(terms.attacker)} ${b.att.map(fa).join('، ')}؛ ${tx(terms.defender)} ${b.def.map(fa).join('، ')}. ${tx(terms.attacker)} ${fa(b.lossA)} و ${tx(terms.defender)} ${fa(b.lossD)} ${tx(terms.army)} از دست داد${b.rounds > 1 ? ` در ${fa(b.rounds)} ${tx(terms.round)}` : ''}${b.conquered ? `؛ ${tx(terms.territory)} ${tx(terms.conquered)}` : ''}.`;
  return (
    <section className="rk-tray" aria-label={text}>
      <h3><Tm t={terms.lastBattle} />{b.rounds > 1 ? ` (${tx(terms.blitz)}، ${fa(b.rounds)} ${tx(terms.round)})` : ''}</h3>
      <div className="rk-tray__felt">
        {row('att', b.att, b.seat)}
        {row('def', b.def, b.defender)}
      </div>
      <p className="rk-losses">
        <span className="rk-loss rk-loss--att"><Tm t={terms.losses} />: <Tm t={terms.attacker} /> {fa(b.lossA)}</span>
        <span className="rk-loss rk-loss--def"><Tm t={terms.defender} /> {fa(b.lossD)}</span>
        {b.conquered && <span className="rk-loss rk-loss--won"><Tm t={terms.conquered} /></span>}
      </p>
    </section>
  );
}

// ---------- renderer ----------

export default function RiskRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<RiskView>) {
  useTermsLang(); // re-render when the terms language changes (module-level helpers read it through tx)
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

  // My attack in the undo window, or sent and not answered yet: the dice tumble without values until the server rolls.
  const [asked, setAsked] = useState<Hint | null>(null);
  useEffect(() => { if (!busy) setAsked(null); }, [busy]);
  const rollAct = queued && (queued.type === 'attack' || queued.type === 'blitz') ? queued : busy ? asked : null;
  const rolling: Rolling | null = rollAct && mySeat !== null ? (() => {
    const from = T[rollAct.from as TerritoryId], to = T[rollAct.to as TerritoryId];
    return { seat: mySeat, from, to, att: rollAct.type === 'blitz' ? Math.min(3, view.armies[from]! - 1) : rollAct.dice as number, def: Math.min(2, view.armies[to]!) };
  })() : null;
  // Undo-window preview of moves whose result is already known: armies placed, moved (fortify, occupation), cards traded.
  const shift: Record<number, number> = {};
  if (queued?.type === 'place') for (const [id, k] of Object.entries(queued.armies as Record<string, number>)) shift[T[id as TerritoryId]] = k;
  if (queued?.type === 'fortify') { shift[T[queued.from as TerritoryId]] = -(queued.armies as number); shift[T[queued.to as TerritoryId]] = queued.armies as number; }
  if (queued?.type === 'occupy' && view.occupy) { shift[view.occupy.from] = -(queued.armies as number); shift[view.occupy.to] = queued.armies as number; }
  const traded = queued?.type === 'trade' ? new Set(queued.cards as number[]) : null;

  // Cards glide: a drawn card flies in from the deck, traded cards leave to it; the preview and its undo animate too.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${latest?.seq ?? 0}|${queued ? JSON.stringify(queued) : ''}|${!!rolling}`);

  const act = (a: Hint) => {
    if (busy) return;
    if (a.type === 'attack' || a.type === 'blitz') setAsked(a);
    onAction(a);
  };

  const placing = myTurn && !!placeHint && !queued;
  const available = placing ? (placeHint!.available as number) : 0;
  const drafted = Object.values(draft).reduce((a, b) => a + b, 0);
  const attackFrom = new Set(attacks.map((a) => a.from));
  const attackTo = sel === null ? new Set<number>() : new Set(attacks.filter((a) => a.from === sel).map((a) => a.to));
  const fortFrom = new Set(forts.map((f) => f.from));
  const fortTo = sel === null ? new Set<number>() : new Set(forts.find((f) => f.from === sel)?.to ?? []);
  const maxDice = attacks.find((a) => a.from === sel && a.to === aim)?.maxDice ?? 0;
  const fortMax = forts.find((f) => f.from === sel)?.max ?? 0;

  const targets = new Set<number>();
  const kinds = new Map<number, Kind>();
  if (placing) view.owner.forEach((o, t) => { if (o === mySeat) { targets.add(t); kinds.set(t, 'place'); } });
  if (myTurn && view.phase === 'attack') { attackFrom.forEach((t) => { targets.add(t); kinds.set(t, 'src'); }); attackTo.forEach((t) => { targets.add(t); kinds.set(t, 'attack'); }); }
  if (myTurn && view.phase === 'fortify') { fortFrom.forEach((t) => { targets.add(t); kinds.set(t, 'src'); }); fortTo.forEach((t) => { targets.add(t); kinds.set(t, 'fort'); }); }

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
    const base = `${tFa(t)}، ${ownerLabel(t)}، ${fa(view.armies[t]!)} ${tx(terms.army)}`;
    if (!targets.has(t)) return base;
    if (placing) return `${base}، افزودن ۱ ${tx(terms.army)}${draft[t] ? ` (تاکنون ${fa(draft[t]!)})` : ''}`;
    if (view.phase === 'attack') return `${base}، ${attackTo.has(t) ? `هدف ${tx(terms.attack)}` : `${tx(terms.attack)} از این‌جا`}`;
    return `${base}، ${fortTo.has(t) ? `مقصد ${tx(terms.fortify)}` : `${tx(terms.fortify)} از این‌جا`}`;
  };

  // Status line.
  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    if (queued) status = { tone: 'wait', text: 'حرکت شما در حال ثبت است…' };
    else if (!myTurn) status = { tone: 'wait', text: `نوبت ${iso(seatName(view.current))} — ${tx(PHASE_T[view.phase])}` };
    else if (view.phase === 'setup') status = { tone: 'mine', text: `${fa(view.available)} ${tx(terms.startArmy)} را روی ${tx(terms.territoriesYour)} بچینید` };
    else if (view.phase === 'reinforce') status = { tone: 'mine', text: view.mustTrade ? `اول باید یک ${tx(terms.set)} ${tx(terms.card)} ${tx(terms.trade)} کنید` : `${fa(view.available)} ${tx(terms.reinforceArmy)} را بچینید` };
    else if (view.phase === 'attack') status = { tone: 'mine', text: `از ${tx(terms.territory)} خود به همسایه دشمن ${tx(terms.attackDo)} یا ${tx(terms.attack)} را تمام کنید` };
    else if (view.phase === 'occupy') status = { tone: 'mine', text: `${tx(terms.territory)} ${tx(terms.conquered)}؛ تعداد ${tx(terms.armiesEz)} ورودی را تعیین کنید` };
    else status = { tone: 'mine', text: `یک بار ${tx(terms.army)} جابه‌جا کنید یا نوبت را تمام کنید` };
  }

  const myCount = mySeat !== null ? territoriesOf(view, mySeat) : 0;
  const pickedOk = picked.length === 3 && isSet(picked) && tradeSets.some((s) => s.every((c) => picked.includes(c)));
  const hand = (view.myHand ?? []).filter((c) => !traded?.has(c));

  const framed = useInFrame() !== null;
  const wide = useWide();
  return (
    <div className={framed ? 'rk rk--framed' : 'rk'} ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          {/* The map has no continent ribbons in the frame: bonuses and who holds each continent are listed here. */}
          <section className="rk-rail" aria-label={tx(terms.continents)}>
            <h3><Tm t={terms.continents} />{mySeat !== null && <span className="rk-rail__note">{SEAT_FA[mySeat]}</span>}</h3>
            <div className="rk-rail__pills">
              {CONTINENTS.map((c) => {
                const all = view.owner.filter((_, t) => CONTINENT_OF[t] === c.id);
                const holder = all.every((o) => o === all[0]) ? all[0]! : null;
                const mine = mySeat === null ? 0 : all.filter((o) => o === mySeat).length;
                return <span key={c.id} className="bgv-chip">{contName(c.id)} +{fa(c.bonus)}: {holder !== null && holder === mySeat ? 'مال شما' : holder !== null ? SEAT_FA[holder] : mySeat !== null ? `${fa(mine)} از ${fa(all.length)}` : 'آزاد'}</span>;
              })}
              <span className="bgv-chip"><Tm t={terms.deck} />: {fa(view.deckCount)} <Tm t={terms.card} /></span>
            </div>
          </section>
          <p className="rk-rail__tip"><Icon name="book" size={18} />
            <span>هدف: {view.goal === 'world' ? <>هر ۴۲ <Tm t={terms.territory} /></> : <>۳۰ <Tm t={terms.territory} /> در پایان نوبت</>}. <Tm t={terms.set} /> بعدی {fa(view.nextSetValue)} <Tm t={terms.army} />،{tx(terms.fortify)} {view.fortifyMode === 'connected' ? 'زنجیره‌ای' : 'فقط همسایه'}.</span>
          </p>
        </RailSlot>
      )}
      {!framed && <div className="rk__meta">
        <span className="rk-chipmeta rk-chipmeta--turn">نوبت {fa(view.turn)}، {tx(PHASE_T[view.phase])}</span>
        <span className="rk-chipmeta">هدف: {view.goal === 'world' ? <>هر ۴۲ <Tm t={terms.territory} /></> : <>۳۰ <Tm t={terms.territory} /> در پایان نوبت</>}</span>
        <span className="rk-chipmeta"><Tm t={terms.set} /> بعدی: {fa(view.nextSetValue)} <Tm t={terms.army} /></span>
        <span className="rk-chipmeta" data-flip-anchor="deck"><img src={CARD_BACK} alt="" aria-hidden="true" className="rk-deck" /> <Tm t={terms.card} /> در <Tm t={terms.deck} />: {fa(view.deckCount)}</span>
        <span className="rk-chipmeta">{tx(terms.fortify)}: {view.fortifyMode === 'connected' ? 'زنجیره‌ای' : 'فقط همسایه'}</span>
      </div>}

      <div className="rk-main">
        <div className="rk-board-wrap">
          <ZoomBoard label={tx(terms.worldMap)}>
            <WorldMap view={view} onPick={pick} ms={{ targets, kinds, selected: sel, target: aim, hinted, draft: queued ? shift : placing ? draft : {}, label }} />
          </ZoomBoard>
          <DiceTray view={view} name={seatName} rolling={rolling} />
        </div>

        <div className="rk-side">
          {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

          {/* Frame: the turn panel is the dock row under the map (the map shrinks to fit), your cards go into the rail on desktop. */}
          {(() => { const turnPanels = (<>
          {myTurn && (view.phase === 'setup' || view.phase === 'reinforce') && (
            <Panel title={view.phase === 'setup' ? tx(terms.setupPhase) : view.elimTrade ? `${tx(terms.trade)} پس از حذف بازیکن` : tx(terms.reinforcement)} tone="decide">
              {view.phase === 'reinforce' && !view.elimTrade && mySeat !== null && (
                <p className="rk-help">
                  {fa(myCount)} <Tm t={terms.territory} /> ÷ ۳ = {fa(Math.max(3, Math.floor(myCount / 3)))}{Math.floor(myCount / 3) < 3 ? ' (حداقل ۳)' : ''}
                  {CONTINENTS.filter((c) => ownsContinent(view, mySeat, c.id)).map((c) => ` + ${contName(c.id)} ${fa(c.bonus)}`).join('')}
                  {' '}= {fa(income(view, mySeat))}
                </p>
              )}
              {view.elimTrade && <p className="rk-help"><Tm t={terms.cardsEz} /> بازیکن حذف‌شده به شما رسید؛ تا ۴ <Tm t={terms.card} /> یا کمتر بماند <Tm t={terms.trade} /> کنید و <Tm t={terms.armies} /> را بچینید.</p>}
              {view.mustTrade && <p className="rk-warn" role="alert">باید پیش از چیدن، یک <Tm t={terms.set} /> <Tm t={terms.card} /> <Tm t={terms.trade} /> کنید (پایین، <Tm t={terms.cardsEz} /> شما).</p>}
              {placing && (
                <>
                  <div className="rk-medal-row">
                    <span className="rk-medal" aria-hidden="true"><strong><Pop v={available - drafted} /></strong><small><Tm t={terms.army} /></small></span>
                    <p className="rk-big"><strong>{fa(available - drafted)}</strong> از {fa(available)} <Tm t={terms.army} /> باقی است. روی <Tm t={terms.territoriesEz} /> خودتان بزنید (هر ضربه ۱ <Tm t={terms.army} />).</p>
                  </div>
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
                    <Tm t={terms.placeBtn} />
                  </Button>
                </>
              )}
            </Panel>
          )}

          {myTurn && view.phase === 'attack' && (
            <Panel title={tx(terms.attack)}>
              <p className="rk-help">
                {sel === null ? `${tx(terms.territory)} مبدأ (دست‌کم ۲ ${tx(terms.army)}) را روی نقشه انتخاب کنید.` : aim === null ? `از ${tFa(sel)}: یک همسایه دشمن را انتخاب کنید.` : `${tFa(sel)} (${fa(view.armies[sel]!)}) ← ${tFa(aim)} (${fa(view.armies[aim]!)}، ${tx(terms.defender)} با ${fa(Math.min(2, view.armies[aim]!))} ${tx(terms.die)})`}
              </p>
              {aim !== null && sel !== null && (
                <fieldset className="rk-dice-pick">
                  <legend><Tm t={terms.attackDice} /></legend>
                  {[1, 2, 3].map((k) => (
                    <button key={k} type="button" className="rk-chip" aria-pressed={dice === k} disabled={k > maxDice} onClick={() => setDice(k)}>{fa(k)} <Tm t={terms.die} /></button>
                  ))}
                </fieldset>
              )}
              <div className="row">
                <Button className={exp?.type === 'attack' ? 'rk-hintbtn' : ''} disabled={busy || sel === null || aim === null || dice > maxDice}
                  onClick={() => act({ type: 'attack', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!], dice })}><Tm t={terms.attack} /></Button>
                <Button variant="secondary" disabled={busy || sel === null || aim === null || !has('blitz')}
                  onClick={() => act({ type: 'blitz', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!] })}>{tx(terms.blitz)}</Button>
                <DockSlot><Button variant="ghost" className={exp?.type === 'endAttack' ? 'rk-hintbtn' : ''} disabled={busy || !has('endAttack')} onClick={() => act({ type: 'endAttack' })}><Tm t={terms.endAttack} /></Button></DockSlot>
              </div>
              <p className="rk-help">{tx(terms.blitz)} با بیشترین <Tm t={terms.die} /> تکرار می‌شود تا <Tm t={terms.territory} /> <Tm t={terms.conquest} /> شود یا ۱ <Tm t={terms.army} /> بماند.</p>
            </Panel>
          )}

          {myTurn && view.phase === 'occupy' && occ && (
            <Panel title={`${tx(terms.occupy)} ${tFa(occ.to)}`} tone="decide">
              <p className="rk-help">دست‌کم {fa(occ.min)} (<Tm t={terms.diceEz} /> آخرین <Tm t={terms.attack} />) و حداکثر {fa(occ.max)} <Tm t={terms.army} /> از {tFa(occ.from)} وارد می‌شود.</p>
              <Stepper label={tx(terms.armiesIn)} value={moveN} min={occ.min} max={occ.max} onChange={setMoveN} />
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => setMoveN(occ.max)}>همه ({fa(occ.max)})</Button>
                <Button className={exp?.type === 'occupy' ? 'rk-hintbtn' : ''} disabled={busy || moveN < occ.min || moveN > occ.max} onClick={() => act({ type: 'occupy', armies: moveN })}><Tm t={terms.confirmOccupy} /></Button>
              </div>
            </Panel>
          )}

          {myTurn && view.phase === 'fortify' && (
            <Panel title={`${tx(terms.fortify)} ${tx(terms.endTurn)}`}>
              <p className="rk-help">
                {sel === null ? `${tx(terms.territory)} مبدأ را انتخاب کنید (${view.fortifyMode === 'connected' ? `مقصد باید از راه ${tx(terms.territoriesEz)} خودتان وصل باشد` : `فقط به ${tx(terms.territory)} همسایه`}).` : aim === null ? `از ${tFa(sel)} به کجا؟` : `${tFa(sel)} ← ${tFa(aim)}`}
              </p>
              {sel !== null && aim !== null && <Stepper label={tx(terms.armiesMoving)} value={Math.min(moveN, fortMax)} min={1} max={fortMax} onChange={setMoveN} />}
              <div className="row">
                <Button className={exp?.type === 'fortify' ? 'rk-hintbtn' : ''} disabled={busy || sel === null || aim === null || moveN < 1}
                  onClick={() => act({ type: 'fortify', from: TERRITORY_IDS[sel!], to: TERRITORY_IDS[aim!], armies: Math.min(moveN, fortMax) })}>{tx(terms.fortify)}</Button>
                <DockSlot><Button variant="secondary" className={exp?.type === 'endTurn' ? 'rk-hintbtn' : ''} disabled={busy || !has('endTurn')} onClick={() => act({ type: 'endTurn' })}><Tm t={terms.endTurn} /></Button></DockSlot>
              </div>
            </Panel>
          )}

          </>); return framed ? (myTurn && !view.outcome ? <DockSlot><div className="rk-dock">{turnPanels}</div></DockSlot> : null) : turnPanels; })()}
          {(() => { const handPanel = (<>
          {view.myHand && !view.outcome && (
            <section className="rk-hand" aria-label={`${tx(terms.cardsEz)} شما`}>
              <h3><Tm t={terms.cardsEz} /> شما ({fa(hand.length)})</h3>
              {hand.length === 0 ? <p className="rk-help"><Tm t={terms.cardAny} /> ندارید. با <Tm t={terms.conquest} /> دست‌کم یک <Tm t={terms.territory} /> در نوبت، در پایانش یک <Tm t={terms.card} /> می‌گیرید.</p> : (
                <ul className="rk-cards" style={{ ['--n' as string]: hand.length }}>
                  {hand.map((c, idx) => {
                    const k = cardKind(c), t = cardTerritory(c);
                    const on = picked.includes(c);
                    const owned = t !== null && view.owner[t] === mySeat;
                    const text = `${tx(cardTerm[k])}${t !== null ? `، ${tFa(t)}${owned ? ` (${tx(terms.territory)} شما)` : ''}` : ''}`;
                    return (
                      <li key={c} data-flip={`card-${c}`} data-flip-from="deck" data-flip-exit="deck" style={{ ['--i' as string]: idx }}>
                        <button type="button" className={`rk-card rk-card--${k}`} aria-pressed={on} aria-label={text} disabled={busy || tradeSets.length === 0}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : p.length < 3 ? [...p, c] : p))}>
                          {CARD_ART[c] ? <img src={CARD_ART[c]} alt="" aria-hidden="true" className="rk-card__img" draggable={false} /> : <>
                          <span className="rk-card__kind">{tx(cardTerm[k])}</span>
                          <span className="rk-card__art" aria-hidden="true">{t !== null ? <Silhouette t={t} /> : null}<CardIcon kind={k} /></span>
                          {t !== null ? <span className="rk-card__terr">{tFa(t)}{owned ? ' ★' : ''}</span> : <span className="rk-card__terr"><Tm t={terms.wild} /></span>}</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {tradeSets.length > 0 && (
                <div className="row">
                  <Button size="sm" variant="ghost" onClick={() => setPicked(tradeSets[0]!)}>انتخاب یک <Tm t={terms.set} /></Button>
                  <Button className={exp?.type === 'trade' ? 'rk-hintbtn' : ''} disabled={busy || !pickedOk} onClick={() => { act({ type: 'trade', cards: picked }); setPicked([]); }}>
                    <Tm t={terms.trade} /> <Tm t={terms.set} /> (+{fa(view.nextSetValue)})
                  </Button>
                </div>
              )}
              <p className="rk-help"><Tm t={terms.set} />: سه هم‌شکل، یکی از هر شکل، یا دو <Tm t={terms.card} /> با <Tm t={terms.wild} />. ★ یعنی <Tm t={terms.territory} /> <Tm t={terms.card} /> مال شماست (۲ <Tm t={terms.army} /> اضافه، یک بار در نوبت). ارزش <Tm t={terms.set} /> بعدی {fa(view.nextSetValue)} و بعدی {fa(setValue(view.trades + 1))}.</p>
            </section>
          )}

          </>); return framed && wide ? <RailSlot>{handPanel}</RailSlot> : handPanel; })()}
          {!framed && <ul className="rk-players" aria-label="بازیکنان">
            {Array.from({ length: view.players }, (_, s) => {
              const turn = view.current === s && !view.outcome;
              const terr = territoriesOf(view, s);
              const armies = view.armies.reduce((a, k, t) => a + (view.owner[t] === s ? k : 0), 0);
              const conts = CONTINENTS.filter((c) => ownsContinent(view, s, c.id));
              return (
                <li key={s} className={['rk-player', turn ? 'rk-player--turn' : '', view.status[s] !== 'active' ? 'rk-player--out' : ''].join(' ')} style={{ ['--pc' as string]: SEAT_COLOR[s] }}>
                  <span className="rk-seal" aria-hidden="true">{fa(s + 1)}</span>
                  <span className="rk-player__body">
                    <span className="rk-player__head">
                      <bdi className="rk-player__name">{seatName(s)}</bdi>
                      <span className="rk-player__color">({SEAT_FA[s]}{s === mySeat ? '، شما' : ''})</span>
                      {turn && <span className="rk-badge">نوبت</span>}
                      {view.status[s] === 'abandoned' && <span className="rk-badge rk-badge--out">کنار رفته</span>}
                      {view.status[s] === 'out' && <span className="rk-badge rk-badge--out"><Tm t={terms.eliminated} /></span>}
                    </span>
                    <span className="rk-player__counts" aria-label={`${fa(terr)} ${tx(terms.territory)}، ${fa(armies)} ${tx(terms.army)}، ${fa(view.handCounts[s] ?? 0)} ${tx(terms.card)}`}>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="terr" /><Pop v={terr} /><small><Tm t={terms.territory} /></small></span>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="army" /><Pop v={armies} /><small><Tm t={terms.army} /></small></span>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="card" /><Pop v={view.handCounts[s] ?? 0} /><small><Tm t={terms.card} /></small></span>
                    </span>
                    {conts.length > 0 && <span className="rk-player__conts">{conts.map((c) => <span key={c.id} role="img" aria-label={`${contName(c.id)} +${fa(c.bonus)}`} className={`rk-flag rk-flag--${c.id}`}>+{fa(c.bonus)}</span>)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>}

          {!framed && <details className="rk-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-10).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>}
        </div>
      </div>
    </div>
  );
}
