// بازار سبزی renderer: a greengrocer's stall. Three crates each show a chalkboard rule card on top of its pile and
// two vegetables below; players keep a row of vegetable counts and their rule cards, each with its running points.
// Tap a pile's rule, or one or two vegetables; tap one of your rules first to flip it into a vegetable this turn.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameAction, type GameRendererProps } from '@bg/ui';
import tomato from './art/tomato.webp';
import lettuce from './art/lettuce.webp';
import carrot from './art/carrot.webp';
import cabbage from './art/cabbage.webp';
import pepper from './art/pepper.webp';
import onion from './art/onion.webp';
import { CARDS, VEG, counts, ruleScore, scores, type PointSaladView, type Rule, type Veg } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const VEG_FA: Record<Veg, string> = { tomato: 'گوجه', lettuce: 'کاهو', carrot: 'هویج', cabbage: 'کلم', pepper: 'فلفل', onion: 'پیاز' };
const sign = (n: number) => (n > 0 ? `+${fa(n)}` : `−${fa(-n)}`);

// Vegetable art is cut from a generated sheet (see DECISIONS.md).
const ART: Record<Veg, string> = { tomato, lettuce, carrot, cabbage, pepper, onion };

export function VegIcon({ v, size = 1.4 }: { v: Veg; size?: number }) {
  return <img src={ART[v]} alt={VEG_FA[v]} draggable={false} style={{ inlineSize: `${size}rem`, blockSize: `${size}rem` }} className={`ps-veg ps-v--${v}`} />;
}

export function RuleText({ rule }: { rule: Rule }) {
  switch (rule.k) {
    case 'combo': return <span className="ps-rule__t">{rule.veg.map((x, i) => <VegIcon key={i} v={x} size={1} />)} = {fa(rule.pts)}</span>;
    case 'each': return <span className="ps-rule__t">{rule.terms.map(([x, n], i) => <span key={i} className="ps-term"><VegIcon v={x} size={1} />{sign(n)}</span>)}</span>;
    case 'parity': return <span className="ps-rule__t"><VegIcon v={rule.veg} size={1} /> زوج ۷، فرد ۳</span>;
    case 'most': return <span className="ps-rule__t">بیشترین <VegIcon v={rule.veg} size={1} /> = ۱۰</span>;
    case 'fewest': return <span className="ps-rule__t">کمترین <VegIcon v={rule.veg} size={1} /> = ۷</span>;
    case 'set': return <span className="ps-rule__t">هر دست شش‌تایی = ۱۲</span>;
    case 'mostTotal': return <span className="ps-rule__t">بیشترین سبزی کل = ۱۰</span>;
    case 'fewestTotal': return <span className="ps-rule__t">کمترین سبزی کل = ۷</span>;
  }
}

export function RuleCard({ id, pts, from, exit }: { id: number; pts?: number; from?: string; exit?: string }) {
  return <span className="ps-rule" data-flip={from ? `c-${id}` : undefined} data-flip-from={from} data-flip-exit={exit}><RuleText rule={CARDS[id]!.rule} />{pts !== undefined && <b className="ps-rule__pts">{fa(pts)}</b>}</span>;
}

export default function PointSaladRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<PointSaladView>) {
  const me = mySeat ?? -1;
  // Undo-window preview: the rule or vegetables I take (and a rule I flip) move to my row at once; the market refill
  // (the next card of a pile) is hidden and waits for the server.
  const waiting = queued?.type === 'rule' ? (queued.pile as number) : null;
  const view: PointSaladView = (() => {
    if (!queued || me < 0 || (queued.type !== 'rule' && queued.type !== 'veg')) return served;
    const rules = served.rules.map((r) => r.slice()), veggies = served.veggies.map((v) => v.slice());
    let { market, pileTops } = served;
    if (queued.type === 'rule') {
      const top = served.pileTops[queued.pile as number];
      if (top !== null && top !== undefined) rules[me]!.push(top);
      pileTops = served.pileTops.map((t, p) => (p === queued.pile ? null : t));
    } else {
      const slots = queued.slots as number[];
      veggies[me]!.push(...slots.map((i) => served.market[i]!).filter((x) => x !== null));
      market = served.market.map((x, i) => (slots.includes(i) ? null : x));
    }
    if (typeof queued.flip === 'number') { rules[me] = rules[me]!.filter((x) => x !== queued.flip); veggies[me]!.push(queued.flip); }
    return { ...served, rules, veggies, market, pileTops };
  })();
  const piles = new Set(legalActions.filter((a) => a.type === 'rule').map((a) => a.pile as number));
  const vegHint = legalActions.find((a) => a.type === 'veg') as { slots: number[]; need: number } | undefined;
  const [sel, setSel] = useState<number[]>([]);
  const [flip, setFlip] = useState<number | null>(null);
  useEffect(() => { setSel([]); setFlip(null); }, [view.seq]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const hint = expected as unknown as { type: string; pile?: number; slots?: number[] } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = piles.size > 0 || !!vegHint;
  const all = view.veggies.map(counts);
  const sc = scores(view);
  const extra = flip !== null ? { flip } : {};
  const act = (a: GameAction) => { setSel([]); setFlip(null); onAction(a); };
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: 'یک دستور یا دو سبزی بردارید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const order = mySeat === null ? view.rules.map((_, k) => k) : [mySeat, ...view.rules.map((_, k) => k).filter((k) => k !== mySeat)];

  return (
    <div className="ps" ref={root} data-seq={served.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {!view.outcome && (
        <section className="ps__market" aria-label="بازار">
          {[0, 1, 2].map((p) => {
            const top = view.pileTops[p];
            return (
              <div key={p} className="ps-crate" data-flip-anchor={`crate-${p}`}>
                {top !== null && top !== undefined
                  ? <button type="button" className={['ps-pile', hint?.type === 'rule' && hint.pile === p ? 'ps-hint' : ''].join(' ')} disabled={!piles.has(p) || busy || sel.length > 0}
                    onClick={() => act({ type: 'rule', pile: p, ...extra })} aria-label={`برداشتن دستور دستهٔ ${fa(p + 1)}`}><RuleCard id={top} from={`crate-${p}`} /><small>{fa(view.pileCounts[p]!)} کارت</small></button>
                  : p === waiting ? <span className="ps-pile ps-pile--empty">…</span> : <span className="ps-pile ps-pile--empty">خالی</span>}
                <div className="ps-crate__veg">
                  {[p * 2, p * 2 + 1].map((i) => {
                    const id = view.market[i];
                    if (id === null || id === undefined) return <span key={i} className="ps-slot ps-slot--empty" />;
                    const on = sel.includes(i);
                    return (
                      <button key={i} type="button" className={['ps-slot', on ? 'ps-slot--on' : '', hint?.type === 'veg' && hint.slots?.includes(i) && !on ? 'ps-hint' : ''].join(' ')}
                        disabled={!vegHint || busy} aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== i) : [...sel, i].slice(-2))}>
                        <span data-flip={`c-${id}`} data-flip-from={`crate-${p}`} data-flip-exit={`seat-${view.current}`} style={{ display: 'inline-flex' }}><VegIcon v={CARDS[id]!.veg} size={2.2} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}
      {vegHint && !view.outcome && (
        <div className="ps__bar">
          <Button size="sm" disabled={busy || sel.length !== vegHint.need} className={hint?.type === 'veg' && sel.length === vegHint.need ? 'ps-hint' : ''}
            onClick={() => act({ type: 'veg', slots: sel.slice().sort((a, b) => a - b), ...extra })}>برداشتن {fa(sel.length)} سبزی</Button>
          {flip !== null && <span className="ps__flipnote">این نوبت یک دستور به سبزی تبدیل می‌شود</span>}
        </div>
      )}

      <ul className="ps__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['ps-pl', view.current === s && !view.outcome ? 'ps-pl--turn' : '', s === mySeat ? 'ps-pl--me' : '', view.outcome?.placements.find((x) => x.seat === s)?.place === 1 ? 'ps-pl--win' : ''].join(' ')}>
            <div className="ps-pl__head"><bdi className="ps-pl__name">{who(s)}</bdi><span className="ps-pl__score bg-pop" key={sc[s]}>{fa(sc[s]!)} امتیاز</span></div>
            <div className="ps-pl__veg">{VEG.map((x) => <span key={x} className={all[s]![x] ? '' : 'ps-zero'}><VegIcon v={x} size={1.2} /><b className="bg-pop" key={all[s]![x]}>{fa(all[s]![x])}</b></span>)}</div>
            <div className="ps-pl__rules">
              {view.rules[s]!.map((id) => {
                const pts = ruleScore(CARDS[id]!.rule, s, all);
                return s === me && myTurn && !view.outcome
                  ? <button key={id} type="button" className={`ps-flip ${flip === id ? 'ps-flip--on' : ''}`} aria-pressed={flip === id} onClick={() => setFlip(flip === id ? null : id)} title="برگرداندن به سبزی"><RuleCard id={id} pts={pts} from={`seat-${s}`} exit="drop" /></button>
                  : <RuleCard key={id} id={id} pts={pts} from={`seat-${s}`} exit="drop" />;
              })}
              {!view.rules[s]!.length && <span className="ps-zero">بدون دستور</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
