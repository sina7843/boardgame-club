// خدمه renderer (shared by both editions): a mission console. Task cards with order tokens and owner/status sit on
// top; the trick in progress fans in the centre with each player's name; crew strips show hand size, tricks and the
// one communicated card; your hand is below with a radio-style "ارتباط" mode for showing a card.
import './renderer.css';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { cardFa, rank, suit } from './trick.ts';
import type { CrewTask, CrewView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const KIND_FA = { top: 'بالاترین', bottom: 'پایین‌ترین', only: 'تنها' } as const;

export function CrewCard({ c, size = 'md' }: { c: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`cw-card cw-card--${size} cw-s--${suit(c)}`} aria-label={cardFa(c)}>
      <b>{fa(rank(c))}</b>
      <i aria-hidden>{suit(c) === 'r' ? '▲' : '●'}</i>
    </span>
  );
}

const nineLabel = (t: CrewTask) => (t.card ? <CrewCard c={t.card} size="sm" /> : null);

type Hint = { type: string; card?: string; task?: number } | null;

export function CrewTable({ view, legalActions, mySeat, seatName, busy, onAction, expected, label, theme, backdrop }: GameRendererProps<CrewView> & { label: (t: CrewTask) => ReactNode; theme: 'space' | 'sea'; backdrop?: string }) {
  const me = mySeat ?? -1;
  const hint = expected as unknown as Hint;
  const [talk, setTalk] = useState(false);
  useEffect(() => { setTalk(false); }, [view.seq]);
  const playable = new Set(legalActions.filter((a) => a.type === 'play').map((a) => a.card as string));
  const speakable = new Set(legalActions.filter((a) => a.type === 'communicate').map((a) => a.card as string));
  const drafting = legalActions.filter((a) => a.type === 'draftTask').map((a) => a.task as number);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    : drafting.length ? { tone: 'mine' as const, text: 'یک وظیفه بردارید' }
      : talk ? { tone: 'mine' as const, text: 'کارتی را که می‌خواهید نشان دهید انتخاب کنید' }
        : playable.size ? { tone: 'mine' as const, text: view.trick.length ? 'از خال اول پیروی کنید' : 'دست را شروع کنید' }
          : { tone: 'wait' as const, text: view.phase === 'draft' ? `${seatName(view.drafter)} وظیفه برمی‌دارد` : `نوبت ${seatName(view.current)}` };
  const statusIcon = (t: CrewTask) => (t.status === 'done' ? '✓' : t.status === 'failed' ? '✗' : '…');
  const order = (t: CrewTask) => (t.order === 'last' ? 'Ω' : t.order !== undefined ? fa(t.order) : null);

  return (
    <div className={`cw cw--${theme}`} style={backdrop ? ({ '--cw-bd': `url(${backdrop})` } as CSSProperties) : undefined} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="cw-tasks" aria-label="وظیفه‌ها">
        {view.tasks.map((t) => {
          const can = drafting.includes(t.id);
          const body = (
            <>
              {order(t) && <i className="cw-order">{order(t)}</i>}
              <span className="cw-task__what">{label(t)}</span>
              <small className="cw-task__who">{t.owner === null ? 'بی‌صاحب' : <bdi>{who(t.owner)}</bdi>}</small>
              {t.difficulty !== undefined && <small className="cw-task__diff">سختی {fa(t.difficulty)}</small>}
              <b className="cw-task__st" aria-label={t.status === 'done' ? 'انجام شد' : t.status === 'failed' ? 'شکست' : 'باز'}>{statusIcon(t)}</b>
            </>
          );
          const cls = ['cw-task', `cw-task--${t.status}`, t.owner === me ? 'cw-task--mine' : '', hint?.type === 'draftTask' && hint.task === t.id ? 'cw-hint' : ''].join(' ');
          return can ? <button key={t.id} type="button" className={`${cls} cw-task--can`} disabled={busy} onClick={() => onAction({ type: 'draftTask', task: t.id })}>{body}</button> : <span key={t.id} className={cls}>{body}</span>;
        })}
      </section>

      <ul className="cw-crew" aria-label="خدمه">
        {view.handCounts.map((n, k) => (
          <li key={k} className={['cw-mate', k === view.current && view.phase === 'play' && !view.outcome ? 'cw-mate--now' : '', k === me ? 'cw-mate--me' : ''].join(' ')}>
            {k === view.commander && <span className="cw-mate__cmd" title="فرمانده">★</span>}
            <bdi className="cw-mate__name">{who(k)}</bdi>
            <small>{fa(n)} کارت · {fa(view.won[k]!.length)} دست</small>
            {view.comms[k] && <span className="cw-comm"><CrewCard c={view.comms[k]!.card} size="sm" /><small>{KIND_FA[view.comms[k]!.kind]}</small></span>}
            {!view.comms[k] && view.commsUsed[k] && <small className="cw-comm--used">ارتباط بازی شد</small>}
          </li>
        ))}
      </ul>

      <section className="cw-trick" aria-label="دست جاری">
        {view.trick.length ? view.trick.map((p) => (
          <span key={p.seat} className="cw-play"><CrewCard c={p.card} /><bdi>{who(p.seat)}</bdi></span>
        )) : view.lastTrick ? (
          <span className="cw-last"><small>دست قبل را <bdi>{who(view.lastTrick.winner)}</bdi> برد:</small>{view.lastTrick.cards.map((p) => <CrewCard key={p.seat} c={p.card} size="sm" />)}</span>
        ) : <small className="cw-empty">{view.phase === 'draft' ? 'اول وظیفه‌ها پخش می‌شوند' : 'فرمانده دست اول را شروع می‌کند'}</small>}
        {view.aside && <small className="cw-aside">کنار گذاشته: {cardFa(view.aside)}</small>}
      </section>

      {view.hand && !view.outcome && (
        <section className="cw-me" aria-label="دست شما">
          <div className="cw-hand">
            {view.hand.map((c) => {
              const can = talk ? speakable.has(c) : playable.has(c);
              return (
                <button key={c} type="button" disabled={busy || !can} onClick={() => onAction(talk ? { type: 'communicate', card: c } : { type: 'play', card: c })}
                  className={['cw-pick', can ? 'cw-pick--can' : '', hint && hint.card === c && (hint.type === 'play') !== talk ? 'cw-hint' : ''].join(' ')}
                  aria-label={`${talk ? 'نشان دادن' : 'بازی'} ${cardFa(c)}`}><CrewCard c={c} /></button>
              );
            })}
          </div>
          {speakable.size > 0 && (
            <Button size="sm" variant={talk ? 'primary' : 'secondary'} disabled={busy} aria-pressed={talk} className={hint?.type === 'communicate' && !talk ? 'cw-hint' : ''} onClick={() => setTalk(!talk)}>
              {talk ? 'لغو ارتباط' : 'ارتباط (یک بار)'}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

export default function TheCrewRenderer(props: GameRendererProps<CrewView>) {
  return <CrewTable {...props} label={nineLabel} theme="space" />;
}
