// بازار سبزی renderer: a greengrocer's stall. Three crates each show a chalkboard rule card on top of its pile and
// two vegetables below; players keep a row of vegetable counts and their rule cards, each with its running points.
// Tap a pile's rule, or one or two vegetables; tap one of your rules first to flip it into a vegetable this turn.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, DockSlot, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, useTermsLang, type GameAction, type GameRendererProps } from '@bg/ui';
import { terms } from './terms.ts';
import { CARDS, VEG, counts, ruleScore, scores, type PointSaladView, type Rule, type Veg } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const vegName = (v: Veg) => tx(terms[v]);
const sign = (n: number) => (n > 0 ? `+${fa(n)}` : `−${fa(-n)}`);

// Vegetable discs are the BGA Point Salad client art (see DECISIONS.md).
const GC = import.meta.glob('./art/gc/point-salad-*.png', { eager: true, import: 'default' });
const gc = (n: string) => GC[`./art/gc/point-salad-${n}.png`]!;
const ART = Object.fromEntries(VEG.map((v) => [v, gc(`sym-${v}`)])) as Record<Veg, string>;
const CARD_ART = Object.fromEntries(VEG.map((v) => [v, gc(v)])) as Record<Veg, string>;

export function VegIcon({ v, size = 1.4 }: { v: Veg; size?: number }) {
  useTermsLang();
  return <img src={ART[v]} alt={vegName(v)} draggable={false} style={{ inlineSize: `${size}rem`, blockSize: `${size}rem` }} className={`ps-veg ps-v--${v}`} />;
}

export function RuleText({ rule }: { rule: Rule }) {
  switch (rule.k) {
    case 'combo': return <span className="ps-rule__t">{rule.veg.map((x, i) => <VegIcon key={i} v={x} size={1} />)} = {fa(rule.pts)}</span>;
    case 'each': return <span className="ps-rule__t">{rule.terms.map(([x, n], i) => <span key={i} className="ps-term"><VegIcon v={x} size={1} />{sign(n)}</span>)}</span>;
    case 'parity': return <span className="ps-rule__t"><VegIcon v={rule.veg} size={1} /> <T t={terms.even} /> ۷، <T t={terms.odd} /> ۳</span>;
    case 'most': return <span className="ps-rule__t"><T t={terms.most} /> <VegIcon v={rule.veg} size={1} /> = ۱۰</span>;
    case 'fewest': return <span className="ps-rule__t"><T t={terms.fewest} /> <VegIcon v={rule.veg} size={1} /> = ۷</span>;
    case 'set': return <span className="ps-rule__t"><T t={terms.setOfSix} /> = ۱۲</span>;
    case 'mostTotal': return <span className="ps-rule__t"><T t={terms.mostTotal} /> = ۱۰</span>;
    case 'fewestTotal': return <span className="ps-rule__t"><T t={terms.fewestTotal} /> = ۷</span>;
  }
}

/** The delivered art has only six printed rule faces; a card gets its picture when the engine card is exactly one of them. */
function ruleArt(veg: Veg, r: Rule): string | null {
  const key = r.k === 'most' && r.veg === 'carrot' && veg === 'cabbage' ? 'cabbage-rule-03'
    : r.k === 'parity' && r.veg === 'cabbage' && veg === 'carrot' ? 'carrot-rule-02'
    : r.k === 'each' && veg === 'carrot' && r.terms.length === 2 && r.terms[0]![0] === 'cabbage' && r.terms[0]![1] === 3 && r.terms[1]![0] === 'tomato' && r.terms[1]![1] === -2 ? 'carrot-rule-08'
    : r.k === 'fewest' && r.veg === 'pepper' && veg === 'lettuce' ? 'lettuce-rule-04'
    : r.k === 'combo' && veg === 'lettuce' && r.pts === 5 && r.veg.length === 2 && [...r.veg].sort().join() === 'carrot,tomato' ? 'lettuce-rule-14'
    : r.k === 'most' && r.veg === 'tomato' && veg === 'onion' ? 'onion-rule-03' : null;
  return key ? (gc(key) as string | undefined) ?? null : null;
}

export function RuleCard({ id, pts, from, exit }: { id: number; pts?: number; from?: string; exit?: string }) {
  const art = ruleArt(CARDS[id]!.veg, CARDS[id]!.rule);
  return <span className={art ? 'ps-rule ps-rule--art' : 'ps-rule'} data-flip={from ? `c-${id}` : undefined} data-flip-from={from} data-flip-exit={exit}>{art ? <><img className="ps-vegcard" src={art} alt="" draggable={false} /><span className="visually-hidden"><RuleText rule={CARDS[id]!.rule} /></span></> : <RuleText rule={CARDS[id]!.rule} />}{pts !== undefined && <b className="ps-rule__pts">{fa(pts)}</b>}</span>;
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
  useTermsLang();
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = piles.size > 0 || !!vegHint;
  const all = view.veggies.map(counts);
  const sc = scores(view);
  const extra = flip !== null ? { flip } : {};
  const act = (a: GameAction) => { setSel([]); setFlip(null); onAction(a); };
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: `یک ${tx(terms.pointCard)} یا دو ${tx(terms.veggie)} بردارید` }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const order = mySeat === null ? view.rules.map((_, k) => k) : [mySeat, ...view.rules.map((_, k) => k).filter((k) => k !== mySeat)];

  const framed = useInFrame() !== null; // the shell draws seats, scores, whose-turn and the events log

  return (
    <div className="ps" ref={root} data-seq={served.seq}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>یا یک <T t={terms.pointCard} /> از بالای <T t={terms.pile} /> بردارید، یا تا دو <T t={terms.veggie} /> از <T t={terms.market} />. هر <T t={terms.pointCard} /> را می‌توانید به یک <T t={terms.veggie} /> تبدیل کنید. <T t={terms.pointCards} /> در پایان بازی امتیاز می‌دهند.</p>
        </RailSlot>
      )}

      {!view.outcome && (
        <section className="ps__market" aria-label={tx(terms.market)}>
          {[0, 1, 2].map((p) => {
            const top = view.pileTops[p];
            return (
              <div key={p} className="ps-crate">
                {top !== null && top !== undefined
                  ? <button type="button" data-flip-anchor={`crate-${p}`} className={['ps-pile', hint?.type === 'rule' && hint.pile === p ? 'ps-hint' : ''].join(' ')} disabled={!piles.has(p) || busy || sel.length > 0}
                    onClick={() => act({ type: 'rule', pile: p, ...extra })} aria-label={`${tx(terms.take)} ${tx(terms.pointCard)} ${tx(terms.pileEz)} ${fa(p + 1)}`}><RuleCard id={top} from={`crate-${p}`} /><small>{fa(view.pileCounts[p]!)} <T t={terms.cards} /></small></button>
                  : p === waiting ? <span data-flip-anchor={`crate-${p}`} className="ps-pile ps-pile--empty">…</span> : <span data-flip-anchor={`crate-${p}`} className="ps-pile ps-pile--empty"><T t={terms.empty} /></span>}
                <div className="ps-crate__veg">
                  {[p * 2, p * 2 + 1].map((i) => {
                    const id = view.market[i];
                    if (id === null || id === undefined) return <span key={i} className="ps-slot ps-slot--empty" />;
                    const on = sel.includes(i);
                    return (
                      <button key={i} type="button" className={['ps-slot', on ? 'ps-slot--on' : '', hint?.type === 'veg' && hint.slots?.includes(i) && !on ? 'ps-hint' : ''].join(' ')}
                        disabled={!vegHint || busy} aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== i) : [...sel, i].slice(-2))}>
                        <span data-flip={`c-${id}`} data-flip-from={`crate-${p}`} data-flip-exit={`seat-${view.current}`} style={{ display: 'inline-flex' }}><img src={CARD_ART[CARDS[id]!.veg]} alt={vegName(CARDS[id]!.veg)} draggable={false} className="ps-vegcard" /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}
      {vegHint && !view.outcome && (() => {
        const bar = (
          <>
            <Button size="sm" disabled={busy || sel.length !== vegHint.need} className={hint?.type === 'veg' && sel.length === vegHint.need ? 'ps-hint' : ''}
              onClick={() => act({ type: 'veg', slots: sel.slice().sort((a, b) => a - b), ...extra })}><T t={terms.take} /> {fa(sel.length)} <T t={terms.veggie} /></Button>
            {flip !== null && <span className="ps__flipnote">این نوبت یک <T t={terms.pointCard} /> به <T t={terms.veggie} /> تبدیل می‌شود</span>}
          </>
        );
        return framed ? <DockSlot>{bar}</DockSlot> : <div className="ps__bar">{bar}</div>;
      })()}

      <ul className="ps__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['ps-pl', view.current === s && !view.outcome ? 'ps-pl--turn' : '', s === mySeat ? 'ps-pl--me' : '', view.outcome?.placements.find((x) => x.seat === s)?.place === 1 ? 'ps-pl--win' : ''].join(' ')}>
            <div className="ps-pl__head"><bdi className="ps-pl__name">{who(s)}</bdi>{!framed && <span className="ps-pl__score bg-pop" key={sc[s]}>{fa(sc[s]!)} امتیاز</span>}</div>
            <div className="ps-pl__veg">{VEG.map((x) => <span key={x} className={all[s]![x] ? '' : 'ps-zero'}><VegIcon v={x} size={1.2} /><b className="bg-pop" key={all[s]![x]}>{fa(all[s]![x])}</b></span>)}</div>
            {view.rules[s]!.length > 0 && <div className="ps-pl__rules">
              {view.rules[s]!.map((id) => {
                const pts = ruleScore(CARDS[id]!.rule, s, all);
                return s === me && myTurn && !view.outcome
                  ? <button key={id} type="button" className={`ps-flip ${flip === id ? 'ps-flip--on' : ''}`} aria-pressed={flip === id} onClick={() => setFlip(flip === id ? null : id)} title={tx(terms.flipToVeg)}><RuleCard id={id} pts={pts} from={`seat-${s}`} exit="drop" /></button>
                  : <RuleCard key={id} id={id} pts={pts} from={`seat-${s}`} exit="drop" />;
              })}
            </div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
