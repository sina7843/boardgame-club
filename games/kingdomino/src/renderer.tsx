// قلمرو renderer: illuminated-map kingdoms. The two domino lines (being placed / to pick) with king markers, your
// kingdom as a 9×9 field around the castle (cells where the domino can start glow), rivals' kingdoms in miniature.
// Rotate the domino, tap where its first half goes, choose your next domino, confirm.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, usePrevious, type GameRendererProps } from '@bg/ui';
import { DIRS, DOMINOES, canPlace, scoreKingdom, type Cell, type Half, type KingdominoView, type Terrain } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const TERRAIN_FA: Record<Terrain | 'C', string> = { W: 'گندم‌زار', F: 'جنگل', L: 'دریاچه', G: 'چمنزار', S: 'باتلاق', M: 'معدن', C: 'قلعه' };
const SEAT = ['#d1495b', '#2f80c9', '#e0a526', '#8e5bd1'];

export function Square({ cell, size = 'md' }: { cell: Cell | Half | null; size?: 'sm' | 'md' }) {
  if (!cell) return <span className={`kd-sq kd-sq--${size} kd-sq--empty`} />;
  return (
    <span className={`kd-sq kd-sq--${size} kd-t--${cell.t}`} aria-label={`${TERRAIN_FA[cell.t]}${cell.c ? `، ${fa(cell.c)} تاج` : ''}`}>
      {cell.t === 'C' ? <svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-7 7 V-3 H-5 V-6 H-2 V-3 H2 V-6 H5 V-3 H7 V7 Z" className="kd-castle" /></svg>
        : cell.c > 0 && <span className="kd-crowns">{Array.from({ length: cell.c }, (_, i) => <i key={i} />)}</span>}
    </span>
  );
}

export function Domino({ dom, size = 'md' }: { dom: number; size?: 'sm' | 'md' }) {
  const [a, b] = DOMINOES[dom]!;
  return <span className={`kd-dom kd-dom--${size}`}><Square cell={a} size={size} /><Square cell={b} size={size} /><b className="kd-dom__n">{fa(dom + 1)}</b></span>;
}

function Kingdom({ id, k, was, from, big, onCell, ok, preview, hint }: { id: string; k: (Cell | null)[][]; was?: (Cell | null)[][]; from?: string; big?: boolean; onCell?: (r: number, c: number) => void; ok?: Set<string>; preview?: Map<string, Half>; hint?: [number, number] | null }) {
  let n = 0;
  return (
    <div className={`kd-kingdom ${big ? 'kd-kingdom--big' : ''}`}>
      {k.map((row, r) => row.map((cell, c) => {
        const key = `${r},${c}`;
        const pv = preview?.get(key);
        const fresh = !!was && !!cell && !was[r]![c];
        const cls = ['kd-slot', ok?.has(key) ? 'kd-slot--ok' : '', pv ? 'kd-slot--pv' : '', hint && hint[0] === r && hint[1] === c ? 'kd-hint' : '', fresh ? 'bg-land' : ''].join(' ');
        const style = fresh ? { ['--i' as string]: n++ } : undefined;
        const inner = <Square cell={pv ?? cell} size={big ? 'md' : 'sm'} />;
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

  return (
    <div className="kd" data-seq={view.seq} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
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
        <section className="kd-player kd-player--me" aria-label="سرزمین شما" data-flip-anchor={`realm-${me}`}>
          <div className="kd-player__head"><i className="kd-king" data-flip-anchor={`seat-${me}`} style={{ background: SEAT[me % 4] }} /><bdi>{who(me)}</bdi><Score v={scoreKingdom(k).total} suffix=" امتیاز" /></div>
          <Kingdom id={`k${me}`} k={k} was={before?.kingdoms[me]} from={landFrom} big onCell={playHint?.canPlace && !busy ? (r, c) => setAt([r, c]) : undefined} ok={playHint?.canPlace ? ok : undefined} preview={preview}
            hint={hint?.type === 'play' && hint.place && !rotHint && !at ? [hint.place.r, hint.place.c] : null} />
        </section>
        <div className="kd__others">
          {order.map((s) => (
            <section key={s} className={['kd-player', view.actor === s ? 'kd-player--turn' : '', view.outcome?.placements.find((x) => x.seat === s)?.place === 1 ? 'kd-player--win' : ''].join(' ')} aria-label={`سرزمین ${who(s)}`} data-flip-anchor={`realm-${s}`}>
              <div className="kd-player__head"><i className="kd-king" data-flip-anchor={`seat-${s}`} style={{ background: SEAT[s % 4] }} /><bdi>{who(s)}</bdi><Score v={scoreKingdom(view.kingdoms[s]!).total} /></div>
              <Kingdom id={`k${s}`} k={view.kingdoms[s]!} was={before?.kingdoms[s]} from={landFrom} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
