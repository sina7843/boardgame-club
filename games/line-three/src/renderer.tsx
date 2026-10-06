// line-three renderer: accessible DOM board. Board coordinates are literal (LTR grid), never mirrored by the RTL shell.
import './renderer.css';
import { useRef, useState, type KeyboardEvent } from 'react';
import { ActionBar, Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import type { LineThreeView } from './rules.ts';

const ROW = ['بالا', 'وسط', 'پایین'];
const COL = ['چپ', 'وسط', 'راست'];
const cellName = (i: number) => `ردیف ${ROW[Math.floor(i / 3)]}، ستون ${COL[i % 3]}`;

export default function LineThreeRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<LineThreeView>) {
  const [picked, setSelected] = useState<number | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const legal = new Set(legalActions.filter((a) => a.type === 'place').map((a) => a.cell as number));
  const expectedCell = expected?.type === 'place' ? (expected.cell as number) : null;
  const myTurn = legal.size > 0;
  const mySymbol = mySeat === null ? null : view.symbols[mySeat];

  // A selection that stopped being legal (new state arrived) is simply ignored.
  const selected = picked !== null && legal.has(picked) ? picked : null;

  const confirm = () => {
    if (selected === null || busy) return;
    onAction({ type: 'place', cell: selected });
    setSelected(null);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      const next = i + delta;
      if (next >= 0 && next < 9 && !(Math.abs(delta) === 1 && Math.floor(next / 3) !== Math.floor(i / 3))) cells.current[next]?.focus();
    } else if (e.key === 'Enter' && selected === i) {
      e.preventDefault();
      confirm();
    }
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
              const preview = selected === i && !mark ? mySymbol : null;
              const win = view.winningLine?.includes(i);
              return (
                <div role="gridcell" key={i}>
                  <button type="button" ref={(el) => { cells.current[i] = el; }}
                    className={['lt__cell', win && 'lt__cell--win', selected === i && 'lt__cell--selected', expectedCell === i && !mark && 'lt__cell--hint'].filter(Boolean).join(' ')}
                    aria-label={`${cellName(i)}: ${mark ?? (preview ? `انتخاب‌شده برای ${preview}` : 'خالی')}${expectedCell === i && !mark ? '، پیشنهاد آموزش' : ''}`}
                    aria-disabled={!isLegal}
                    onClick={() => { if (isLegal) setSelected(selected === i ? null : i); }}
                    onDoubleClick={() => { if (isLegal) { setSelected(i); onAction({ type: 'place', cell: i }); setSelected(null); } }}
                    onKeyDown={(e) => onKey(e, i)}>
                    <span aria-hidden key={mark ? `m${mark}` : 'p'} className={[mark === 'X' || preview === 'X' ? 'lt__x' : 'lt__o', mark ? 'lt__mark' : ''].join(' ')} style={preview ? { opacity: 0.4 } : undefined}>{mark ?? preview ?? ''}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {myTurn && (
        <ActionBar>
          <span className="muted">{selected === null ? 'یک خانه خالی را انتخاب کنید' : `انتخاب: ${cellName(selected)}`}</span>
          <Button onClick={confirm} disabled={selected === null || busy}>ثبت حرکت</Button>
        </ActionBar>
      )}
    </div>
  );
}
