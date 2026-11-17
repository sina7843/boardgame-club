// قلمرو renderer: illuminated-map kingdoms. The two domino lines (being placed / to pick) with king markers, your
// kingdom as a 9×9 field around the castle (cells where the domino can start glow), rivals' kingdoms in miniature.
// Rotate the domino, tap where its first half goes, choose your next domino, confirm.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, RailSlot, TurnIndicator, useInFrame, useFlip, usePop, usePrevious, type GameRendererProps } from '@bg/ui';
import { DIRS, DOMINOES, canPlace, scoreKingdom, type Cell, type Half, type KingdominoView, type Terrain } from './rules.ts';

import d01 from './art/kingdomino-d01.png';
import d02 from './art/kingdomino-d02.png';
import d03 from './art/kingdomino-d03.png';
import d04 from './art/kingdomino-d04.png';
import d07 from './art/kingdomino-d07.png';
import d08 from './art/kingdomino-d08.png';
import d09 from './art/kingdomino-d09.png';
import d10 from './art/kingdomino-d10.png';
import d11 from './art/kingdomino-d11.png';
import d12 from './art/kingdomino-d12.png';
import d13 from './art/kingdomino-d13.png';
import d14 from './art/kingdomino-d14.png';
import d16 from './art/kingdomino-d16.png';
import d19 from './art/kingdomino-d19.png';
import d20 from './art/kingdomino-d20.png';
import d21 from './art/kingdomino-d21.png';
import d23 from './art/kingdomino-d23.png';
import d24 from './art/kingdomino-d24.png';
import d25 from './art/kingdomino-d25.png';
import d26 from './art/kingdomino-d26.png';
import d27 from './art/kingdomino-d27.png';
import d28 from './art/kingdomino-d28.png';
import d29 from './art/kingdomino-d29.png';
import d30 from './art/kingdomino-d30.png';
import d31 from './art/kingdomino-d31.png';
import d33 from './art/kingdomino-d33.png';
import d34 from './art/kingdomino-d34.png';
import d35 from './art/kingdomino-d35.png';
import d36 from './art/kingdomino-d36.png';
import d37 from './art/kingdomino-d37.png';
import d38 from './art/kingdomino-d38.png';
import d39 from './art/kingdomino-d39.png';
import d40 from './art/kingdomino-d40.png';
import d41 from './art/kingdomino-d41.png';
import d42 from './art/kingdomino-d42.png';
import d43 from './art/kingdomino-d43.png';
import d46 from './art/kingdomino-d46.png';
import d48 from './art/kingdomino-d48.png';
import castlePink from './art/kingdomino-castle-pink.png'; import castleBlue from './art/kingdomino-castle-blue.png'; import castleOrange from './art/kingdomino-castle-orange.png'; import castleGreen from './art/kingdomino-castle-green.png';
import kingPink from './art/kingdomino-king-pink.png'; import kingBlue from './art/kingdomino-king-blue.png'; import kingOrange from './art/kingdomino-king-orange.png'; import kingGreen from './art/kingdomino-king-green.png';
// Art: design/games/group-d/art/kingdomino. Only 42 of the 48 domino faces are delivered (missing numbers fall back to two terrain squares); terrain squares inside kingdoms stay the older terrain textures.
const DOM_ART: Record<number, string> = { 1: d01, 2: d02, 3: d03, 4: d04, 7: d07, 8: d08, 9: d09, 10: d10, 11: d11, 12: d12, 13: d13, 14: d14, 16: d16, 19: d19, 20: d20, 21: d21, 23: d23, 24: d24, 25: d25, 26: d26, 27: d27, 28: d28, 29: d29, 30: d30, 31: d31, 33: d33, 34: d34, 35: d35, 36: d36, 37: d37, 38: d38, 39: d39, 40: d40, 41: d41, 42: d42, 43: d43, 46: d46, 48: d48 };
const CASTLE = [castlePink, castleBlue, castleOrange, castleGreen];
const KING = [kingPink, kingBlue, kingOrange, kingGreen];
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const TERRAIN_FA: Record<Terrain | 'C', string> = { W: 'گندم‌زار', F: 'جنگل', L: 'دریاچه', G: 'چمنزار', S: 'باتلاق', M: 'معدن', C: 'قلعه' };
const SEAT = ['#d1495b', '#2f80c9', '#e0a526', '#8e5bd1'];

export function Square({ cell, size = 'md', seat }: { cell: Cell | Half | null; size?: 'sm' | 'md'; seat?: number }) {
  if (!cell) return <span className={`kd-sq kd-sq--${size} kd-sq--empty`} />;
  return (
    <span className={`kd-sq kd-sq--${size} kd-t--${cell.t}`} aria-label={`${TERRAIN_FA[cell.t]}${cell.c ? `، ${fa(cell.c)} تاج` : ''}`}>
      {cell.t === 'C' ? <img className="kd-castle-img" src={CASTLE[(seat ?? 0) % 4]} alt="" draggable={false} />
        : cell.c > 0 && <span className="kd-crowns">{Array.from({ length: cell.c }, (_, i) => <i key={i} />)}</span>}
    </span>
  );
}

export function Domino({ dom, size = 'md' }: { dom: number; size?: 'sm' | 'md' }) {
  const [a, b] = DOMINOES[dom]!;
  if (DOM_ART[dom + 1]) return <span className={`kd-dom kd-dom--img kd-dom--${size}`} aria-label={`دومینو ${fa(dom + 1)}`}><img src={DOM_ART[dom + 1]} alt="" draggable={false} /><b className="kd-dom__n visually-hidden">{fa(dom + 1)}</b></span>;
  return <span className={`kd-dom kd-dom--${size}`}><Square cell={a} size={size} /><Square cell={b} size={size} /><b className="kd-dom__n">{fa(dom + 1)}</b></span>;
}

function Kingdom({ id, k, was, from, big, onCell, ok, preview, hint }: { id: string; k: (Cell | null)[][]; was?: (Cell | null)[][]; from?: string; big?: boolean; onCell?: (r: number, c: number) => void; ok?: Set<string>; preview?: Map<string, Half>; hint?: [number, number] | null }) {
  let n = 0;
  // The kingdom may only span 5×5: cells that can no longer fall inside that frame are printed faded.
  let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
  k.forEach((row, r) => row.forEach((cell, c) => { if (cell) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
  const out = (r: number, c: number) => Math.max(r1, r) - Math.min(r0, r) > 4 || Math.max(c1, c) - Math.min(c0, c) > 4;
  return (
    <div className={`kd-kingdom ${big ? 'kd-kingdom--big' : ''}`} role={onCell ? 'group' : undefined} aria-label="سرزمین ۵×۵">
      {k.map((row, r) => row.map((cell, c) => {
        const key = `${r},${c}`;
        const pv = preview?.get(key);
        const fresh = !!was && !!cell && !was[r]![c];
        const cls = ['kd-slot', !cell && !pv && out(r, c) ? 'kd-slot--out' : '', ok?.has(key) ? 'kd-slot--ok' : '', pv ? 'kd-slot--pv' : '', hint && hint[0] === r && hint[1] === c ? 'kd-hint' : '', fresh ? 'bg-land' : ''].join(' ');
        const style = fresh ? { ['--i' as string]: n++ } : undefined;
        const inner = <Square cell={pv ?? cell} size={big ? 'md' : 'sm'} seat={Number(id.slice(1))} />;
        return onCell && !cell
          ? <button key={key} type="button" className={cls} data-ok={ok?.has(key) ? '1' : undefined} style={style} onClick={() => onCell(r, c)} aria-label={`خانهٔ ${fa(r + 1)}، ${fa(c + 1)}`}>{inner}</button>
          : <span key={key} className={cls} style={style} {...(cell ? { 'data-flip': `${id}-${key}` } : {})} {...(fresh && from ? { 'data-flip-from': from, 'data-flip-exit': from } : {})}>{inner}</span>;
      }))}
    </div>
  );
}

/** A score that bumps when it changes (never on first render). */
function Score({ v, suffix = '' }: { v: number; suffix?: string }) {
  const pop = usePop(v);
  return <b key={v} className={pop}>{fa(v)}{suffix}</b>;
}

type Queued = { type: string; slot?: number; place?: { r: number; c: number; dir: number } | null } | null | undefined;
/** The view with the own pick or placement already made, from what the client knows (undo-window preview). */
function withQueued(view: KingdominoView, me: number, q: Queued): KingdominoView {
  if (!q || (q.type !== 'pick' && q.type !== 'play')) return view;
  const next = q.slot === undefined ? view.next : view.next.map((x, i) => (i === q.slot ? { ...x, owner: me } : x));
  if (q.type === 'pick') return { ...view, next };
  const dom = view.current[view.idx]?.dom;
  if (dom === undefined) return view;
  const kingdoms = view.kingdoms.map((k, s) => {
    if (s !== me || !q.place) return k;
    const out = k.map((row) => row.slice()), [dr, dc] = DIRS[q.place.dir]!, [h1, h2] = DOMINOES[dom]!;
    out[q.place.r]![q.place.c] = h1; out[q.place.r + dr]![q.place.c + dc] = h2;
    return out;
  });
  return { ...view, next, kingdoms, last: { seat: me, dom, placed: q.place ?? null } };
}

export default function KingdominoRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<KingdominoView>) {
  const me = mySeat ?? 0;
  const q = mySeat === null ? null : (queued as Queued);
  const view = withQueued(real, me, q);
  const pickHint = q ? undefined : legalActions.find((a) => a.type === 'pick') as { slots: number[] } | undefined;
  const playHint = q ? undefined : legalActions.find((a) => a.type === 'play') as { dom: number; canPlace: boolean; slots: number[] } | undefined;
  const root = useRef<HTMLDivElement>(null);
  const qKey = q ? JSON.stringify(q) : '';
  useFlip(root, `${real.seq}|${qKey}`);
  const before = usePrevious(`${real.seq}|${qKey}`, view);
  const landFrom = view.last?.placed ? `dom-${view.last.dom}` : undefined;
  const wasOwner = new Map([...(before?.current ?? []), ...(before?.next ?? [])].map((x) => [x.dom, x.owner] as const));
  const [dir, setDir] = useState(0);
  const [at, setAt] = useState<[number, number] | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  useEffect(() => { setDir(0); setAt(null); setSlot(null); }, [real.seq, qKey]);
  const hint = expected as unknown as { type: string; place?: { r: number; c: number; dir: number }; slot?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const k = view.kingdoms[me]!;
  const dom = playHint?.dom;
  const ok = useMemo(() => {
    const out = new Set<string>();
    if (dom === undefined) return out;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (canPlace(k, dom, r, c, dir)) out.add(`${r},${c}`);
    return out;
  }, [k, dom, dir]);
  const preview = useMemo(() => {
    if (dom === undefined || !at) return undefined;
    const [dr, dc] = DIRS[dir]!;
    return new Map<string, Half>([[`${at[0]},${at[1]}`, DOMINOES[dom]![0]], [`${at[0] + dr},${at[1] + dc}`, DOMINOES[dom]![1]]]);
  }, [dom, at, dir]);
  const placeOk = !!at && ok.has(`${at[0]},${at[1]}`);
  const needSlot = !!playHint && playHint.slots.length > 0;
  const ready = playHint && (placeOk || !playHint.canPlace) && (!needSlot || slot !== null);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : pickHint ? { tone: 'mine' as const, text: 'یک دومینو از ردیف بعد انتخاب کنید' }
      : playHint ? { tone: 'mine' as const, text: playHint.canPlace ? (at ? (needSlot && slot === null ? 'دومینوی بعدی‌تان را انتخاب کنید' : 'تأیید کنید') : 'بچرخانید و جای نیمهٔ اول را بزنید') : 'این دومینو جا نمی‌شود: دور بیندازید' }
        : { tone: 'wait' as const, text: `نوبت ${view.actor === null ? '' : who(view.actor)}` };
  const send = () => {
    if (!playHint || busy) return;
    onAction({ type: 'play', place: playHint.canPlace && at ? { r: at[0], c: at[1], dir } : null, ...(needSlot ? { slot: slot! } : {}) });
  };
  const rotHint = hint?.type === 'play' && hint.place && hint.place.dir !== dir;
  const order = mySeat === null ? view.kingdoms.map((_, i) => i) : view.kingdoms.map((_, i) => i).filter((i) => i !== mySeat);

  const line = (slots: KingdominoView['current'], kind: 'cur' | 'next') => (
    <div className={`kd-line kd-line--${kind}`}>
      <span className="kd-line__label">{kind === 'cur' ? 'این دور' : 'دور بعد'}</span>
      {slots.map((x, i) => {
        const active = kind === 'cur' && view.phase === 'play' && i === view.idx && !view.outcome;
        const free = x.owner === null;
        const canTap = kind === 'next' && free && !busy && (!!pickHint || (!!playHint && needSlot));
        const chosen = kind === 'next' && slot === i;
        const content = <><Domino dom={x.dom} />{x.owner !== null && <i className="kd-king" style={{ background: SEAT[x.owner % 4] }} title={who(x.owner)} data-flip={wasOwner.get(x.dom) === null ? `king-${x.dom}` : undefined} data-flip-from={`seat-${x.owner}`} />}</>;
        return canTap
          ? <button key={i} type="button" data-flip={`dom-${x.dom}`} data-flip-from="deck" data-flip-anchor={`dom-${x.dom}`} className={['kd-pick', 'kd-dom--free', chosen ? 'kd-pick--on' : '', hint?.slot === i ? 'kd-hint' : ''].join(' ')}
            onClick={() => (pickHint ? onAction({ type: 'pick', slot: i }) : setSlot(chosen ? null : i))} aria-pressed={chosen}>{content}</button>
          : <span key={i} data-flip={`dom-${x.dom}`} data-flip-from="deck" data-flip-anchor={`dom-${x.dom}`} data-flip-exit={x.owner === null ? 'drop' : `realm-${x.owner}`} className={['kd-pick', active ? 'kd-pick--active' : '', kind === 'cur' && i < view.idx && view.phase === 'play' ? 'kd-pick--done' : ''].join(' ')}>{content}</span>;
      })}
    </div>
  );

  const framed = useInFrame() !== null;
  return (
    <div className="kd" data-seq={view.seq} ref={root}>
      {framed && <RailSlot>{status && <p><b>{status.text}</b></p>}<p>دومینو را کنار زمین‌های هم‌نوع بگذارید (یا کنار قلعه)؛ سرزمین ۵ در ۵ است. امتیاز هر ناحیه خانه‌ها ضربدر تاج‌هاست.</p></RailSlot>}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!view.outcome && (
        <section className="kd__lines" aria-label="دومینوها">
          {view.phase === 'play' && line(view.current, 'cur')}
          {view.next.length > 0 && line(view.next, 'next')}
          <span className="kd__deck" data-flip-anchor="deck">{fa(view.deckCount)} دومینو در کیسه</span>
        </section>
      )}

      {playHint && (
        <div className="kd__tools">
          <span className="kd__mine"><Domino dom={playHint.dom} /></span>
          {playHint.canPlace && <Button size="sm" variant="secondary" className={`kd-rot ${rotHint ? 'kd-hint' : ''}`} onClick={() => { setDir((dir + 1) % 4); setAt(null); }}>چرخش ↻</Button>}
          <Button size="sm" disabled={!ready || busy} className={hint?.type === 'play' && ready ? 'kd-hint' : ''} onClick={send}>{playHint.canPlace ? 'تأیید' : 'دور انداختن'}</Button>
        </div>
      )}

      <div className="kd__realm">
        <Realm s={me} name={who(me)} k={k} me turn={view.actor === me && !view.outcome} place={view.outcome?.placements.find((x) => x.seat === me)?.place}>
          <Kingdom id={`k${me}`} k={k} was={before?.kingdoms[me]} from={landFrom} big onCell={playHint?.canPlace && !busy ? (r, c) => setAt([r, c]) : undefined} ok={playHint?.canPlace ? ok : undefined} preview={preview}
            hint={hint?.type === 'play' && hint.place && !rotHint && !at ? [hint.place.r, hint.place.c] : null} />
        </Realm>
        <div className="kd__others">
          {order.map((s) => (
            <Realm key={s} s={s} name={who(s)} k={view.kingdoms[s]!} turn={view.actor === s && !view.outcome} place={view.outcome?.placements.find((x) => x.seat === s)?.place}>
              <Kingdom id={`k${s}`} k={view.kingdoms[s]!} was={before?.kingdoms[s]} from={landFrom} />
            </Realm>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A player's kingdom as it lies on the table: the castle in the player's colour, the 5×5 frame, and the tally of crowns. */
function Realm({ s, name, k, me, turn, place, children }: { s: number; name: string; k: (Cell | null)[][]; me?: boolean; turn: boolean; place?: number; children: ReactNode }) {
  // Rivals' kingdoms start folded on phones (tap to open); the tally stays visible.
  const [open, setOpen] = useState(() => !!me || typeof window === 'undefined' || window.matchMedia('(min-width: 40rem)').matches);
  const framed = useInFrame() !== null;
  const sc = scoreKingdom(k);
  const filled = k.flat().filter((x) => x && x.t !== 'C').length;
  return (
    <section className={['kd-player', me ? 'kd-player--me' : '', turn ? 'kd-player--turn' : '', place === 1 ? 'kd-player--win' : ''].join(' ')} style={{ ['--seat' as string]: SEAT[s % 4] }}
      aria-label={me ? 'سرزمین شما' : `سرزمین ${name}`} data-flip-anchor={`realm-${s}`}>
      <div className="kd-player__head">
        <img className="kd-king" data-flip-anchor={`seat-${s}`} src={KING[s % 4]} alt="" aria-hidden="true" draggable={false} />
        <bdi>{name}</bdi>
        {!framed && turn && <span className="kd-player__turn">در نوبت</span>}
        {!framed && place !== undefined && <span className="kd-player__place">رتبهٔ {fa(place)}</span>}
        {!framed && <Score v={sc.total} suffix=" امتیاز" />}
        {!me && <button type="button" className="kd-player__fold" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={open ? `بستن سرزمین ${name}` : `باز کردن سرزمین ${name}`}>{open ? '▴' : '▾'}</button>}
      </div>
      {open && children}
      {!framed && <ul className="kd-tally" aria-label="شمارش">
        <li title="تاج‌ها"><span className="kd-crowns kd-crowns--tally" aria-hidden="true"><i /></span>تاج <b>{fa(sc.crowns)}</b></li>
        <li title="بزرگ‌ترین ناحیه">بزرگ‌ترین ناحیه <b>{fa(sc.largest)}</b></li>
        <li title="خانه‌های پر از ۲۴">زمین <b>{fa(filled)}/۲۴</b></li>
      </ul>}
    </section>
  );
}
