// ست renderer: one shared table of vector cards (shape, colour, shading and count are rules geometry, so they stay in
// code). Tap three cards (or focus + Enter/Space), then «ست!». Found sets fly to the finder's tray; new cards flip in.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import { attrs, isSet, type SetView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const COUNT_FA = ['یک', 'دو', 'سه'];
const SHAPE_FA = ['لوزی', 'موج', 'بیضی'];
const COLOR_FA = ['قرمز', 'سبز', 'بنفش'];
const SHADE_FA = ['توپر', 'هاشور', 'توخالی'];
const INK = ['#d22a3c', '#14874a', '#6a37a6'];
const SHAPES = [
  'M6 25 L50 4 L94 25 L50 46 Z',
  'M12 37 C2 22 16 4 36 9 C52 13 60 21 76 11 C90 3 100 14 92 28 C84 44 66 45 52 37 C40 30 30 34 22 42 C18 45 14 42 12 37 Z',
  'M28 5 H72 A20 20 0 0 1 72 45 H28 A20 20 0 0 1 28 5 Z'
];

export const cardLabel = (id: number) => {
  const [n, s, c, f] = attrs(id);
  return `${COUNT_FA[n]} ${SHAPE_FA[s]} ${COLOR_FA[c]} ${SHADE_FA[f]}`;
};

export function SetCard({ id }: { id: number }) {
  const [n, s, c, f] = attrs(id);
  const k = n + 1, top = (150 - (k * 44 + (k - 1) * 10)) / 2;
  const fill = f === 0 ? INK[c] : f === 1 ? `url(#set-stripe-${c})` : 'none';
  return (
    <svg className="set-card__face" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
      {Array.from({ length: k }, (_, i) => (
        <path key={i} d={SHAPES[s]} transform={`translate(10 ${top + i * 54}) scale(1 0.88)`} fill={fill} stroke={INK[c]} strokeWidth={4} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Wrong claims shake the seat's line (only when the count really went up). */
function Meta({ sets, penalties }: { sets: number; penalties: number }) {
  const hit = usePop(penalties) ? 'bg-hit' : '';
  return <span key={penalties} className={`muted set-seat__meta ${hit}`}>{fa(sets)} ست{penalties ? ` · ${fa(penalties)} اشتباه` : ''}</span>;
}

export default function SetRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SetView>) {
  // Undo window: a claim that is a set (checked here from the cards themselves) flies to my tray at once; the cards
  // that replace it come from the server only. Undo clears `queued` and the three fly back to the table.
  const claimed = queued?.type === 'claim' && mySeat !== null ? (queued.cards as number[]) : null;
  const view = claimed && isSet(claimed[0]!, claimed[1]!, claimed[2]!) ? {
    ...served, table: served.table.filter((c) => !claimed.includes(c)),
    sets: served.sets.map((g, k) => (k === mySeat ? [...g, claimed] : g)), scores: served.scores.map((n, k) => (k === mySeat ? n + 1 : n))
  } : served;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const canClaim = legalActions.some((a) => a.type === 'claim');
  const [sel, setSel] = useState<number[]>([]);
  // A new board (someone's set, a wrong claim, a timeout) clears any half-made selection that is no longer on it.
  useEffect(() => { setSel((x) => x.filter((c) => view.table.includes(c))); }, [view.seq, view.table]);
  const hint = (expected as { type: string; cards?: number[] } | null)?.cards ?? null;
  const toggle = (c: number) => setSel((x) => (x.includes(c) ? x.filter((y) => y !== c) : x.length < 3 ? [...x, c] : x));
  const claim = () => { if (sel.length === 3 && canClaim && !busy) { onAction({ type: 'claim', cards: [...sel].sort((a, b) => a - b) }); setSel([]); } };
  const seats = Array.from({ length: view.players }, (_, i) => i);

  const last = view.last;
  const lastText = !last ? null
    : last.kind === 'set' ? `${seatName(last.seat)} یک ست گرفت: ${last.cards.map(cardLabel).join('، ')}.`
      : last.kind === 'miss' ? `${seatName(last.seat)} اشتباه اعلام کرد و یک امتیاز از دست داد: ${last.cards.map(cardLabel).join('، ')}.`
        : `مهلت تمام شد؛ این ست بدون امتیاز کنار رفت: ${last.cards.map(cardLabel).join('، ')}.`;

  return (
    <div className="set" ref={root} data-seq={view.seq}>
      <svg className="set__defs" aria-hidden="true" focusable="false">
        <defs>
          {INK.map((ink, i) => (
            <pattern key={i} id={`set-stripe-${i}`} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="2.2" height="6" fill={ink} />
            </pattern>
          ))}
        </defs>
      </svg>

      <div className="set__status">
        {!view.outcome && (
          <TurnIndicator tone={canClaim && !queued ? 'mine' : 'wait'}>
            {queued ? 'حرکت شما در حال ثبت است…' : canClaim ? 'همه هم‌زمان: سه کارت ست را پیدا کنید'
              : mySeat !== null && view.locked[mySeat] ? 'اعلام اشتباه: تا برداشته شدن ست بعدی نمی‌توانید اعلام کنید'
                : 'بازی در جریان است'}
          </TurnIndicator>
        )}
        <span className="set__deck" aria-label={`${fa(view.deckCount)} کارت در دسته، ${fa(view.table.length)} کارت روی میز`}>
          <span className="set__deck-stack" data-flip-anchor="deck" aria-hidden="true" /> دسته: <b key={view.deckCount} className="bg-pop">{fa(view.deckCount)}</b>
          <span className="muted"> · روی میز: {fa(view.table.length)}</span>
        </span>
      </div>

      {lastText && <p key={view.seq} className={`set__last set__last--${last!.kind} bg-land`} role="status" aria-live="assertive">{lastText}</p>}

      <div className="set__board" role="group" aria-label="کارت‌های روی میز">
        {view.table.map((c, i) => {
          const on = sel.includes(c);
          return (
            <button key={c} type="button" data-card={c} data-flip={`c${c}`} data-flip-from="deck" data-flip-exit="drop" style={{ ['--i' as string]: i % 3 }}
              className={['set-card', on ? 'set-card--on' : '', hint?.includes(c) ? 'set-hint' : ''].join(' ')}
              aria-pressed={on} aria-label={cardLabel(c)} title={cardLabel(c)} disabled={!canClaim || busy} onClick={() => toggle(c)}>
              <SetCard id={c} />
            </button>
          );
        })}
      </div>

      {canClaim && !view.outcome && (
        <div className="set__bar">
          <span className="muted" aria-live="polite">{sel.length ? `${fa(sel.length)} از ۳ کارت انتخاب شد` : 'سه کارت انتخاب کنید'}</span>
          <Button variant="secondary" disabled={!sel.length || busy} onClick={() => setSel([])}>پاک کردن</Button>
          <Button className={['set-claim', hint ? 'set-hint' : ''].join(' ')} disabled={sel.length !== 3 || busy} onClick={claim}>ست!</Button>
        </div>
      )}

      <div className="set__players">
        {seats.map((s) => (
          <section key={s} className={['set-seat', s === mySeat ? 'set-seat--me' : '', view.resigned[s] ? 'set-seat--out' : ''].join(' ')}
            aria-label={`${seatName(s)}: ${fa(view.scores[s]!)} امتیاز، ${fa(view.sets[s]!.length)} ست، ${fa(view.penalties[s]!)} اعلام اشتباه`}>
            <header className="set-seat__head">
              <bdi>{seatName(s)}</bdi>{s === mySeat ? ' (شما)' : ''}{view.resigned[s] ? ' — انصراف' : view.locked[s] ? ' — منتظر ست بعدی' : ''}
              <b key={view.scores[s]} className="set-seat__score bg-pop">{fa(view.scores[s]!)}</b>
            </header>
            <Meta sets={view.sets[s]!.length} penalties={view.penalties[s]!} />
            <div className="set-seat__tray" aria-hidden="true">
              {view.sets[s]!.flat().map((c) => <span key={c} className="set-mini" data-flip={`c${c}`}><SetCard id={c} /></span>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
