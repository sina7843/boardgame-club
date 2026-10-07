// UNO renderer: opponents rail, felt table with draw/discard piles and active-colour halo, decision panels,
// own hand within thumb reach. Shows only the projection; other hands are counts, never cards.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { COLORS, type Card, type Color, type LogEntry, type UnoView } from './rules.ts';
import { CardBack, CardFace, cardLabel, COLOR_FA } from './cards.tsx';

const fa = (n: number) => n.toLocaleString('fa-IR');
type Hint = { type: string; card?: unknown; seat?: unknown; needsColor?: unknown; color?: unknown };

function describe(e: LogEntry, name: (s: number) => string): string {
  switch (e.t) {
    case 'start': return `دست ${fa(e.hand)} شروع شد؛ کارت رو: ${cardLabel(e.top)}.`;
    case 'play': return `${name(e.seat)} ${cardLabel(e.card)} گذاشت${e.card.color ? '' : ` و رنگ ${COLOR_FA[e.color]} را انتخاب کرد`}${e.uno ? ' و گفت «اونو!»' : ''}.`;
    case 'draw': {
      const why = { turn: '', d2: ' (+۲)', wd4: ' (+۴)', start: ' (کارت شروع)', penalty: ' (جریمه)', challenge: ' (نتیجه اعتراض)' }[e.reason];
      return e.n === 0 ? `${name(e.seat)} کارتی برای کشیدن نبود.` : `${name(e.seat)} ${fa(e.n)} کارت کشید${why}.`;
    }
    case 'pass': return `${name(e.seat)} نوبتش را تمام کرد.`;
    case 'skip': return `نوبت ${name(e.seat)} سوخت.`;
    case 'uno': return `${name(e.seat)} گفت «اونو!»`;
    case 'caught': return `${name(e.by)} ${name(e.seat)} را گرفت؛ «اونو» نگفته بود و ${fa(e.n)} کارت جریمه شد.`;
    case 'challenge': return `${name(e.by)} به +۴ ${name(e.seat)} اعتراض کرد: ${e.guilty ? 'حق با معترض بود' : 'بازی درست بود'}.`;
    case 'color': return `${name(e.seat)} رنگ ${COLOR_FA[e.color]} را انتخاب کرد.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد.`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'handEnd': return `${name(e.winner)} دستش را تمام کرد و ${fa(e.points)} امتیاز گرفت.`;
  }
}

export default function UnoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<UnoView>) {
  const hints = legalActions as Hint[];
  const myTurn = mySeat !== null && view.current === mySeat && !view.outcome;
  const playableIds = useMemo(() => new Set(hints.filter((h) => h.type === 'play').map((h) => h.card as string)), [hints]);
  const canDraw = hints.some((h) => h.type === 'draw');
  const catchSeat = hints.find((h) => h.type === 'catch')?.seat as number | undefined;
  const canCallUno = hints.some((h) => h.type === 'callUno');
  const [picked, setPicked] = useState<string | null>(null);
  const [unoArmed, setUnoArmed] = useState(false);
  const hand = view.myHand ?? [];
  const selected = picked && playableIds.has(picked) ? hand.find((c) => c.id === picked) ?? null : null;
  const exp = expected as { type: string; card?: string; color?: Color; uno?: boolean } | null;

  // New turn / new state: drop stale selection and the UNO toggle.
  const turnSeat = view.current;
  useEffect(() => { setPicked(null); setUnoArmed(false); }, [turnSeat, view.phase, view.hand, hand.length]);

  const lastPlaySeq = [...view.log].reverse().find((e) => e.t === 'play' || e.t === 'start')?.seq ?? 0;
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const play = (c: Card, color?: Color) => {
    if (busy) return;
    onAction({ type: 'play', card: c.id, ...(color ? { color } : {}), ...(unoArmed && hand.length === 2 ? { uno: true } : {}) });
    setPicked(null);
    setUnoArmed(false);
  };
  const tap = (c: Card) => {
    if (!playableIds.has(c.id) || busy) return;
    if (picked === c.id && c.color) play(c);
    else setPicked(c.id);
  };

  const others = Array.from({ length: view.players }, (_, s) => s).filter((s) => s !== mySeat);
  const colorClass = view.color ? `uno-table--${view.color}` : '';
  const needsUno = myTurn && hand.length === 2 && (view.phase === 'play' || view.phase === 'drawn');

  let status: { tone: 'mine' | 'wait' | 'done'; text: string } | null;
  if (view.outcome) status = null;
  else if (myTurn && view.phase === 'wd4') status = { tone: 'mine', text: `${seatName(view.wd4!.offender)} برای شما +۴ گذاشت؛ تصمیم بگیرید` };
  else if (myTurn && view.phase === 'chooseColor') status = { tone: 'mine', text: 'کارت شروع «رنگی» است؛ رنگ را انتخاب کنید' };
  else if (myTurn && view.phase === 'drawn') status = { tone: 'mine', text: 'کارت کشیده‌شده قابل بازی است' };
  else if (myTurn) status = { tone: 'mine', text: playableIds.size ? 'نوبت شماست: کارت هم‌رنگ، هم‌عدد یا هم‌نماد بگذارید' : 'کارت مناسبی ندارید؛ یک کارت بکشید' };
  else status = { tone: 'wait', text: `نوبت ${seatName(view.current)}${view.phase === 'wd4' ? '، تصمیم درباره +۴' : ''}` };

  return (
    <div className="uno">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="uno__meta">
        <span>دست {fa(view.hand)}{view.target ? ` · هدف ${fa(view.target)} امتیاز` : ' · یک‌دسته'}</span>
        {view.color && <span className={`uno-pill uno-pill--${view.color}`}>رنگ: {COLOR_FA[view.color]}</span>}
        <span className="uno-dir" aria-label={view.direction === 1 ? 'جهت بازی: عادی' : 'جهت بازی: برعکس'}>
          <span aria-hidden="true" className={view.direction === 1 ? 'uno-dir__icon' : 'uno-dir__icon uno-dir__icon--rev'}>↻</span>
          {view.direction === 1 ? 'جهت عادی' : 'جهت برعکس'}
        </span>
      </div>

      <ul className="uno-rail" aria-label="بازیکنان دیگر">
        {others.map((s) => {
          const active = view.current === s && !view.outcome;
          return (
            <li key={s} className={['uno-opp', active ? 'uno-opp--turn' : '', view.active[s] ? '' : 'uno-opp--out'].join(' ')}>
              <span className="uno-opp__fan" aria-hidden="true">
                {Array.from({ length: Math.min(view.handCounts[s] ?? 0, 5) }, (_, i) => <span key={i} className="uno-opp__back" style={{ ['--i' as string]: i }} />)}
              </span>
              <span className="uno-opp__body">
                <bdi className="uno-opp__name">{seatName(s)}</bdi>
                <span className="uno-opp__count">{view.active[s] ? `${fa(view.handCounts[s] ?? 0)} کارت` : 'کنار رفته'}{view.target ? ` · ${fa(view.scores[s] ?? 0)} امتیاز` : ''}</span>
              </span>
              {active && <span className="uno-badge">نوبت</span>}
              {view.called[s] && view.handCounts[s] === 1 && <span className="uno-badge uno-badge--uno">اونو!</span>}
              {catchSeat === s && <Button size="sm" variant="danger" disabled={busy} onClick={() => onAction({ type: 'catch', seat: s })}>اونو نگفت! بگیر</Button>}
            </li>
          );
        })}
      </ul>

      <div className={`uno-table ${colorClass}`}>
        <button type="button" className="uno-pile uno-pile--draw" onClick={() => canDraw && !busy && onAction({ type: 'draw' })}
          aria-disabled={!canDraw || busy || undefined} aria-label={`دسته کشیدن، ${fa(view.drawCount)} کارت${canDraw ? '؛ یک کارت بکشید' : ''}`}>
          <span className="uno-stack" aria-hidden="true"><span /><span /><span /></span>
          <CardBack size="lg" />
          <span className="uno-pile__count">{fa(view.drawCount)}</span>
          {canDraw && <span className="uno-pile__cta">کشیدن</span>}
        </button>
        <div className="uno-pile uno-pile--discard">
          <span className="uno-halo" aria-hidden="true" />
          <span className="uno-under" aria-hidden="true"><span /><span /></span>
          {view.top && <span key={lastPlaySeq} className="uno-pile__top"><CardFace card={view.top} size="lg" /></span>}
          <span className="uno-pile__label">{view.color ? `رنگ فعال: ${COLOR_FA[view.color]}` : 'رنگ انتخاب نشده'}</span>
        </div>
      </div>

      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {canCallUno && (
        <div className="uno-alert" role="alert">
          <span>یک کارت دارید و «اونو» نگفتید! پیش از اینکه کسی شما را بگیرد بگویید.</span>
          <Button disabled={busy} onClick={() => onAction({ type: 'callUno' })}>اونو!</Button>
        </div>
      )}

      {view.reveal && (
        <section className="uno-panel" aria-labelledby="uno-reveal-h">
          <h3 id="uno-reveal-h">دست <bdi>{seatName(view.reveal.seat)}</bdi> (فقط برای شما)</h3>
          <div className="uno-mini">{view.reveal.cards.map((c) => <CardFace key={c.id} card={c} size="sm" />)}</div>
        </section>
      )}

      {myTurn && view.phase === 'wd4' && (
        <section className="uno-panel uno-panel--decide" aria-labelledby="uno-wd4-h">
          <h3 id="uno-wd4-h">+۴ از <bdi>{seatName(view.wd4!.offender)}</bdi></h3>
          <p>+۴ فقط وقتی مجاز است که بازیکن کارت هم‌رنگ کارت قبلی نداشته باشد. اگر اعتراض کنید دستش را می‌بینید:
            اگر خطا کرده باشد خودش ۴ کارت می‌کشد و شما بازی می‌کنید؛ وگرنه شما ۶ کارت می‌کشید.</p>
          <div className="row">
            <Button disabled={busy} onClick={() => onAction({ type: 'accept' })}>پذیرفتن و کشیدن ۴ کارت</Button>
            <Button variant="secondary" disabled={busy} onClick={() => onAction({ type: 'challenge' })}>اعتراض</Button>
          </div>
        </section>
      )}

      {myTurn && view.phase === 'chooseColor' && <ColorPicker title="رنگ شروع را انتخاب کنید" busy={busy} onPick={(color) => onAction({ type: 'chooseColor', color })} />}

      {selected && !selected.color && (
        <ColorPicker title={`${cardLabel(selected)}: رنگ بعدی را انتخاب کنید`} busy={busy} hint={exp?.color} onPick={(color) => play(selected, color)} onCancel={() => setPicked(null)} />
      )}

      {view.myHand && !view.outcome && (
        <section className="uno-hand" aria-label={`دست شما، ${fa(hand.length)} کارت`}>
          <div className="uno-hand__bar">
            <strong>دست شما ({fa(hand.length)})</strong>
            {needsUno && (
              <button type="button" className={unoArmed ? 'uno-call uno-call--on' : 'uno-call'} aria-pressed={unoArmed} onClick={() => setUnoArmed(!unoArmed)}>
                {unoArmed ? '✓ اونو!' : 'اونو!'}
              </button>
            )}
            {myTurn && view.phase === 'drawn' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'keep' })}>نگه‌داشتن و پایان نوبت</Button>}
            {selected?.color && <Button size="sm" disabled={busy} onClick={() => play(selected)}>بازی {cardLabel(selected)}</Button>}
          </div>
          {needsUno && !unoArmed && <p className="uno-hand__tip">یکی‌مانده به آخر! پیش از گذاشتن کارت «اونو!» را بزنید.</p>}
          <div className="uno-hand__cards">
            {hand.map((c) => {
              const ok = playableIds.has(c.id) && !busy;
              return (
                <CardFace key={c.id} card={c} onClick={() => tap(c)} disabled={!ok}
                  state={picked === c.id ? 'selected' : ok ? 'playable' : myTurn ? 'dim' : undefined}
                  hint={exp?.type === 'play' && exp.card === c.id} />
              );
            })}
          </div>
        </section>
      )}

      {view.target && (
        <details className="uno-scores">
          <summary>امتیازها</summary>
          <table className="table">
            <caption className="visually-hidden">امتیاز بازیکنان</caption>
            <thead><tr><th scope="col">بازیکن</th><th scope="col">امتیاز</th></tr></thead>
            <tbody>{Array.from({ length: view.players }, (_, s) => (
              <tr key={s}><th scope="row"><bdi>{seatName(s)}</bdi>{s === mySeat ? ' (شما)' : ''}</th><td className="num">{fa(view.scores[s] ?? 0)}</td></tr>
            ))}</tbody>
          </table>
        </details>
      )}

      <details className="uno-log" open>
        <summary>رویدادها</summary>
        <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
      </details>
    </div>
  );
}

function ColorPicker({ title, busy, onPick, onCancel, hint }: { title: string; busy: boolean; onPick: (c: Color) => void; onCancel?: () => void; hint?: Color }) {
  return (
    <section className="uno-panel uno-panel--decide" aria-label={title}>
      <h3>{title}</h3>
      <div className="uno-colors">
        {COLORS.map((c) => (
          <button key={c} type="button" className={`uno-color uno-color--${c}${hint === c ? ' uno-color--hint' : ''}`} disabled={busy} onClick={() => onPick(c)}>
            {COLOR_FA[c]}
          </button>
        ))}
      </div>
      {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>انصراف</Button>}
    </section>
  );
}
