// چهل‌تکه renderer: a quilter's table. A time track of 54 squares with button-income and leather marks, the next
// patches of the circle (the first three can be bought), and the 9×9 quilts. Choose a patch, turn or flip it, tap
// where its corner goes (a preview shows if it fits), then «بدوز».
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
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

function Quilt({ q, big, preview, ok, onCell, hintCell }: { q: (number | null)[][]; big?: boolean; preview?: Set<string>; ok?: boolean; onCell?: (r: number, c: number) => void; hintCell?: [number, number] | null }) {
  return (
    <div className={`pw-quilt ${big ? 'pw-quilt--big' : ''}`} role={onCell ? 'grid' : undefined} aria-label="لحاف">
      {q.map((row, r) => row.map((id, c) => {
        const k = `${r},${c}`;
        const pv = preview?.has(k);
        const cls = ['pw-cell', fabric(id) ?? '', pv ? (ok ? 'pw-cell--ok' : 'pw-cell--bad') : '', hintCell && hintCell[0] === r && hintCell[1] === c ? 'pw-hint' : ''].join(' ');
        const style = id !== null && id >= 0 && id < 98 ? { ['--h' as string]: hue(id) } : undefined;
        return onCell
          ? <button key={k} type="button" className={cls} style={style} onClick={() => onCell(r, c)} aria-label={`ردیف ${fa(r + 1)} ستون ${fa(c + 1)}`} />
          : <span key={k} className={cls} style={style} />;
      }))}
    </div>
  );
}

export default function PatchworkRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<PatchworkView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  const canAdvance = legalActions.some((a) => a.type === 'advance');
  const leather = legalActions.some((a) => a.type === 'leather');
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.patch as number));
  const [pick, setPick] = useState<number | null>(null);
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [at, setAt] = useState<[number, number] | null>(null);
  useEffect(() => { setPick(null); setRot(0); setFlip(false); setAt(null); }, [view.seq]);
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
    : leather ? { tone: 'mine' as const, text: 'تکهٔ چرمی ۱×۱: یک خانهٔ خالی لحاف را بزنید' }
      : myTurn ? { tone: 'mine' as const, text: pick === null ? 'تکه بخرید یا جلو بروید' : 'جای گوشهٔ تکه را روی لحاف بزنید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };

  const onCell = (r: number, c: number) => {
    if (busy) return;
    if (leather) { if (q[r]![c] === null) onAction({ type: 'leather', row: r, col: c }); return; }
    if (pick !== null) setAt([r, c]);
  };

  return (
    <div className="pw" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="pw-track" aria-label="مسیر زمان">
        {Array.from({ length: END + 1 }, (_, i) => (
          <span key={i} className={['pw-track__sq', INCOME.includes(i) ? 'pw-track__sq--inc' : '', view.leatherLeft.includes(i) ? 'pw-track__sq--lea' : ''].join(' ')}>
            {view.pos[me] === i && <i className="pw-pawn pw-pawn--me" title="شما" />}
            {view.pos[opp] === i && <i className="pw-pawn pw-pawn--opp" title={who(opp)} />}
          </span>
        ))}
      </section>

      <ul className="pw__players" aria-label="بازیکنان">
        {[me, opp].map((k) => (
          <li key={k} className={['pw-pl', view.current === k && !view.outcome ? 'pw-pl--turn' : '', view.outcome?.placements[0]?.seat === k ? 'pw-pl--win' : ''].join(' ')}>
            <bdi className="pw-pl__name">{who(k)}</bdi>
            <span className="pw-pl__btns" key={view.buttons[k]}><b className="pw-btn" />{fa(view.buttons[k]!)}</span>
            <span>درآمد {fa(view.income[k]!)}</span>
            <span>خالی {fa(emptyCount(view.quilts[k]!))}</span>
            <span>زمان {fa(view.pos[k]!)}/{fa(END)}</span>
            {view.bonus7 === k && <span className="pw-pl__bonus">۷×۷ +۷</span>}
            <span className="pw-pl__score">امتیاز {fa(score(view, k))}</span>
          </li>
        ))}
      </ul>

      {!view.outcome && (
        <section className="pw__market" aria-label="تکه‌ها">
          {upcoming.map((id) => {
            const p = PATCHES[id]!;
            const can = buyable.has(id) && !busy;
            return (
              <button key={id} type="button" disabled={!can} aria-pressed={pick === id} onClick={() => { setPick(pick === id ? null : id); setRot(0); setFlip(false); setAt(null); }}
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
        <Quilt q={q} big preview={preview} ok={fitsHere} onCell={myTurn && !view.outcome && (leather || pick !== null) ? onCell : undefined}
          hintCell={hint?.type === 'buy' && pick !== null && !at && hint.row !== undefined ? [hint.row, hint.col!] : null} />
        <div className="pw__opp"><bdi>{who(opp)}</bdi><Quilt q={view.quilts[opp]!} /></div>
      </div>

      {canAdvance && !view.outcome && (
        <div className="pw__actions">
          <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'advance' ? 'pw-hint' : ''} onClick={() => onAction({ type: 'advance' })}>جلو رفتن (+{fa(advanceGain)} دکمه)</Button>
        </div>
      )}
    </div>
  );
}

