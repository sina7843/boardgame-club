// پایگاه فضایی renderer: a hangar console. Your twelve sector bays sit in a strip (blue station reward on top, the
// red sum of deployed ships below); dice glow on the bays they hit; the shipyard shows three levels of ships with
// cost, sector, blue/red rewards and purchase bonus. Rivals appear as compact strips of their red income per sector.
import './renderer.css';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { GOAL, SHIPS, sectorsFor, type Reward, type SbView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const rw = (r: Reward | undefined) => [r?.credits ? `${fa(r.credits)}¢` : '', r?.vp ? `${fa(r.vp)}★` : ''].filter(Boolean).join(' ') || '—';
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ n }: { n: number }) {
  return <span className="sb-die" aria-label={`تاس ${fa(n)}`}>{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n]!.includes(i) ? 'on' : ''} />)}</span>;
}

export function ShipCard({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const x = SHIPS[id]!;
  return (
    <span className={`sb-ship sb-ship--${size} sb-l--${x.level}`} aria-label={`${x.name}، بخش ${fa(x.sector)}${x.cost ? `، ${fa(x.cost)} اعتبار` : ''}`}>
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

export default function SpaceBaseRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SbView>) {
  const me = mySeat ?? 0;
  const hint = expected as unknown as Hint;
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.ship as number));
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const lit = view.dice ? (view.phase === 'choose' ? [...sectorsFor(view.dice, 'separate'), ...sectorsFor(view.dice, 'sum')] : view.last && (view.last.kind === 'sum' || view.last.kind === 'separate') ? sectorsFor(view.dice, view.last.kind) : []) : [];
  const status = view.outcome ? null
    : has('roll') ? { tone: 'mine' as const, text: 'تاس‌ها را بریزید' }
      : has('choose') ? { tone: 'mine' as const, text: 'دو بخش جدا یا جمع دو تاس؟' }
        : has('pass') ? { tone: 'mine' as const, text: 'یک ناو بخرید یا نوبت را تمام کنید' }
          : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const gain = (s: number) => view.gains.find((g) => g.seat === s);
  const mine = view.boards[me]!;

  const Bays = ({ seat, compact }: { seat: number; compact?: boolean }) => {
    const b = view.boards[seat]!;
    return (
      <div className={`sb-bays ${compact ? 'sb-bays--compact' : ''}`} dir="ltr">
        {b.station.map((st, i) => {
          const red = b.deployed[i]!.reduce((acc, id) => ({ credits: (acc.credits ?? 0) + (SHIPS[id]!.red.credits ?? 0), vp: (acc.vp ?? 0) + (SHIPS[id]!.red.vp ?? 0) }), {} as Reward);
          return (
            <span key={i} className={`sb-bay ${lit.includes(i + 1) ? 'sb-bay--lit' : ''}`}>
              <b className="sb-bay__n">{fa(i + 1)}</b>
              {compact ? <span className="sb-bay__red">{b.deployed[i]!.length ? rw(red) : ''}</span> : (
                <>
                  <span className="sb-bay__blue" title={SHIPS[st]!.name}>{rw(SHIPS[st]!.blue)}</span>
                  <span className="sb-bay__red">{b.deployed[i]!.length ? `${rw(red)} ×${fa(b.deployed[i]!.length)}` : ''}</span>
                </>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="sb" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="sb-rivals" aria-label="بازیکنان">
        {view.boards.map((b, k) => (k === me ? null : (
          <li key={k} className={`sb-rival ${k === view.current && !view.outcome ? 'sb-rival--now' : ''}`}>
            <div className="sb-rival__head">
              <bdi>{who(k)}</bdi>
              <span className="sb-vp" key={b.vp}>{fa(b.vp)}★</span>
              <span>{fa(b.credits)}¢ · درآمد {fa(b.income)}</span>
              {gain(k) && (gain(k)!.credits || gain(k)!.vp) ? <span className="sb-gain">+{rw(gain(k))}</span> : null}
            </div>
            <Bays seat={k} compact />
          </li>
        )))}
      </ul>

      <section className="sb-console" aria-label="تاس‌ها">
        {view.dice ? <span className="sb-dice" key={view.seq}><Die n={view.dice[0]} /><Die n={view.dice[1]} /></span> : <small>هنوز تاسی ریخته نشده</small>}
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
            <small className="sb-yard__lvl">{['سبک', 'میانه', 'سنگین'][l]} · {fa(view.deckCounts[l]!)}</small>
            {row.map((id) => {
              const can = buyable.has(id);
              return <button key={id} type="button" disabled={busy || !can} onClick={() => onAction({ type: 'buy', ship: id })}
                className={['sb-pick', can ? 'sb-pick--can' : '', hint?.ship === id ? 'sb-hint' : ''].join(' ')}><ShipCard id={id} /></button>;
            })}
          </div>
        ))}
      </section>

      <section className={`sb-me ${view.current === me && !view.outcome ? 'sb-me--now' : ''}`} aria-label="پایگاه شما">
        <div className="sb-me__head">
          <bdi>{who(me)}</bdi>
          <span className="sb-vp sb-vp--lg" key={mine.vp}>{fa(mine.vp)} از {fa(GOAL)} امتیاز</span>
          <span className="sb-credits" key={mine.credits}>{fa(mine.credits)}¢</span>
          <span>درآمد {fa(mine.income)}</span>
          {gain(me) && (gain(me)!.credits || gain(me)!.vp) ? <span className="sb-gain">+{rw(gain(me))}</span> : null}
        </div>
        <Bays seat={me} />
      </section>
    </div>
  );
}
