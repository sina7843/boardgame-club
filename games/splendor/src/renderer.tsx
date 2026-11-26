// گوهرفروش renderer: a jeweller's velvet counter. Faceted gem tokens in the bank, three rows of development cards
// (deck tile + four cards) under the visiting nobles, rival ledgers with bonuses and tokens, and your own reserved
// cards. Tap gems to pick (three different, or the same gem twice for a pair); tap a card to buy or reserve it.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, T, tx, type Term, useTermsLang, useFlip, useInFrame, type GameAction, type GameRendererProps, DockSlot } from '@bg/ui';
import gemW from './art/splendor-token-w.png';
import gemU from './art/splendor-token-u.png';
import gemG from './art/splendor-token-g.png';
import gemR from './art/splendor-token-r.png';
import gemK from './art/splendor-token-k.png';
import gemO from './art/splendor-token-gold.png';
import cardsArt from './art/cards.webp';
import noblesArt from './art/nobles.webp';
import { terms } from './terms.ts';
import { CARDS, GEMS, NOBLES, bonuses, payment, type Gem, type SplendorView, type Token } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const GEM_T: Record<Token, Term> = { w: terms.diamond, u: terms.sapphire, g: terms.emerald, r: terms.ruby, k: terms.onyx, o: terms.gold };
export const gemName = (t: Token) => tx(GEM_T[t]);
// BGA Splendor client art (see DECISIONS.md). cards.webp: 6 × 6 sprite, one row per colour, two pictures per level;
// nobles.webp: 5 × 3 portraits.
const GEM_ART: Record<Token, string> = { w: gemW, u: gemU, g: gemG, r: gemR, k: gemK, o: gemO };
const CARD_ROW: Record<Gem, number> = { u: 0, k: 1, r: 2, g: 3, w: 4 };
const cardArt = (id: number) => { const c = CARDS[id]!; return { backgroundImage: `url(${cardsArt})`, backgroundPosition: `${((c.level - 1) * 2 + (id % 2)) * 20}% ${CARD_ROW[c.color] * 20}%` }; };
const nobleArt = (id: number) => ({ backgroundImage: `url(${noblesArt})`, backgroundPosition: `${(id % 5) * 25}% ${Math.floor(id / 5) * 50}%` });
const LEVEL_T: Term[] = [terms.card, terms.level1, terms.level2, terms.level3];
const levelName = (l: number) => tx(LEVEL_T[l]!);

export function Chip({ t, n, size = 'md', on }: { t: Token; n?: number; size?: 'sm' | 'md'; on?: boolean }) {
  useTermsLang();
  return (
    <span className={['sp-chip', `sp-chip--${size}`, `sp-t--${t}`, on ? 'sp-chip--on' : ''].join(' ')} aria-label={n === undefined ? gemName(t) : `${fa(n)} ${gemName(t)}`}>
      <img src={GEM_ART[t]} alt="" draggable={false} />
      {n !== undefined && <b key={n} className="bg-pop">{fa(n)}</b>}
    </span>
  );
}

export function DevCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  useTermsLang();
  const c = CARDS[id]!;
  return (
    <span className={['sp-card', `sp-card--${size}`, `sp-t--${c.color}`, `sp-l--${c.level}`].join(' ')} aria-label={`${gemName(c.color)}، ${fa(c.points)} ${tx(terms.prestige)}، ${tx(terms.cost)}: ${GEMS.filter((g) => c.cost[g]).map((g) => `${fa(c.cost[g]!)} ${gemName(g)}`).join('، ')}`}>
      <span className="sp-card__art" style={cardArt(id)} aria-hidden="true" />
      <span className="sp-card__top"><b className="sp-card__pts">{c.points ? fa(c.points) : ''}</b><Chip t={c.color} size="sm" /></span>
      <span className="sp-card__tier" aria-hidden="true">{Array.from({ length: c.level }, (_, i) => <i key={i} />)}</span>
      <span className="sp-card__cost">{GEMS.filter((g) => c.cost[g]).map((g) => <span key={g} className={`sp-cost sp-t--${g}`}>{fa(c.cost[g]!)}</span>)}</span>
    </span>
  );
}

export function NobleTile({ id }: { id: number }) {
  useTermsLang();
  const n = NOBLES[id]!;
  return (
    <span className="sp-noble" aria-label={`${tx(terms.noble)}: ${GEMS.filter((g) => n.need[g]).map((g) => `${fa(n.need[g]!)} ${gemName(g)}`).join('، ')}`}>
      <span className="sp-noble__face" style={nobleArt(id)} aria-hidden="true" />
      <b className="sp-noble__pts"><span>۳</span></b>
      <span className="sp-noble__need">{GEMS.filter((g) => n.need[g]).map((g) => <span key={g} className={`sp-req sp-t--${g}`}>{fa(n.need[g]!)}</span>)}</span>
    </span>
  );
}

/**
 * Undo-window preview: my move applied with what the client already knows (the same arithmetic as the rules) — gems
 * taken or returned, a card bought (paid) or reserved (+gold). The market refill, a blind reserve and noble visits
 * are left to the server's answer.
 */
function preview(v: SplendorView, me: number, q: GameAction | null | undefined): SplendorView {
  if (!q || me < 0) return v;
  const bank = { ...v.bank }, tokens = v.tokens.map((t) => ({ ...t })), t = tokens[me]!;
  const off = (card: number) => ({ market: v.market.map((r) => r.map((x) => (x === card ? null : x))), reserved: v.reserved.map((r, k) => (k === me ? r.filter((x) => x !== card) : r)) });
  switch (q.type) {
    case 'take': for (const g of q.gems as Gem[]) { bank[g] -= 1; t[g] += 1; } return { ...v, bank, tokens, last: { seat: me, kind: 'take', gems: q.gems as Gem[] } };
    case 'return': for (const g of q.gems as Token[]) { bank[g] += 1; t[g] -= 1; } return { ...v, bank, tokens, last: { seat: me, kind: 'return', gems: q.gems as Token[] } };
    case 'reserve': {
      if (typeof q.card !== 'number') return v;
      const { market } = off(q.card);
      if (bank.o > 0) { bank.o -= 1; t.o += 1; }
      return { ...v, bank, tokens, market, reserved: v.reserved.map((r, k) => (k === me ? [...r, q.card as number] : r)), last: { seat: me, kind: 'reserve', card: q.card } };
    }
    case 'buy': {
      const card = q.card as number, pay = payment(v.tokens[me]!, v.bought[me]!, card);
      if (!pay) return v;
      for (const k of Object.keys(pay) as Token[]) { t[k] -= pay[k]; bank[k] += pay[k]; }
      return { ...v, bank, tokens, ...off(card), bought: v.bought.map((b, k) => (k === me ? [...b, card] : b)), points: v.points.map((p, k) => (k === me ? p + CARDS[card]!.points : p)), last: { seat: me, kind: 'buy', card } };
    }
    default: return v;
  }
}

export default function SplendorRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction: send, expected, queued }: GameRendererProps<SplendorView>) {
  useTermsLang();
  const me = mySeat ?? -1;
  const view = preview(served, me, queued);
  // Cards glide deck → market → reserved/ledger, nobles → their owner, and gems fly bank ↔ player; my own move is
  // previewed in the undo window and animates back on undo.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const take = legalActions.find((a) => a.type === 'take') as { colors: Gem[]; need: number } | undefined;
  const pairs = new Set(legalActions.filter((a) => a.type === 'take2').map((a) => a.color as Gem));
  const reservable = new Set(legalActions.filter((a) => a.type === 'reserve' && a.card !== undefined).map((a) => a.card as number));
  const blindLevels = new Set(legalActions.filter((a) => a.type === 'reserve' && a.level !== undefined).map((a) => a.level as number));
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.card as number));
  const ret = legalActions.find((a) => a.type === 'return') as { count: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const [sel, setSel] = useState<Gem[]>([]);
  const [card, setCard] = useState<number | null>(null);
  const [back, setBack] = useState<Token[]>([]);
  useEffect(() => { setSel([]); setCard(null); setBack([]); }, [view.seq]);
  const onAction = (a: GameAction) => { setSel([]); setCard(null); setBack([]); send(a); };
  const hint = expected as unknown as { type: string; gems?: Gem[]; card?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = !!take || pairs.size > 0 || buyable.size > 0 || reservable.size > 0 || !!ret || canPass;
  const pairPick = sel.length === 2 && sel[0] === sel[1];
  const takeOk = !!take && (pairPick || (sel.length === take.need && new Set(sel).size === sel.length));

  const tapGem = (g: Gem) => {
    if (!take && !pairs.size) return;
    setCard(null);
    if (sel.includes(g) && sel.length === 1 && pairs.has(g)) setSel([g, g]);
    else if (sel.includes(g)) setSel(sel.filter((x) => x !== g));
    else if (pairPick) setSel([g]);
    else if (sel.length < 3 && take?.colors.includes(g)) setSel([...sel, g]);
  };

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : ret ? { tone: 'mine' as const, text: `بیش از ده ${tx(terms.gem)} دارید: ${fa(ret.count)} تا ${tx(terms.returnV)}` }
      : myTurn ? { tone: 'mine' as const, text: view.ending ? `${tx(terms.lastRound)}! ${tx(terms.gem)} ${tx(terms.takeV)} یا ${tx(terms.card)} ${tx(terms.buyV)}/${tx(terms.reserve)} کنید` : `${tx(terms.gem)} ${tx(terms.takeV)} یا ${tx(terms.card)} ${tx(terms.buyV)}/${tx(terms.reserve)} کنید` }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}${view.ending ? ` (${tx(terms.lastRound)})` : ''}` };
  const framed = useInFrame() !== null; // the shell draws players, points and whose-turn
  const order = mySeat === null ? view.tokens.map((_, k) => k) : [...view.tokens.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const cardHint = (id: number) => hint?.type === 'buy' && hint.card === id;
  const last = view.last;
  const bought = last?.kind === 'buy' ? last.card : undefined;
  const gemImg = (g: Token, id: string, from: string) => <img key={id} className="sp-took" src={GEM_ART[g]} alt="" draggable={false} data-flip={id} data-flip-from={from} />;

  const cardBtn = (id: number) => {
    const sel_ = card === id;
    const can = buyable.has(id) || reservable.has(id);
    return (
      <button key={id} type="button" data-flip={`card-${id}`} data-flip-from={`deck-${CARDS[id]!.level}`} className={['sp-slot', sel_ ? 'sp-slot--on' : '', buyable.has(id) ? 'sp-slot--buy' : '', cardHint(id) && !sel_ ? 'sp-hint' : ''].join(' ')}
        disabled={!can || busy} onClick={() => { setSel([]); setCard(sel_ ? null : id); }} aria-pressed={sel_}><DevCard id={id} /></button>
    );
  };

  // Rivals' ledgers move beside the bank on desktop frames only (phones keep them in the list under the market).
  const side = framed && !view.outcome && order.some((k) => k !== mySeat) && typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
  const ledger = (s: number) => {
          const b = bonuses(view.bought[s]!);
          const t = view.tokens[s]!;
          const isMe = s === mySeat;
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['sp-pl', view.current === s && !view.outcome ? 'sp-pl--turn' : '', isMe ? 'sp-pl--me' : '', place === 1 ? 'sp-pl--win' : ''].join(' ')}>
              <div className="sp-pl__head">
                {!framed && place && <b className="sp-pl__place">{fa(place)}</b>}
                <bdi className="sp-pl__name">{who(s)}</bdi>
                {!framed && <span className="sp-pl__pts bg-pop" key={view.points[s]}>{fa(view.points[s]!)} <T t={terms.prestige} /></span>}
                {!framed && view.visited[s]!.length > 0 && <span className="sp-pl__nob" data-flip={last?.seat === s && last.noble !== undefined ? `noble-${last.noble}` : undefined}>{fa(view.visited[s]!.length)} <T t={terms.noble} /></span>}
                {last?.kind === 'take' && last.seat === s && last.gems?.map((g, i) => gemImg(g, `took-${s}-${g}-${i}`, `bank-${g}`))}
              </div>
              <div className="sp-pl__grid">
                <span className="sp-col sp-col--lbl" aria-hidden="true"><small><T t={terms.card} /></small><small><T t={terms.token} /></small></span>
                {GEMS.map((g) => (
                  <span key={g} className={`sp-col sp-t--${g}`}>
                    <span className="sp-col__bonus" title={tx(terms.card)} data-flip={bought !== undefined && last?.seat === s && CARDS[bought]!.color === g ? `card-${bought}` : undefined}>{fa(b[g])}</span>
                    {isMe && ret && t[g] > 0
                      ? <button type="button" className={`sp-col__tok sp-col__tok--btn ${back.filter((x) => x === g).length ? 'on' : ''}`} disabled={back.filter((x) => x === g).length >= t[g]} aria-label={`${tx(terms.returnN)} ${gemName(g)}، ${fa(t[g] - back.filter((x) => x === g).length)} مانده`} onClick={() => setBack(back.length < ret.count && back.filter((x) => x === g).length < t[g] ? [...back, g] : back)}>{fa(t[g] - back.filter((x) => x === g).length)}</button>
                      : <span className="sp-col__tok bg-pop" key={t[g]}>{fa(t[g])}</span>}
                  </span>
                ))}
                <span className="sp-col sp-t--o"><span className="sp-col__bonus">&nbsp;</span>
                  {isMe && ret && t.o > 0 ? <button type="button" className="sp-col__tok sp-col__tok--btn" disabled={back.filter((x) => x === 'o').length >= t.o} aria-label={`${tx(terms.returnN)} ${gemName('o')}، ${fa(t.o - back.filter((x) => x === 'o').length)} مانده`} onClick={() => setBack(back.length < ret.count && back.filter((x) => x === 'o').length < t.o ? [...back, 'o'] : back)}>{fa(t.o - back.filter((x) => x === 'o').length)}</button> : <span className="sp-col__tok">{fa(t.o)}</span>}</span>
              </div>
              {view.reserved[s]!.length > 0 && (
                <div className="sp-pl__res" aria-label={tx(terms.reserves)}>
                  {view.reserved[s]!.map((r, i) => (typeof r === 'number'
                    ? (isMe ? cardBtn(r) : <span key={i} data-flip={`card-${r}`} data-flip-from={`deck-${CARDS[r]!.level}`}><DevCard id={r} size="sm" /></span>)
                    : <span key={i} data-flip={`blind-${s}-${i}`} data-flip-from={`deck-${r.level}`} className={`sp-deck sp-deck--sm sp-l--${r.level}`}><span>{levelName(r.level)}</span></span>))}
                </div>
              )}
            </li>
          );
        };
  return (
    <div className={framed ? 'sp sp--framed' : 'sp'} ref={root} data-seq={served.seq} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>اولین کسی که به ۱۵ <T t={terms.prestige} /> برسد، پس از پایان <T t={terms.round} />، برنده است. هر نوبت فقط یک کار: سه <T t={terms.gem} /> ناهمرنگ، دو <T t={terms.gem} /> هم‌رنگ، <T t={terms.reserve} /> یا <T t={terms.buyN} />.</p>
        </RailSlot>
      )}

      <div className="sp__nobles" aria-label={tx(terms.nobles)}>{view.nobles.map((n) => <span key={n} data-flip={`noble-${n}`}><NobleTile id={n} /></span>)}</div>

      <div className="sp__table">
      {side && <ul className="sp__players sp__players--side" aria-label="حریف‌ها">{order.filter((k) => k !== mySeat).map(ledger)}</ul>}
      <section className="sp__bank" aria-label={`${tx(terms.bank)} ${tx(terms.gem)}`}>
          {(['w', 'u', 'g', 'r', 'k', 'o'] as Token[]).map((t) => {
            const n = sel.filter((x) => x === t).length;
            const can = t !== 'o' && (take?.colors.includes(t as Gem) || pairs.has(t as Gem)) && !busy;
            return (
              <button key={t} type="button" data-flip-anchor={`bank-${t}`} className={['sp-bankgem', n ? 'sp-bankgem--on' : '', hint?.type === 'take' && hint.gems?.includes(t as Gem) && !n ? 'sp-hint' : ''].join(' ')}
                disabled={!can} onClick={() => tapGem(t as Gem)} aria-pressed={n > 0}>
                <Chip t={t} n={view.bank[t]} />{n > 0 && <span className="sp-bankgem__sel">{n > 1 ? '×۲' : '✓'}</span>}
              </button>
            );
          })}
          {last?.kind === 'return' && last.gems?.map((g, i) => gemImg(g, `back-${last.seat}-${g}-${i}`, `seat-${last.seat}`))}
        </section>
      <section className="sp__market" aria-label={tx(terms.cards)}>
        {[2, 1, 0].map((l) => (
          <div key={l} className="sp__row">
            <button type="button" data-flip-anchor={`deck-${l + 1}`} className={`sp-deck sp-l--${l + 1}`} disabled={!blindLevels.has(l + 1) || busy || card !== null || sel.length > 0}
              onClick={() => onAction({ type: 'reserve', level: l + 1 })} aria-label={`${tx(terms.reserve)} ${tx(terms.card)} ناشناس ${levelName(l + 1)}`}>
              <span>{levelName(l + 1)}</span><b key={view.deckCounts[l]} className="bg-pop">{fa(view.deckCounts[l]!)}</b>
            </button>
            {view.market[l]!.map((id, i) => (id === null ? <span key={`e${i}`} className="sp-slot sp-slot--empty" /> : <span key={id}>{cardBtn(id)}</span>))}
          </div>
        ))}
      </section>
      </div>

      {card !== null && (
        <div className="sp__cardbar" role="group" aria-label={`${tx(terms.card)} انتخاب‌شده`}>
          {buyable.has(card) && <Button size="sm" disabled={busy} className={cardHint(card) ? 'sp-hint' : ''} onClick={() => onAction({ type: 'buy', card })}><T t={terms.buyN} /></Button>}
          {reservable.has(card) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'reserve', card })}><T t={terms.reserve} /> (+<T t={terms.gold} />)</Button>}
          {!buyable.has(card) && me >= 0 && <span className="sp__short">{tx(terms.missing)}: {(() => { const b = bonuses(view.bought[me]!); const t = view.tokens[me]!; const miss = GEMS.map((g) => ({ g, n: Math.max(0, (CARDS[card]!.cost[g] ?? 0) - b[g] - t[g]) })).filter((x) => x.n); const gap = miss.reduce((a, x) => a + x.n, 0) - t.o; return gap > 0 ? `${fa(gap)} ${tx(terms.gem)}` : '—'; })()}</span>}
        </div>
      )}

      
      {(take || pairs.size > 0) && (
        <div className="sp__takebar">
          <Button size="sm" disabled={!takeOk || busy} className={hint?.type === 'take' && takeOk ? 'sp-hint' : ''} onClick={() => onAction({ type: 'take', gems: sel })}>
            <T t={terms.takeN} /> {sel.length ? sel.map((g) => gemName(g)).join('، ') : tx(terms.gem)}
          </Button>
          {canPass && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}><T t={terms.passTurn} /></Button></DockSlot>}
        </div>
      )}

      {(() => {
        const list = view.outcome ? view.outcome.placements.map((x) => x.seat) : order;
        // Framed (reference): rivals' ledgers stand in a column beside the bank; yours stays under the market.
        const below = side ? list.filter((k) => k === mySeat) : list;
        return below.length > 0 && <ul className="sp__players" aria-label="بازیکنان">{below.map(ledger)}</ul>;
      })()}

      {ret && (
        <div className="sp__takebar">
          <span>{tx(terms.returnN)}: {back.map((g) => gemName(g)).join('، ') || '—'}</span>
          <Button size="sm" variant="secondary" onClick={() => setBack([])} disabled={!back.length}>از نو</Button>
          <Button size="sm" disabled={back.length !== ret.count || busy} onClick={() => onAction({ type: 'return', gems: back })}><T t={terms.returnN} /></Button>
        </div>
      )}
    </div>
  );
}

