// غول‌های شهر renderer: a neon city at night. The arena in the middle shows who holds the city; monster panels carry
// health, a star track to 20 and energy; six chunky dice can be tapped to keep between rolls; the power market sits
// below with prices in energy.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { POWERS, type Face, type KotView } from './rules.ts';
import { Bolt, DieGlyph, Monster } from './art.tsx';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const MONSTERS = ['اژدها', 'ربات', 'گوریل', 'هیولای دریا', 'خفاش غول', 'دایناسور'];
const HUE = [350, 200, 30, 170, 280, 100];

export function DieFace({ f, tumble }: { f: Face; tumble?: boolean }) {
  // Tumbling (my roll not answered yet): no face colour and the glyph hidden, so no value shows before the server's.
  if (tumble) return <span className="kt-die bg-tumble" role="img" aria-label="در حال چرخیدن"><DieGlyph f={f} /></span>;
  return <span className={`kt-die bg-roll kt-f--${f}`} role="img" aria-label={f === 'heart' ? 'قلب' : f === 'bolt' ? 'انرژی' : f === 'claw' ? 'چنگ' : f}><DieGlyph f={f} /></span>;
}

/** A monster-board dial: a numbered wheel turned so the current value sits under the window at the top, with the value
 *  printed large on the hub (heart = health, star = victory points). Numbers come from the view, never from art. */
function Dial({ kind, value, max }: { kind: 'hp' | 'vp'; value: number; max: number }) {
  const n = max + 1, step = 360 / n, v = Math.max(0, Math.min(max, value));
  const label = kind === 'hp' ? 'جان' : 'امتیاز';
  return (
    <span className={`kt-dial kt-dial--${kind}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${label}: ${fa(value)} از ${fa(max)}`}>
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="48" className="kt-dial__rim" />
        <g className="kt-dial__wheel" style={{ transform: `rotate(${-v * step}deg)` }}>
          <circle r="44" className="kt-dial__disc" />
          {Array.from({ length: n }, (_, i) => <text key={i} transform={`rotate(${i * step}) translate(0 -32)`} className={i === v ? 'is-on' : ''}>{fa(i)}</text>)}
        </g>
        <path d="M-10 -49 h20 l-3 20 h-14 z" className="kt-dial__window" />
        <circle r="24" className="kt-dial__hub" />
        {kind === 'hp'
          ? <path d="M0 17C-19 5-17-13-8-13c4 0 7 2 8 6 1-4 4-6 8-6 9 0 11 18-8 30Z" className="kt-dial__icon" />
          : <path d="M0-17 5-6 17-5 8 3 10.5 15 0 9-10.5 15-8 3-17-5-5-6Z" className="kt-dial__icon" />}
        <text y="8" className="kt-dial__num bg-pop" key={value}>{fa(value)}</text>
      </svg>
      <small>{label}</small>
    </span>
  );
}

export function PowerCard({ id }: { id: number }) {
  const p = POWERS[id]!;
  return (
    <span className={`kt-card ${p.effect.kind === 'keep' ? 'kt-card--keep' : ''}`}>
      <b className="kt-card__cost">{fa(p.cost)}<Bolt /></b>
      <span className="kt-card__name">{p.nameFa}</span>
      <small>{p.textFa}</small>
    </span>
  );
}

export default function KotRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<KotView>) {
  const me = mySeat ?? -1;
  // Undo window: a bought card leaves the market at once (to my kept cards, energy paid); its effect waits for the server.
  const buying = queued?.type === 'buy' ? served.market[queued.slot as number] : undefined;
  const view = buying === undefined ? served : {
    ...served, market: served.market.filter((id) => id !== buying),
    energy: served.energy.map((e, k) => (k === me ? e - POWERS[buying]!.cost : e)),
    kept: served.kept.map((ks, k) => (k === me && POWERS[buying]!.effect.kind === 'keep' ? [...ks, buying] : ks))
  };
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const canResolve = legalActions.some((a) => a.type === 'resolve');
  const canYield = legalActions.some((a) => a.type === 'yield');
  const buys = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.slot as number));
  const canSweep = legalActions.some((a) => a.type === 'sweep');
  const canEnd = legalActions.some((a) => a.type === 'end');
  const [keep, setKeep] = useState<boolean[]>([false, false, false, false, false, false]);
  const turnKey = `${view.current}-${view.rolls === 0}`;
  useEffect(() => { setKeep([false, false, false, false, false, false]); }, [turnKey]);
  const root = useRef<HTMLDivElement>(null);
  // My roll in the undo window or waiting for the server: the dice I did not keep tumble with no face.
  const [asked, setAsked] = useState<boolean[] | null>(null);
  useEffect(() => { if (!busy) setAsked(null); }, [busy]);
  const rollingKeep = queued?.type === 'roll' ? (queued.keep as boolean[]) : busy ? asked : null;
  const tumbling = (i: number) => !!rollingKeep && !(served.rolls > 0 && rollingKeep[i]);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}|${!!rollingKeep}`);
  // Stamps (the state seq of the last change) drive the retrigger keys: a die is thrown again when it was rerolled
  // (my own roll: every die I did not keep, even if it shows the same face; others: the first roll, or a changed face),
  // a monster shakes only when its health dropped.
  const prev = useRef<{ dice: Face[]; rolls: number; dieAt: number[]; hp: number[]; hitAt: number[]; keep: boolean[] | null }>({ dice: [], rolls: 0, dieAt: [], hp: [], hitAt: [], keep: null });
  const rolled = view.rolls !== prev.current.rolls && view.rolls > 0;
  const lastKeep = view.current === me ? prev.current.keep : null;
  const dieAt = view.dice.map((f, i) => (rolled && (view.rolls === 1 || (lastKeep ? !lastKeep[i] : prev.current.dice[i] !== f)) ? view.seq : prev.current.dice[i] === f ? prev.current.dieAt[i]! : view.seq));
  const hitAt = view.hp.map((hp, k) => (prev.current.hp[k] !== undefined && hp < prev.current.hp[k]! ? view.seq : prev.current.hitAt[k] ?? 0));
  prev.current = { dice: view.dice, rolls: view.rolls, dieAt, hp: view.hp, hitAt, keep: rollingKeep ?? (rolled ? null : prev.current.keep) };
  const hint = expected as unknown as { type: string; slot?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = view.current === me && !view.outcome;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : canYield ? { tone: 'mine' as const, text: 'ضربه خوردید! در شهر می‌مانید یا بیرون می‌روید؟' }
      : myTurn ? { tone: 'mine' as const, text: view.phase === 'roll' ? (view.rolls ? `تاس‌ها را نگه دارید و دوباره بریزید (${fa(3 - view.rolls)} بار مانده) یا حساب کنید` : 'تاس بریزید') : 'کارت بخرید یا نوبت را تمام کنید' }
        : { tone: 'wait' as const, text: view.phase === 'yield' ? `منتظر تصمیم ${who(view.tokyo!)}` : `نوبت ${who(view.current)}` };

  return (
    <div className="kt" data-seq={view.seq} data-phase={view.phase} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="kt__arena" aria-label="شهر">
        {view.tokyo !== null
          ? <span className="kt__king" style={{ ['--h' as string]: HUE[view.tokyo % 6] }} key={view.tokyo} data-flip={`king-${view.tokyo}`} data-flip-from={`mon-${view.tokyo}`}><span className="kt__burst" aria-hidden="true" /><Monster k={view.tokyo} className="kt-art--king" /><b>{MONSTERS[view.tokyo % 6]}</b><bdi>{who(view.tokyo)}</bdi> در شهر</span>
          : <span className="kt__empty">شهر خالی است</span>}
      </section>

      <ul className="kt__monsters" aria-label="صفحه‌های غول">
        {/* My monster board first and full size; the others follow as compact boards. */}
        {(me >= 0 ? [me, ...view.hp.map((_, k) => k).filter((k) => k !== me)] : view.hp.map((_, k) => k)).map((k) => (
          <li key={`${k}-${hitAt[k]}`} data-flip-anchor={`mon-${k}`} className={['kt-mon', k === me ? 'kt-mon--me' : '', hitAt[k] ? 'bg-hit' : '', view.current === k && !view.outcome ? 'kt-mon--turn' : '', !view.alive[k] ? 'kt-mon--dead' : '', view.tokyo === k ? 'kt-mon--tokyo' : '', view.outcome?.placements[0]?.seat === k ? 'kt-mon--win' : ''].join(' ')} style={{ ['--h' as string]: HUE[k % 6] }}>
            <div className="kt-mon__head"><b>{MONSTERS[k % 6]}</b><bdi>{who(k)}</bdi>{!view.alive[k] && <small>بیرون</small>}</div>
            <Dial kind="hp" value={view.hp[k]!} max={view.maxHp[k]!} />
            <div className="kt-mon__pic"><Monster k={k} /></div>
            <Dial kind="vp" value={view.vp[k]!} max={20} />
            <div className="kt-mon__en" role="img" aria-label={`${fa(view.energy[k]!)} انرژی`}>
              <span className="kt-badge kt-badge--en"><Bolt /><em className="bg-pop" key={view.energy[k]}>{fa(view.energy[k]!)}</em></span>
              <span className="kt-cubes">{Array.from({ length: Math.min(view.energy[k]!, 12) }, (_, i) => <i key={i} />)}</span>
            </div>
            {view.kept[k]!.length > 0 && <div className="kt-mon__kept" aria-label="کارت‌های نگه‌داشته">{view.kept[k]!.map((id) => <small key={id} data-flip={`card-${id}`} data-flip-from="market" title={POWERS[id]!.textFa}>{POWERS[id]!.nameFa}</small>)}</div>}
          </li>
        ))}
      </ul>

      {(view.dice.length > 0 || rollingKeep) && (
        <section className="kt__dice" aria-label="تاس‌ها">
          {(rollingKeep ? Array.from({ length: 6 }, (_, i) => view.dice[i] ?? '1') : view.dice).map((f, i) => (tumbling(i)
            ? <span key={`t${i}`} className="kt-keep" style={{ ['--i' as string]: i }}><DieFace f={f} tumble /></span>
            // One element type for a die whether it can be kept or not, so a die is thrown again only when it was rerolled.
            : <button key={`${i}-${dieAt[i]}`} type="button" style={{ ['--i' as string]: i }} className={`kt-keep ${(rollingKeep ? rollingKeep[i] : keep[i]) ? 'kt-keep--on' : ''}`}
              disabled={!(myTurn && view.phase === 'roll' && view.rolls < 3) || !!rollingKeep} aria-pressed={keep[i]} onClick={() => setKeep(keep.map((x, j) => (j === i ? !x : x)))}><DieFace f={f} /></button>))}
        </section>
      )}

      {(canRoll || canResolve) && (
        <div className="kt__bar">
          {canRoll && <Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'kt-hint' : ''} onClick={() => { const k = view.rolls ? keep : [false, false, false, false, false, false]; setAsked(k); onAction({ type: 'roll', keep: k }); }}>{view.rolls ? 'دوباره بریز' : 'بریز'} ({fa(view.rolls + 1)} از ۳)</Button>}
          {canResolve && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'resolve' ? 'kt-hint' : ''} onClick={() => onAction({ type: 'resolve' })}>همین‌ها</Button>}
        </div>
      )}
      {canYield && (
        <div className="kt__bar">
          <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'yield', leave: false })}>می‌مانم</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'yield', leave: true })}>از شهر بیرون می‌روم</Button>
        </div>
      )}

      {!view.outcome && (
        <section className="kt__market" aria-label="کارت‌های قدرت" data-flip-anchor="market">
          {view.market.map((id, i) => (
            <button key={id} type="button" data-flip={`card-${id}`} data-flip-exit="drop" className={['kt-buy', hint?.type === 'buy' && hint.slot === i ? 'kt-hint' : ''].join(' ')} disabled={!buys.has(i) || busy} onClick={() => onAction({ type: 'buy', slot: i })}><PowerCard id={id} /></button>
          ))}
        </section>
      )}
      {(canSweep || canEnd) && (
        <div className="kt__bar">
          {canSweep && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'sweep' })}>کارت‌های تازه (۲ϟ)</Button>}
          {canEnd && <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'end' })}>پایان نوبت</Button>}
        </div>
      )}
    </div>
  );
}
