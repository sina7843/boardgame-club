// سوشی گردان renderer: a sushi bar. Your hand rides a conveyor belt of plates; everyone's tableau sits on a wooden
// geta board grouped by dish, with running set points; the plates just revealed pop in.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import tempura from './art/tempura.webp';
import sashimi from './art/sashimi.webp';
import dumpling from './art/dumpling.webp';
import maki from './art/maki.webp';
import salmon from './art/salmon.webp';
import squid from './art/squid.webp';
import egg from './art/egg.webp';
import pudding from './art/pudding.webp';
import wasabi from './art/wasabi.webp';
import chopsticks from './art/chopsticks.webp';
import { MAKI, setScore, type Kind, type Played, type SushiGoView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const NAME: Record<Kind, string> = {
  tempura: 'تمپورا', sashimi: 'ساشیمی', dumpling: 'دامپلینگ', maki1: 'ماکی ۱', maki2: 'ماکی ۲', maki3: 'ماکی ۳', salmon: 'نیگیری سالمون',
  squid: 'نیگیری ماهی مرکب', egg: 'نیگیری تخم‌مرغ', pudding: 'پودینگ', wasabi: 'واسابی', chopsticks: 'چاپستیک'
};
const NOTE: Record<Kind, string> = {
  tempura: 'دوتا = ۵', sashimi: 'سه‌تا = ۱۰', dumpling: '۱ ۳ ۶ ۱۰ ۱۵', maki1: 'رول بیشتر', maki2: 'رول بیشتر', maki3: 'رول بیشتر', salmon: '۲',
  squid: '۳', egg: '۱', pudding: 'آخر بازی', wasabi: 'نیگیری ×۳', chopsticks: 'بعداً دو کارت'
};
const ORDER: Kind[] = ['wasabi', 'squid', 'salmon', 'egg', 'tempura', 'sashimi', 'dumpling', 'maki3', 'maki2', 'maki1', 'pudding', 'chopsticks'];

// Dish art is cut from a generated sprite sheet (see DECISIONS.md); maki repeats the roll by its count.
const ART: Record<Kind, string> = {
  tempura, sashimi, dumpling, maki1: maki, maki2: maki, maki3: maki, salmon, squid, egg, pudding, wasabi, chopsticks
};

function Dish({ k }: { k: Kind }) {
  const c = MAKI[k] ?? 0;
  if (!c) return <image href={ART[k]} x="-19" y="-19" width="38" height="38" />;
  const xs = c === 1 ? [0] : c === 2 ? [-9, 9] : [-12, 0, 12], w = c === 1 ? 36 : c === 2 ? 24 : 20;
  return <g>{xs.map((x) => <image key={x} href={maki} x={x - w / 2} y={-w / 2} width={w} height={w} />)}</g>;
}

export function Plate({ k, size = 'md', fresh, wasabi, flip, flipFrom }: { k: Kind; size?: 'sm' | 'md'; fresh?: boolean; wasabi?: boolean; flip?: string; flipFrom?: string }) {
  return (
    <span className={['sg-plate', `sg-plate--${size}`, `sg-k--${k}`, fresh ? 'sg-plate--fresh' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom}>
      <svg viewBox="-30 -30 60 60" aria-hidden="true">
        <circle r="28" className="sg-plate__rim" /><circle r="22" className="sg-plate__in" />
        {wasabi && <path d="M-22 14 Q-24 6 -16 4 Q-14 -2 -8 2 Q0 4 -2 12 Q-4 20 -22 14 Z" fill="#7cb342" opacity=".9" />}
        <Dish k={k} />
      </svg>
      {size === 'md' && <span className="sg-plate__name">{NAME[k]}</span>}
      {size === 'md' && <span className="sg-plate__note">{NOTE[k]}</span>}
    </span>
  );
}

function Tableau({ t, fresh, seat, from }: { t: Played[]; fresh: Kind[]; seat: number; from: string }) {
  const groups = ORDER.map((k) => ({ k, items: t.filter((c) => c.kind === k) })).filter((g) => g.items.length);
  const maki = t.reduce((a, c) => a + (MAKI[c.kind] ?? 0), 0);
  if (!t.length) return <div className="sg-tab sg-tab--empty">—</div>;
  return (
    <div className="sg-tab">
      {groups.map(({ k, items }) => (
        <span key={k} className="sg-tab__g" title={NAME[k]}>
          {items.map((c, i) => <Plate key={i} k={k} size="sm" wasabi={c.wasabi} fresh={fresh.includes(k) && i === items.length - 1} flip={`t-${seat}-${k}-${i}`} flipFrom={from} />)}
        </span>
      ))}
      <span className="sg-tab__sum">{fa(setScore(t))} امتیاز{maki ? `، ${fa(maki)} رول` : ''}</span>
    </div>
  );
}

export default function SushiGoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SushiGoView>) {
  const can = new Set(legalActions.filter((a) => a.type === 'pick').map((a) => a.card as Kind));
  const canChop = legalActions.some((a) => a.type === 'chopsticks');
  const [chop, setChop] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  useEffect(() => { setChop(false); setFirst(null); }, [view.seq]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const hint = expected as unknown as { type: string; card?: Kind } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const me = mySeat ?? -1;
  const myPick = me >= 0 ? view.picked[me] : false;
  const order = mySeat === null ? view.scores.map((_, k) => k) : [...view.scores.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const waiting = view.picked.map((p, k) => (p === false ? k : -1)).filter((k) => k >= 0);
  const status = view.outcome ? null
    : can.size ? { tone: 'mine' as const, text: chop ? (first === null ? 'چاپستیک: کارت اول را انتخاب کنید' : 'و کارت دوم…') : 'یک بشقاب بردارید' }
      : { tone: 'wait' as const, text: `منتظر ${waiting.map(who).join('، ')}` };

  const tap = (i: number) => {
    const k = view.hand![i]!;
    if (!chop) { onAction({ type: 'pick', card: k }); return; }
    if (first === null) { setFirst(i); return; }
    if (first === i) { setFirst(null); return; }
    onAction({ type: 'pick', card: view.hand![first]!, extra: k });
  };

  return (
    <div className="sg" ref={root} data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!view.outcome && <p className="sg__round">دور {fa(view.round)} از {fa(view.rounds)}، {fa(view.handSize)} کارت در هر دست</p>}

      <ul className="sg__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['sg-pl', s === mySeat ? 'sg-pl--me' : '', place === 1 ? 'sg-pl--win' : ''].join(' ')}>
              <div className="sg-pl__head">
                {place && <b className="sg-pl__place">{fa(place)}</b>}
                <bdi className="sg-pl__name">{who(s)}</bdi>
                <span className="sg-pl__score bg-pop" key={view.scores[s]}>{fa(view.scores[s]!)}</span>
                <span className="sg-pl__pud" aria-label={`${fa(view.puddings[s]!)} پودینگ`}><Plate k="pudding" size="sm" />×<span className="bg-pop" key={view.puddings[s]}>{fa(view.puddings[s]!)}</span></span>
                {!view.outcome && <span className={`sg-pl__flag ${view.picked[s] ? 'sg-pl__flag--ok' : ''}`}>{view.picked[s] ? 'برداشت' : 'در فکر…'}</span>}
              </div>
              {!view.outcome && <Tableau t={view.table[s]!} fresh={view.revealed[s] ?? []} seat={s} from={s === mySeat ? 'hand' : `seat-${s}`} />}
            </li>
          );
        })}
      </ul>

      {view.lastRound.length > 0 && (
        <table className="sg__scores">
          <thead><tr><th scope="col">امتیاز</th>{view.scores.map((_, k) => <th key={k} scope="col"><bdi>{who(k)}</bdi></th>)}</tr></thead>
          <tbody>{view.lastRound.map((r, i) => <tr key={i}><th scope="row">{i < view.rounds ? `دور ${fa(i + 1)}` : 'پودینگ'}</th>{r.map((v, k) => <td key={k}>{fa(v)}</td>)}</tr>)}</tbody>
        </table>
      )}

      {view.hand && !view.outcome && (
        <section className="sg__me" aria-label="دست شما">
          {Array.isArray(myPick) && <p className="sg__picked">انتخاب شما: {myPick.map((k) => NAME[k]).join(' و ')} — منتظر بقیه</p>}
          {canChop && <button type="button" className={`sg-chop ${chop ? 'sg-chop--on' : ''}`} aria-pressed={chop} onClick={() => { setChop(!chop); setFirst(null); }}>چاپستیک: دو کارت بردار</button>}
          <div className={`sg-belt ${myPick === false ? '' : 'sg-belt--done'}`} role="group" aria-label="کارت‌های دست" data-flip-anchor="hand">
            {view.hand.map((k, i) => (
              <button key={i} type="button" data-flip={`h-${view.round}-${view.handSize}-${i}`} data-flip-from={`seat-${(me - 1 + view.players) % view.players}`} className={['sg-pick', first === i ? 'sg-pick--on' : '', hint?.type === 'pick' && hint.card === k ? 'sg-hint' : ''].join(' ')}
                disabled={busy || !can.has(k)} onClick={() => tap(i)} aria-label={`برداشتن ${NAME[k]}`} style={{ ['--i' as string]: i }}>
                <Plate k={k} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
