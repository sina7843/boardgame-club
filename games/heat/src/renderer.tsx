// هیت renderer: a 1960s pit wall. The circuit is drawn from the track geometry (spaces, corners with their speed
// limits, the chequered start/finish line) with painted top-down cars; below it the race order with each driver's gear,
// engine Heat and revealed cards, and your own cockpit: gear lever, hand, and — on your move — boost, adrenaline,
// slipstream and discards. Everything secret (hands, decks, plans) is only ever shown to its owner.
import './renderer.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, MOTION, TurnIndicator, ZoomBoard, motionOff, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import car0 from './art/car-0.webp';
import car1 from './art/car-1.webp';
import car2 from './art/car-2.webp';
import car3 from './art/car-3.webp';
import car4 from './art/car-4.webp';
import car5 from './art/car-5.webp';
import wSun from './art/w-sun.webp';
import wRain from './art/w-rain.webp';
import wFog from './art/w-fog.webp';
import wCold from './art/w-cold.webp';
import wHeat from './art/w-heatwave.webp';
import flameArt from './art/heat.webp';
import stressArt from './art/stress.webp';
import flagArt from './art/flag.webp';
import gearArt from './art/gear.webp';
import { GARAGE, GEAR_COOL, type Card, type HeatView, type LogEntry, type RoadId, type WeatherId } from './rules.ts';
import { pointAt, trackOf, type TrackId } from './tracks.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const CAR_ART = [car0, car1, car2, car3, car4, car5];
const CAR_FA = ['قرمز', 'آبی', 'سبز', 'زرد', 'مشکی', 'سفید'];
const WEATHER_ART: Record<WeatherId, string> = { sun: wSun, rain: wRain, fog: wFog, cold: wCold, heatwave: wHeat };
const TRACK_FA: Record<TrackId, string> = { usa: 'آمریکا', italy: 'ایتالیا', france: 'فرانسه', gb: 'بریتانیا' };
const ROAD_FA: Record<RoadId, string> = { up: 'محدودیت ۱+', down: 'محدودیت ۱−', overheat: 'داغ کردن: ۱ گرمای اضافه', slip: 'مکش ۱+ در بخش بعد' };
const ROAD_TAG: Record<RoadId, string> = { up: '+۱', down: '−۱', overheat: '🔥', slip: '≫' };
const WEATHER_FA: Record<WeatherId, string> = {
  sun: 'آفتابی: ۱ گرمای بیشتر در موتور، مکش ۱+',
  rain: 'باران: ۱ استرس بیشتر، خنک‌سازی ۱+',
  fog: 'مه: مکش ممنوع',
  cold: 'سرمای شدید: ۱ گرمای کمتر، خنک‌سازی ۱+',
  heatwave: 'موج گرما: ۱ کارت گرما در دسته، خنک‌سازی ۱−'
};

export function garageText(c: Card): string {
  if (c.k !== 'garage') return '';
  const g = GARAGE[c.g!];
  return [g.heat && `${fa(g.heat)} گرما`, g.cool && `خنک‌سازی ${fa(g.cool)}`, g.scrap && `${fa(g.scrap)} کارت دسته دور`, g.stress && `حذف ${fa(g.stress)} استرس`,
    g.superCool && `${fa(g.superCool)} گرما به موتور`, g.slip && `مکش +${fa(g.slip)}`, g.limit && `محدودیت +${fa(g.limit)}`, g.refresh && 'برگشت روی دسته'].filter(Boolean).join('، ');
}
export function cardLabel(c: Card): string {
  if (c.k === 'heat') return 'کارت گرما';
  if (c.k === 'stress') return 'کارت استرس';
  if (c.k === 'garage') return `${GARAGE[c.g!].nameFa}، سرعت ${fa(c.v ?? 0)}، ${garageText(c)}`;
  return `سرعت ${fa(c.v ?? 0)}${c.up ? ' (ارتقای شروع)' : ''}`;
}

export function HeatCard({ c, size = 'md' }: { c: Card; size?: 'sm' | 'md' }) {
  return (
    <span className={`ht-card ht-card--${c.k} ht-card--${size}${c.up ? ' ht-card--up' : ''}`} aria-label={cardLabel(c)}>
      {c.k === 'heat' ? <img src={flameArt} alt="" draggable={false} />
        : c.k === 'stress' ? <><img src={stressArt} alt="" draggable={false} /><b>؟</b></>
          : <><b className="ht-card__v">{fa(c.v ?? 0)}</b>{c.k === 'garage' && size === 'md' && <small className="ht-card__g">{GARAGE[c.g!].nameFa}<br />{garageText(c)}</small>}</>}
    </span>
  );
}

function where(view: HeatView, pos: number) {
  const L = trackOf(view.track).length;
  if (pos < 0) return 'پشت خط شروع';
  const lap = Math.min(Math.floor(pos / L) + 1, view.laps);
  return `دور ${fa(lap)} از ${fa(view.laps)} · خانهٔ ${fa(pos - (lap - 1) * L)}`;
}

function logText(e: LogEntry, who: (s: number) => string): string {
  const w = who(e.seat);
  switch (e.e) {
    case 'shift': return `${w} دنده ${fa(e.n!)}${e.to ? ' (پرش دو دنده: ۱ گرما)' : ''}`;
    case 'move': return `${w} با سرعت ${fa(e.n!)} حرکت کرد`;
    case 'stress': return `استرس ${w}: ${fa(e.n!)}`;
    case 'boost': return `بوست ${w}: +${fa(e.n!)}`;
    case 'adrenaline': return `آدرنالین ${w}: +۱`;
    case 'cool': return `${w} ${fa(e.n!)} گرما را خنک کرد`;
    case 'slip': return `مکش ${w}: +${fa(e.n!)} خانه`;
    case 'corner': return `${w} در پیچ ${fa(e.at! + 1)} ${fa(e.n!)} گرما پرداخت`;
    case 'spin': return `${w} در پیچ ${fa(e.at! + 1)} چرخید (${fa(e.n!)} استرس، دندهٔ ۱)`;
    case 'finish': return `${w} از خط پایان گذشت (${fa(e.n!)} خانه جلوتر)`;
    case 'scrap': return `${w} ${fa(e.n!)} کارت از دسته دور ریخت`;
    case 'pick': return `${w} یک کارت ارتقا برداشت`;
    case 'timeout': return `زمان ${w} تمام شد`;
    case 'resign': return `${w} انصراف داد`;
  }
}

function Track({ view, who }: { view: HeatView; who: (s: number) => string }) {
  const t = trackOf(view.track);
  const L = t.length;
  const d = useMemo(() => `M${t.path.map((p) => p.map((x) => x.toFixed(1)).join(' ')).join(' L')} Z`, [t]);
  const across = (i: number, half = 34) => {
    const p = pointAt(t, i / L);
    const nx = -Math.sin(p.a), ny = Math.cos(p.a);
    return { x1: p.x + nx * half, y1: p.y + ny * half, x2: p.x - nx * half, y2: p.y - ny * half, p, nx, ny };
  };
  const finish = across(0);
  const carAt = (pos: number, lane: number) => {
    const p = pointAt(t, (((pos % L) + L) % L + 0.5) / L);
    const off = lane === 0 ? -13 : 13;
    return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, deg: (p.a * 180) / Math.PI };
  };
  // Cars drive along the road space by space (not straight across the infield), turning with the track.
  const cars = useRef(new Map<number, SVGGElement>());
  const was = useRef<number[] | null>(null);
  const posKey = view.racers.map((r) => `${r.pos}:${r.lane}`).join();
  useLayoutEffect(() => {
    const prev = was.current;
    was.current = view.racers.map((r) => r.pos);
    if (!prev || motionOff()) return;
    view.racers.forEach((r, seat) => {
      const from = prev[seat], el = cars.current.get(seat);
      if (from === undefined || from === r.pos || !el || Math.abs(r.pos - from) > L) return;
      const dir = r.pos > from ? 1 : -1;
      const steps: { x: number; y: number; deg: number }[] = [];
      for (let k = from; k !== r.pos + dir; k += dir) steps.push(carAt(k, r.lane));
      const end = steps.at(-1)!;
      // Unwrap the heading backwards from the end so a long lap never spins the car the wrong way round.
      const rel = steps.map(() => 0);
      for (let i = steps.length - 2; i >= 0; i--) rel[i] = rel[i + 1]! + ((((steps[i]!.deg - steps[i + 1]!.deg) % 360) + 540) % 360 - 180);
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(steps.map((c, i) => ({ transform: `translate(${c.x - end.x}px, ${c.y - end.y}px) rotate(${rel[i]}deg)` })),
        { duration: Math.min(MOTION.move + 120 * steps.length, 2400), easing: 'ease-in-out' });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);
  return (
    <svg className="ht-track" viewBox="-20 -20 1040 660" role="img" aria-label={`پیست ${TRACK_FA[view.track]}، ${fa(L)} خانه در هر دور`}>
      <path d={d} className="ht-track__verge" />
      <path d={d} className="ht-track__road" />
      <path d={d} className="ht-track__mid" />
      {Array.from({ length: L }, (_, i) => { const a = across(i, 30); return <line key={i} {...{ x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 }} className="ht-track__tick" />; })}
      {Array.from({ length: L }, (_, i) => i).filter((i) => i % 5 === 0 && i).map((i) => { const a = across(i + 0.5, 48); return <text key={i} x={a.x1} y={a.y1} className="ht-track__num">{fa(i)}</text>; })}
      <line {...{ x1: finish.x1, y1: finish.y1, x2: finish.x2, y2: finish.y2 }} className="ht-track__finish" />
      <image href={flagArt} x={finish.p.x - finish.nx * 74 - 22} y={finish.p.y - finish.ny * 74 - 22} width="44" height="44" />
      {t.corners.map((c, i) => {
        const a = across(c.at, 38);
        const road = view.road[i];
        const b = across(c.at, 70);
        const lim = Math.max(1, c.limit + (road === 'up' ? 1 : road === 'down' ? -1 : 0));
        return (
          <g key={i} className="ht-corner">
            <title>{`پیچ ${fa(i + 1)} (خانهٔ ${fa(c.at)}): محدودیت سرعت ${fa(lim)}${road ? ` · ${ROAD_FA[road]}` : ''}`}</title>
            <line {...{ x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 }} className="ht-corner__line" />
            <circle cx={b.x1} cy={b.y1} r="26" className="ht-corner__badge" />
            <text x={b.x1} y={b.y1 + 10} className="ht-corner__lim">{fa(lim)}</text>
            {road && <text x={b.x1} y={b.y1 - 32} className="ht-corner__road"><title>{ROAD_FA[road]}</title>{ROAD_TAG[road]}</text>}
          </g>
        );
      })}
      {view.racers.map((r, seat) => {
        if (r.finished || r.resigned) return null;
        const { x, y, deg } = carAt(r.pos, r.lane);
        return (
          <g key={seat} className="ht-carpath" ref={(el) => { if (el) cars.current.set(seat, el); else cars.current.delete(seat); }}>
            <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`} className={view.current === seat ? 'ht-car ht-car--on' : 'ht-car'}>
              <title>{`${who(seat)}: ${where(view, r.pos)}`}</title>
              <image href={CAR_ART[seat]} x="-24" y="-15" width="48" height="30" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

const sorted = (a: number[]) => a.slice().sort((x, y) => x - y);

/** The served view with my queued choice applied from what I already hold: a committed plan, discarded cards leaving the
 * hand, a picked garage card leaving the market. Movement, flips, corners and draws wait for the server. */
function preview(v: HeatView, me: number | null, q: GameAction | null | undefined): HeatView {
  if (!q || me === null || !v.me) return v;
  const racers = (f: (r: HeatView['racers'][number]) => HeatView['racers'][number]) => v.racers.map((r, s) => (s === me ? f(r) : r));
  if (q.type === 'plan') return { ...v, me: { ...v.me, plan: { gear: q.gear as number, cards: q.cards as number[] } }, racers: racers((r) => ({ ...r, planned: true })) };
  if (q.type === 'react') {
    const out = q.discard as number[];
    if (!out.length) return v;
    return { ...v, me: { ...v.me, hand: v.me.hand.filter((c) => !out.includes(c.id)) }, racers: racers((r) => ({ ...r, hand: r.hand - out.length, discard: r.discard + out.length })) };
  }
  if (q.type === 'pick' && v.draft) return { ...v, draft: { ...v.draft, market: v.draft.market.filter((c) => c.id !== q.card) } };
  return v;
}

function Stat({ value, className, title, children }: { value: number; className: string; title: string; children: ReactNode }) {
  const pop = usePop(value);
  return <span key={value} className={`${className} ${pop}`} title={title}>{children}</span>;
}

/** A small H-pattern gate: the four gear slots with the car's current gear knob. */
function GearMini({ gear }: { gear: number }) {
  return (
    <span className="ht-gearmini" title="دنده" aria-label={`دندهٔ ${fa(gear)}`}>
      <span className="ht-gearmini__gate" dir="ltr" aria-hidden="true">{[1, 3, 2, 4].map((n) => <i key={n} className={n === gear ? 'on' : ''} />)}</span>
      دندهٔ {fa(gear)}
    </span>
  );
}

/** A car's revealed cards this round (played, then boost flips) and the resulting speed. */
function Play({ r, s }: { r: HeatView['racers'][number]; s: number }) {
  return (
    <div className="ht-racer__play">
      {r.played.map((c) => <span key={c.id} data-flip={`card-${c.id}`} data-flip-from={`seat-${s}`} data-flip-exit={`discard-${s}`}><HeatCard c={c} size="sm" /></span>)}
      {r.flips.length > 0 && <span className="ht-flips">رو شد: {r.flips.map((c) => <span key={c.id} data-flip={`card-${c.id}`} data-flip-from={`deck-${s}`} data-flip-exit={`discard-${s}`}><HeatCard c={c} size="sm" /></span>)}</span>}
      <b key={r.speed} className="ht-speed bg-pop">سرعت {fa(r.speed)}</b>
    </div>
  );
}

export default function HeatRenderer({ view: served, legalActions: legal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<HeatView>) {
  // Undo-window preview (see preview()); while a move waits in the window nothing else can be chosen.
  const view = preview(served, mySeat, queued);
  const legalActions = queued ? [] : legal;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const plan = legalActions.find((a) => a.type === 'plan') as { gears: { gear: number; cost: number }[]; playable: number[] } | undefined;
  const react = legalActions.find((a) => a.type === 'react') as { adrenaline: boolean; slip: boolean; slipAdrenaline: boolean; discardable: number[]; cooldown: number } | undefined;
  const canBoost = legalActions.some((a) => a.type === 'boost');
  const pick = legalActions.find((a) => a.type === 'pick') as { cards: number[] } | undefined;
  const me = view.me;
  const myR = mySeat !== null ? view.racers[mySeat] : undefined;
  const hasMat = !!me && !!myR && !myR.resigned;

  const [gear, setGear] = useState<number | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [adr, setAdr] = useState(false);
  const [slip, setSlip] = useState(false);
  const [disc, setDisc] = useState<number[]>([]);
  // Reset choices only when the decision changes (new race/phase/round/mover), not on every seq: in the simultaneous
  // plan phase another player's commit bumps seq and must not wipe a half-made selection; neither should a boost.
  const decision = `${view.race}|${view.phase}|${view.round}|${view.current}|${view.draft?.round ?? ''}`;
  useEffect(() => { setGear(null); setSel([]); setAdr(false); setSlip(false); setDisc([]); }, [decision]);
  const hint = expected as unknown as { type: string; gear?: number; cards?: number[]; adrenaline?: boolean; slipstream?: boolean; discard?: number[]; card?: number } | null;

  const g = gear ?? (plan ? (plan.gears.find((o) => o.gear === myR?.gear) ?? plan.gears[0]!).gear : 1);
  const gOpt = plan?.gears.find((o) => o.gear === g);
  const cardHeat = (id: number) => { const c = me?.hand.find((x) => x.id === id); return c?.k === 'garage' ? GARAGE[c.g!].heat ?? 0 : 0; };
  // Forced play (only Heat / unaffordable cards in hand) skips the Heat check, exactly as the server does.
  const forced = !!plan && !!myR && plan.playable.some((id) => me?.hand.find((x) => x.id === id)?.k === 'heat' || cardHeat(id) > myR.engine);
  const heatNeed = (gOpt?.cost ?? 0) + sel.reduce((a, id) => a + cardHeat(id), 0);
  const planOk = !!plan && !!gOpt && sel.length === g && (forced || heatNeed <= (myR?.engine ?? 0));
  const slipOk = react ? (adr ? react.slipAdrenaline : react.slip) : false;
  const reactAction = { type: 'react', adrenaline: adr, slipstream: slip && slipOk, discard: sorted(disc) };
  const isHint = (a: object) => !!hint && JSON.stringify(hint) === JSON.stringify(a);

  const tap = (id: number) => {
    if (plan) setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < g ? [...sel, id] : sel);
    else if (react && react.discardable.includes(id)) setDisc(disc.includes(id) ? disc.filter((x) => x !== id) : [...disc, id]);
  };

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : pick ? { tone: 'mine' as const, text: `گاراژ (دور ${fa(view.draft!.round)} از ۳): یک کارت ارتقا بردارید` }
      : plan ? { tone: 'mine' as const, text: `دنده را انتخاب کنید و ${fa(g)} کارت بازی کنید` }
        : react ? { tone: 'mine' as const, text: `نوبت حرکت شما: سرعت ${fa(myR!.speed)}` }
          : view.phase === 'draft' ? { tone: 'wait' as const, text: `گاراژ: انتخاب ${who(view.draft!.picker ?? 0)}` }
            : view.phase === 'plan' ? { tone: 'wait' as const, text: me?.plan ? 'انتخاب شما ثبت شد؛ منتظر بقیه' : 'بازیکنان دنده و کارت انتخاب می‌کنند' }
              : { tone: 'wait' as const, text: `نوبت حرکت ${who(view.current ?? 0)}` };

  const order = view.order.length ? [...view.order, ...view.racers.map((_, i) => i).filter((i) => !view.order.includes(i))]
    : view.racers.map((_, i) => i).sort((a, b) => {
      const ra = view.racers[a]!, rb = view.racers[b]!;
      if (ra.finished || rb.finished) return (ra.finished ? 0 : 1) - (rb.finished ? 0 : 1) || (ra.finished && rb.finished ? ra.finished.round - rb.finished.round || rb.finished.over - ra.finished.over : 0);
      return rb.pos - ra.pos || ra.lane - rb.lane;
    });

  return (
    <div className="ht" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="ht__bar">
        <span className="ht-chip">پیست {TRACK_FA[view.track]}</span>
        <span className="ht-chip">{fa(view.laps)} دور</span>
        {view.races > 1 && <span className="ht-chip">مسابقهٔ {fa(view.race + 1)} از {fa(view.races)}</span>}
        <span className="ht-chip">دور بازی {fa(view.round)}</span>
        {view.weather && <span className="ht-chip ht-chip--w"><img src={WEATHER_ART[view.weather]} alt="" />{WEATHER_FA[view.weather]}</span>}
        {view.garage && <span className="ht-chip">گاراژ فعال</span>}
      </div>

      <ZoomBoard label="پیست" className="ht__board">
        <div dir="ltr"><Track view={view} who={who} /></div>
      </ZoomBoard>

      {view.draft && (
        <section className="ht__draft" aria-label="بازار گاراژ">
          <h3 className="ht__h">بازار گاراژ: دور {fa(view.draft.round)} از ۳</h3>
          <div className="ht__cards">
            {view.draft.market.map((c) => (
              <button key={c.id} type="button" data-flip={`card-${c.id}`} data-flip-exit={`deck-${view.draft!.picker ?? 0}`} className={`ht-pick${hint?.type === 'pick' && hint.card === c.id ? ' ht-hint' : ''}`} disabled={!pick || busy}
                onClick={() => onAction({ type: 'pick', card: c.id })} aria-label={`برداشتن ${cardLabel(c)}`}><HeatCard c={c} /></button>
            ))}
          </div>
        </section>
      )}

      <ol className="ht__racers" aria-label="ترتیب مسابقه">
        {order.map((s) => {
          const r = view.racers[s]!;
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          // My own piles and played cards live on my car mat below (one home per motion id / anchor).
          const onMat = s === mySeat && hasMat;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['ht-racer', 'ht-mat', `ht-mat--c${s}`, view.current === s ? 'ht-racer--on' : '', s === mySeat ? 'ht-racer--me' : '', r.resigned ? 'ht-racer--out' : ''].join(' ')}>
              <img className="ht-racer__car" src={CAR_ART[s]} alt={`ماشین ${CAR_FA[s]}`} />
              <div className="ht-racer__main">
                <div className="ht-racer__head">
                  {place && <b className="ht-racer__place">{fa(place)}</b>}
                  <bdi className="ht-racer__name">{who(s)}</bdi>
                  <GearMini gear={r.gear} />
                  <Stat value={r.engine} className="ht-heat" title="گرمای موتور"><img src={flameArt} alt="" />موتور {fa(r.engine)}</Stat>
                  {r.adrenaline && <span className="ht-tag">آدرنالین</span>}
                  {view.phase === 'plan' && !r.finished && !r.resigned && <span className="ht-tag">{r.planned ? 'آماده ✓' : 'در حال انتخاب…'}</span>}
                  {view.races > 1 && <span className="ht-tag">{fa(r.points)} امتیاز</span>}
                </div>
                <div className="ht-racer__sub">
                  {r.resigned ? 'انصراف داده' : r.finished ? `تمام کرد · ${fa(r.finished.over)} خانه بعد از خط` : where(view, r.pos)}
                  {!onMat && <span className="ht-racer__counts"> · دست {fa(r.hand)} · <span data-flip-anchor={`deck-${s}`}>دسته {fa(r.deck)}</span> · <span data-flip-anchor={`discard-${s}`}>دورریز {fa(r.discard)}</span></span>}
                </div>
                {r.revealed && !onMat && <Play r={r} s={s} />}
                {r.revealed && onMat && <div className="ht-racer__play"><b key={r.speed} className="ht-speed bg-pop">سرعت {fa(r.speed)}</b></div>}
              </div>
            </li>
          );
        })}
      </ol>

      {hasMat && me && myR && (
        <section className={`ht__cockpit ht-mat ht-mat--c${mySeat} ht-mat--mine`} aria-label="صفحهٔ ماشین شما">
          <div className="ht-mat__top">
            <div className="ht-mat__car">
              <img src={CAR_ART[mySeat!]} alt={`ماشین ${CAR_FA[mySeat!]}`} />
              <bdi>{who(mySeat!)}</bdi>
              {myR.adrenaline && <span className="ht-tag">آدرنالین</span>}
            </div>
            <div className="ht-shifter" dir="ltr" role="group" aria-label={`دنده (فعلی ${fa(myR.gear)})`}>
              <img className="ht__gearart" src={gearArt} alt="" />
              {[1, 2, 3, 4].map((n) => {
                const pos = { gridColumn: n <= 2 ? 1 : 2, gridRow: n % 2 ? 1 : 2 };
                if (!plan) {
                  return <span key={n} style={pos} className={`ht-gearpos${myR.gear === n ? ' ht-gearpos--on' : ''}`} aria-current={myR.gear === n ? 'true' : undefined}><b>{fa(n)}</b><small>{GEAR_COOL[n] ? `خنک ${fa(GEAR_COOL[n]!)}` : ' '}</small></span>;
                }
                const o = plan.gears.find((x) => x.gear === n);
                return (
                  <button key={n} type="button" style={pos} className={['ht-gearbtn', g === n ? 'ht-gearbtn--on' : '', hint?.type === 'plan' && hint.gear === n && g !== n ? 'ht-hint' : ''].join(' ')}
                    disabled={!o || busy} aria-pressed={g === n} onClick={() => { setGear(n); setSel(sel.slice(0, n)); }}>
                    <b>{fa(n)}</b><small>{o ? (o.cost ? '۱ گرما' : 'رایگان') : '—'}</small>
                  </button>
                );
              })}
            </div>
            <div className="ht-engine" aria-label={`موتور: ${fa(myR.engine)} کارت گرما`}>
              <small>موتور</small>
              <span className="ht-engine__flames" aria-hidden="true">{Array.from({ length: Math.min(myR.engine, 8) }, (_, i) => <img key={i} src={flameArt} alt="" />)}</span>
              <Stat value={myR.engine} className="ht-engine__n" title="گرمای موتور">{fa(myR.engine)}</Stat>
            </div>
            <div className="ht-pile" data-flip-anchor={`deck-${mySeat}`} aria-label={`دسته: ${fa(myR.deck)} کارت، ${fa(me.deckStress)} استرس`}>
              <span className="ht-pile__back" aria-hidden="true" />
              <b>{fa(myR.deck)}</b><small>دسته</small>
              <small className="ht-pile__note"><img src={stressArt} alt="" />استرس {fa(me.deckStress)}</small>
            </div>
            <div className="ht-pile ht-pile--disc" data-flip-anchor={`discard-${mySeat}`} aria-label={`دورریز: ${fa(myR.discard)} کارت`}>
              {myR.discardTop ? <HeatCard c={myR.discardTop} size="sm" /> : <span className="ht-pile__empty" aria-hidden="true" />}
              <b>{fa(myR.discard)}</b><small>دورریز</small>
            </div>
          </div>
          {myR.revealed && <div className="ht-mat__play"><small>بازی‌شده:</small><Play r={myR} s={mySeat!} /></div>}
          <div className="ht__hand" role="group" aria-label="دست شما">
            {me.hand.map((c) => {
              const on = sel.includes(c.id) || disc.includes(c.id);
              const can = (!!plan && plan.playable.includes(c.id)) || (!!react && react.discardable.includes(c.id));
              const hinted = !on && ((hint?.type === 'plan' && hint.cards?.includes(c.id)) || (hint?.type === 'react' && hint.discard?.includes(c.id)));
              return (
                <button key={c.id} type="button" data-flip={`card-${c.id}`} data-flip-from={`deck-${mySeat}`} data-flip-exit={`discard-${mySeat}`} className={['ht-slot', on ? (disc.includes(c.id) ? 'ht-slot--disc' : 'ht-slot--on') : '', hinted ? 'ht-hint' : ''].join(' ')}
                  disabled={!can || busy} aria-pressed={on} onClick={() => tap(c.id)}><HeatCard c={c} /></button>
              );
            })}
          </div>
          {me.plan && <p className="ht__note">انتخاب ثبت‌شده: دندهٔ {fa(me.plan.gear)} و {fa(me.plan.cards.length)} کارت</p>}
          {plan && (
            <div className="ht__actions">
              <Button size="sm" disabled={!planOk || busy} className={`ht-submit${planOk && isHint({ type: 'plan', gear: g, cards: sorted(sel) }) ? ' ht-hint' : ''}`}
                onClick={() => onAction({ type: 'plan', gear: g, cards: sorted(sel) })}>ثبت دندهٔ {fa(g)} و {fa(sel.length)} کارت{gOpt?.cost ? ' (۱ گرما)' : ''}</Button>
            </div>
          )}
          {react && (
            <div className="ht__actions">
              {canBoost && <Button size="sm" variant="secondary" disabled={busy} className={`ht-boost${hint?.type === 'boost' ? ' ht-hint' : ''}`} onClick={() => onAction({ type: 'boost' })}>بوست (۱ گرما)</Button>}
              {react.adrenaline && (
                <button type="button" className={['ht-toggle', adr ? 'ht-toggle--on' : '', hint?.type === 'react' && hint.adrenaline && !adr ? 'ht-hint' : ''].join(' ')} aria-pressed={adr} disabled={busy} onClick={() => setAdr(!adr)}>آدرنالین +۱</button>
              )}
              <button type="button" className={['ht-toggle', slip && slipOk ? 'ht-toggle--on' : '', hint?.type === 'react' && hint.slipstream && !(slip && slipOk) && slipOk ? 'ht-hint' : ''].join(' ')}
                aria-pressed={slip && slipOk} disabled={!slipOk || busy} onClick={() => setSlip(!slip)}>مکش +۲</button>
              <span className="ht__note">خنک‌سازی خودکار: {fa(react.cooldown)}{disc.length ? ` · دور ریختن ${fa(disc.length)} کارت` : ''}</span>
              <Button size="sm" disabled={busy} className={`ht-end${isHint(reactAction) ? ' ht-hint' : ''}`} onClick={() => onAction(reactAction)}>پایان نوبت</Button>
            </div>
          )}
        </section>
      )}

      {view.log.length > 0 && (
        <ul className="ht__log" aria-label="رویدادهای این دور" aria-live="polite">
          {view.log.slice(-8).map((e, i) => <li key={`${view.seq}-${i}`}>{logText(e, who)}</li>)}
        </ul>
      )}

      {view.history.length > 0 && (
        <section className="ht__hist" aria-label="نتایج مسابقه‌ها">
          {view.history.map((h, i) => (
            <p key={i}><b>مسابقهٔ {fa(i + 1)} ({TRACK_FA[h.track]}):</b> {h.order.map((s, k) => `${fa(k + 1)}. ${who(s)}`).join('، ')}</p>
          ))}
        </section>
      )}
    </div>
  );
}
