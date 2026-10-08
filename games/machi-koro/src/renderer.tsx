// شهر تاس renderer: a toy-town board. Dice tumble in the middle; the supply row shows every establishment with its
// numbers, colour and price; each player's street lists their cards, coins and the four landmarks (lit when built).
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARD_DEFS, DEF, LANDMARKS, type CardKey, type Landmark, type MachiView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CARD_FA: Record<CardKey, string> = {
  wheat: 'گندم‌زار', ranch: 'دامداری', bakery: 'نانوایی', cafe: 'قهوه‌خانه', store: 'بقالی', forest: 'جنگل', stadium: 'ورزشگاه', tv: 'ایستگاه تلویزیون',
  business: 'مرکز تجاری', cheese: 'پنیرسازی', furniture: 'مبل‌سازی', mine: 'معدن', restaurant: 'رستوران', orchard: 'باغ میوه', market: 'بازار میوه'
};
export const LANDMARK_FA: Record<Landmark, string> = { station: 'ایستگاه قطار', mall: 'مرکز خرید', park: 'شهربازی', radio: 'برج رادیو' };
const EFFECT: Record<CardKey, string> = {
  wheat: '+۱', ranch: '+۱', bakery: '+۱', cafe: '۱ از تاس‌انداز', store: '+۳', forest: '+۱', stadium: '۲ از هر نفر', tv: '۵ از یک نفر', business: 'جابه‌جایی کارت',
  cheese: '+۳ هر دامداری', furniture: '+۳ هر جنگل/معدن', mine: '+۵', restaurant: '۲ از تاس‌انداز', orchard: '+۳', market: '+۲ هر گندم/باغ'
};

const Die = ({ v }: { v: number }) => {
  const pips: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  return <svg viewBox="-12 -12 24 24" className="mk-die" aria-label={`تاس ${fa(v)}`}><rect x="-11" y="-11" width="22" height="22" rx="4" />{pips[v]!.map(([x, y], i) => <circle key={i} cx={x * 6} cy={y * 6} r="2.2" />)}</svg>;
};

export function TownCard({ k, count }: { k: CardKey; count?: number }) {
  const d = DEF[k];
  return (
    <span className={`mk-card mk-col--${d.color}`}>
      <b className="mk-card__rolls">{d.rolls.map(fa).join('–')}</b>
      <span className="mk-card__name">{CARD_FA[k]}</span>
      <small>{EFFECT[k]}</small>
      {count !== undefined && <i className="mk-card__count">×{fa(count)}</i>}
    </span>
  );
}

export default function MachiRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<MachiView>) {
  const me = mySeat ?? -1;
  const rolls = legalActions.filter((a) => a.type === 'roll').map((a) => a.dice as number);
  const canKeep = legalActions.some((a) => a.type === 'keep');
  const builds = new Set(legalActions.filter((a) => a.type === 'build' && a.card).map((a) => a.card as CardKey));
  const lms = new Set(legalActions.filter((a) => a.type === 'build' && a.landmark).map((a) => a.landmark as Landmark));
  const canPass = legalActions.some((a) => a.type === 'pass');
  const [give, setGive] = useState<CardKey | ''>('');
  const [target, setTarget] = useState<number>(-1);
  const [take, setTake] = useState<CardKey | ''>('');
  useEffect(() => { setGive(''); setTarget(-1); setTake(''); }, [view.seq]);
  const hint = expected as unknown as { type: string; dice?: number; landmark?: Landmark; card?: CardKey } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = view.current === me && !view.outcome;
  const status = view.outcome ? null
    : myTurn ? {
      tone: 'mine' as const,
      text: view.phase === 'roll' ? 'تاس بریزید' : view.phase === 'reroll' ? 'دوباره می‌ریزید یا همین را نگه می‌دارید؟' : view.phase === 'tv' ? 'از چه کسی ۵ سکه می‌گیرید؟' : view.phase === 'swap' ? 'یک کارت را عوض می‌کنید؟' : 'یک مغازه یا بنای بزرگ بسازید'
    }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const others = view.coins.map((_, k) => k).filter((k) => k !== me);
  const swapOk = give && take && target >= 0;

  return (
    <div className="mk" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="mk__dice" aria-label="تاس‌ها">
        <span className="mk__diceRow" key={view.seq}>{view.dice.length ? view.dice.map((v, i) => <Die key={i} v={v} />) : <span className="mk__noDice">—</span>}</span>
        {view.dice.length > 0 && <b className="mk__sum">{fa(view.dice.reduce((a, b) => a + b, 0))}</b>}
        {view.dice.length > 0 && <span className="mk__income">{view.income.map((g, k) => (g ? <span key={k} className={g > 0 ? 'up' : 'down'}><bdi>{who(k)}</bdi> {g > 0 ? '+' : '−'}{fa(Math.abs(g))}</span> : null))}</span>}
      </section>

      {myTurn && (rolls.length > 0 || canKeep) && (
        <div className="mk__bar">
          {rolls.map((n) => <Button key={n} size="sm" disabled={busy} className={hint?.type === 'roll' && hint.dice === n ? 'mk-hint' : ''} onClick={() => onAction({ type: 'roll', dice: n })}>{view.phase === 'reroll' ? 'دوباره' : 'ریختن'} {fa(n)} تاس</Button>)}
          {canKeep && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'keep' })}>همین را نگه دار</Button>}
        </div>
      )}
      {myTurn && view.phase === 'tv' && (
        <div className="mk__bar">{others.map((k) => <Button key={k} size="sm" disabled={busy} onClick={() => onAction({ type: 'tv', target: k })}>از <bdi>{who(k)}</bdi> ({fa(view.coins[k]!)} سکه)</Button>)}</div>
      )}
      {myTurn && view.phase === 'swap' && (
        <div className="mk__bar mk__swap">
          <select value={give} onChange={(e) => setGive(e.target.value as CardKey)} aria-label="کارتی که می‌دهید"><option value="">کارت شما…</option>{CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[me]![d.key]).map((d) => <option key={d.key} value={d.key}>{CARD_FA[d.key]}</option>)}</select>
          <select value={target} onChange={(e) => { setTarget(Number(e.target.value)); setTake(''); }} aria-label="بازیکن"><option value={-1}>با…</option>{others.map((k) => <option key={k} value={k}>{who(k)}</option>)}</select>
          <select value={take} onChange={(e) => setTake(e.target.value as CardKey)} aria-label="کارتی که می‌گیرید" disabled={target < 0}><option value="">کارت او…</option>{target >= 0 && CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[target]![d.key]).map((d) => <option key={d.key} value={d.key}>{CARD_FA[d.key]}</option>)}</select>
          <Button size="sm" disabled={!swapOk || busy} onClick={() => onAction({ type: 'swap', give: give as CardKey, target, take: take as CardKey })}>عوض کن</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'noSwap' })}>نه</Button>
        </div>
      )}

      {!view.outcome && (
        <section className="mk__supply" aria-label="بازار ساخت">
          {CARD_DEFS.map((d) => (
            <button key={d.key} type="button" className={['mk-buy', hint?.card === d.key ? 'mk-hint' : ''].join(' ')} disabled={!builds.has(d.key) || busy}
              onClick={() => onAction({ type: 'build', card: d.key })} aria-label={`ساختن ${CARD_FA[d.key]} به قیمت ${fa(d.cost)}`}>
              <TownCard k={d.key} /><span className="mk-buy__cost">{fa(d.cost)} سکه، {fa(view.supply[d.key])} مانده</span>
            </button>
          ))}
        </section>
      )}
      {myTurn && view.phase === 'build' && (
        <div className="mk__bar">
          {LANDMARKS.filter((l) => !view.landmarks[me]![l.key]).map((l) => (
            <Button key={l.key} size="sm" disabled={!lms.has(l.key) || busy} className={hint?.landmark === l.key ? 'mk-hint' : ''} onClick={() => onAction({ type: 'build', landmark: l.key })}>{LANDMARK_FA[l.key]} ({fa(l.cost)})</Button>
          ))}
          {canPass && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>چیزی نمی‌سازم</Button>}
        </div>
      )}

      <ul className="mk__players" aria-label="شهرها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.coins.map((_, k) => k)).map((s) => (
          <li key={s} className={['mk-pl', view.current === s && !view.outcome ? 'mk-pl--turn' : '', s === me ? 'mk-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'mk-pl--win' : ''].join(' ')}>
            <div className="mk-pl__head"><bdi className="mk-pl__name">{who(s)}</bdi><span className="mk-pl__coins" key={view.coins[s]}>{fa(view.coins[s]!)} سکه</span></div>
            <div className="mk-pl__lms">{LANDMARKS.map((l) => <span key={l.key} className={`mk-lm ${view.landmarks[s]![l.key] ? 'mk-lm--on' : ''}`} title={LANDMARK_FA[l.key]}>{LANDMARK_FA[l.key]}</span>)}</div>
            <div className="mk-pl__cards">{CARD_DEFS.filter((d) => view.cards[s]![d.key]).map((d) => <TownCard key={d.key} k={d.key} count={view.cards[s]![d.key]} />)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
