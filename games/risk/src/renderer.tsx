// RISK renderer: an antique-style world map (watercolour continents, owner washes, 3D army tokens, continent
// ribbons, last battle arrow) in a ZoomBoard, plus panels driven by the phase and legal actions: placement, cards,
// attack with dice tray, occupation, fortification, players and log. Shows only the projection: other hands are counts.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import {
  CARD_FA, CONTINENTS, CONTINENT_OF, T, TERRITORY_FA, TERRITORY_IDS, cardKind, cardTerritory, isSet, setValue,
  type TerritoryId
} from './board.ts';
import {
  CONTINENT_LABEL, CONTINENT_LINES, COASTS, DECOR_PATHS, LAKE_PATHS, MAP_H, MAP_W, REGIONS, SEA_LANES, WRAP_LANE, project, type Pt
} from './geometry.ts';
import { ArmyToken, CARD_BACK, CardIcon, Cartouche, Compass, DieFace, INK, MapDefs, Parchment, SEAT_COLOR, SEAT_FA, SEAT_WASH, Serpent, Ship, StatIcon } from './art.tsx';
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
const xMost = (t: number, dir: 1 | -1): Pt => REGIONS[t]!.poly.reduce((a, b) => (b[0] * dir > a[0] * dir ? b : a));
/** Hit-test anchor: a transparent box centred on the token spot so the group's bounding-box centre is a point inside the territory. */
const anchorOf = (poly: Pt[], c: Pt) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const hw = Math.max(c[0] - Math.min(...xs), Math.max(...xs) - c[0]) + 6, hh = Math.max(c[1] - Math.min(...ys), Math.max(...ys) - c[1]) + 6;
  return { x: c[0] - hw, y: c[1] - hh, width: hw * 2, height: hh * 2 };
};
const ANCHORS = REGIONS.map((r) => anchorOf(r.poly, r.center));
const GRAT_LAT = [60, 30, 0, -30], GRAT_LON = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

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

function WorldMap({ view, ms, onPick }: { view: RiskView; ms: MapState; onPick: (t: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const k = useMapScale(svg);
  const [hover, setHover] = useState<number | null>(null);
  const key = (t: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); } };
  const battle = view.lastBattle && view.lastBattle.turn === view.turn ? view.lastBattle : null;
  const wa = xMost(WRAP_LANE[0], -1), wk = xMost(WRAP_LANE[1], 1);

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
    <svg ref={svg} className={showNames ? 'rk-map rk-map--names' : 'rk-map'} viewBox={`${-PAD} ${-PAD} ${VIEW_W} ${MAP_H + PAD * 2}`} role="group" aria-label="نقشه جهان ریسک" style={{ direction: 'ltr' }}>
      <MapDefs />
      <g aria-hidden="true" pointerEvents="none">
        <rect x={-PAD} y={-PAD} width={VIEW_W} height={MAP_H + PAD * 2} rx="10" className="rk-paper" />
        <Parchment w={MAP_W} h={MAP_H} />
        {GRAT_LAT.map((la) => { const y = project(0, la)[1]; return <line key={`la${la}`} x1="0" x2={MAP_W} y1={y} y2={y} className="rk-grid" />; })}
        {GRAT_LON.map((lo) => { const x = project(lo, 0)[0]; return <line key={`lo${lo}`} y1="0" y2={MAP_H} x1={x} x2={x} className="rk-grid" />; })}
        <rect width={MAP_W} height={MAP_H} fill="url(#rkm-vignette)" />
        {/* Graduated neatline: a chequered band between two ink rules. */}
        <rect x="-8" y="-8" width={MAP_W + 16} height={MAP_H + 16} className="rk-band rk-band--a" />
        <rect x="-8" y="-8" width={MAP_W + 16} height={MAP_H + 16} className="rk-band rk-band--b" />
        <rect x="-12.5" y="-12.5" width={MAP_W + 25} height={MAP_H + 25} className="rk-rule" />
        <rect x="-3.5" y="-3.5" width={MAP_W + 7} height={MAP_H + 7} className="rk-rule rk-rule--thin" />

        <g transform={`translate(${project(-136, -9).map((v) => v.toFixed(1)).join(' ')})`}><Compass /></g>
        <g transform={`translate(104 ${(MAP_H - 36).toFixed(1)})`}><Cartouche title="ریسک" /></g>
        <g transform={`translate(${project(-30, -38).map((v) => v.toFixed(1)).join(' ')})`}><Ship /></g>
        <g transform={`translate(${project(62, -38).map((v) => v.toFixed(1)).join(' ')}) scale(-0.8 0.8)`}><Ship /></g>
        <g transform={`translate(${project(-150, -26).map((v) => v.toFixed(1)).join(' ')})`}><Serpent /></g>
        <g transform={`translate(${project(-58, 62).map((v) => v.toFixed(1)).join(' ')}) scale(0.75)`}><Serpent /></g>

        {SEA_LANES.map((l) => <path key={`h${l.a}-${l.b}`} d={curve(l.p, l.q)} className="rk-lane-halo" />)}
        {SEA_LANES.map((l) => <path key={`${l.a}-${l.b}`} d={curve(l.p, l.q)} className="rk-lane" />)}
        {/* Alaska–Kamchatka wraps around the edge of the map. */}
        <path d={`M${wa[0].toFixed(1)} ${wa[1].toFixed(1)} Q${(wa[0] / 2).toFixed(1)} 26 0 20`} className="rk-lane-halo" />
        <path d={`M${wk[0].toFixed(1)} ${wk[1].toFixed(1)} Q${((wk[0] + MAP_W) / 2).toFixed(1)} 26 ${MAP_W} 20`} className="rk-lane-halo" />
        <path d={`M${wa[0].toFixed(1)} ${wa[1].toFixed(1)} Q${(wa[0] / 2).toFixed(1)} 26 0 20`} className="rk-lane" />
        <path d={`M${wk[0].toFixed(1)} ${wk[1].toFixed(1)} Q${((wk[0] + MAP_W) / 2).toFixed(1)} 26 ${MAP_W} 20`} className="rk-lane" />
        <text x="6" y="13" className="rk-lane__wrap">← {TERRITORY_FA.kamchatka}</text>
        <text x={MAP_W - 6} y="13" className="rk-lane__wrap rk-lane__wrap--end">{TERRITORY_FA.alaska} →</text>

        {/* Water-lining: concentric ripples around every coast, then the land with a drop shadow. */}
        {[22, 15, 9].map((w, i) => COASTS.map((d, j) => <path key={`r${i}-${j}`} d={d} className={`rk-ripple rk-ripple--${i}`} strokeWidth={w} />))}
        {COASTS.map((d, i) => <path key={`l${i}`} d={d} className="rk-land" filter="url(#rkm-land)" />)}
        {DECOR_PATHS.map((p, i) => <path key={`dc${i}`} d={p.d} className="rk-decor" fill={`url(#rkm-c-${p.c})`} />)}
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
            <path d={r.d} className="rk-terr__fill" fill={`url(#rkm-c-${CONTINENT_OF[t]})`} />
            <path d={r.d} className="rk-terr__wash" fill={SEAT_COLOR[owner]} fillOpacity={SEAT_WASH[owner]} pointerEvents="none" />
            <path d={r.d} fill="url(#rkm-paper)" pointerEvents="none" />
            <path d={r.d} clipPath={`url(#rkm-clip-${t})`} className="rk-terr__owner" stroke={SEAT_COLOR[owner]} pointerEvents="none" />
            <path d={r.edge} className="rk-terr__edge" pointerEvents="none" />
            <path d={r.edge} className="rk-ring" pointerEvents="none" />
          </g>
        );
      })}

      <g aria-hidden="true" pointerEvents="none">
        {LAKE_PATHS.map((d, i) => <path key={`lk${i}`} d={d} className="rk-lake" />)}
        <path d={CONTINENT_LINES} className="rk-continent-line" />
        {COASTS.map((d, i) => <path key={`c${i}`} d={d} className="rk-coast" />)}
        {COASTS.map((d, i) => <path key={`ci${i}`} d={d} className="rk-coast rk-coast--inline" />)}

        {CONTINENTS.map((c) => {
          const [x, y] = CONTINENT_LABEL[c.id];
          const owner = view.owner.find((_, t) => CONTINENT_OF[t] === c.id)!;
          const held = ownsContinent(view, owner, c.id);
          return <Ribbon key={c.id} x={x} y={y} text={`${c.nameFa} +${fa(c.bonus)}`} tint={c.id} held={held} chip={held ? { color: SEAT_COLOR[owner]!, seat: owner } : null} />;
        })}

        {arrow && (
          <>
            <path className="rk-arrow-halo" d={arrow} />
            <path className={battle!.conquered ? 'rk-arrow rk-arrow--won' : 'rk-arrow'} d={arrow} markerEnd="url(#rkm-arrow)" />
          </>
        )}

        {REGIONS.map((r, t) => {
          const [x, y] = pos[t]!;
          const draft = ms.draft[t] ?? 0, n = view.armies[t]! + draft;
          const inBattle = !!battle && (battle.from === t || battle.to === t);
          const named = showNames || hover === t || ms.selected === t || ms.target === t;
          return (
            <g key={r.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={['rk-piece', inBattle ? 'rk-piece--battle' : '', ms.selected === t ? 'rk-piece--sel' : ''].join(' ')}>
              {ms.kinds.get(t) && <circle r={R + 4} className={`rk-halo rk-halo--${ms.kinds.get(t)}`} />}
              <g key={`${view.owner[t]}-${view.armies[t]}`} className="rk-piece__token"><ArmyToken seat={view.owner[t]!} n={n} r={R} lift={ms.selected === t} /></g>
              {draft > 0 && <text x="0" y={-R - 4} className="rk-draft" fontSize={R * 0.78}>+{fa(draft)}</text>}
              {named && <text y={R + 12} className="rk-terr__name">{TERRITORY_FA[r.id]}</text>}
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
              <span className="rk-mark">{r === 'win' ? '✓' : r === 'loss' ? '−۱' : '–'}</span>
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
      <div className="rk-tray__felt">
        {row('att', b.att, b.seat)}
        {row('def', b.def, b.defender)}
      </div>
      <p className="rk-losses">
        <span className="rk-loss rk-loss--att">تلفات: مهاجم {fa(b.lossA)}</span>
        <span className="rk-loss rk-loss--def">مدافع {fa(b.lossD)}</span>
        {b.conquered && <span className="rk-loss rk-loss--won">فتح شد</span>}
      </p>
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
  const hand = view.myHand ?? [];

  return (
    <div className="rk">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="rk__meta">
        <span className="rk-chipmeta rk-chipmeta--turn">نوبت {fa(view.turn)} · {PHASE_FA[view.phase]}</span>
        <span className="rk-chipmeta">هدف: {view.goal === 'world' ? 'هر ۴۲ قلمرو' : '۳۰ قلمرو در پایان نوبت'}</span>
        <span className="rk-chipmeta">دسته بعدی: {fa(view.nextSetValue)} ارتش</span>
        <span className="rk-chipmeta"><img src={CARD_BACK} alt="" aria-hidden="true" className="rk-deck" /> کارت در دسته: {fa(view.deckCount)}</span>
        <span className="rk-chipmeta">جابه‌جایی: {view.fortifyMode === 'connected' ? 'زنجیره‌ای' : 'فقط همسایه'}</span>
      </div>

      <div className="rk-main">
        <div className="rk-board-wrap">
          <ZoomBoard label="نقشه جهان">
            <WorldMap view={view} onPick={pick} ms={{ targets, kinds, selected: sel, target: aim, hinted, draft: placing ? draft : {}, label }} />
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
                  <div className="rk-medal-row">
                    <span className="rk-medal" aria-hidden="true"><strong>{fa(available - drafted)}</strong><small>ارتش</small></span>
                    <p className="rk-big"><strong>{fa(available - drafted)}</strong> از {fa(available)} ارتش باقی است. روی قلمروهای خودتان بزنید (هر ضربه ۱ ارتش).</p>
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
              <h3>کارت‌های شما ({fa(hand.length)})</h3>
              {hand.length === 0 ? <p className="rk-help">کارتی ندارید. با فتح دست‌کم یک قلمرو در نوبت، در پایانش یک کارت می‌گیرید.</p> : (
                <ul className="rk-cards" style={{ ['--n' as string]: hand.length }}>
                  {hand.map((c, idx) => {
                    const k = cardKind(c), t = cardTerritory(c);
                    const on = picked.includes(c);
                    const owned = t !== null && view.owner[t] === mySeat;
                    const text = `${CARD_FA[k]}${t !== null ? `، ${tFa(t)}${owned ? ' (قلمرو شما)' : ''}` : ''}`;
                    return (
                      <li key={c} style={{ ['--i' as string]: idx }}>
                        <button type="button" className={`rk-card rk-card--${k}`} aria-pressed={on} aria-label={text} disabled={busy || tradeSets.length === 0}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c) : p.length < 3 ? [...p, c] : p))}>
                          <span className="rk-card__kind">{CARD_FA[k]}</span>
                          <span className="rk-card__art" aria-hidden="true">{t !== null ? <Silhouette t={t} /> : null}<CardIcon kind={k} /></span>
                          {t !== null ? <span className="rk-card__terr">{tFa(t)}{owned ? ' ★' : ''}</span> : <span className="rk-card__terr">جوکر</span>}
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
                  <span className="rk-seal" aria-hidden="true">{fa(s + 1)}</span>
                  <span className="rk-player__body">
                    <span className="rk-player__head">
                      <bdi className="rk-player__name">{seatName(s)}</bdi>
                      <span className="rk-player__color">({SEAT_FA[s]}{s === mySeat ? '، شما' : ''})</span>
                      {turn && <span className="rk-badge">نوبت</span>}
                      {view.status[s] === 'abandoned' && <span className="rk-badge rk-badge--out">کنار رفته</span>}
                      {view.status[s] === 'out' && <span className="rk-badge rk-badge--out">حذف شد</span>}
                    </span>
                    <span className="rk-player__counts" aria-label={`${fa(terr)} قلمرو، ${fa(armies)} ارتش، ${fa(view.handCounts[s] ?? 0)} کارت`}>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="terr" />{fa(terr)}<small>قلمرو</small></span>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="army" />{fa(armies)}<small>ارتش</small></span>
                      <span className="rk-stat" aria-hidden="true"><StatIcon kind="card" />{fa(view.handCounts[s] ?? 0)}<small>کارت</small></span>
                    </span>
                    {conts.length > 0 && <span className="rk-player__conts">{conts.map((c) => <span key={c.id} role="img" aria-label={`${c.nameFa} +${fa(c.bonus)}`} className={`rk-flag rk-flag--${c.id}`}>+{fa(c.bonus)}</span>)}</span>}
                  </span>
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
