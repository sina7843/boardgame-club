// «املاک» renderer: square board (vector, literal coordinates), tokens, ownership, buildings; a decision panel driven by
// the phase; property management, trade composer and responder; players and log. All state shown is public.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFlip, type GameRendererProps } from '@bg/ui';
import { AmlakBoard, Landmarks, SEAT_COLORS, Token } from './board-art.tsx';
import { BOARD, BAIL, GROUP_COLOR, GROUP_FA, STATION_RENT, cardById, priceOf } from './board.ts';
import { unmortgageCost, type AmlakView, type LogEntry, type TradeSide } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const money = (n: number) => `${fa(n)} هزار تومان`;
type Hint = { type: string; sq?: number; to?: number; min?: number; max?: number };

function describe(e: LogEntry, name: (s: number) => string): string {
  const who = (s: number) => (s === -1 ? 'بانک' : s === -2 ? 'صندوق پارکینگ' : name(s));
  switch (e.t) {
    case 'roll': return `${name(e.seat)} تاس ریخت: ${fa(e.dice[0])} و ${fa(e.dice[1])}${e.dice[0] === e.dice[1] ? ' (جفت)' : ''}${e.jail === 'stay' ? '؛ در زندان ماند' : e.jail === 'forced' ? '؛ سومین بار — جریمه می‌پردازد' : ''}.`;
    case 'move': return `${name(e.seat)} به «${BOARD[e.to]!.nameFa}» رفت${e.salary ? ` و ${money(e.salary)} حقوق گرفت` : ''}.`;
    case 'buy': return `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را به ${money(e.price)} خرید.`;
    case 'decline': return `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را نخرید.`;
    case 'bid': return `${name(e.seat)} ${money(e.amount)} پیشنهاد داد.`;
    case 'auctionPass': return `${name(e.seat)} از مزایده کنار کشید.`;
    case 'auctionWon': return e.seat === null ? `«${BOARD[e.sq]!.nameFa}» در مزایده فروش نرفت.` : `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را در مزایده به ${money(e.price)} برد.`;
    case 'pay': return `${name(e.seat)} ${money(e.amount)} به ${who(e.to)} پرداخت${e.why === 'rent' ? ' (اجاره)' : e.why === 'tax' ? ' (مالیات)' : e.why === 'bail' ? ' (جریمه زندان)' : ''}.`;
    case 'collect': return `${name(e.seat)} ${money(e.amount)} گرفت${e.why === 'parking' ? ' (جایزه پارکینگ)' : ''}.`;
    case 'card': return `${name(e.seat)} کارت کشید: ${cardById(e.card).textFa}`;
    case 'jail': return `${name(e.seat)} به زندان رفت${e.why === 'doubles' ? ' (سه جفت پشت‌سرهم)' : ''}.`;
    case 'leaveJail': return `${name(e.seat)} از زندان آزاد شد${e.how === 'bail' ? ' (پرداخت جریمه)' : e.how === 'card' ? ' (کارت آزادی)' : ' (جفت)'}.`;
    case 'build': return `${name(e.seat)} در «${BOARD[e.sq]!.nameFa}» ${e.houses === 5 ? 'هتل' : 'خانه'} ساخت.`;
    case 'sell': return `${name(e.seat)} یک ساختمان در «${BOARD[e.sq]!.nameFa}» را فروخت.`;
    case 'mortgage': return `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را ${e.on ? 'رهن گذاشت' : 'از رهن درآورد'}.`;
    case 'trade': return e.accepted === null ? `${name(e.from)} به ${name(e.to)} پیشنهاد معامله داد.` : `${name(e.to)} معامله با ${name(e.from)} را ${e.accepted ? 'پذیرفت' : 'رد کرد'}.`;
    case 'bankrupt': return `${name(e.seat)} ورشکست شد${e.to >= 0 ? `؛ دارایی‌اش به ${name(e.to)} رسید` : ''}.`;
    case 'turn': return `دور ${fa(e.round)}: نوبت ${name(e.seat)}.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد؛ خودکار عمل شد.`;
  }
}

/** Title-deed rows: [label, value]. */
function rentRows(i: number): [string, string][] {
  const b = BOARD[i]!;
  if (b.kind === 'street') return [['اجاره زمین', money(b.rents[0])], ['با کل رنگ', money(b.rents[0] * 2)], ...[1, 2, 3, 4].map((h): [string, string] => [`با ${fa(h)} خانه`, money(b.rents[h]!)]), ['با هتل', money(b.rents[5])]];
  if (b.kind === 'station') return STATION_RENT.slice(1).map((r, k): [string, string] => [`با ${fa(k + 1)} ایستگاه`, money(r)]);
  if (b.kind === 'utility') return [['با یک شرکت', '۴ × عدد تاس'], ['با هر دو شرکت', '۱۰ × عدد تاس']];
  if (b.kind === 'tax') return [['پرداخت', money(b.amount)]];
  return [];
}

export default function AmlakRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<AmlakView>) {
  const hints = legalActions as Hint[];
  const has = (t: string) => hints.some((h) => h.type === t);
  const send = (a: Record<string, unknown>) => { if (!busy) onAction({ type: a.type as string, ...a }); };
  const me = mySeat !== null ? view.p[mySeat] : null;
  const [selected, setSelected] = useState<number | null>(null);
  const [bid, setBid] = useState<number>(0);
  const [tradeOpen, setTradeOpen] = useState(false);

  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, latest?.seq ?? 0);
  const bidHint = hints.find((h) => h.type === 'bid');
  useEffect(() => { if (bidHint) setBid(bidHint.min!); }, [bidHint?.min]); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = view.trade ? view.trade.to : view.phase === 'auction' ? view.auction!.turn : view.phase === 'debt' ? view.debts[0]!.seat : view.current;
  const mine = mySeat !== null && waiting === mySeat && !view.outcome;
  const status = view.outcome ? null : mine
    ? { tone: 'mine' as const, text: view.trade ? 'پیشنهاد معامله برای شما' : view.phase === 'auction' ? 'مزایده: نوبت پیشنهاد شما' : view.phase === 'debt' ? 'بدهی دارید: پول جور کنید' : view.phase === 'buy' ? 'خرید یا مزایده؟' : view.phase === 'end' ? 'کارهای نوبت را انجام دهید یا نوبت را تمام کنید' : 'نوبت شماست: تاس بریزید' }
    : { tone: 'wait' as const, text: `در انتظار ${seatName(waiting)}${view.phase === 'auction' ? ' (مزایده)' : view.phase === 'debt' ? ' (بدهی)' : view.trade ? ' (پاسخ معامله)' : ''}` };

  const manage = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const h of hints) if (['build', 'sell', 'mortgage', 'unmortgage'].includes(h.type)) map.set(h.sq!, [...(map.get(h.sq!) ?? []), h.type]);
    return map;
  }, [hints]);
  const myProps = mySeat === null ? [] : view.owner.map((o, i) => (o === mySeat ? i : -1)).filter((i) => i >= 0);
  const pos = me ? me.pos : 0;
  const debt = view.debts[0];
  const card = view.lastCard ? cardById(view.lastCard.card) : null;
  const lastOf = (t: LogEntry['t']) => [...view.log].reverse().find((e) => e.t === t)?.seq ?? 0;
  const rollKey = lastOf('roll');
  const cardSeq = lastOf('card');
  // Show the drawn card during the turn it was drawn in.
  const showCard = !!card && cardSeq > lastOf('turn');

  return (
    <div className="am" ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="am-main">
        <div className="am-boardcol">
          <ZoomBoard label="صفحه املاک">
            <AmlakBoard view={view} selected={selected} onSelect={(i) => setSelected(i === selected ? null : i)} seatName={seatName} rollKey={rollKey} />
          </ZoomBoard>
          {selected !== null && <SquareCard view={view} i={selected} seatName={seatName} onClose={() => setSelected(null)} />}
        </div>
        <div className="am-side">
          {showCard && card && <CardFace key={cardSeq} id={card.id} text={card.textFa} who={view.lastCard ? seatName(view.lastCard.seat) : ''} />}

          {mine && (
            <section className="am-panel am-panel--decide" aria-label="تصمیم">
              {view.trade && (
                <>
                  <h3>پیشنهاد معامله از <bdi>{seatName(view.trade.from)}</bdi></h3>
                  <TradeSummary trade={view.trade} seatName={seatName} />
                  <div className="am-row">
                    <Button disabled={busy || !has('acceptTrade')} onClick={() => send({ type: 'acceptTrade' })}>قبول</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'rejectTrade' })}>رد</Button>
                  </div>
                  {!has('acceptTrade') && <p className="am-help">با وضعیت فعلی این معامله ممکن نیست (پول یا ملک کافی نیست).</p>}
                </>
              )}
              {!view.trade && view.phase === 'roll' && (
                <div className="am-row">
                  <Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => send({ type: 'roll' })}>تاس بریز</Button>
                  {has('payBail') && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'payBail' })}>پرداخت {money(BAIL)} و آزادی</Button>}
                  {has('useCard') && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'useCard' })}>کارت آزادی از زندان</Button>}
                </div>
              )}
              {!view.trade && view.phase === 'buy' && (
                <>
                  <h3>این ملک صاحب ندارد</h3>
                  <Deed view={view} i={pos} seatName={seatName} />
                  <div className="am-row">
                    <Button disabled={busy || !has('buy')} variant={expected?.type === 'buy' ? 'brand' : 'primary'} onClick={() => send({ type: 'buy' })}>خرید به {money(priceOf(pos))}</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'decline' })}>{view.rules.auction ? 'نمی‌خرم (مزایده)' : 'نمی‌خرم'}</Button>
                  </div>
                </>
              )}
              {!view.trade && view.phase === 'auction' && bidHint && (
                <>
                  <h3>مزایده</h3>
                  <Deed view={view} i={view.auction!.sq} seatName={seatName} compact />
                  <p className="am-help">بالاترین پیشنهاد: {view.auction!.leader === null ? 'هنوز نیست' : `${money(view.auction!.high)} از ${seatName(view.auction!.leader)}`}</p>
                  <label className="am-field">پیشنهاد شما (هزار تومان)
                    <input type="number" inputMode="numeric" min={bidHint.min} max={bidHint.max} value={bid} onChange={(e) => setBid(Number(e.target.value))} />
                  </label>
                  <div className="am-chips" role="group" aria-label="افزایش سریع پیشنهاد">
                    {[1, 10, 50, 100].map((d) => (
                      <button key={d} type="button" className="am-chip" disabled={busy || bidHint.min! + d - 1 > bidHint.max!}
                        onClick={() => setBid(Math.min(bidHint.max!, Math.max(bid, bidHint.min! - 1) + d))}>+{fa(d)}</button>
                    ))}
                  </div>
                  <div className="am-row">
                    <Button disabled={busy || bid < bidHint.min! || bid > bidHint.max!} onClick={() => send({ type: 'bid', amount: bid })}>ثبت پیشنهاد</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'pass' })}>کنار می‌کشم</Button>
                  </div>
                </>
              )}
              {!view.trade && view.phase === 'auction' && !bidHint && <div className="am-row"><Button variant="secondary" disabled={busy} onClick={() => send({ type: 'pass' })}>کنار می‌کشم</Button></div>}
              {!view.trade && view.phase === 'debt' && debt && (
                <>
                  <h3>بدهی: {money(debt.amount)} به {debt.to >= 0 ? seatName(debt.to) : debt.to === -2 ? 'صندوق پارکینگ' : 'بانک'}</h3>
                  <p className="am-help">پول نقد شما {money(me!.cash)} است. خانه بفروشید یا ملک رهن بگذارید؛ وقتی پول کافی شد، بدهی خودکار پرداخت می‌شود.</p>
                  <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
                  <Button variant="danger" disabled={busy} onClick={() => send({ type: 'bankrupt' })}>اعلام ورشکستگی</Button>
                </>
              )}
              {!view.trade && view.phase === 'end' && (
                <Button size="lg" disabled={busy} variant={expected?.type === 'endTurn' ? 'brand' : 'primary'} onClick={() => send({ type: 'endTurn' })}>پایان نوبت</Button>
              )}
            </section>
          )}

          {mine && !view.trade && (view.phase === 'roll' || view.phase === 'end') && (
            <>
              {myProps.length > 0 && (
                <details className="am-panel" open={manage.size > 0}>
                  <summary>مدیریت املاک (ساخت، فروش، رهن)</summary>
                  <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
                </details>
              )}
              {has('offer') && (
                <details className="am-panel" open={tradeOpen} onToggle={(e) => setTradeOpen((e.target as HTMLDetailsElement).open)}>
                  <summary>پیشنهاد معامله</summary>
                  {tradeOpen && <TradeComposer view={view} mySeat={mySeat!} partners={hints.filter((h) => h.type === 'offer').map((h) => h.to!)} seatName={seatName} busy={busy} send={send} />}
                </details>
              )}
            </>
          )}

          <ul className="am-wallets" aria-label="بازیکنان">
            {view.order.map((seat) => {
              const pl = view.p[seat]!;
              const owned = view.owner.map((o, i) => (o === seat ? i : -1)).filter((i) => i >= 0);
              return (
                <li key={seat} className={['am-wallet', seat === view.current && !view.outcome ? 'am-wallet--turn' : '', pl.bankrupt ? 'am-wallet--out' : ''].join(' ')} style={{ ['--seat' as string]: SEAT_COLORS[seat] }}>
                  <span className="am-wallet__pawn" aria-hidden="true"><svg viewBox="-20 -19 40 36"><Token seat={seat} /></svg><i>{fa(seat + 1)}</i></span>
                  <span className="am-wallet__who">
                    <bdi className="am-wallet__name">{seatName(seat)}</bdi>{seat === mySeat && <span className="am-wallet__me"> (شما)</span>}
                    {pl.inJail && <span className="am-tag">زندان</span>}
                    {pl.jailCards.length > 0 && <span className="am-tag am-tag--card">کارت آزادی</span>}
                    {pl.bankrupt && <span className="am-tag am-tag--out">ورشکسته</span>}
                  </span>
                  <span className="am-wallet__cash" aria-label={money(pl.cash)}><b className="bg-pop" key={pl.cash}>{fa(pl.cash)}</b><small>هزار تومان</small></span>
                  {owned.length > 0 && (
                    <span className="am-wallet__deeds" aria-label={`املاک: ${owned.map((i) => BOARD[i]!.nameFa).join('، ')}`}>
                      {owned.map((i) => {
                        const b = BOARD[i]!;
                        const bg = b.kind === 'street' ? GROUP_COLOR[b.group] : b.kind === 'station' ? '#2b2f36' : '#6b7c8f';
                        return <span key={i} className={view.mortgaged[i] ? 'am-deedchip am-deedchip--mortgaged' : 'am-deedchip'} style={{ background: bg }} title={b.nameFa} />;
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="am-help">دور {fa(view.round)}{view.rules.rounds ? ` از ${fa(view.rules.rounds)}` : ''} · خانه‌های بانک {fa(view.housesLeft)} · هتل‌ها {fa(view.hotelsLeft)}</p>

          <details className="am-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-8).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>
        </div>
      </div>
    </div>
  );
}

function SquareCard({ view, i, seatName, onClose }: { view: AmlakView; i: number; seatName: (s: number) => string; onClose: () => void }) {
  const b = BOARD[i]!;
  if (!('price' in b) && b.kind !== 'tax') {
    return <section className="am-panel" aria-label={b.nameFa}><h3>{b.nameFa}</h3><Button size="sm" variant="ghost" onClick={onClose}>بستن</Button></section>;
  }
  return <div className="am-sqcard"><Deed view={view} i={i} seatName={seatName} /><Button size="sm" variant="ghost" onClick={onClose}>بستن</Button></div>;
}

/** Title deed («سند مالکیت»): colour header, rent table with leaders, price / mortgage / house cost, owner. */
function Deed({ view, i, seatName, compact }: { view: AmlakView; i: number; seatName: (s: number) => string; compact?: boolean }) {
  const b = BOARD[i]!;
  const head = b.kind === 'street' ? GROUP_COLOR[b.group] : b.kind === 'station' ? '#2b2f36' : b.kind === 'utility' ? '#5d6f84' : '#8a6b12';
  const dark = b.kind === 'street' && ['yellow', 'lightBlue'].includes(b.group);
  const owner = view.owner[i];
  const kicker = b.kind === 'street' ? `سند مالکیت · ${GROUP_FA[b.group]}` : b.kind === 'station' ? 'سند ایستگاه' : b.kind === 'utility' ? 'سند شرکت' : 'مالیات';
  return (
    <article className={compact ? 'am-deed am-deed--compact' : 'am-deed'} aria-label={`سند ${b.nameFa}`}>
      <header className="am-deed__head" style={{ background: head, color: dark ? '#1b130b' : '#fff' }}>
        <span className="am-deed__kicker">{kicker}</span>
        <strong className="am-deed__name">{b.nameFa}</strong>
        <svg className="am-deed__mark" viewBox="-50 -130 100 135" aria-hidden="true"><Landmarks fill="currentColor" /></svg>
      </header>
      {!compact && <dl className="am-deed__rows">{rentRows(i).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {'price' in b && (
        <footer className="am-deed__foot">
          <span>قیمت <b>{money(b.price)}</b></span>
          <span>رهن {money(b.price / 2)}</span>
          {b.kind === 'street' && <span>هر خانه {money(b.house)}</span>}
          {owner !== null && owner !== undefined && (
            <span>مالک <bdi>{seatName(owner)}</bdi>{view.mortgaged[i] ? ` · در رهن (فک رهن ${money(unmortgageCost(i))})` : ''}{view.houses[i] ? ` · ${view.houses[i] === 5 ? 'هتل' : `${fa(view.houses[i]!)} خانه`}` : ''}</span>
          )}
        </footer>
      )}
    </article>
  );
}

/** The drawn card, face up: «شانس» or «صندوق». */
function CardFace({ id, text, who }: { id: string; text: string; who: string }) {
  const chance = id.startsWith('ch');
  return (
    <figure className={chance ? 'am-cardface am-cardface--chance' : 'am-cardface am-cardface--chest'} aria-label={`${chance ? 'شانس' : 'صندوق'}: ${text}`}>
      <span className="am-cardface__badge" aria-hidden="true">{chance ? '؟' : '▣'}</span>
      <figcaption><span className="am-cardface__kind">{chance ? 'شانس' : 'صندوق'} · <bdi>{who}</bdi></span>{text}</figcaption>
    </figure>
  );
}

function ManageList({ view, props, manage, busy, send }: { view: AmlakView; props: number[]; manage: Map<number, string[]>; busy: boolean; send: (a: Record<string, unknown>) => void }) {
  const LABEL: Record<string, (i: number) => string> = {
    build: (i) => { const b = BOARD[i]!; return `ساخت ${view.houses[i] === 4 ? 'هتل' : 'خانه'} (${money(b.kind === 'street' ? b.house : 0)})`; },
    sell: (i) => { const b = BOARD[i]!; return `فروش ساختمان (+${money(b.kind === 'street' ? b.house / 2 : 0)})`; },
    mortgage: (i) => `رهن (+${money(priceOf(i) / 2)})`,
    unmortgage: (i) => `فک رهن (${money(unmortgageCost(i))})`
  };
  return (
    <ul className="am-manage">
      {props.map((i) => {
        const b = BOARD[i]!;
        const acts = manage.get(i) ?? [];
        return (
          <li key={i}>
            <span>{b.kind === 'street' && <span className="am-swatch" style={{ background: GROUP_COLOR[b.group] }} aria-hidden="true" />}{b.nameFa}{view.houses[i] ? ` · ${view.houses[i] === 5 ? 'هتل' : `${fa(view.houses[i]!)} خانه`}` : ''}{view.mortgaged[i] ? ' · در رهن' : ''}</span>
            <span className="am-manage__acts">{acts.map((t) => <Button key={t} size="sm" variant="secondary" disabled={busy} onClick={() => send({ type: t, sq: i })}>{LABEL[t]!(i)}</Button>)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function sideText(side: TradeSide) {
  const parts = [...side.props.map((i) => `«${BOARD[i]!.nameFa}»`), ...(side.cash ? [money(side.cash)] : []), ...(side.cards.length ? [`${fa(side.cards.length)} کارت آزادی`] : [])];
  return parts.length ? parts.join('، ') : 'هیچ';
}
function TradeSummary({ trade, seatName }: { trade: NonNullable<AmlakView['trade']>; seatName: (s: number) => string }) {
  return (
    <ul className="am-rents">
      <li><bdi>{seatName(trade.from)}</bdi> می‌دهد: {sideText(trade.give)}</li>
      <li>در عوض می‌خواهد: {sideText(trade.get)}</li>
    </ul>
  );
}

function TradeComposer({ view, mySeat, partners, seatName, busy, send }: { view: AmlakView; mySeat: number; partners: number[]; seatName: (s: number) => string; busy: boolean; send: (a: Record<string, unknown>) => void }) {
  const [to, setTo] = useState(partners[0]!);
  const [give, setGive] = useState<TradeSide>({ cash: 0, props: [], cards: [] });
  const [get, setGet] = useState<TradeSide>({ cash: 0, props: [], cards: [] });
  useEffect(() => { setGet({ cash: 0, props: [], cards: [] }); }, [to]);
  const tradable = (seat: number) => view.owner.map((o, i) => (o === seat ? i : -1)).filter((i) => i >= 0 && !(BOARD[i]!.kind === 'street' && BOARD.some((b, j) => b.kind === 'street' && BOARD[i]!.kind === 'street' && b.group === (BOARD[i] as { group: string }).group && view.houses[j]! > 0)));
  const toggle = (side: TradeSide, set: (s: TradeSide) => void, i: number) => set({ ...side, props: side.props.includes(i) ? side.props.filter((x) => x !== i) : [...side.props, i] });
  // A render helper, not a component: a component defined here would remount on every keystroke and drop focus.
  const side = (seat: number, sideVal: TradeSide, set: (s: TradeSide) => void, label: string) => (
    <fieldset className="am-tradeside">
      <legend>{label}</legend>
      {tradable(seat).map((i) => (
        <label key={i} className="am-check"><input type="checkbox" checked={sideVal.props.includes(i)} onChange={() => toggle(sideVal, set, i)} />{BOARD[i]!.nameFa}{view.mortgaged[i] ? ' (رهن)' : ''}</label>
      ))}
      <label className="am-field">پول (هزار تومان، حداکثر {fa(view.p[seat]!.cash)})
        <input type="number" inputMode="numeric" min={0} max={view.p[seat]!.cash} value={sideVal.cash} onChange={(e) => set({ ...sideVal, cash: Math.max(0, Math.min(view.p[seat]!.cash, Number(e.target.value) || 0)) })} />
      </label>
      {view.p[seat]!.jailCards.length > 0 && (
        <label className="am-check"><input type="checkbox" checked={sideVal.cards.length > 0} onChange={(e) => set({ ...sideVal, cards: e.target.checked ? view.p[seat]!.jailCards.slice(0, 1) : [] })} />کارت آزادی از زندان</label>
      )}
    </fieldset>
  );
  const empty = !give.cash && !give.props.length && !give.cards.length && !get.cash && !get.props.length && !get.cards.length;
  return (
    <div className="am-trade">
      <label className="am-field">با چه کسی؟
        <select value={to} onChange={(e) => setTo(Number(e.target.value))}>{partners.map((s) => <option key={s} value={s}>{seatName(s)}</option>)}</select>
      </label>
      <div className="am-trade__sides">
        {side(mySeat, give, setGive, 'شما می‌دهید')}
        {side(to, get, setGet, `از ${seatName(to)} می‌گیرید`)}
      </div>
      <p className="am-help">املاکی که در رنگشان ساختمان هست قابل معامله نیستند. گیرنده ملک در رهن ۱۰٪ بهره می‌پردازد.</p>
      <Button disabled={busy || empty} onClick={() => send({ type: 'offer', to, give, get })}>ارسال پیشنهاد</Button>
    </div>
  );
}
