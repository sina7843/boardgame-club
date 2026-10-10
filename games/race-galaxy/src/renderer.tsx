// رقابت کهکشانی renderer: a star-chart command deck. Five phase tiles for the secret choice, a phase track showing
// what runs this round, empire rows of planet cards (glowing dots for goods) and developments, and your hand where
// you pick a card to place and then the cards that pay for it.
import './renderer.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import goodN from './art/good-n.webp';
import goodR from './art/good-r.webp';
import goodG from './art/good-g.webp';
import goodA from './art/good-a.webp';
import { CARDS, PHASES, type Good, type Phase, type RgView } from './rules.ts';

// Goods paintings are cut from a generated sprite sheet (see DECISIONS.md).
const GOOD_ART: Record<Good, string> = { n: goodN, r: goodR, g: goodG, a: goodA };

const fa = (n: number) => n.toLocaleString('fa-IR');
export const PHASE_FA: Record<Phase, [string, string, string]> = {
  explore: ['کاوش', '🔭', 'دو کارت بکش، یکی نگه دار (انتخاب‌کننده: چهار)'], develop: ['توسعه', '⚙', 'یک پیشرفت بگذار (انتخاب‌کننده: ۱ ارزان‌تر)'],
  settle: ['استقرار', '🪐', 'یک جهان بگذار (انتخاب‌کننده: یک کارت جایزه)'], consume: ['مصرف', '♻', 'کالاها امتیاز می‌شوند (انتخاب‌کننده: دو برابر)'],
  produce: ['تولید', '⛏', 'جهان‌های تولیدی کالا می‌گیرند (انتخاب‌کننده: بادآورده‌ها هم)']
};
const POWER_FA: Record<string, string> = { devCost: 'توسعه −۱', settleCost: 'استقرار −۱', military: 'نظامی', explore: 'کاوش +۱', consume: 'مصرف +۱' };

export function GalaxyCard({ id, good, size = 'md' }: { id: number; good?: boolean; size?: 'sm' | 'md' }) {
  const c = CARDS[id]!;
  const tag = c.type === 'dev' ? (c.power ? `${POWER_FA[c.power]}${c.mil ? ` +${fa(c.mil)}` : ''}` : 'پیشرفت') : c.kind === 'mil' ? `نظامی ${fa(c.cost)}` : c.kind === 'wind' ? 'بادآورده' : 'تولیدی';
  return (
    <span className={`rg-card rg-card--${size} ${c.type === 'dev' ? 'rg-dev' : `rg-w--${c.good} rg-k--${c.kind}`}`} aria-label={`${c.name}، ${tag}، هزینه ${fa(c.cost)}، ${fa(c.vp)} امتیاز${good ? '، دارای کالا' : ''}`}>
      <span className="rg-card__orb" aria-hidden>{c.type === 'dev' ? '⬢' : ''}{good && c.good && <img className="rg-good bg-land" src={GOOD_ART[c.good]} alt="" />}</span>
      {size === 'md' && c.good && <img className="rg-card__gt" src={GOOD_ART[c.good]} alt="" aria-hidden="true" />}
      <span className="rg-card__name">{c.name}</span>
      {size === 'md' && <small className="rg-card__tag">{tag}</small>}
      <b className="rg-card__cost">{fa(c.cost)}</b>
      <b className="rg-card__vp">{fa(c.vp)}★</b>
    </span>
  );
}

type Hint = { type: string; phase?: string; card?: number; pay?: number[] } | null;
type Queued = { type: string; phase?: Phase; card?: number; pay?: number[] };

/** My queued keep / place applied at once with what I already hold (no hidden draws, e.g. the settle bonus card). */
function preview(v: RgView, q: Queued | null | undefined, me: number): RgView {
  if (!q || me < 0 || !v.hand || q.card === undefined || q.card < 0) return v;
  const card = q.card;
  if (q.type === 'keep') return { ...v, drawn: null, hand: [...v.hand, card], empires: v.empires.map((e, k) => (k === me ? { ...e, hand: e.hand + 1 } : e)) };
  if (q.type !== 'place') return v;
  const pay = q.pay ?? [];
  const hand = v.hand.filter((c, i) => c !== card && !pay.includes(i));
  return {
    ...v, hand,
    empires: v.empires.map((e, k) => (k !== me ? e : { ...e, hand: hand.length, tableau: [...e.tableau, card], goods: CARDS[card]!.kind === 'wind' ? [...e.goods, card] : e.goods }))
  };
}

function Num({ v, className, children }: { v: number; className?: string; children: ReactNode }) {
  const pop = usePop(v);
  return <b key={v} className={`${className ?? ''} ${pop}`}>{children}</b>;
}

export default function RaceGalaxyRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<RgView>) {
  const me = mySeat ?? 0;
  const q = queued as Queued | null | undefined;
  const view = preview(served, q, mySeat ?? -1);
  const picked = q?.type === 'choose' ? q.phase : null; // my queued secret choice lights its tile at once
  // Cards glide deck → drawn → hand → tableau (my queued keep/place at once; undo glides them back); cards that leave
  // to the discard (unkept draws, payment) drop away; chosen phase tiles flip face-up when revealed; goods land.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q ? JSON.stringify(q) : ''}`);
  const hint = expected as unknown as Hint;
  const [sel, setSel] = useState<number | null>(null);
  const [pay, setPay] = useState<number[]>([]);
  useEffect(() => { setSel(null); setPay([]); }, [view.seq]);
  useEffect(() => { if (hint?.type === 'place' && hint.card !== undefined && hint.card >= 0) { setSel(hint.card); setPay(hint.pay ?? []); } }, [hint?.type, hint?.card]); // eslint-disable-line react-hooks/exhaustive-deps
  const choosing = legalActions.some((a) => a.type === 'choose');
  const keeps = legalActions.filter((a) => a.type === 'keep').map((a) => a.card as number);
  const places = legalActions.filter((a) => a.type === 'place' && (a.card as number) >= 0) as unknown as { card: number; price: number }[];
  const placing = legalActions.some((a) => a.type === 'place');
  const price = places.find((x) => x.card === sel)?.price ?? 0;
  const hand = view.hand ?? [];
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : choosing ? { tone: 'mine' as const, text: 'پنهانی یک مرحله انتخاب کنید' }
      : keeps.length ? { tone: 'mine' as const, text: 'یکی از کارت‌های کشیده را نگه دارید' }
        : placing ? { tone: 'mine' as const, text: sel === null ? `کارتی برای ${PHASE_FA[view.stage as Phase][0]} انتخاب کنید یا صرف‌نظر کنید` : `${fa(price)} کارت برای پرداخت انتخاب کنید` }
          : { tone: 'wait' as const, text: view.stage === 'select' ? 'منتظر انتخاب دیگران…' : `منتظر بقیه در مرحلهٔ ${PHASE_FA[view.stage as Phase][0]}` };
  const chosenNow = view.stage !== 'select' ? new Set(view.chosen.flat()) : new Set<Phase>();

  return (
    <div className="rg" ref={root} data-seq={view.seq} data-stage={view.stage}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="rg-info" data-flip-anchor="deck">دور {fa(view.round)} · بانک امتیاز <Num v={view.pool}>{fa(view.pool)}</Num> · دسته <Num v={view.deckCount}>{fa(view.deckCount)}</Num></p>

      <section className="rg-phases" aria-label="مرحله‌ها">
        {PHASES.map((ph) => {
          const active = view.stage === ph;
          const on = chosenNow.has(ph);
          const mine = view.myChoice === ph;
          return choosing ? (
            <button key={ph} type="button" disabled={busy} onClick={() => onAction({ type: 'choose', phase: ph })} aria-pressed={picked === ph} className={`rg-phase is-can ${hint?.phase === ph ? 'rg-hint' : ''} ${picked === ph ? 'is-mine' : ''}`}>
              <b>{PHASE_FA[ph][1]}</b><span>{PHASE_FA[ph][0]}</span><small>{PHASE_FA[ph][2]}</small>
            </button>
          ) : (
            <span key={`${ph}${on}`} className={['rg-phase', on ? 'is-on bg-flip-in' : 'is-off', active ? 'is-active' : '', mine ? 'is-mine' : ''].join(' ')}>
              <b>{PHASE_FA[ph][1]}</b><span>{PHASE_FA[ph][0]}</span>
              {view.stage !== 'select' && <small>{view.chosen.map((c, k) => (c.includes(ph) ? who(k) : null)).filter(Boolean).join('، ') || '—'}</small>}
            </span>
          );
        })}
      </section>

      <ul className="rg-empires" aria-label="امپراتوری‌ها">
        {view.empires.map((e, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={['rg-empire', k === me ? 'is-me' : '', (view.stage === 'select' ? !e.chose : !e.done) && !view.outcome ? 'is-waiting' : ''].join(' ')}>
            <div className="rg-empire__head">
              <bdi>{who(k)}</bdi><Num className="rg-vp" v={e.vp}>{fa(e.vp)}★</Num>
              <small>{fa(e.tableau.length)}/۱۲ کارت · نظامی {fa(e.military)} · {fa(e.chips)} نشان · دست {fa(e.hand)}</small>
            </div>
            <div className="rg-row">{e.tableau.map((id) => <span key={id} className="rg-fly" data-flip={`g${id}`} data-flip-from={`seat-${k}`}><GalaxyCard id={id} size="sm" good={e.goods.includes(id)} /></span>)}</div>
          </li>
        ))}
      </ul>

      {keeps.length > 0 && view.drawn && (
        <section className="rg-drawn" aria-label="کارت‌های کشیده">
          {view.drawn.map((id) => <button key={id} type="button" data-flip={`g${id}`} data-flip-from="deck" data-flip-exit="drop" className="rg-pick is-can" disabled={busy} onClick={() => onAction({ type: 'keep', card: id })}><GalaxyCard id={id} /></button>)}
        </section>
      )}

      {view.hand && !view.outcome && (
        <section className="rg-hand" aria-label="دست شما">
          <div className="rg-row">
            {hand.map((id, i) => {
              const placeable = places.some((x) => x.card === id);
              const isSel = sel === id;
              const isPay = pay.includes(i);
              const click = () => {
                if (!placing) return;
                if (sel === null || (isSel && !pay.length)) { if (placeable) setSel(isSel ? null : id); return; }
                if (isSel) return;
                setPay(isPay ? pay.filter((x) => x !== i) : pay.length < price ? [...pay, i] : pay);
              };
              return (
                <button key={id} type="button" data-flip={`g${id}`} data-flip-from="deck" data-flip-exit="drop" disabled={busy || !placing || (sel === null && !placeable)} onClick={click} aria-pressed={isSel || isPay}
                  className={['rg-pick', placeable && sel === null ? 'is-can' : '', isSel ? 'is-sel' : '', isPay ? 'is-pay' : ''].join(' ')}><GalaxyCard id={id} /></button>
              );
            })}
            {!hand.length && <small>دستتان خالی است</small>}
          </div>
          {placing && (
            <div className="rg-bar">
              {sel !== null && <Button size="sm" disabled={busy || pay.length !== price} className={hint?.type === 'place' && (hint.card ?? -1) >= 0 ? 'rg-hint' : ''} onClick={() => onAction({ type: 'place', card: sel, pay })}>گذاشتن {CARDS[sel]!.name} ({fa(pay.length)}/{fa(price)})</Button>}
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'place', card: -1, pay: [] })}>صرف‌نظر</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
