// سوشی گردان renderer: a sushi bar. Your hand rides a conveyor belt of plates; everyone's tableau sits on a wooden
// geta board grouped by dish, with running set points; the plates just revealed pop in.
import './renderer.css';
import { useEffect, useState } from 'react';
import { TurnIndicator, type GameRendererProps } from '@bg/ui';
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

function Dish({ k }: { k: Kind }) {
  switch (k) {
    case 'tempura': return <g><path d="M-18 8 Q-20 -14 4 -16 Q18 -14 16 -4 Q6 -8 -2 -2 Q-8 4 -6 12 Z" fill="#e8a33d" stroke="#9a5f12" strokeWidth="1.5" /><path d="M14 -6 L22 -14 M16 -2 L24 -6" stroke="#e3582f" strokeWidth="3" strokeLinecap="round" /></g>;
    case 'sashimi': return <g>{[-10, 0, 10].map((x) => <path key={x} d={`M${x - 7} 10 Q${x - 9} -10 ${x} -12 Q${x + 9} -10 ${x + 7} 10 Z`} fill="#f08a6b" stroke="#b9533a" strokeWidth="1.2" />)}{[-10, 0, 10].map((x) => <path key={`s${x}`} d={`M${x - 4} -4 L${x + 4} 2`} stroke="#ffd6c8" strokeWidth="1.5" />)}</g>;
    case 'dumpling': return <g><path d="M-20 6 Q0 -22 20 6 Z" fill="#f2e2be" stroke="#a88a52" strokeWidth="1.5" />{[-12, -6, 0, 6, 12].map((x) => <path key={x} d={`M${x} ${-10 + Math.abs(x) * 0.6} q2 4 0 6`} stroke="#a88a52" strokeWidth="1.2" fill="none" />)}</g>;
    case 'maki1': case 'maki2': case 'maki3': {
      const c = MAKI[k]!;
      const xs = c === 1 ? [0] : c === 2 ? [-10, 10] : [-14, 0, 14];
      return <g>{xs.map((x) => <g key={x} transform={`translate(${x} 0)`}><circle r="8" fill="#1f2b22" /><circle r="6" fill="#fbf7ee" /><circle r="2.6" fill="#e5533f" /></g>)}</g>;
    }
    case 'salmon': case 'squid': case 'egg': {
      const top = k === 'salmon' ? '#f28c5b' : k === 'squid' ? '#f3eee6' : '#f4cf47';
      return <g><rect x="-17" y="0" width="34" height="11" rx="5" fill="#fbf7ee" stroke="#cfc6b2" /><path d="M-19 2 Q-18 -12 0 -12 Q18 -12 19 2 Z" fill={top} stroke="rgb(0 0 0 / .25)" />
        {k === 'egg' && <rect x="-3" y="-12" width="6" height="23" fill="#1f2b22" />}{k === 'salmon' && <path d="M-10 -8 L-4 -2 M0 -9 L6 -3 M9 -8 L13 -4" stroke="#ffd0b5" strokeWidth="1.5" />}
        {k === 'squid' && <path d="M-12 -6 H12 M-12 -2 H12" stroke="#d9cfc0" strokeWidth="1" />}</g>;
    }
    case 'pudding': return <g><path d="M-14 10 L-10 -8 H10 L14 10 Z" fill="#f2c46a" stroke="#a36d1c" strokeWidth="1.5" /><path d="M-10 -8 Q0 -14 10 -8 L9 -4 Q0 -8 -9 -4 Z" fill="#7a3d10" /></g>;
    case 'wasabi': return <path d="M-14 10 Q-16 -2 -6 -6 Q-4 -16 6 -12 Q16 -8 14 4 Q14 12 -14 10 Z" fill="#7cb342" stroke="#4d7a22" strokeWidth="1.5" />;
    case 'chopsticks': return <g stroke="#b5762f" strokeWidth="3" strokeLinecap="round"><path d="M-18 14 L14 -16" /><path d="M-12 16 L20 -12" /></g>;
  }
}

export function Plate({ k, size = 'md', fresh, wasabi }: { k: Kind; size?: 'sm' | 'md'; fresh?: boolean; wasabi?: boolean }) {
  return (
    <span className={['sg-plate', `sg-plate--${size}`, `sg-k--${k}`, fresh ? 'sg-plate--fresh' : ''].join(' ')}>
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

function Tableau({ t, fresh }: { t: Played[]; fresh: Kind[] }) {
  const groups = ORDER.map((k) => ({ k, items: t.filter((c) => c.kind === k) })).filter((g) => g.items.length);
  const maki = t.reduce((a, c) => a + (MAKI[c.kind] ?? 0), 0);
  if (!t.length) return <div className="sg-tab sg-tab--empty">—</div>;
  return (
    <div className="sg-tab">
      {groups.map(({ k, items }) => (
        <span key={k} className="sg-tab__g" title={NAME[k]}>
          {items.map((c, i) => <Plate key={i} k={k} size="sm" wasabi={c.wasabi} fresh={fresh.includes(k) && i === items.length - 1} />)}
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
    <div className="sg" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!view.outcome && <p className="sg__round">دور {fa(view.round)} از {fa(view.rounds)}، {fa(view.handSize)} کارت در هر دست</p>}

      <ul className="sg__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} className={['sg-pl', s === mySeat ? 'sg-pl--me' : '', place === 1 ? 'sg-pl--win' : ''].join(' ')}>
              <div className="sg-pl__head">
                {place && <b className="sg-pl__place">{fa(place)}</b>}
                <bdi className="sg-pl__name">{who(s)}</bdi>
                <span className="sg-pl__score" key={view.scores[s]}>{fa(view.scores[s]!)}</span>
                <span className="sg-pl__pud" aria-label={`${fa(view.puddings[s]!)} پودینگ`}><Plate k="pudding" size="sm" />×{fa(view.puddings[s]!)}</span>
                {!view.outcome && <span className={`sg-pl__flag ${view.picked[s] ? 'sg-pl__flag--ok' : ''}`}>{view.picked[s] ? 'برداشت' : 'در فکر…'}</span>}
              </div>
              {!view.outcome && <Tableau t={view.table[s]!} fresh={view.revealed[s] ?? []} />}
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
          <div className={`sg-belt ${myPick === false ? '' : 'sg-belt--done'}`} role="group" aria-label="کارت‌های دست" key={view.seq}>
            {view.hand.map((k, i) => (
              <button key={i} type="button" className={['sg-pick', first === i ? 'sg-pick--on' : '', hint?.type === 'pick' && hint.card === k ? 'sg-hint' : ''].join(' ')}
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
