// آرکانا renderer: an alchemist's table. Essences are cut gems (fire, life, calm, death, gold) with counts; cards
// are vellum plates showing cost gems, what they collect each round and their power (pay → gain, ★ for points).
// Places of power and monuments wait on a velvet shelf; your mage and artifacts sit in front of you.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import artE from './art/ess-e.webp';
import artL from './art/ess-l.webp';
import artC from './art/ess-c.webp';
import artD from './art/ess-d.webp';
import artG from './art/ess-g.webp';
import { CARDS, ESS, ESS_FA, type Ess, type Pile, type RaView } from './rules.ts';

// Painted crystals cut from a generated sheet (see DECISIONS.md), shown as round essence icons.
const art = (k: Ess) => ({ backgroundImage: `url(${{ e: artE, l: artL, c: artC, d: artD, g: artG }[k]})` });
const fa = (n: number) => n.toLocaleString('fa-IR');
export function Gems({ pile, empty }: { pile: Pile; empty?: string }) {
  const items = ESS.flatMap((k) => (pile[k] ? [<span key={k} className="ra-gem" style={art(k)} aria-label={`${fa(pile[k]!)} ${ESS_FA[k]}`}>{fa(pile[k]!)}</span>] : []));
  return items.length ? <span className="ra-gems">{items}</span> : <small className="ra-none">{empty ?? '—'}</small>;
}

export function ArcCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const c = CARDS[id]!;
  return (
    <span className={`ra-card ra-card--${size} ra-k--${c.kind}`} aria-label={c.name}>
      <span className="ra-card__name">{c.name}</span>
      {c.vp > 0 && <b className="ra-card__vp">{fa(c.vp)}★</b>}
      {size === 'md' && c.kind !== 'mage' && <span className="ra-card__row"><small>هزینه</small><Gems pile={c.cost} empty="رایگان" /></span>}
      {Object.keys(c.collect).length > 0 && <span className="ra-card__row"><small>تولید</small><Gems pile={c.collect} /></span>}
      {c.power && <span className="ra-card__row ra-card__pw"><small>قدرت</small><Gems pile={c.power.pay} empty="·" /><i>←</i><Gems pile={c.power.gain} empty="" />{c.power.vp ? <b>{fa(c.power.vp)}★</b> : null}</span>}
    </span>
  );
}

type Hint = { type: string; card?: number } | null;

export default function ResArcanaRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<RaView>) {
  const me = mySeat ?? 0;
  const hint = expected as unknown as Hint;
  const can = (t: string, card: number) => legalActions.some((a) => a.type === t && a.card === card);
  const myTurn = legalActions.some((a) => a.type === 'pass');
  const [dropping, setDropping] = useState<number | null>(null);
  useEffect(() => { setDropping(null); }, [view.seq]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const mine = view.mages[me]!;
  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: dropping !== null ? 'کدام جوهر را می‌خواهید؟' : 'یک کار انجام دهید یا رد کنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  return (
    <div className="ra" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="ra-round">دور {fa(view.round)}</p>

      <ul className="ra-rivals" aria-label="جادوگران">
        {view.mages.map((g, k) => (k === me ? null : (
          <li key={k} className={['ra-rival', k === view.current && !view.outcome ? 'is-now' : '', g.passed ? 'is-passed' : ''].join(' ')}>
            <div className="ra-rival__head"><bdi>{who(k)}</bdi><b className="ra-vp" key={g.vp}>{fa(g.vp)}★</b><Gems pile={g.ess} empty="بی‌جوهر" /><small>{g.passed ? 'رد کرد' : `${fa(g.hand)} کارت`}</small></div>
            <div className="ra-row">{g.table.map((id) => <span key={id} className={view.tapped.includes(id) ? 'is-tapped' : ''}><ArcCard id={id} size="sm" /></span>)}</div>
          </li>
        )))}
      </ul>

      <section className="ra-shelf" aria-label="مکان‌های قدرت و بناها">
        {[...view.places, ...view.monuments].map((id) => {
          const ok = can('buy', id);
          return (
            <button key={id} type="button" disabled={busy || !ok} onClick={() => onAction({ type: 'buy', card: id })}
              className={['ra-pick', ok ? 'is-can' : '', hint?.type === 'buy' && hint.card === id ? 'ra-hint' : ''].join(' ')}><ArcCard id={id} /></button>
          );
        })}
        <small className="ra-shelf__left">بناهای دیگر: {fa(view.monumentsLeft)}</small>
      </section>

      <section className={`ra-me ${myTurn ? 'is-now' : ''}`} aria-label="میز شما">
        <div className="ra-me__head"><bdi>{who(me)}</bdi><b className="ra-vp ra-vp--lg" key={mine.vp}>{fa(mine.vp)} از ۱۰ ★</b><Gems pile={mine.ess} empty="بی‌جوهر" /></div>
        <div className="ra-row">
          {mine.table.map((id) => {
            const ok = can('tap', id);
            return (
              <span key={id} className={`ra-slot ${view.tapped.includes(id) ? 'is-tapped' : ''}`}>
                <ArcCard id={id} />
                {CARDS[id]!.power && <button type="button" className={`ra-mini ${hint?.type === 'tap' && hint.card === id ? 'ra-hint' : ''}`} disabled={busy || !ok} onClick={() => onAction({ type: 'tap', card: id })}>{view.tapped.includes(id) ? 'استفاده شد' : 'فعال کردن'}</button>}
              </span>
            );
          })}
        </div>
        {view.hand && !view.outcome && (
          <div className="ra-hand" aria-label="دست شما">
            {view.hand.map((id) => (
              <span key={id} className="ra-slot">
                <ArcCard id={id} />
                <span className="ra-slot__acts">
                  <button type="button" className={`ra-mini ${hint?.type === 'play' && hint.card === id ? 'ra-hint' : ''}`} disabled={busy || !can('play', id)} onClick={() => onAction({ type: 'play', card: id })}>بازی</button>
                  <button type="button" className="ra-mini" disabled={busy || !can('discard', id)} aria-pressed={dropping === id} onClick={() => setDropping(dropping === id ? null : id)}>دور انداختن</button>
                </span>
                {dropping === id && (
                  <span className="ra-drop">
                    {ESS.map((k: Ess) => <button key={k} type="button" className="ra-gem" style={art(k)} disabled={busy} aria-label={k === 'g' ? '۱ طلا' : `۲ ${ESS_FA[k]}`} onClick={() => onAction({ type: 'discard', card: id, gain: k })}>{k === 'g' ? '۱' : '۲'}</button>)}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        {myTurn && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'pass' ? 'ra-hint' : ''} onClick={() => onAction({ type: 'pass' })}>رد کردن (یک کارت بکشید)</Button>}
      </section>
    </div>
  );
}
