// چهل‌تکه renderer: a quilter's table. A time track of 54 squares with button-income and leather marks, the next
// patches of the circle (the first three can be bought), and the 9×9 quilts. Choose a patch, turn or flip it, tap
// where its corner goes (a preview shows if it fits), then «بدوز».
import './renderer.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, TurnIndicator, motionOff, useFlip, usePop, usePrevious, type GameRendererProps } from '@bg/ui';
import { END, INCOME, PATCHES, emptyCount, fits, offered, orient, score, type PatchworkView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const hue = (id: number) => (id * 47) % 360;
const fabric = (id: number | null) => (id === null ? undefined : id === -1 ? 'fabric-leather' : id >= 98 ? 'fabric-plain' : 'fabric');

export function Shape({ id, rot = 0, flip = false, cell = 0.7 }: { id: number; rot?: number; flip?: boolean; cell?: number }) {
  const cells = orient(PATCHES[id]!.cells, rot, flip);
  const h = Math.max(...cells.map((c) => c[0])) + 1, w = Math.max(...cells.map((c) => c[1])) + 1;
  const btn = PATCHES[id]!.buttons;
  return (
    <span className="pw-shape" style={{ gridTemplateColumns: `repeat(${w}, ${cell}rem)`, gridTemplateRows: `repeat(${h}, ${cell}rem)`, ['--h' as string]: hue(id) }} aria-hidden="true">
      {cells.map(([r, c], i) => <i key={i} className="fabric" style={{ gridRow: r + 1, gridColumn: c + 1 }}>{i < btn ? <b className="pw-btn" /> : null}</i>)}
    </span>
  );
}

function Quilt({ q, was, big, preview, ok, onCell, hintCell, anchor }: { q: (number | null)[][]; was?: (number | null)[][]; big?: boolean; anchor?: string; preview?: Set<string>; ok?: boolean; onCell?: (r: number, c: number) => void; hintCell?: [number, number] | null }) {
  return (
    <div data-flip-anchor={anchor} className={`pw-quilt ${big ? 'pw-quilt--big' : ''}`} role={onCell ? 'grid' : undefined} aria-label="لحاف">
      {q.map((row, r) => row.map((id, c) => {
        const k = `${r},${c}`;
        const fresh = !!was && id !== null && was[r]![c] === null;
        const pv = preview?.has(k);
        const cls = ['pw-cell', fabric(id) ?? '', pv ? (ok ? 'pw-cell--ok' : 'pw-cell--bad') : '', hintCell && hintCell[0] === r && hintCell[1] === c ? 'pw-hint' : '', fresh ? 'bg-land' : ''].join(' ');
        const style = { ...(id !== null && id >= 0 && id < 98 ? { ['--h' as string]: hue(id) } : {}), ...(fresh ? { ['--i' as string]: (r + c) % 6 } : {}) };
        return onCell
          ? <button key={k} type="button" className={cls} style={style} onClick={() => onCell(r, c)} aria-label={`ردیف ${fa(r + 1)} ستون ${fa(c + 1)}`} />
          : <span key={k} className={cls} style={style} />;
      }))}
    </div>
  );
}

export default function PatchworkRenderer({ view: real, legalActions: realLegal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<PatchworkView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  // Undo-window preview: a bought patch is already sewn on (and paid for, with the pawn moved on), an advance already
  // moved the pawn and paid its buttons, a leather patch already lies in its cell. Undo puts it all back.
  const view = queuedView(real, me, queued as Record<string, unknown> | null | undefined);
  const legalActions = view === real ? realLegal : [];
  const mark = `${view.seq}|${view === real}`;
  const canAdvance = legalActions.some((a) => a.type === 'advance');
  const leather = legalActions.some((a) => a.type === 'leather');
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.patch as number));
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, mark);
  const before = usePrevious(mark, view.quilts);
  const beforeBtns = usePrevious(mark, view.buttons);
  // Pawns walk the time track square by square.
  const posSig = view.pos.join(',');
  const lastPos = useRef(view.pos);
  useLayoutEffect(() => {
    const prev = lastPos.current;
    lastPos.current = view.pos;
    const host = root.current;
    if (!host || motionOff()) return;
    const sq = Array.from(host.querySelectorAll<HTMLElement>('.pw-track__sq'));
    view.pos.forEach((to, k) => {
      const from = prev[k]!;
      const el = host.querySelector<HTMLElement>(`[data-pawn="${k}"]`);
      if (from === to || !el || !sq[to]) return;
      const end = sq[to]!.getBoundingClientRect();
      const d = to > from ? 1 : -1;
      const frames: Keyframe[] = [];
      for (let i = from; i !== to + d; i += d) {
        const b = sq[i]?.getBoundingClientRect();
        if (b) frames.push({ transform: `translate(${b.left - end.left}px, ${b.top - end.top}px) scale(${i !== from && i !== to ? 1.15 : 1})` });
      }
      el.animate(frames, { duration: Math.min(260 + frames.length * 130, 2600), easing: 'linear' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSig]);
  const [pick, setPick] = useState<number | null>(null);
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [at, setAt] = useState<[number, number] | null>(null);
  useEffect(() => { setPick(null); setRot(0); setFlip(false); setAt(null); }, [mark]);
  const hint = expected as unknown as { type: string; patch?: number; row?: number; col?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const q = view.quilts[me]!;
  const cells = pick !== null ? orient(PATCHES[pick]!.cells, rot, flip) : null;
  const preview = useMemo(() => (cells && at ? new Set(cells.map(([r, c]) => `${at[0] + r},${at[1] + c}`)) : undefined), [cells, at]);
  const fitsHere = !!(cells && at && fits(q, cells, at[0], at[1]));
  const upcoming = Array.from({ length: Math.min(6, view.circle.length) }, (_, k) => view.circle[(view.token + k) % view.circle.length]!).filter((x, i, a) => a.indexOf(x) === i);
  const offer = new Set(offered(view));
  const myTurn = canAdvance || leather;
  const advanceGain = Math.min(END, view.pos[opp]! + 1) - view.pos[me]!;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : leather ? { tone: 'mine' as const, text: 'تکهٔ چرمی ۱×۱: یک خانهٔ خالی لحاف را بزنید' }
      : myTurn ? { tone: 'mine' as const, text: pick === null ? 'تکه بخرید یا جلو بروید' : 'جای گوشهٔ تکه را روی لحاف بزنید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };

  const onCell = (r: number, c: number) => {
    if (busy) return;
    if (leather) { if (q[r]![c] === null) onAction({ type: 'leather', row: r, col: c }); return; }
    if (pick !== null) setAt([r, c]);
  };

  return (
    <div className="pw" data-seq={view.seq} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="pw-track" aria-label="مسیر زمان">
        {Array.from({ length: END + 1 }, (_, i) => (
          <span key={i} className={['pw-track__sq', INCOME.includes(i) ? 'pw-track__sq--inc' : '', view.leatherLeft.includes(i) ? 'pw-track__sq--lea' : ''].join(' ')}>
            {view.pos[me] === i && <span data-pawn={me} className="pw-pawn-slot"><i className="pw-pawn pw-pawn--me" title="شما" /></span>}
            {view.pos[opp] === i && <span data-pawn={opp} className="pw-pawn-slot"><i className="pw-pawn pw-pawn--opp" title={who(opp)} /></span>}
          </span>
        ))}
      </section>

      {!view.outcome && (
        <section className="pw__market" aria-label="تکه‌ها">
          {upcoming.map((id) => {
            const p = PATCHES[id]!;
            const can = buyable.has(id) && !busy;
            return (
              <button key={id} type="button" data-flip={`patch-${id}`} data-flip-exit={view.current === me ? 'quilt-me' : 'quilt-opp'} disabled={!can} aria-pressed={pick === id} onClick={() => { setPick(pick === id ? null : id); setRot(0); setFlip(false); setAt(null); }}
                className={['pw-patch', offer.has(id) ? 'pw-patch--offer' : '', pick === id ? 'pw-patch--on' : '', hint?.type === 'buy' && hint.patch === id && pick !== id ? 'pw-hint' : ''].join(' ')}
                aria-label={`تکه: ${fa(p.cost)} دکمه، ${fa(p.time)} زمان، درآمد ${fa(p.buttons)}`}>
                <Shape id={id} />
                <span className="pw-patch__meta"><span><b className="pw-btn" />{fa(p.cost)}</span><span>⌛{fa(p.time)}</span></span>
              </button>
            );
          })}
          <span className="pw__left">{fa(view.circle.length)} تکه</span>
        </section>
      )}

      {pick !== null && (
        <div className="pw__tools">
          <span className="pw__preview"><Shape id={pick} rot={rot} flip={flip} cell={1} /></span>
          <Button size="sm" variant="secondary" onClick={() => { setRot((rot + 1) % 4); setAt(null); }}>چرخش ↻</Button>
          <Button size="sm" variant="secondary" onClick={() => { setFlip(!flip); setAt(null); }}>برگرداندن ⇋</Button>
          <Button size="sm" disabled={!fitsHere || busy} className={hint?.type === 'buy' && fitsHere ? 'pw-hint' : ''} onClick={() => at && onAction({ type: 'buy', patch: pick, rot, flip, row: at[0], col: at[1] })}>بدوز</Button>
        </div>
      )}

      <div className="pw__quilts">
        <QuiltBoard view={view} k={me} me name={who(me)} buttonsPop={!!beforeBtns && beforeBtns[me] !== view.buttons[me]}>
          <Quilt q={q} was={before?.[me]} anchor="quilt-me" big preview={preview} ok={fitsHere} onCell={myTurn && !view.outcome && (leather || pick !== null) ? onCell : undefined}
            hintCell={hint?.type === 'buy' && pick !== null && !at && hint.row !== undefined ? [hint.row, hint.col!] : null} />
        </QuiltBoard>
        <QuiltBoard view={view} k={opp} name={who(opp)} buttonsPop={!!beforeBtns && beforeBtns[opp] !== view.buttons[opp]}>
          <Quilt q={view.quilts[opp]!} was={before?.[opp]} anchor="quilt-opp" />
        </QuiltBoard>
      </div>

      {canAdvance && !view.outcome && (
        <div className="pw__actions">
          <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'advance' ? 'pw-hint' : ''} onClick={() => onAction({ type: 'advance' })}>جلو رفتن (+{fa(advanceGain)} دکمه)</Button>
        </div>
      )}
    </div>
  );
}


/** The view after the own queued buy / advance / leather, computed from what the client already holds. */
function queuedView(v: PatchworkView, me: number, q: Record<string, unknown> | null | undefined): PatchworkView {
  if (!q || v.current !== me || v.outcome) return v;
  const at = <T,>(xs: T[], x: T) => xs.map((y, k) => (k === me ? x : y));
  if (q.type === 'leather') {
    const quilt = v.quilts[me]!.map((row, r) => row.map((c, k) => (r === q.row && k === q.col ? -1 : c)));
    return { ...v, quilts: at(v.quilts, quilt) };
  }
  if (q.type === 'advance') {
    const to = Math.min(END, v.pos[1 - me]! + 1);
    return { ...v, pos: at(v.pos, to), buttons: at(v.buttons, v.buttons[me]! + to - v.pos[me]!) };
  }
  if (q.type === 'buy') {
    const p = PATCHES[q.patch as number]!, idx = v.circle.indexOf(p.id);
    if (idx < 0) return v;
    const quilt = v.quilts[me]!.map((row) => row.slice());
    for (const [r, c] of orient(p.cells, q.rot as number, q.flip as boolean)) quilt[(q.row as number) + r]![(q.col as number) + c] = p.id;
    const circle = v.circle.filter((x) => x !== p.id);
    return { ...v, quilts: at(v.quilts, quilt), circle, token: circle.length ? idx % circle.length : 0, buttons: at(v.buttons, v.buttons[me]! - p.cost), income: at(v.income, v.income[me]! + p.buttons), pos: at(v.pos, Math.min(END, v.pos[me]! + p.time)) };
  }
  return v;
}

// A number that bumps whenever it changes.
function Pop({ n, className, children }: { n: number; className: string; children: React.ReactNode }) {
  return <span key={n} className={`${className} ${usePop(n)}`}>{children}</span>;
}

/** A player's quilt board as on the table: the 9×9 board with its button pocket — buttons, button income, time, the 7×7 tile. */
function QuiltBoard({ view, k, me, name, buttonsPop, children }: { view: PatchworkView; k: number; me?: boolean; name: string; buttonsPop: boolean; children: ReactNode }) {
  // The opponent's board starts folded on phones (tap to open); its pocket stays readable.
  const [open, setOpen] = useState(() => !!me || typeof window === 'undefined' || window.matchMedia('(min-width: 40rem)').matches);
  const turn = view.current === k && !view.outcome;
  const win = view.outcome?.placements[0]?.seat === k;
  const empty = emptyCount(view.quilts[k]!);
  const pos = view.pos[k]!;
  const nextInc = INCOME.find((x) => x > pos);
  const inc = view.income[k]!;
  return (
    <section className={['pw-board', me ? 'pw-board--me' : 'pw-board--opp', turn ? 'pw-board--turn' : '', win ? 'pw-board--win' : ''].join(' ')} aria-label={`لحاف ${name}`}>
      <header className="pw-board__head">
        <i className={`pw-pawn ${me ? 'pw-pawn--me' : 'pw-pawn--opp'}`} aria-hidden="true" />
        <bdi className="pw-board__name">{name}</bdi>
        {turn && <span className="pw-board__turn">در نوبت</span>}
        <Pop n={score(view, k)} className="pw-board__score">امتیاز <bdi dir="ltr">{score(view, k) < 0 ? `−${fa(-score(view, k))}` : fa(score(view, k))}</bdi></Pop>
        {!me && <button type="button" className="pw-board__fold" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={open ? `بستن لحاف ${name}` : `باز کردن لحاف ${name}`}>{open ? '▴' : '▾'}</button>}
      </header>
      <div className="pw-board__body">
        {open && <div className="pw-board__quilt">{children}</div>}
        <ul className="pw-pocket" aria-label="جیب دکمه">
          <li className="pw-pocket__btns" title="دکمه‌های در دست"><b className="pw-btn pw-btn--big" aria-hidden="true" /><span className={buttonsPop ? 'bg-pop' : ''} key={view.buttons[k]}>{fa(view.buttons[k]!)}</span><small>دکمه</small></li>
          <li className="pw-pocket__inc" title="درآمد دکمه‌ای لحاف در هر خانهٔ درآمد">
            <small>درآمد</small>
            <span className="pw-pocket__row" aria-hidden="true">{Array.from({ length: Math.min(inc, 8) }, (_, i) => <b key={i} className="pw-btn" />)}</span>
            <b>{fa(inc)}</b>
          </li>
          <li className="pw-pocket__time" title="جای مهره روی مسیر زمان">
            <small>زمان</small><b>{fa(pos)}/{fa(END)}</b>
            <span className="pw-pocket__bar" aria-hidden="true"><span style={{ inlineSize: `${(pos / END) * 100}%` }} /></span>
            {nextInc !== undefined && <small>درآمد بعدی: {fa(nextInc - pos)} خانه</small>}
          </li>
          <li className="pw-pocket__empty" title="هر خانهٔ خالی در پایان −۲"><small>خالی</small><b>{fa(empty)}</b><small>(−{fa(empty * 2)})</small></li>
          <li className={['pw-tile7', view.bonus7 === k ? 'pw-tile7--on' : view.bonus7 !== null ? 'pw-tile7--gone' : ''].join(' ')}
            title={view.bonus7 === k ? 'کاشی ۷×۷: +۷' : view.bonus7 !== null ? 'کاشی ۷×۷ را حریف گرفت' : 'کاشی ۷×۷ هنوز آزاد است'}>
            <b>۷×۷</b><small>{view.bonus7 === k ? '+۷' : view.bonus7 !== null ? 'رفت' : 'آزاد'}</small>
          </li>
        </ul>
      </div>
    </section>
  );
}
