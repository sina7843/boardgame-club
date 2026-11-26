// سوشی گردان renderer: a sushi bar. Your hand rides a conveyor belt of plates; everyone's tableau sits on a wooden
// geta board grouped by dish, with running set points; the plates just revealed pop in.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { RailSlot, T, TurnIndicator, tx, type Term, useTermsLang, useFlip, useInFrame, usePop, type GameRendererProps } from '@bg/ui';
import tempura from './art/sushi-go-tempura.png';
import sashimi from './art/sushi-go-sashimi.png';
import dumpling from './art/sushi-go-dumpling.png';
import maki2 from './art/sushi-go-maki2.png';
import maki3 from './art/sushi-go-maki3.png';
import squid from './art/sushi-go-squidnigiri.png';
import egg from './art/sushi-go-eggnigiri.png';
import pudding from './art/sushi-go-pudding.png';
import puddingIcon from './art/sushi-go-pudding-icon.png';
import wasabi from './art/sushi-go-wasabi.png';
import chopsticks from './art/sushi-go-chopsticks.png';
import mat from './art/sushi-go-mat.png';
import { terms } from './terms.ts';
import { MAKI, setScore, type Kind, type Played, type SushiGoView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const NAME_T: Record<Kind, Term> = {
  tempura: terms.tempura, sashimi: terms.sashimi, dumpling: terms.dumpling, maki1: terms.maki1, maki2: terms.maki2, maki3: terms.maki3, salmon: terms.salmonNigiri,
  squid: terms.squidNigiri, egg: terms.eggNigiri, pudding: terms.pudding, wasabi: terms.wasabi, chopsticks: terms.chopsticks
};
const nameOf = (k: Kind) => tx(NAME_T[k]);
const NOTE: Record<Kind, Term> = {
  tempura: terms.noteTempura, sashimi: terms.noteSashimi, dumpling: terms.noteDumpling, maki1: terms.noteMaki, maki2: terms.noteMaki, maki3: terms.noteMaki, salmon: terms.noteSalmon,
  squid: terms.noteSquid, egg: terms.noteEgg, pudding: terms.notePudding, wasabi: terms.noteWasabi, chopsticks: terms.noteChopsticks
};
const ORDER: Kind[] = ['wasabi', 'squid', 'salmon', 'egg', 'tempura', 'sashimi', 'dumpling', 'maki3', 'maki2', 'maki1', 'pudding', 'chopsticks'];

// Delivered card art (design/games/group-c/art/sushi-go). maki1 and salmon nigiri were not delivered: placeholders.
const ART: Partial<Record<Kind, string>> = { tempura, sashimi, dumpling, maki2, maki3, squid, egg, pudding, wasabi, chopsticks };

export function Plate({ k, size = 'md', fresh, wasabi, flip, flipFrom, exit, pending }: { k: Kind; size?: 'sm' | 'md'; fresh?: boolean; wasabi?: boolean; flip?: string; flipFrom?: string; exit?: string; pending?: boolean }) {
  useTermsLang();
  const src = ART[k];
  return (
    <span className={['sg-plate', `sg-plate--${size}`, fresh ? 'sg-plate--fresh' : '', pending ? 'sg-plate--pending' : '', wasabi ? 'sg-plate--wasabi' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit}>
      {src ? <img className="sg-plate__img" src={src} alt={nameOf(k)} draggable={false} /> : <span className="sg-plate__img sg-ph" role="img" aria-label={nameOf(k)}>{nameOf(k)}</span>}
      {size === 'md' && <span className="sg-plate__note"><T t={NOTE[k]} /></span>}
    </span>
  );
}

type Shown = Played & { id?: string; pending?: boolean };

/** Played plates by dish. `id` overrides the plate's flip id (my picks keep the id they had in the hand). At the end of a
 * round the plates are cleared: puddings fly to the pudding counter, everything else drops. */
function Tableau({ t, fresh, seat, from, mine, sum }: { sum?: boolean; mine?: boolean; t: Shown[]; fresh: Kind[]; seat: number; from: string }) {
  useTermsLang();
  const groups = ORDER.map((k) => ({ k, items: t.filter((c) => c.kind === k) })).filter((g) => g.items.length);
  const real = t.filter((c) => !c.pending);
  const maki = real.reduce((a, c) => a + (MAKI[c.kind] ?? 0), 0);
  // Every tableau sits on the printed mat, also before the first plate (QA round 2: empty «—» tableaus, mat art unused).
  return (
    <div className={['sg-tab', 'sg-tab--mat', mine ? 'sg-tab--me' : ''].join(' ')} style={{ ['--mat' as string]: `url(${mat})` }}>
      {groups.map(({ k, items }) => (
        <span key={k} className="sg-tab__g" title={nameOf(k)}>
          {items.map((c, i) => <Plate key={i} k={k} size="sm" wasabi={c.wasabi} pending={c.pending} fresh={!c.pending && fresh.includes(k) && i === items.length - 1}
            flip={c.id ?? `t-${seat}-${k}-${i}`} flipFrom={from} exit={k === 'pudding' ? `pud-${seat}` : 'drop'} />)}
        </span>
      ))}
      {sum && <span className="sg-tab__sum">{fa(setScore(real))} امتیاز{maki ? `، ${fa(maki)} ${tx(terms.rolls)}` : ''}</span>}
    </div>
  );
}

function Pop({ n }: { n: number }) {
  const pop = usePop(n);
  return <span className={pop} key={n}>{fa(n)}</span>;
}

export default function SushiGoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SushiGoView>) {
  useTermsLang();
  const can = new Set(legalActions.filter((a) => a.type === 'pick').map((a) => a.card as Kind));
  const canChop = legalActions.some((a) => a.type === 'chopsticks');
  const [chop, setChop] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  useEffect(() => { setChop(false); setFirst(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; card?: Kind } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const me = mySeat ?? -1;
  // My pick (in the undo window, or sent and waiting for the others) leaves the hand at once and waits face up, dimmed,
  // on my board; undo returns it. The others' picks stay hidden until everyone has picked.
  const q = queued?.type === 'pick' ? [queued.card as Kind, ...(queued.extra ? [queued.extra as Kind] : [])] : null;
  const myPick = q ?? (me >= 0 ? view.picked[me] : false);
  const pend: Kind[] = Array.isArray(myPick) ? myPick : [];
  // Hand plates: id per dish and occurrence (stable while the hand stays); the picked ones are taken out.
  const seen: Partial<Record<Kind, number>> = {};
  const handIds = (view.hand ?? []).map((k) => { const o = seen[k] ?? 0; seen[k] = o + 1; return `h-${view.round}-${view.handSize}-${k}-${o}`; });
  const left = [...pend];
  const handShown = (view.hand ?? []).map((k, i) => ({ k, i, id: handIds[i]! })).filter(({ k }) => { const j = left.indexOf(k); if (j < 0) return true; left.splice(j, 1); return false; });
  const pickedIds = handIds.filter((id) => !handShown.some((h) => h.id === id));
  // My board: the picked plates keep their hand id, also once revealed (until the round ends), so they never jump.
  const alias = useRef(new Map<string, string>());
  const myTable: Shown[] = [];
  if (me >= 0) {
    const served = view.table[me]!;
    const count: Partial<Record<Kind, number>> = {};
    for (const c of served) { const i = count[c.kind] ?? 0; count[c.kind] = i + 1; myTable.push({ ...c, id: alias.current.get(`${c.kind}-${i}`) }); }
    const keep = new Set(myTable.map((c, n) => `${c.kind}-${myTable.slice(0, n).filter((x) => x.kind === c.kind).length}`));
    pend.forEach((k, j) => {
      const i = count[k] ?? 0; count[k] = i + 1;
      const slot = `${k}-${i}`, id = pickedIds[j] ?? `p-${slot}`;
      alias.current.set(slot, id); keep.add(slot);
      myTable.push({ kind: k, id, pending: true });
    });
    for (const slot of [...alias.current.keys()]) if (!keep.has(slot)) alias.current.delete(slot);
  }
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${pend.join()}`);
  const order = mySeat === null ? view.scores.map((_, k) => k) : [...view.scores.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const waiting = view.picked.map((p, k) => (p === false ? k : -1)).filter((k) => k >= 0);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : can.size ? { tone: 'mine' as const, text: chop ? (first === null ? `${tx(terms.chopsticks)}: ${tx(terms.pickFirst)}` : tx(terms.pickSecond)) : tx(terms.pickPlate) }
      : { tone: 'wait' as const, text: `منتظر ${waiting.map(who).join('، ')}` };

  const framed = useInFrame() !== null;
  const tap = (i: number) => {
    const k = view.hand![i]!;
    if (!chop) { onAction({ type: 'pick', card: k }); return; }
    if (first === null) { setFirst(i); return; }
    if (first === i) { setFirst(null); return; }
    onAction({ type: 'pick', card: view.hand![first]!, extra: k });
  };

  return (
    <div className="sg" ref={root} data-seq={view.seq}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && !view.outcome && <RailSlot><p><T t={terms.railPass} /> <T t={terms.nigiri} /> روی <T t={terms.wasabi} /> سه برابر می‌شود.</p><p><T t={terms.round} /> {fa(view.round)} از {fa(view.rounds)}، {fa(view.handSize)} <T t={terms.card} /> <T t={terms.inHand} /></p></RailSlot>}
      {!framed && !view.outcome && <p className="sg__round"><T t={terms.round} /> {fa(view.round)} از {fa(view.rounds)}، {fa(view.handSize)} <T t={terms.card} /> <T t={terms.inEachHand} /></p>}

      <ul className="sg__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['sg-pl', s === mySeat ? 'sg-pl--me' : '', place === 1 ? 'sg-pl--win' : ''].join(' ')}>
              <div className="sg-pl__head">
                {place && <b className="sg-pl__place">{fa(place)}</b>}
                <bdi className="sg-pl__name">{who(s)}</bdi>
                {!framed && <span className="sg-pl__score"><Pop n={view.scores[s]!} /></span>}
                <span className="sg-pl__pud" data-flip-anchor={`pud-${s}`} aria-label={`${fa(view.puddings[s]!)} ${tx(terms.pudding)}`}><img className="sg-pud-ic" src={puddingIcon} alt="" /><Pop n={view.puddings[s]!} /></span>
                {!framed && !view.outcome && <span className={`sg-pl__flag ${view.picked[s] ? 'sg-pl__flag--ok' : ''}`}>{view.picked[s] ? tx(terms.picked) : 'در فکر…'}</span>}
              </div>
              {!view.outcome && <Tableau sum={!framed} mine={s === me} t={s === me ? myTable : view.table[s]!} fresh={view.revealed[s] ?? []} seat={s} from={s === mySeat ? 'hand' : `seat-${s}`} />}
            </li>
          );
        })}
      </ul>

      {!framed && view.lastRound.length > 0 && (
        <table className="sg__scores">
          <thead><tr><th scope="col">امتیاز</th>{view.scores.map((_, k) => <th key={k} scope="col"><bdi>{who(k)}</bdi></th>)}</tr></thead>
          <tbody>{view.lastRound.map((r, i) => <tr key={i}><th scope="row">{i < view.rounds ? `${tx(terms.round)} ${fa(i + 1)}` : tx(terms.pudding)}</th>{r.map((v, k) => <td key={k}>{fa(v)}</td>)}</tr>)}</tbody>
        </table>
      )}

      {view.hand && !view.outcome && (
        <section className="sg__me" aria-label={tx(terms.yourHand)}>
          {Array.isArray(myPick) && <p className="sg__picked"><T t={terms.yourPick} /> {myPick.map((k) => nameOf(k)).join(' و ')} — منتظر بقیه</p>}
          {canChop && <button type="button" className={`sg-chop ${chop ? 'sg-chop--on' : ''}`} aria-pressed={chop} onClick={() => { setChop(!chop); setFirst(null); }}>{tx(terms.chopsticks)}: {tx(terms.takeTwo)}</button>}
          <div className={`sg-belt ${myPick === false ? '' : 'sg-belt--done'}`} role="group" aria-label={tx(terms.handCards)} data-flip-anchor="hand" style={{ ['--n' as string]: handShown.length, ['--cols' as string]: Math.ceil(handShown.length / 2) }}>
            {handShown.map(({ k, i, id }) => (
              <button key={id} type="button" data-flip={id} data-flip-from={`seat-${(me - 1 + view.players) % view.players}`} data-flip-exit={`seat-${(me + 1) % view.players}`} className={['sg-pick', first === i ? 'sg-pick--on' : '', hint?.type === 'pick' && hint.card === k ? 'sg-hint' : ''].join(' ')}
                disabled={busy || !can.has(k)} onClick={() => tap(i)} aria-label={`${tx(terms.pickV)} ${nameOf(k)}`} style={{ ['--i' as string]: i }}>
                <Plate k={k} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
