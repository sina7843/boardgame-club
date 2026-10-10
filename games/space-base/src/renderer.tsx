// پایگاه فضایی renderer: a hangar console. Your twelve sector bays sit in a strip (blue station reward on top, the
// red sum of deployed ships below); dice glow on the bays they hit; the shipyard shows three levels of ships with
// cost, sector, blue/red rewards and purchase bonus. Rivals appear as compact strips of their red income per sector.
import './renderer.css';
import { useRef, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import scout from './art/ship-scout.webp';
import freighter from './art/ship-freighter.webp';
import cruiser from './art/ship-cruiser.webp';
import station from './art/ship-station.webp';
import { GOAL, SHIPS, sectorsFor, type Reward, type SbView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const rw = (r: Reward | undefined) => [r?.credits ? `${fa(r.credits)}¢` : '', r?.vp ? `${fa(r.vp)}★` : ''].filter(Boolean).join(' ') || '—';
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

// Ship paintings are cut from a generated sprite sheet (see DECISIONS.md); picked by cost tier (costs run 0-14).
const shipArt = (cost: number) => (cost <= 5 ? scout : cost <= 9 ? freighter : cost <= 13 ? cruiser : station);

/** A die; `n` null = the roll is still pending (undo window / server), so it tumbles with no pips. */
export function Die({ n, i = 0 }: { n: number | null; i?: number }) {
  return <span className={`sb-die ${n === null ? 'bg-tumble' : 'bg-roll'}`} style={{ ['--i' as string]: i }} aria-label={n === null ? 'تاس در حال چرخش' : `تاس ${fa(n)}`}>{Array.from({ length: 9 }, (_, i) => <i key={i} data-pip="" className={n !== null && PIPS[n]!.includes(i) ? 'on' : ''} />)}</span>;
}

type Queued = { type: string; use?: 'separate' | 'sum'; ship?: number };

/** My queued buy applied to the view: only what I already know (the ship, its cost and buy bonus). The shop refill
 *  comes from a hidden deck, so the empty slot stays empty until the server answers. */
function preview(v: SbView, q: Queued | null | undefined, me: number): SbView {
  if (q?.type !== 'buy' || q.ship === undefined || me < 0) return v;
  const x = SHIPS[q.ship]!, i = x.sector - 1;
  return {
    ...v,
    shop: v.shop.map((row) => row.filter((id) => id !== q.ship)),
    boards: v.boards.map((b, s) => (s !== me ? b : {
      ...b, credits: b.credits - x.cost, income: b.income + (x.onBuy?.income ?? 0), vp: b.vp + (x.onBuy?.vp ?? 0),
      station: b.station.map((st, k) => (k === i ? q.ship! : st)), deployed: b.deployed.map((d, k) => (k === i ? [...d, b.station[i]!] : d))
    })),
    last: { seat: me, kind: 'buy', ship: q.ship }
  };
}

function Num({ v, className, children }: { v: number; className: string; children: ReactNode }) {
  const pop = usePop(v);
  return <span className={`${className} ${pop}`} key={v}>{children}</span>;
}

export function ShipCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const x = SHIPS[id]!;
  return (
    <span className={`sb-ship sb-ship--${size} sb-l--${x.level}`} aria-label={`${x.name}، بخش ${fa(x.sector)}${x.cost ? `، ${fa(x.cost)} اعتبار` : ''}`}>
      <img className="sb-ship__art" src={shipArt(x.cost)} alt="" aria-hidden="true" />
      <b className="sb-ship__sec">{fa(x.sector)}</b>
      {x.cost > 0 && <b className="sb-ship__cost">{fa(x.cost)}</b>}
      <span className="sb-ship__name">{x.name}</span>
      <span className="sb-ship__blue">{rw(x.blue)}</span>
      {size === 'md' && <span className="sb-ship__red">{rw(x.red)}</span>}
      {size === 'md' && x.onBuy && <span className="sb-ship__buy">خرید: {[x.onBuy.income ? `+${fa(x.onBuy.income)} درآمد` : '', x.onBuy.vp ? `${fa(x.onBuy.vp)}★` : ''].filter(Boolean).join(' ')}</span>}
    </span>
  );
}

type Hint = { type: string; use?: string; ship?: number } | null;

export default function SpaceBaseRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SbView>) {
  const me = mySeat ?? 0;
  const q = queued as Queued | null | undefined;
  const view = preview(served, q, mySeat ?? -1);
  // My roll in the undo window or sent and unanswered: the dice tumble with no pips until the server rolls.
  const sent = useRef<Queued | null>(null);
  if (q) sent.current = q;
  else if (!busy) sent.current = null;
  const pend = q ?? (busy ? sent.current : null);
  const rolling = pend?.type === 'roll';
  // Ships glide shipyard → the bay of their sector (my queued buy at once), new shop ships drop in from their deck;
  // dice are thrown on the top layer once per roll.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q ? JSON.stringify(q) : ''}|${rolling}`);
  const roll = useRef({ n: 0, phase: view.phase });
  if (view.phase === 'choose' && roll.current.phase !== 'choose') roll.current.n += 1;
  roll.current.phase = view.phase;
  const hint = expected as unknown as Hint;
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.ship as number));
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const use = q?.type === 'choose' ? q.use : undefined; // my queued choice lights its bays at once
  const lit = view.dice ? (use ? sectorsFor(view.dice, use) : view.phase === 'choose' ? [...sectorsFor(view.dice, 'separate'), ...sectorsFor(view.dice, 'sum')] : view.last && (view.last.kind === 'sum' || view.last.kind === 'separate') ? sectorsFor(view.dice, view.last.kind) : []) : [];
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : has('roll') ? { tone: 'mine' as const, text: 'تاس‌ها را بریزید' }
      : has('choose') ? { tone: 'mine' as const, text: 'دو بخش جدا یا جمع دو تاس؟' }
        : has('pass') ? { tone: 'mine' as const, text: 'یک ناو بخرید یا نوبت را تمام کنید' }
          : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const gain = (s: number) => view.gains.find((g) => g.seat === s);
  const mine = view.boards[me]!;

  // A bought ship keeps its motion id (s<id>) from the shop card to its bay, so it glides into its sector; starting
  // ships share ids across boards and never move, so they carry none.
  const flipOf = (st: number) => (SHIPS[st]!.level > 0 ? `s${st}` : undefined);

  const Bays = ({ seat, compact }: { seat: number; compact?: boolean }) => {
    const b = view.boards[seat]!;
    return (
      <div className={`sb-bays ${compact ? 'sb-bays--compact' : ''}`} dir="ltr">
        {b.station.map((st, i) => {
          const red = b.deployed[i]!.reduce((acc, id) => ({ credits: (acc.credits ?? 0) + (SHIPS[id]!.red.credits ?? 0), vp: (acc.vp ?? 0) + (SHIPS[id]!.red.vp ?? 0) }), {} as Reward);
          return (
            <span key={i} className={`sb-bay ${lit.includes(i + 1) ? 'sb-bay--lit' : ''}`} data-flip={compact ? flipOf(st) : undefined}>
              <b className="sb-bay__n">{fa(i + 1)}</b>
              {compact ? <span className="sb-bay__red" key={b.deployed[i]!.length}>{b.deployed[i]!.length ? rw(red) : ''}</span> : (
                <>
                  <span className="sb-bay__blue" title={SHIPS[st]!.name} data-flip={flipOf(st)}>{rw(SHIPS[st]!.blue)}</span>
                  <span className={`sb-bay__red ${b.deployed[i]!.length ? 'bg-land' : ''}`} key={b.deployed[i]!.length}>{b.deployed[i]!.length ? `${rw(red)} ×${fa(b.deployed[i]!.length)}` : ''}</span>
                </>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="sb" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="sb-rivals" aria-label="بازیکنان">
        {view.boards.map((b, k) => (k === me ? null : (
          <li key={k} className={`sb-rival ${k === view.current && !view.outcome ? 'sb-rival--now' : ''}`}>
            <div className="sb-rival__head">
              <bdi>{who(k)}</bdi>
              <Num className="sb-vp" v={b.vp}>{fa(b.vp)}★</Num>
              <span>{fa(b.credits)}¢ · درآمد {fa(b.income)}</span>
              {gain(k) && (gain(k)!.credits || gain(k)!.vp) ? <span className="sb-gain">+{rw(gain(k))}</span> : null}
            </div>
            <Bays seat={k} compact />
          </li>
        )))}
      </ul>

      <section className="sb-console" aria-label="تاس‌ها">
        {rolling ? <span className="sb-dice" key="pending"><Die n={null} /><Die n={null} i={1} /></span>
          : view.dice ? <span className="sb-dice" key={roll.current.n}><Die n={view.dice[0]} /><Die n={view.dice[1]} i={1} /></span> : <small>هنوز تاسی ریخته نشده</small>}
        {has('roll') && <Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'sb-hint' : ''} onClick={() => onAction({ type: 'roll' })}>ریختن تاس‌ها</Button>}
        {has('choose') && view.dice && <>
          <Button size="sm" variant="secondary" disabled={busy} className={hint?.use === 'separate' ? 'sb-hint' : ''} onClick={() => onAction({ type: 'choose', use: 'separate' })}>بخش {fa(view.dice[0])} و {fa(view.dice[1])}</Button>
          <Button size="sm" disabled={busy} className={hint?.use === 'sum' ? 'sb-hint' : ''} onClick={() => onAction({ type: 'choose', use: 'sum' })}>بخش {fa(view.dice[0] + view.dice[1])} (جمع)</Button>
        </>}
        {has('pass') && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>پایان نوبت بدون خرید</Button>}
      </section>

      <section className="sb-yard" aria-label="کارگاه ناو">
        {view.shop.map((row, l) => (
          <div key={l} className="sb-yard__row">
            <small className="sb-yard__lvl" data-flip-anchor={`deck-${l}`}>{['سبک', 'میانه', 'سنگین'][l]} · {fa(view.deckCounts[l]!)}</small>
            {row.map((id) => {
              const can = buyable.has(id);
              return <button key={id} type="button" data-flip={`s${id}`} data-flip-from={`deck-${l}`} disabled={busy || !can} onClick={() => onAction({ type: 'buy', ship: id })}
                className={['sb-pick', can ? 'sb-pick--can' : '', hint?.ship === id ? 'sb-hint' : ''].join(' ')}><ShipCard id={id} /></button>;
            })}
          </div>
        ))}
      </section>

      <section className={`sb-me ${view.current === me && !view.outcome ? 'sb-me--now' : ''}`} aria-label="پایگاه شما">
        <div className="sb-me__head">
          <bdi>{who(me)}</bdi>
          <Num className="sb-vp sb-vp--lg" v={mine.vp}>{fa(mine.vp)} از {fa(GOAL)} امتیاز</Num>
          <Num className="sb-credits" v={mine.credits}>{fa(mine.credits)}¢</Num>
          <span>درآمد {fa(mine.income)}</span>
          {gain(me) && (gain(me)!.credits || gain(me)!.vp) ? <span className="sb-gain">+{rw(gain(me))}</span> : null}
        </div>
        <Bays seat={me} />
      </section>
    </div>
  );
}
