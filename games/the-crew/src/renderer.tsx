// خدمه renderer (shared by both editions): a mission console. Task cards with order tokens and owner/status sit on
// top; the trick in progress fans in the centre with each player's name; crew strips show hand size, tricks and the
// one communicated card; your hand is below with a radio-style "ارتباط" mode for showing a card.
import './renderer.css';
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, DockSlot, RailSlot, TurnIndicator, useFlip, useInFrame, type GameRendererProps } from '@bg/ui';
import cB4 from './art/the-crew-b4.png';
import cG1 from './art/the-crew-g1.png';
import cG8 from './art/the-crew-g8.png';
import cG9 from './art/the-crew-g9.png';
import cP2 from './art/the-crew-p2.png';
import cP3 from './art/the-crew-p3.png';
import cP5 from './art/the-crew-p5.png';
import cP7 from './art/the-crew-p7.png';
import cP9 from './art/the-crew-p9.png';
import cR2 from './art/the-crew-r2.png';
import cY6 from './art/the-crew-y6.png';
import tB7 from './art/the-crew-task-b7.png';
import tG4 from './art/the-crew-task-g4.png';
import tP5 from './art/the-crew-task-p5.png';
import tY9 from './art/the-crew-task-y9.png';
import order1 from './art/the-crew-order-1.png';
import orderLast from './art/the-crew-order-last.png';
import radioOn from './art/the-crew-radio-available.png';
import commanderPng from './art/the-crew-commander.png';
import { cardFa, rank, suit } from './trick.ts';
import type { CrewTask, CrewView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
/** Art a Crew edition delivers. Anything missing falls back to the older sprite (cards) or the text label (tasks). */
export interface CrewArt { cards: Record<string, string | undefined>; task?: (t: CrewTask) => string | undefined; order?: Record<string, string | undefined>; radio?: string; radioUsed?: string; commander?: string }
const ArtCtx = createContext<CrewArt>({ cards: {} });

/** Planet Nine: only the cards and task cards listed in the handoff were delivered; the rest keep the sprite / text. */
export const NINE_ART: CrewArt = {
  cards: { b4: cB4, g1: cG1, g8: cG8, g9: cG9, p2: cP2, p3: cP3, p5: cP5, p7: cP7, p9: cP9, r2: cR2, y6: cY6 },
  task: (t) => (({ b7: tB7, g4: tG4, p5: tP5, y9: tY9 }) as Record<string, string>)[t.card ?? ''],
  order: { '1': order1, last: orderLast }, radio: radioOn, commander: commanderPng
};

const KIND_FA = { top: 'بالاترین', bottom: 'پایین‌ترین', only: 'تنها' } as const;

/** Card picture cell in the BGA sprites (rows blue, green, pink, yellow; rockets / submarines by rank); the theme's CSS picks the sheet. */
const SUIT_ROW: Record<string, number> = { b: 0, g: 1, p: 2, y: 3 };
const cell = (c: string) => ({ '--k': rank(c) - 1, '--row': suit(c) === 'r' ? -1 : SUIT_ROW[suit(c)] }) as CSSProperties;

export function CrewCard({ c, size = 'md', flip, flipFrom, exit }: { c: string; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; exit?: string }) {
  const art = useContext(ArtCtx).cards[c];
  if (art) return <img className={`cw-card cw-card--${size} cw-card--img`} src={art} alt={cardFa(c)} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} draggable={false} />;
  return (
    <span className={`cw-card cw-card--${size} cw-s--${suit(c)}`} style={cell(c)} aria-label={cardFa(c)} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit}>
      <b>{fa(rank(c))}</b>
      <i aria-hidden>{suit(c) === 'r' ? '▲' : '●'}</i>
    </span>
  );
}

const nineLabel = (t: CrewTask) => (t.card ? <CrewCard c={t.card} size="sm" /> : null);

type Hint = { type: string; card?: string; task?: number } | null;

export function CrewTable({ view: served, legalActions, mySeat, seatName, busy: sending, onAction, expected, queued, label, theme, backdrop, art }: GameRendererProps<CrewView> & { label: (t: CrewTask) => ReactNode; theme: 'space' | 'sea'; backdrop?: string; art: CrewArt }) {
  const me = mySeat ?? -1;
  const framed = useInFrame() !== null;
  const hint = expected as unknown as Hint;
  const [talk, setTalk] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const isQueued = !!queued;
  const busy = sending || isQueued;
  useEffect(() => { setTalk(false); }, [served.seq, isQueued]);
  // Undo window: my played card lies in the trick, my shown card in my strip, my drafted task carries my name at once.
  let view = served;
  if (queued && mySeat !== null && served.hand) {
    if (queued.type === 'play') view = { ...served, hand: served.hand.filter((c) => c !== queued.card), trick: [...served.trick, { seat: mySeat, card: queued.card as string }] };
    else if (queued.type === 'communicate') {
      const kind = legalActions.find((a) => a.type === 'communicate' && a.card === queued.card)?.kind as keyof typeof KIND_FA | undefined;
      if (kind) view = { ...served, comms: served.comms.map((m, k) => (k === mySeat ? { card: queued.card as string, kind } : m)) };
    } else if (queued.type === 'draftTask') view = { ...served, tasks: served.tasks.map((t) => (t.id === queued.task ? { ...t, owner: mySeat } : t)) };
  }
  const playable = new Set(legalActions.filter((a) => a.type === 'play').map((a) => a.card as string));
  const speakable = new Set(legalActions.filter((a) => a.type === 'communicate').map((a) => a.card as string));
  const drafting = legalActions.filter((a) => a.type === 'draftTask').map((a) => a.task as number);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : drafting.length ? { tone: 'mine' as const, text: 'یک وظیفه بردارید' }
      : talk ? { tone: 'mine' as const, text: 'کارتی را که می‌خواهید نشان دهید انتخاب کنید' }
        : playable.size ? { tone: 'mine' as const, text: view.trick.length ? 'از خال اول پیروی کنید' : 'دست را شروع کنید' }
          : { tone: 'wait' as const, text: view.phase === 'draft' ? `${seatName(view.drafter)} وظیفه برمی‌دارد` : `نوبت ${seatName(view.current)}` };
  const statusIcon = (t: CrewTask) => (t.status === 'done' ? '✓' : t.status === 'failed' ? '✗' : '…');
  const order = (t: CrewTask) => (t.order === 'last' ? 'Ω' : t.order !== undefined ? fa(t.order) : null);

  return (
    <ArtCtx.Provider value={art}>
    <div ref={root} className={`cw cw--${theme}${framed ? ' cw--framed' : ''}`} style={backdrop ? ({ '--cw-bd': `url(${backdrop})` } as CSSProperties) : undefined} data-seq={view.seq} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && <RailSlot><p>هر وظیفه باید به دست صاحبش برده شود و همهٔ خدمه با هم می‌برند یا می‌بازند. دربارهٔ کارت‌هایتان حرف نزنید؛ فقط یک بار می‌توانید یک کارت را نشان دهید.</p></RailSlot>}

      <section className="cw-tasks" aria-label="وظیفه‌ها">
        {view.tasks.map((t) => {
          const can = drafting.includes(t.id);
          const body = (
            <>
              {order(t) && (art.order?.[String(t.order)] ? <img className="cw-order cw-order--img" src={art.order[String(t.order)]} alt={`ترتیب ${order(t)}`} /> : <i className="cw-order">{order(t)}</i>)}
              {art.task?.(t) ? <img className="cw-task__img" src={art.task(t)} alt={String(label(t))} draggable={false} /> : <span className="cw-task__what">{label(t)}</span>}
              <small className={`cw-task__who ${t.owner === null ? '' : 'bg-pop'}`} key={`o${t.owner}`}>{t.owner === null ? 'بی‌صاحب' : <bdi>{who(t.owner)}</bdi>}</small>
              {t.difficulty !== undefined && <small className="cw-task__diff">سختی {fa(t.difficulty)}</small>}
              <b key={t.status} className={`cw-task__st ${t.status === 'open' ? '' : 'bg-pop'}`} aria-label={t.status === 'done' ? 'انجام شد' : t.status === 'failed' ? 'شکست' : 'باز'}>{statusIcon(t)}</b>
            </>
          );
          const cls = ['cw-task', `cw-task--${t.status}`, t.owner === me ? 'cw-task--mine' : '', hint?.type === 'draftTask' && hint.task === t.id ? 'cw-hint' : ''].join(' ');
          return can ? <button key={t.id} type="button" className={`${cls} cw-task--can`} disabled={busy} onClick={() => onAction({ type: 'draftTask', task: t.id })}>{body}</button> : <span key={t.id} className={cls}>{body}</span>;
        })}
      </section>

      <ul className="cw-crew" aria-label="خدمه">
        {view.handCounts.map((n, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={['cw-mate', k === view.current && view.phase === 'play' && !view.outcome ? 'cw-mate--now' : '', k === me ? 'cw-mate--me' : ''].join(' ')}>
            {k === view.commander && (art.commander ? <img className="cw-mate__cmd cw-mate__cmd--img" src={art.commander} alt="فرمانده" /> : <span className="cw-mate__cmd" title="فرمانده">★</span>)}
            <bdi className="cw-mate__name">{who(k)}</bdi>
            {!framed && <small>{fa(n)} کارت <span className="bgv-sep" /> {fa(view.won[k]!.length)} دست</small>}
            {view.comms[k] && <span className="cw-comm"><CrewCard c={view.comms[k]!.card} size="sm" flip={`m-${view.comms[k]!.card}`} flipFrom={`seat-${k}`} /><small>{KIND_FA[view.comms[k]!.kind]}</small></span>}
            {!view.comms[k] && view.commsUsed[k] && (art.radioUsed ? <img className="cw-radio" src={art.radioUsed} alt="ارتباط بازی شد" /> : <small className="cw-comm--used">ارتباط بازی شد</small>)}
            {!view.comms[k] && !view.commsUsed[k] && art.radio && <img className="cw-radio" src={art.radio} alt="ارتباط در دسترس" />}
          </li>
        ))}
      </ul>

      <section className="cw-trick" aria-label="دست جاری">
        {view.trick.length ? view.trick.map((p) => (
          <span key={p.seat} className="cw-play" data-flip={`c-${p.card}`} data-flip-from={`seat-${p.seat}`}><CrewCard c={p.card} /><bdi>{who(p.seat)}</bdi></span>
        )) : view.lastTrick ? (
          <span className="cw-last"><small>دست قبل را <bdi>{who(view.lastTrick.winner)}</bdi> برد:</small>{view.lastTrick.cards.map((p) => <CrewCard key={p.seat} c={p.card} size="sm" flip={`c-${p.card}`} exit={`seat-${view.lastTrick!.winner}`} />)}</span>
        ) : <small className="cw-empty">{view.phase === 'draft' ? 'اول وظیفه‌ها پخش می‌شوند' : 'فرمانده دست اول را شروع می‌کند'}</small>}
        {view.aside && <small className="cw-aside">کنار گذاشته: {cardFa(view.aside)}</small>}
      </section>

      {view.hand && !view.outcome && (
        <section className="cw-me" aria-label="دست شما">
          <div className="cw-hand" style={{ ['--n' as string]: view.hand.length }}>
            {view.hand.map((c) => {
              const can = talk ? speakable.has(c) : playable.has(c);
              return (
                <button key={c} type="button" data-flip={`c-${c}`} disabled={busy || !can} onClick={() => onAction(talk ? { type: 'communicate', card: c } : { type: 'play', card: c })}
                  className={['cw-pick', can ? 'cw-pick--can' : '', hint && hint.card === c && (hint.type === 'play') !== talk ? 'cw-hint' : ''].join(' ')}
                  aria-label={`${talk ? 'نشان دادن' : 'بازی'} ${cardFa(c)}`}><CrewCard c={c} /></button>
              );
            })}
          </div>
          {speakable.size > 0 && (<Dock framed={framed}>
            <Button size="sm" variant={talk ? 'primary' : 'secondary'} disabled={busy} aria-pressed={talk} className={hint?.type === 'communicate' && !talk ? 'cw-hint' : ''} onClick={() => setTalk(!talk)}>
              {talk ? 'لغو ارتباط' : 'ارتباط (یک بار)'}
            </Button></Dock>
          )}
        </section>
      )}
    </div>
    </ArtCtx.Provider>
  );
}

function Dock({ framed, children }: { framed: boolean; children: ReactNode }) {
  return framed ? <DockSlot>{children}</DockSlot> : <>{children}</>;
}

export default function TheCrewRenderer(props: GameRendererProps<CrewView>) {
  return <CrewTable {...props} label={nineLabel} theme="space" art={NINE_ART} />;
}
