// گوهرفروش renderer: a jeweller's velvet counter. Faceted gem tokens in the bank, three rows of development cards
// (deck tile + four cards) under the visiting nobles, rival ledgers with bonuses and tokens, and your own reserved
// cards. Tap gems to pick (three different, or the same gem twice for a pair); tap a card to buy or reserve it.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARDS, GEMS, NOBLES, bonuses, type Gem, type SplendorView, type Token } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const GEM_FA: Record<Token, string> = { w: 'الماس', u: 'یاقوت کبود', g: 'زمرد', r: 'یاقوت سرخ', k: 'عقیق سیاه', o: 'طلا' };
const LEVEL_FA = ['', 'معدن', 'کارگاه', 'کاروان'];

export function Chip({ t, n, size = 'md', on }: { t: Token; n?: number; size?: 'sm' | 'md'; on?: boolean }) {
  return (
    <span className={['sp-chip', `sp-chip--${size}`, `sp-t--${t}`, on ? 'sp-chip--on' : ''].join(' ')} aria-label={n === undefined ? GEM_FA[t] : `${fa(n)} ${GEM_FA[t]}`}>
      <svg viewBox="-20 -20 40 40" aria-hidden="true">
        <circle r="18.5" className="sp-chip__rim" /><circle r="15.5" className="sp-chip__edge" /><circle r="13" className="sp-chip__face" />
        {t === 'o'
          ? <g><path d="M0 -10 L2.9 -3.6 L9.5 -3 L4.5 1.6 L6 8.3 L0 5 L-6 8.3 L-4.5 1.6 L-9.5 -3 L-2.9 -3.6 Z" className="sp-chip__star" /><circle r="12" className="sp-chip__ring" /></g>
          : <g><path d="M-5 -9 H5 L3 -3.5 H-3 Z" className="sp-f sp-f1" /><path d="M-9 -3.5 L-5 -9 L-3 -3.5 Z" className="sp-f sp-f2" /><path d="M5 -9 L9 -3.5 L3 -3.5 Z" className="sp-f sp-f3" />
            <path d="M-9 -3.5 H-3 L0 9.5 Z" className="sp-f sp-f2" /><path d="M-3 -3.5 H3 L0 9.5 Z" className="sp-f sp-f1" /><path d="M3 -3.5 H9 L0 9.5 Z" className="sp-f sp-f4" />
            <path d="M-9 -3.5 L-5 -9 H5 L9 -3.5 L0 9.5 Z" className="sp-chip__gem" /></g>}
      </svg>
      {n !== undefined && <b>{fa(n)}</b>}
    </span>
  );
}

export function DevCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const c = CARDS[id]!;
  return (
    <span className={['sp-card', `sp-card--${size}`, `sp-t--${c.color}`, `sp-l--${c.level}`].join(' ')} aria-label={`${GEM_FA[c.color]}، ${fa(c.points)} اعتبار، قیمت: ${GEMS.filter((g) => c.cost[g]).map((g) => `${fa(c.cost[g]!)} ${GEM_FA[g]}`).join('، ')}`}>
      <span className="sp-card__top"><b className="sp-card__pts">{c.points ? fa(c.points) : ''}</b><Chip t={c.color} size="sm" /></span>
      <svg viewBox="-10 -10 20 20" className="sp-card__mark" aria-hidden="true"><path d="M0 -9 L8 -3 L5 8 H-5 L-8 -3 Z" /><path d="M-8 -3 H8 M0 -9 L-3 -3 L0 8 L3 -3 Z" className="sp-card__cut" /></svg>
      <span className="sp-card__tier" aria-hidden="true">{Array.from({ length: c.level }, (_, i) => <i key={i} />)}</span>
      <span className="sp-card__cost">{GEMS.filter((g) => c.cost[g]).map((g) => <span key={g} className={`sp-cost sp-t--${g}`}>{fa(c.cost[g]!)}</span>)}</span>
    </span>
  );
}

export function NobleTile({ id }: { id: number }) {
  const n = NOBLES[id]!;
  return (
    <span className="sp-noble" aria-label={`بزرگ: ${GEMS.filter((g) => n.need[g]).map((g) => `${fa(n.need[g]!)} ${GEM_FA[g]}`).join('، ')}`}>
      <svg viewBox="-20 -20 40 40" className="sp-noble__face" aria-hidden="true">
        <ellipse rx="16" ry="18.5" className="sp-noble__frame" /><ellipse rx="13.5" ry="16" className="sp-noble__cameo" />
        <path d="M-12 16 Q-11 7 0 6 Q11 7 12 16 Q0 20 -12 16 Z" className="sp-noble__robe" /><path d="M-3 6.5 L0 12 L3 6.5 Z" className="sp-noble__ruff" />
        <ellipse cx="0" cy="-1" rx="5.4" ry="6.4" className="sp-noble__skin" />
        <path d="M-6.5 -2 Q-8 -12 0 -12.5 Q8 -12 6.5 -2 Q4 -7 0 -7 Q-4 -7 -6.5 -2 Z" className="sp-noble__hair" /><path d="M-7 -9 L-4 -14 L-1.5 -10.5 L0 -15 L1.5 -10.5 L4 -14 L7 -9 Z" className="sp-noble__crown" />
      </svg>
      <b className="sp-noble__pts"><span>۳</span></b>
      <span className="sp-noble__need">{GEMS.filter((g) => n.need[g]).map((g) => <span key={g} className={`sp-req sp-t--${g}`}>{fa(n.need[g]!)}</span>)}</span>
    </span>
  );
}

export default function SplendorRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SplendorView>) {
  const me = mySeat ?? -1;
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
    : ret ? { tone: 'mine' as const, text: `بیش از ده گوهر دارید: ${fa(ret.count)} تا پس بدهید` }
      : myTurn ? { tone: 'mine' as const, text: view.ending ? 'دور آخر! گوهر بردارید یا کارت بخرید/رزرو کنید' : 'گوهر بردارید یا کارت بخرید/رزرو کنید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}${view.ending ? ' (دور آخر)' : ''}` };
  const order = mySeat === null ? view.tokens.map((_, k) => k) : [...view.tokens.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const cardHint = (id: number) => hint?.type === 'buy' && hint.card === id;
  const lastCard = view.last?.kind === 'buy' || view.last?.kind === 'reserve' ? view.last.card : undefined;

  const cardBtn = (id: number) => {
    const sel_ = card === id;
    const can = buyable.has(id) || reservable.has(id);
    return (
      <button key={id} type="button" className={['sp-slot', sel_ ? 'sp-slot--on' : '', buyable.has(id) ? 'sp-slot--buy' : '', cardHint(id) && !sel_ ? 'sp-hint' : ''].join(' ')}
        disabled={!can || busy} onClick={() => { setSel([]); setCard(sel_ ? null : id); }} aria-pressed={sel_}><DevCard id={id} /></button>
    );
  };

  return (
    <div className="sp" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="sp__nobles" aria-label="بزرگان">{view.nobles.map((n) => <NobleTile key={n} id={n} />)}</div>

      <section className="sp__market" aria-label="کارت‌ها">
        {[2, 1, 0].map((l) => (
          <div key={l} className="sp__row">
            <button type="button" className={`sp-deck sp-l--${l + 1}`} disabled={!blindLevels.has(l + 1) || busy || card !== null || sel.length > 0}
              onClick={() => onAction({ type: 'reserve', level: l + 1 })} aria-label={`رزرو کارت ناشناس ${LEVEL_FA[l + 1]}`}>
              <span>{LEVEL_FA[l + 1]}</span><b>{fa(view.deckCounts[l]!)}</b>
            </button>
            {view.market[l]!.map((id, i) => (id === null ? <span key={`e${i}`} className="sp-slot sp-slot--empty" /> : <span key={id} className={id === lastCard ? 'sp-fresh' : ''}>{cardBtn(id)}</span>))}
          </div>
        ))}
      </section>

      {card !== null && (
        <div className="sp__cardbar" role="group" aria-label="کارت انتخاب‌شده">
          {buyable.has(card) && <Button size="sm" disabled={busy} className={cardHint(card) ? 'sp-hint' : ''} onClick={() => onAction({ type: 'buy', card })}>خرید</Button>}
          {reservable.has(card) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'reserve', card })}>رزرو (+طلا)</Button>}
          {!buyable.has(card) && me >= 0 && <span className="sp__short">کمبود: {(() => { const b = bonuses(view.bought[me]!); const t = view.tokens[me]!; const miss = GEMS.map((g) => ({ g, n: Math.max(0, (CARDS[card]!.cost[g] ?? 0) - b[g] - t[g]) })).filter((x) => x.n); const gap = miss.reduce((a, x) => a + x.n, 0) - t.o; return gap > 0 ? `${fa(gap)} گوهر` : '—'; })()}</span>}
        </div>
      )}

      <section className="sp__bank" aria-label="بانک گوهر">
        {(['w', 'u', 'g', 'r', 'k', 'o'] as Token[]).map((t) => {
          const n = sel.filter((x) => x === t).length;
          const can = t !== 'o' && (take?.colors.includes(t as Gem) || pairs.has(t as Gem)) && !busy;
          return (
            <button key={t} type="button" className={['sp-bankgem', n ? 'sp-bankgem--on' : '', hint?.type === 'take' && hint.gems?.includes(t as Gem) && !n ? 'sp-hint' : ''].join(' ')}
              disabled={!can} onClick={() => tapGem(t as Gem)} aria-pressed={n > 0}>
              <Chip t={t} n={view.bank[t]} />{n > 0 && <span className="sp-bankgem__sel">{n > 1 ? '×۲' : '✓'}</span>}
            </button>
          );
        })}
      </section>
      {(take || pairs.size > 0) && (
        <div className="sp__takebar">
          <Button size="sm" disabled={!takeOk || busy} className={hint?.type === 'take' && takeOk ? 'sp-hint' : ''} onClick={() => onAction({ type: 'take', gems: sel })}>
            برداشتن {sel.length ? sel.map((g) => GEM_FA[g]).join('، ') : 'گوهر'}
          </Button>
          {canPass && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>رد کردن نوبت</Button>}
        </div>
      )}

      <ul className="sp__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const b = bonuses(view.bought[s]!);
          const t = view.tokens[s]!;
          const isMe = s === mySeat;
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} className={['sp-pl', view.current === s && !view.outcome ? 'sp-pl--turn' : '', isMe ? 'sp-pl--me' : '', place === 1 ? 'sp-pl--win' : ''].join(' ')}>
              <div className="sp-pl__head">
                {place && <b className="sp-pl__place">{fa(place)}</b>}
                <bdi className="sp-pl__name">{who(s)}</bdi>
                <span className="sp-pl__pts" key={view.points[s]}>{fa(view.points[s]!)} اعتبار</span>
                {view.visited[s]!.length > 0 && <span className="sp-pl__nob">{fa(view.visited[s]!.length)} بزرگ</span>}
              </div>
              <div className="sp-pl__grid">
                {GEMS.map((g) => (
                  <span key={g} className={`sp-col sp-t--${g}`}>
                    <span className="sp-col__bonus" title="کارت">{fa(b[g])}</span>
                    {isMe && ret && t[g] > 0
                      ? <button type="button" className={`sp-col__tok sp-col__tok--btn ${back.filter((x) => x === g).length ? 'on' : ''}`} disabled={back.filter((x) => x === g).length >= t[g]} aria-label={`پس دادن ${GEM_FA[g]}، ${fa(t[g] - back.filter((x) => x === g).length)} مانده`} onClick={() => setBack(back.length < ret.count && back.filter((x) => x === g).length < t[g] ? [...back, g] : back)}>{fa(t[g] - back.filter((x) => x === g).length)}</button>
                      : <span className="sp-col__tok">{fa(t[g])}</span>}
                  </span>
                ))}
                <span className="sp-col sp-t--o"><span className="sp-col__bonus">&nbsp;</span>
                  {isMe && ret && t.o > 0 ? <button type="button" className="sp-col__tok sp-col__tok--btn" disabled={back.filter((x) => x === 'o').length >= t.o} aria-label={`پس دادن ${GEM_FA.o}، ${fa(t.o - back.filter((x) => x === 'o').length)} مانده`} onClick={() => setBack(back.length < ret.count && back.filter((x) => x === 'o').length < t.o ? [...back, 'o'] : back)}>{fa(t.o - back.filter((x) => x === 'o').length)}</button> : <span className="sp-col__tok">{fa(t.o)}</span>}</span>
              </div>
              {view.reserved[s]!.length > 0 && (
                <div className="sp-pl__res" aria-label="رزروها">
                  {view.reserved[s]!.map((r, i) => (typeof r === 'number'
                    ? (isMe ? cardBtn(r) : <DevCard key={i} id={r} size="sm" />)
                    : <span key={i} className={`sp-deck sp-deck--sm sp-l--${r.level}`}><span>{LEVEL_FA[r.level]}</span></span>))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {ret && (
        <div className="sp__takebar">
          <span>پس دادن: {back.map((g) => GEM_FA[g]).join('، ') || '—'}</span>
          <Button size="sm" variant="secondary" onClick={() => setBack([])} disabled={!back.length}>از نو</Button>
          <Button size="sm" disabled={back.length !== ret.count || busy} onClick={() => onAction({ type: 'return', gems: back })}>پس دادن</Button>
        </div>
      )}
    </div>
  );
}

