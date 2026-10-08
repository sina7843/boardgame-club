// اونیتاما renderer: rice-paper board with ink lines, vermilion and indigo pieces, move cards with a 5×5 pattern.
// Tap a piece → its targets light up (per card colour); tap a target. If two cards reach it, pick the card. Tapping a
// card first narrows the targets to that card.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { TEMPLE, cardById, type OnitamaView, type Piece } from './rules.ts';

const S = 120, M = 26, SIZE = 5 * S + 2 * M;
type Mv = { card: string; from: number; to: number };

export default function OnitamaRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<OnitamaView>) {
  const me = mySeat ?? 0;
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
    : view.current === mySeat
      ? { tone: 'mine' as const, text: passes.length ? 'حرکتی ممکن نیست: یک کارت را عوض کنید' : from === null ? 'نوبت شما: یک مهره را بزنید' : 'یک خانه روشن را بزنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const endText = view.end && { stone: 'استاد زده شد (راه سنگ)', stream: 'استاد به معبد رسید (راه رود)', resign: 'انصراف', timeout: 'اتمام زمان', repetition: 'تکرار سه‌باره — مساوی' }[view.end.kind];

  return (
    <div className="oni" data-turn={turnNo}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="oni__hand oni__hand--them" aria-label={`کارت‌های ${who(1 - me)}`}>
        {view.hands[1 - me as 0 | 1].map((id) => <MoveCard key={id} id={id} upside />)}
      </div>

      <div className="oni__middle">
        <ZoomBoard label="صفحه اونیتاما">
          <svg className="oni-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه اونیتاما" style={{ direction: 'ltr' }}>
            <defs>
              <linearGradient id="oni-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4ead2" /><stop offset="1" stopColor="#e3d2ad" /></linearGradient>
              <linearGradient id="oni-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a2a22" /><stop offset="1" stopColor="#1a120d" /></linearGradient>
              <filter id="oni-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".45" /></filter>
            </defs>
            <rect width={SIZE} height={SIZE} rx="18" fill="url(#oni-frame)" />
            <rect x={M} y={M} width={5 * S} height={5 * S} fill="url(#oni-paper)" />
            {Array.from({ length: 6 }, (_, k) => (
              <g key={k} className="oni-ink">
                <line x1={M + k * S} y1={M} x2={M + k * S} y2={M + 5 * S} />
                <line x1={M} y1={M + k * S} x2={M + 5 * S} y2={M + k * S} />
              </g>
            ))}
            {TEMPLE.map((t, seat) => {
              const { x, y } = xy(t);
              return <g key={t} className={`oni-temple oni-temple--${seat === 0 ? 'red' : 'blue'}`} aria-hidden="true">
                <path d={`M${x - 34} ${y - 26} L${x + 34} ${y - 26} M${x - 26} ${y - 14} L${x + 26} ${y - 14} M${x - 20} ${y - 26} L${x - 20} ${y + 30} M${x + 20} ${y - 26} L${x + 20} ${y + 30}`} />
              </g>;
            })}

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
                  {tg.map((m, k) => <circle key={m.card} cx={x + (tg.length > 1 ? (k ? 14 : -14) : 0)} cy={y} r="13" className={`oni-target oni-target--${cardById(m.card).color}`} />)}
                </g>
              );
            })}

            {view.board.map((p, i) => {
              if (!p) return null;
              const { x, y } = xy(i);
              const slide = moved && moved.to === i && moved.from !== null ? xy(moved.from) : null;
              return (
                <g key={`${i}-${slide ? turnNo : 0}`} pointerEvents="none" className={slide ? 'oni-pc oni-pc--moved' : 'oni-pc'}
                  style={slide ? { ['--dx' as string]: `${slide.x - x}px`, ['--dy' as string]: `${slide.y - y}px` } : undefined}>
                  <Token x={x} y={y} p={p} />
                </g>
              );
            })}
          </svg>
        </ZoomBoard>
        <div className="oni__side" aria-label="کارت کنار صفحه">
          <span className="oni__side-label">کارت بعدی برای {view.current === me ? 'حریف' : 'شما'}</span>
          <MoveCard key={view.side} id={view.side} upside={view.current !== me} incoming />
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

function Token({ x, y, p }: { x: number; y: number; p: Piece }) {
  const red = p[0] === 'r';
  const master = p[1] === 'M';
  const r = master ? 42 : 33;
  return (
    <g filter="url(#oni-shadow)">
      <circle cx={x} cy={y + 5} r={r} fill={red ? '#5e1308' : '#101a3a'} />
      <circle cx={x} cy={y} r={r} fill={red ? '#c8361f' : '#2b3f8c'} stroke={red ? '#6e170a' : '#16224d'} strokeWidth="3" />
      <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#f4ead2" strokeWidth={master ? 4 : 3} opacity=".85" />
      {master
        ? <path d={`M${x - 16} ${y + 10} L${x - 20} ${y - 12} L${x - 8} ${y - 2} L${x} ${y - 18} L${x + 8} ${y - 2} L${x + 20} ${y - 12} L${x + 16} ${y + 10} Z`} fill="#f4ead2" />
        : <circle cx={x} cy={y} r="7" fill="#f4ead2" />}
    </g>
  );
}

function MoveCard({ id, upside, selectable, selected, onSelect, incoming }: { id: string; upside?: boolean; selectable?: boolean; selected?: boolean; onSelect?: () => void; incoming?: boolean }) {
  const c = cardById(id);
  const cells = new Set(c.moves.map(([dx, dy]) => `${dx},${dy}`));
  const body = (
    <>
      <span className={`oni-card__stamp oni-card__stamp--${c.color}`} aria-hidden="true" />
      <strong className="oni-card__name">{c.nameFa}</strong>
      <span className="oni-card__en"><bdi>{c.nameEn}</bdi></span>
      <span className="oni-card__grid" aria-hidden="true">
        {Array.from({ length: 25 }, (_, k) => {
          const dx = (k % 5) - 2, dy = 2 - Math.floor(k / 5);
          return <i key={k} className={dx === 0 && dy === 0 ? 'is-me' : cells.has(`${dx},${dy}`) ? `is-move is-${c.color}` : ''} />;
        })}
      </span>
    </>
  );
  const cls = ['oni-card', upside ? 'oni-card--upside' : '', selected ? 'oni-card--sel' : '', incoming ? 'oni-card--incoming' : ''].join(' ');
  const label = `کارت ${c.nameFa}: ${c.moves.map(([dx, dy]) => `${dy > 0 ? `${dy} جلو` : dy < 0 ? `${-dy} عقب` : ''}${dx ? ` ${Math.abs(dx)} ${dx > 0 ? 'راست' : 'چپ'}` : ''}`.trim()).join('، ')}`;
  return selectable
    ? <button type="button" className={cls} aria-pressed={selected} aria-label={label} onClick={onSelect}>{body}</button>
    : <div className={cls} role="img" aria-label={label}>{body}</div>;
}
