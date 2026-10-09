// line-three renderer: accessible DOM board. Board coordinates are literal (LTR grid), never mirrored by the RTL shell.
// One tap places the mark; the table shell holds every move for a short undo window before sending it.
import './renderer.css';
import { useRef, type KeyboardEvent } from 'react';
import { ActionBar, TurnIndicator, useFresh, type GameRendererProps } from '@bg/ui';
import type { LineThreeView } from './rules.ts';
// Mark art is cut from a generated sheet (see DECISIONS.md).
import markX from './art/mark-x.webp';
import markO from './art/mark-o.webp';

const ROW = ['بالا', 'وسط', 'پایین'];
const COL = ['چپ', 'وسط', 'راست'];
const cellName = (i: number) => `ردیف ${ROW[Math.floor(i / 3)]}، ستون ${COL[i % 3]}`;

export default function LineThreeRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<LineThreeView>) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const legal = new Set(legalActions.filter((a) => a.type === 'place').map((a) => a.cell as number));
  const expectedCell = expected?.type === 'place' ? (expected.cell as number) : null;
  const myTurn = legal.size > 0;
  const fresh = useFresh(view.board.map((m, i) => (m ? `${i}${m}` : '')).filter(Boolean));
  const mySymbol = mySeat === null ? null : view.symbols[mySeat];

  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = i + delta;
    if (next >= 0 && next < 9 && !(Math.abs(delta) === 1 && Math.floor(next / 3) !== Math.floor(i / 3))) cells.current[next]?.focus();
  };

  const status = view.outcome ? null
    : myTurn ? `نوبت شماست (${mySymbol})`
      : view.current === null ? '' : `نوبت ${seatName(view.current)} (${view.symbols[view.current]})`;

  return (
    <div className="lt">
      {status && <TurnIndicator tone={myTurn ? 'mine' : 'wait'}>{status}</TurnIndicator>}
      <div className="lt__board" role="grid" aria-label="جدول سه‌در‌سه" dir="ltr">
        {[0, 1, 2].map((r) => (
          <div role="row" key={r} className="lt__row">
            {[0, 1, 2].map((c) => {
              const i = r * 3 + c;
              const mark = view.board[i];
              const isLegal = legal.has(i) && !busy;
              const win = view.winningLine?.includes(i);
              return (
                <div role="gridcell" key={i}>
                  <button type="button" ref={(el) => { cells.current[i] = el; }}
                    className={['lt__cell', win && 'lt__cell--win', expectedCell === i && !mark && 'lt__cell--hint'].filter(Boolean).join(' ')}
                    aria-label={`${cellName(i)}: ${mark ?? 'خالی'}${expectedCell === i && !mark ? '، پیشنهاد آموزش' : ''}`}
                    aria-disabled={!isLegal}
                    onClick={() => { if (isLegal) onAction({ type: 'place', cell: i }); }}
                    onKeyDown={(e) => onKey(e, i)}>
                    <span aria-hidden key={mark ? `m${mark}` : 'p'} className={mark ? `lt__mark${fresh.has(`${i}${mark}`) ? ' bg-land' : ''}` : undefined}>{mark && <>{mark}<img src={mark === 'X' ? markX : markO} alt="" draggable={false} /></>}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {myTurn && !busy && (
        <ActionBar>
          <span className="muted">یک خانه خالی را بزنید</span>
        </ActionBar>
      )}
    </div>
  );
}
