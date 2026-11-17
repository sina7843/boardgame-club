// اونیتاما renderer: rice-paper board with ink lines, vermilion and indigo pieces, move cards with a 5×5 pattern.
// Tap a piece → its targets light up (per card colour); tap a target. If two cards reach it, pick the card. Tapping a
// card first narrows the targets to that card.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useFlip, useInFrame, usePieceIds, usePrevious, type GameRendererProps } from '@bg/ui';
// Board, pieces and cards: design/games/group-a/art/onitama, copied as-is (the design ships 7 of the 16 card faces).
import rM from './art/onitama-red-master.png';
import rS from './art/onitama-red-student.png';
import bM from './art/onitama-blue-master.png';
import bS from './art/onitama-blue-student.png';
import boardArt from './art/onitama-board.png';
import cardBoar from './art/onitama-card-boar.png';
import cardCobra from './art/onitama-card-cobra.png';
import cardElephant from './art/onitama-card-elephant.png';
import cardFrog from './art/onitama-card-frog.png';
import cardMantis from './art/onitama-card-mantis.png';
import cardMonkey from './art/onitama-card-monkey.png';
import cardRabbit from './art/onitama-card-rabbit.png';
import { cardById, type OnitamaView, type Piece } from './rules.ts';

const CARD_ART: Record<string, string> = { boar: cardBoar, cobra: cardCobra, elephant: cardElephant, frog: cardFrog, mantis: cardMantis, monkey: cardMonkey, rabbit: cardRabbit };
const S = 120, M = 20, SIZE = 5 * S + 2 * M;
type Mv = { card: string; from: number; to: number };
const gridDist = (a: number, b: number) => Math.hypot((a % 5) - (b % 5), Math.floor(a / 5) - Math.floor(b / 5));

/** My queued move applied locally (undo window): the piece moves, a piece on the target is taken, the used card and the side card swap. */
function preview(v: OnitamaView, seat: number, q: GameRendererProps<OnitamaView>['queued']): OnitamaView {
  if (q?.type !== 'move') return v;
  const board = v.board.slice();
  board[q.to as number] = board[q.from as number] ?? null;
  board[q.from as number] = null;
  const hands = v.hands.map((h, k) => (k === seat ? h.map((c) => (c === q.card ? v.side : c)) : h)) as OnitamaView['hands'];
  return { ...v, board, hands, side: q.card as string };
}

export default function OnitamaRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<OnitamaView>) {
  const framed = useInFrame() !== null; // the shell draws players, clocks, whose-turn and the move log
  const me = mySeat ?? 0;
  // Undo window: my move (piece, capture, card swap) shows at once; undo clears `queued` and it all glides back.
  const view = preview(served, me, queued);
  const flip = me === 1;
  const xy = (i: number) => {
    const r = Math.floor(i / 5), c = i % 5;
    return { x: M + (flip ? 4 - c : c) * S + S / 2, y: M + (flip ? r : 4 - r) * S + S / 2 };
  };
  const moves: Mv[] = legalActions.filter((a) => a.type === 'move').map((a) => ({ card: a.card as string, from: a.from as number, to: a.to as number }));
  const passes = legalActions.filter((a) => a.type === 'pass').map((a) => a.card as string);
  const [from, setFrom] = useState<number | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [choice, setChoice] = useState<Mv[] | null>(null);
  const turnNo = view.history.length;
  // Cards glide hand → side → opponent's hand; pieces glide square to square (stable ids); a taken piece fades out.
  const root = useRef<HTMLDivElement>(null);
  const flipKey = `${turnNo}|${queued ? JSON.stringify(queued) : ''}`;
  useFlip(root, flipKey);
  const ids = usePieceIds(view.board, gridDist);
  const prevIds = usePrevious(flipKey, ids) ?? ids;
  const prevBoard = usePrevious(flipKey, view.board) ?? view.board;
  const taken = prevIds.flatMap((id, i) => (id && !ids.includes(id) && prevBoard[i] ? [i] : []));
  useEffect(() => { setFrom(null); setCard(null); setChoice(null); }, [turnNo]);
  const hint = expected?.type === 'move' ? (expected as unknown as Mv) : null;

  const usable = moves.filter((m) => !card || m.card === card);
  const sources = new Set(usable.map((m) => m.from));
  const targets = from === null ? [] : usable.filter((m) => m.from === from);
  const go = (m: Mv) => { onAction({ type: 'move', ...m }); setFrom(null); setChoice(null); };
  const tapSquare = (i: number) => {
    if (busy) return;
    const here = targets.filter((m) => m.to === i);
    if (here.length === 1) return go(here[0]!);
    if (here.length > 1) return setChoice(here);
    setChoice(null);
    setFrom(sources.has(i) && from !== i ? i : null);
  };

  const last = view.history.at(-1);
  const moved = last && last.to !== null ? last : null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : view.current === mySeat
      ? { tone: 'mine' as const, text: passes.length ? 'حرکتی ممکن نیست: یک کارت را عوض کنید' : from === null ? 'نوبت شما: یک مهره را بزنید' : 'یک خانه روشن را بزنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const endText = view.end && { stone: 'استاد زده شد (راه سنگ)', stream: 'استاد به معبد رسید (راه رود)', resign: 'انصراف', timeout: 'اتمام زمان', repetition: 'تکرار سه‌باره — مساوی' }[view.end.kind];

  return (
    <div className="oni" data-turn={turnNo} ref={root}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          <p>{view.current === mySeat && !view.outcome
            ? <>اول <b>یک مهره</b> و بعد یک خانهٔ روشن را بزنید، یا اول <b>کارت</b> را بزنید تا فقط حرکت‌های همان کارت پیدا شود.</>
            : <>برنده کسی است که <b>استاد حریف را بزند</b> یا استاد خود را به <b>معبد حریف</b> برساند.</>}</p>
        </RailSlot>
      )}

      <div className="oni__hand oni__hand--them" aria-label={`کارت‌های ${who(1 - me)}`}>
        {view.hands[1 - me as 0 | 1].map((id) => <MoveCard key={id} id={id} upside />)}
      </div>

      <div className="oni__middle">
        <ZoomBoard label="صفحه اونیتاما">
          <svg className="oni-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه اونیتاما" style={{ direction: 'ltr' }}>
            <defs>
              <filter id="oni-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".45" /></filter>
            </defs>
            <image href={boardArt} x="0" y="0" width={SIZE} height={SIZE} preserveAspectRatio="none" />
            {Array.from({ length: 25 }, (_, i) => {
              const { x, y } = xy(i);
              const tg = targets.filter((m) => m.to === i);
              const isSrc = sources.has(i) && !busy && view.current === mySeat;
              const isHint = hint && (from === null ? hint.from === i : hint.to === i);
              return (
                <g key={i} role="gridcell" tabIndex={isSrc || tg.length ? 0 : -1}
                  aria-label={`${'abcde'[i % 5]}${Math.floor(i / 5) + 1}${view.board[i] ? `: ${pieceFa(view.board[i]!, me)}` : ''}${tg.length ? `، مقصد با ${tg.map((m) => cardById(m.card).nameFa).join(' یا ')}` : isSrc ? '، قابل حرکت' : ''}`}
                  className={['oni-sq', isSrc ? 'oni-sq--src' : '', from === i ? 'oni-sq--sel' : '', isHint ? 'oni-sq--hint' : ''].join(' ')}
                  onClick={() => tapSquare(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSquare(i); } }}>
                  <rect x={x - S / 2} y={y - S / 2} width={S} height={S} fill="transparent" />
                  {moved && (moved.from === i || moved.to === i) && <rect x={x - S / 2 + 4} y={y - S / 2 + 4} width={S - 8} height={S - 8} className="oni-last" />}
                  {tg.map((m, k) => <circle key={m.card} cx={x + (tg.length > 1 ? (k ? 14 : -14) : 0)} cy={y} r={view.board[i] ? 44 : 13} className={view.board[i] ? 'oni-target oni-target--cap' : 'oni-target'} />)}
                </g>
              );
            })}

            {taken.map((i) => {
              const { x, y } = xy(i);
              return <g key={`gone-${flipKey}-${i}`} className="oni-gone" pointerEvents="none"><Token x={x} y={y} p={prevBoard[i]!} /></g>;
            })}
            {view.board.map((p, i) => {
              if (!p) return null;
              const { x, y } = xy(i);
              return (
                <g key={ids[i]} data-flip={`pc-${ids[i]}`} pointerEvents="none" className="oni-pc">
                  <Token x={x} y={y} p={p} />
                </g>
              );
            })}
          </svg>
        </ZoomBoard>
        <div className="oni__side" aria-label="کارت کنار صفحه">
          <span className="oni__side-label">کارت بعدی برای {view.current === me ? 'حریف' : 'شما'}</span>
          <MoveCard key={view.side} id={view.side} upside={view.current !== me} />
        </div>
      </div>

      <div className="oni__hand oni__hand--mine" role="group" aria-label="کارت‌های شما">
        {view.hands[me as 0 | 1].map((id) => (
          <MoveCard key={id} id={id} selectable={view.current === mySeat && !busy && moves.some((m) => m.card === id)} selected={card === id}
            onSelect={() => { setCard(card === id ? null : id); setChoice(null); }} />
        ))}
      </div>

      {choice && (
        <div className="oni__choice" role="group" aria-label="کدام کارت؟">
          <span>با کدام کارت؟</span>
          {choice.map((m) => <Button key={m.card} size="sm" disabled={busy} onClick={() => go(m)}>{cardById(m.card).nameFa}</Button>)}
        </div>
      )}
      {passes.length > 0 && (
        <div className="oni__choice" role="group" aria-label="عوض کردن کارت">
          {passes.map((id) => <Button key={id} size="sm" disabled={busy} onClick={() => onAction({ type: 'pass', card: id })}>عوض کردن «{cardById(id).nameFa}»</Button>)}
        </div>
      )}
      {endText && <p className="oni__end" role="status">{endText}</p>}
    </div>
  );
}

const pieceFa = (p: Piece, me: number) => `${(p[0] === 'r') === (me === 0) ? 'شما' : 'حریف'} — ${p[1] === 'M' ? 'استاد' : 'شاگرد'}`;

const ART: Record<Piece, string> = { rM, rS, bM, bS };

function Token({ x, y, p }: { x: number; y: number; p: Piece }) {
  const w = p[1] === 'M' ? 100 : 90;
  return <image href={ART[p]} x={x - w / 2} y={y - (w * 70) / 160 - 4} width={w} height={(w * 70) / 80} filter="url(#oni-shadow)" />;
}

function MoveCard({ id, upside, selectable, selected, onSelect }: { id: string; upside?: boolean; selectable?: boolean; selected?: boolean; onSelect?: () => void }) {
  const c = cardById(id);
  const art = CARD_ART[id];
  const body = art ? (
    <>
      <img src={art} alt="" draggable={false} />
      <span className="oni-card__cap">{c.nameFa}</span>
    </>
  ) : <strong className="oni-card__name">{c.nameFa}</strong>;
  const cls = ['oni-card', art ? 'oni-card--art' : '', upside && art ? 'oni-card--upside' : '', selected ? 'oni-card--sel' : ''].join(' ');
  const label = `کارت ${c.nameFa}: ${c.moves.map(([dx, dy]) => `${dy > 0 ? `${dy} جلو` : dy < 0 ? `${-dy} عقب` : ''}${dx ? ` ${Math.abs(dx)} ${dx > 0 ? 'راست' : 'چپ'}` : ''}`.trim()).join('، ')}`;
  return selectable
    ? <button type="button" data-flip={`card-${id}`} className={cls} aria-pressed={selected} aria-label={label} onClick={onSelect}>{body}</button>
    : <div data-flip={`card-${id}`} className={cls} role="img" aria-label={label}>{body}</div>;
}
