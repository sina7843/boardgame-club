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

export function DieFace({ f }: { f: Face }) {
  return <span className={`kt-die bg-roll kt-f--${f}`} role="img" aria-label={f === 'heart' ? 'قلب' : f === 'bolt' ? 'انرژی' : f === 'claw' ? 'چنگ' : f}><DieGlyph f={f} /></span>;
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

export default function KotRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<KotView>) {
  const me = mySeat ?? -1;
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
  useFlip(root, view.seq);
  // Stamps (the state seq of the last change) drive the retrigger keys: a die tumbles only when its face changed,
  // a monster shakes only when its health dropped.
  const prev = useRef<{ dice: Face[]; dieAt: number[]; hp: number[]; hitAt: number[] }>({ dice: [], dieAt: [], hp: [], hitAt: [] });
  const dieAt = view.dice.map((f, i) => (prev.current.dice[i] === f ? prev.current.dieAt[i]! : view.seq));
  const hitAt = view.hp.map((hp, k) => (prev.current.hp[k] !== undefined && hp < prev.current.hp[k]! ? view.seq : prev.current.hitAt[k] ?? 0));
  prev.current = { dice: view.dice, dieAt, hp: view.hp, hitAt };
  const hint = expected as unknown as { type: string; slot?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = view.current === me && !view.outcome;
  const status = view.outcome ? null
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

      <ul className="kt__monsters" aria-label="غول‌ها">
        {view.hp.map((hp, k) => (
          <li key={`${k}-${hitAt[k]}`} data-flip-anchor={`mon-${k}`} className={['kt-mon', hitAt[k] ? 'bg-hit' : '', view.current === k && !view.outcome ? 'kt-mon--turn' : '', !view.alive[k] ? 'kt-mon--dead' : '', view.tokyo === k ? 'kt-mon--tokyo' : '', view.outcome?.placements[0]?.seat === k ? 'kt-mon--win' : ''].join(' ')} style={{ ['--h' as string]: HUE[k % 6] }}>
            <div className="kt-mon__pic"><Monster k={k} /></div>
            <div className="kt-mon__head"><b>{MONSTERS[k % 6]}</b><bdi>{who(k)}</bdi></div>
            <div className="kt-mon__stats">
              <span className="kt-badge kt-badge--hp" aria-label={`${fa(hp)} جان`}><i aria-hidden="true">♥</i><em className="bg-pop" key={hp}>{fa(hp)}</em></span>
              <span className="kt-badge kt-badge--vp" aria-label={`${fa(view.vp[k]!)} امتیاز`}><i aria-hidden="true">★</i><em className="bg-pop" key={view.vp[k]}>{fa(view.vp[k]!)}</em></span>
              <span className="kt-badge kt-badge--en" aria-label={`${fa(view.energy[k]!)} انرژی`}><Bolt /><em className="bg-pop" key={view.energy[k]}>{fa(view.energy[k]!)}</em></span>
            </div>
            <span className="kt-meter" aria-hidden="true"><i style={{ inlineSize: `${Math.max(0, Math.min(100, (hp / view.maxHp[k]!) * 100))}%` }} /></span>
            {view.kept[k]!.length > 0 && <div className="kt-mon__kept">{view.kept[k]!.map((id) => <small key={id} data-flip={`kept-${id}`} data-flip-from="market">{POWERS[id]!.nameFa}</small>)}</div>}
          </li>
        ))}
      </ul>

      {view.dice.length > 0 && (
        <section className="kt__dice" aria-label="تاس‌ها">
          {view.dice.map((f, i) => (myTurn && view.phase === 'roll' && view.rolls < 3
            ? <button key={`${i}-${dieAt[i]}`} type="button" style={{ ['--i' as string]: i }} className={`kt-keep ${keep[i] ? 'kt-keep--on' : ''}`} aria-pressed={keep[i]} onClick={() => setKeep(keep.map((x, j) => (j === i ? !x : x)))}><DieFace f={f} /></button>
            : <span key={`${i}-${dieAt[i]}`} className="kt-keep" style={{ ['--i' as string]: i }}><DieFace f={f} /></span>))}
        </section>
      )}

      {(canRoll || canResolve) && (
        <div className="kt__bar">
          {canRoll && <Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'kt-hint' : ''} onClick={() => onAction({ type: 'roll', keep: view.rolls ? keep : [false, false, false, false, false, false] })}>{view.rolls ? 'دوباره بریز' : 'بریز'} ({fa(view.rolls + 1)} از ۳)</Button>}
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
            <button key={id} type="button" data-flip={`card-${id}`} className={['kt-buy', hint?.type === 'buy' && hint.slot === i ? 'kt-hint' : ''].join(' ')} disabled={!buys.has(i) || busy} onClick={() => onAction({ type: 'buy', slot: i })}><PowerCard id={id} /></button>
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
