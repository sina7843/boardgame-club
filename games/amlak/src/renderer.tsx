// «املاک» renderer: square board (vector, literal coordinates), tokens, ownership, buildings; a decision panel driven by
// the phase; property management, trade composer and responder; players and log. All state shown is public.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, RailSlot, T, TurnIndicator, ZoomBoard, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps, DockSlot } from '@bg/ui';
import { AmlakBoard, Landmarks, SEAT_COLORS, Token } from './board-art.tsx';
import { BOARD, BAIL, GROUP_COLOR, GROUP_FA, STATION_RENT, cardById, priceOf } from './board.ts';
import { terms } from './terms.ts';
import { unmortgageCost, type AmlakView, type LogEntry, type TradeSide } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
/** Seat colour names, in the order of SEAT_COLORS (the rail's «دارایی شما» names your colour, as the reference). */
const SEAT_FA = ['قرمز', 'آبی', 'سبز', 'زرد', 'بنفش', 'نارنجی', 'فیروزه‌ای', 'قهوه‌ای'];
/** Desktop frame (≥900): management and trade go into the rail; on phones the rail is a collapsed line, so they stay on the felt. */
function useWide() {
  const q = '(min-width: 900px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
/** «دارایی شما» pills: cash, then how much of each colour group / stations / utilities you hold. */
function holdings(view: AmlakView, seat: number): string[] {
  const out = [`نقد: ${fa(view.p[seat]!.cash)} هزار`];
  const count = (pick: (i: number) => boolean) => { let n = 0, of = 0; BOARD.forEach((_, i) => { if (pick(i)) { of++; if (view.owner[i] === seat) n++; } }); return [n, of] as const; };
  for (const g of Object.keys(GROUP_FA) as (keyof typeof GROUP_FA)[]) {
    const [n, of] = count((i) => { const b = BOARD[i]!; return b.kind === 'street' && b.group === g; });
    if (n) out.push(`${GROUP_FA[g]}: ${fa(n)} از ${fa(of)}`);
  }
  const [st, stOf] = count((i) => BOARD[i]!.kind === 'station');
  if (st) out.push(`ایستگاه: ${fa(st)} از ${fa(stOf)}`);
  const [ut, utOf] = count((i) => BOARD[i]!.kind === 'utility');
  if (ut) out.push(`شرکت: ${fa(ut)} از ${fa(utOf)}`);
  return out;
}
const money = (n: number) => `${fa(n)} هزار تومان`;
type Hint = { type: string; sq?: number; to?: number; min?: number; max?: number };

function describe(e: LogEntry, name: (s: number) => string): string {
  const who = (s: number) => (s === -1 ? 'بانک' : s === -2 ? 'صندوق پارکینگ' : name(s));
  switch (e.t) {
    case 'roll': return `${name(e.seat)} تاس ریخت: ${fa(e.dice[0])} و ${fa(e.dice[1])}${e.dice[0] === e.dice[1] ? ' (جفت)' : ''}${e.jail === 'stay' ? `؛ در ${tx(terms.jail)} ماند` : e.jail === 'forced' ? '؛ سومین بار — جریمه می‌پردازد' : ''}.`;
    case 'move': return `${name(e.seat)} به «${BOARD[e.to]!.nameFa}» رفت${e.salary ? ` و ${money(e.salary)} حقوق گرفت` : ''}.`;
    case 'buy': return `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را به ${money(e.price)} خرید.`;
    case 'decline': return `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را نخرید.`;
    case 'bid': return `${name(e.seat)} ${money(e.amount)} پیشنهاد داد.`;
    case 'auctionPass': return `${name(e.seat)} از ${tx(terms.auction)} کنار کشید.`;
    case 'auctionWon': return e.seat === null ? `«${BOARD[e.sq]!.nameFa}» در ${tx(terms.auction)} فروش نرفت.` : `${name(e.seat)} «${BOARD[e.sq]!.nameFa}» را در ${tx(terms.auction)} به ${money(e.price)} برد.`;
    case 'pay': return `${name(e.seat)} ${money(e.amount)} به ${who(e.to)} پرداخت${e.why === 'rent' ? ' (اجاره)' : e.why === 'tax' ? ' (مالیات)' : e.why === 'bail' ? ' (جریمه زندان)' : ''}.`;
    case 'collect': return `${name(e.seat)} ${money(e.amount)} گرفت${e.why === 'parking' ? ' (جایزه پارکینگ)' : ''}.`;
    case 'card': return `${name(e.seat)} کارت کشید: ${cardById(e.card).textFa}`;
    case 'jail': return `${name(e.seat)} به ${tx(terms.jail)} رفت${e.why === 'doubles' ? ' (سه جفت پشت‌سرهم)' : ''}.`;
    case 'leaveJail': return `${name(e.seat)} از ${tx(terms.jail)} آزاد شد${e.how === 'bail' ? ' (پرداخت جریمه)' : e.how === 'card' ? ' (کارت آزادی)' : ' (جفت)'}.`;
    case 'build': return `${name(e.seat)} در «${BOARD[e.sq]!.nameFa}» ${e.houses === 5 ? tx(terms.hotel) : 'خانه'} ساخت.`;
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
  if (b.kind === 'street') return [['اجاره زمین', money(b.rents[0])], ['با کل رنگ', money(b.rents[0] * 2)], ...[1, 2, 3, 4].map((h): [string, string] => [`با ${fa(h)} خانه`, money(b.rents[h]!)]), [`با ${tx(terms.hotel)}`, money(b.rents[5])]];
  if (b.kind === 'station') return STATION_RENT.slice(1).map((r, k): [string, string] => [`با ${fa(k + 1)} ایستگاه`, money(r)]);
  if (b.kind === 'utility') return [['با یک شرکت', '۴ × عدد تاس'], ['با هر دو شرکت', '۱۰ × عدد تاس']];
  if (b.kind === 'tax') return [['پرداخت', money(b.amount)]];
  return [];
}

export default function AmlakRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<AmlakView>) {
  useTermsLang(); // re-render when the terms language changes (module-level helpers read it through tx)
  // Undo-window preview of the own buy / build: the ribbon or house is already on the board and the money already paid
  // (all known to the client); undo clears `queued` and it animates back. The roll itself is never previewed.
  const view = useMemo((): AmlakView => {
    if (!queued || mySeat === null) return real;
    const sq = queued.type === 'buy' ? real.p[mySeat]!.pos : queued.type === 'build' ? (queued.sq as number) : -1;
    const b = BOARD[sq];
    if (!b) return real;
    const cost = queued.type === 'buy' ? priceOf(sq) : b.kind === 'street' ? b.house : 0;
    return {
      ...real,
      owner: queued.type === 'buy' ? real.owner.map((o, i) => (i === sq ? mySeat : o)) : real.owner,
      houses: queued.type === 'build' ? real.houses.map((h, i) => (i === sq ? h + 1 : h)) : real.houses,
      p: real.p.map((q, s) => (s === mySeat ? { ...q, cash: q.cash - cost } : q))
    };
  }, [real, queued, mySeat]);
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
  const lastOf = (t: LogEntry['t']) => [...view.log].reverse().find((e) => e.t === t)?.seq ?? 0;
  const rollKey = lastOf('roll');
  // My roll waits in the undo window or for the server: the dice tumble without pips until the result is thrown in.
  const [rollAsked, setRollAsked] = useState(-1);
  const rolling = queued?.type === 'roll' || (busy && rollAsked === rollKey);
  useFlip(root, `${latest?.seq ?? 0}|${queued?.type ?? ''}|${rolling}`);
  const bidHint = hints.find((h) => h.type === 'bid');
  useEffect(() => { if (bidHint) setBid(bidHint.min!); }, [bidHint?.min]); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = view.trade ? view.trade.to : view.phase === 'auction' ? view.auction!.turn : view.phase === 'debt' ? view.debts[0]!.seat : view.current;
  const mine = mySeat !== null && waiting === mySeat && !view.outcome;
  const framed = useInFrame() !== null;
  const wide = useWide();
  const status = view.outcome ? null : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' } : mine
    ? { tone: 'mine' as const, text: view.trade ? 'پیشنهاد معامله برای شما' : view.phase === 'auction' ? `${tx(terms.auction)}: نوبت پیشنهاد شما` : view.phase === 'debt' ? 'بدهی دارید: پول جور کنید' : view.phase === 'buy' ? 'خرید یا مزایده؟' : view.phase === 'end' ? 'کارهای نوبت را انجام دهید یا نوبت را تمام کنید' : 'نوبت شماست: تاس بریزید' }
    : { tone: 'wait' as const, text: `در انتظار ${seatName(waiting)}${view.phase === 'auction' ? ` (${tx(terms.auction)})` : view.phase === 'debt' ? ' (بدهی)' : view.trade ? ' (پاسخ معامله)' : ''}` };

  const manage = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const h of hints) if (['build', 'sell', 'mortgage', 'unmortgage'].includes(h.type)) map.set(h.sq!, [...(map.get(h.sq!) ?? []), h.type]);
    return map;
  }, [hints]);
  const myProps = mySeat === null ? [] : view.owner.map((o, i) => (o === mySeat ? i : -1)).filter((i) => i >= 0);
  const pos = me ? me.pos : 0;
  const debt = view.debts[0];
  const card = view.lastCard ? cardById(view.lastCard.card) : null;
  const cardSeq = lastOf('card');
  // Show the drawn card during the turn it was drawn in.
  const showCard = !!card && cardSeq > lastOf('turn');

  if (framed) {
    // Shared frame (design/games/group-b Amlak §1/§3): rail «دارایی شما»; deed of the square beside the board; one turn card
    // (dice line + buttons) in the dock row with your deeds fanned under it; management and trade in the rail (desktop).
    const sqName = BOARD[pos]?.nameFa ?? '';
    const rollLine = mine && view.lastRoll && view.current === mySeat && (view.phase === 'buy' || view.phase === 'end')
      ? `${fa(view.lastRoll[0])} و ${fa(view.lastRoll[1])} آوردید؛ ${sqName}` : null;
    const sideDeed = !view.trade && view.phase === 'buy' ? pos : !view.trade && view.phase === 'auction' ? view.auction!.sq : null;
    const manageOpen = mine && !view.trade && (view.phase === 'roll' || view.phase === 'end');
    const extras = (
      <>
        {mine && !view.trade && view.phase === 'debt' && debt && (
          <section className="am-panel am-debt" aria-label="تأمین بدهی">
            <p className="am-help">پول نقد شما {money(me!.cash)} است. خانه بفروشید یا ملک رهن بگذارید؛ وقتی پول کافی شد، بدهی خودکار پرداخت می‌شود.</p>
            <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
          </section>
        )}
        {mine && !view.trade && view.phase === 'buy' && myProps.some((i) => manage.has(i)) && (
          <details className="am-panel">
            <summary>{tx(terms.mortgage)} یا فروش برای تأمین پول خرید</summary>
            <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
          </details>
        )}
        {manageOpen && myProps.length > 0 && (
          <details className="am-panel" open={manage.size > 0}>
            <summary>مدیریت املاک (ساخت، فروش، {tx(terms.mortgage)})</summary>
            <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
          </details>
        )}
        {manageOpen && has('offer') && (
          <details className="am-panel" open={tradeOpen} onToggle={(e) => setTradeOpen((e.target as HTMLDetailsElement).open)}>
            <summary>پیشنهاد معامله</summary>
            {tradeOpen && <TradeComposer view={view} mySeat={mySeat!} partners={hints.filter((h) => h.type === 'offer').map((h) => h.to!)} seatName={seatName} busy={busy} send={send} />}
          </details>
        )}
      </>
    );
    return (
      <div className="am am--framed" ref={root}>
        <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          {me && mySeat !== null && (
            <section className="am-assets" aria-label="دارایی شما">
              <h3>دارایی شما<span className="am-assets__note">{SEAT_FA[mySeat]}</span></h3>
              <div className="am-pills">{holdings(view, mySeat).map((t) => <span key={t} className="bgv-chip">{t}</span>)}</div>
            </section>
          )}
          <p className="am-tip"><Icon name="book" size={18} />
            <span>{view.phase === 'buy' && mine
              ? 'اگر نخرید، ملک بین همه مزایده می‌شود و شما هم می‌توانید پیشنهاد بدهید. با همهٔ خیابان‌های هم‌رنگ اجارهٔ زمین دو برابر می‌شود و از آن به بعد می‌توانید خانه بسازید.'
              : `ملک بی‌صاحب را بخرید یا به ${tx(terms.auction)} بروید. ساخت باید یکنواخت باشد. خانه‌های بانک ${fa(view.housesLeft)}، هتل‌ها ${fa(view.hotelsLeft)}.`}</span>
          </p>
          {wide && extras}
        </RailSlot>
        <div className="am-main">
          <div className="am-boardcol">
            <ZoomBoard label="صفحه املاک">
              <AmlakBoard view={view} selected={selected} onSelect={(i) => setSelected(i === selected ? null : i)} seatName={seatName} rollKey={rollKey} rolling={rolling} />
            </ZoomBoard>
          </div>
          <div className="am-side">
            {showCard && card && <CardFace key={cardSeq} seq={cardSeq} id={card.id} text={card.textFa} who={view.lastCard ? seatName(view.lastCard.seat) : ''} />}
            {selected !== null ? <SquareCard view={view} i={selected} seatName={seatName} onClose={() => setSelected(null)} />
              : sideDeed !== null && (
                <figure className="am-sidedeed"><Deed view={view} i={sideDeed} seatName={seatName} />
                  <figcaption>{view.phase === 'auction' ? `در ${tx(terms.auction)}` : 'این ملک صاحب ندارد'}</figcaption></figure>
              )}
          </div>
        </div>
        {/* Phones: in the page, not the sticky dock; an open trade form is taller than the screen and its top could never be reached there. */}
        {!wide && mine && <div className="am-extras">{extras}</div>}
        <DockSlot>
          {mine && (
            <section className="am-panel--decide am-turn" aria-label="تصمیم">
              <div className="am-turn__text">
                {view.trade ? <><b>پیشنهاد معامله از <bdi>{seatName(view.trade.from)}</bdi></b><TradeSummary trade={view.trade} seatName={seatName} /></>
                  : view.phase === 'auction' ? <><b><T t={terms.auction} /></b><small>بالاترین پیشنهاد: {view.auction!.leader === null ? 'هنوز نیست' : <>{money(view.auction!.high)} از <bdi>{seatName(view.auction!.leader)}</bdi></>}</small></>
                  : view.phase === 'debt' && debt ? <><b>بدهی: {money(debt.amount)}</b><small>به {debt.to >= 0 ? <bdi>{seatName(debt.to)}</bdi> : debt.to === -2 ? 'صندوق پارکینگ' : 'بانک'}</small></>
                  : rollLine ? <><b>{rollLine}</b>{view.phase === 'buy' && <small>{money(priceOf(pos))}</small>}</>
                  : <b>{status?.text}</b>}
              </div>
              <div className="am-row">
                {view.trade && <>
                  <Button disabled={busy || !has('acceptTrade')} onClick={() => send({ type: 'acceptTrade' })}>قبول</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'rejectTrade' })}>رد</Button>
                </>}
                {!view.trade && view.phase === 'roll' && <>
                  <Button disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { if (!busy) setRollAsked(rollKey); send({ type: 'roll' }); }}>تاس بریز</Button>
                  {has('payBail') && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'payBail' })}>پرداخت {money(BAIL)} و آزادی</Button>}
                  {has('useCard') && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'useCard' })}>کارت آزادی از زندان</Button>}
                </>}
                {!view.trade && view.phase === 'buy' && <>
                  <Button disabled={busy || !has('buy')} variant={expected?.type === 'buy' ? 'brand' : 'primary'} onClick={() => send({ type: 'buy' })}>خرید به {money(priceOf(pos))}</Button>
                  <Button variant="secondary" icon="players" disabled={busy} onClick={() => send({ type: 'decline' })}>{view.rules.auction ? `نمی‌خرم، ${tx(terms.auction)}` : 'نمی‌خرم'}</Button>
                </>}
                {!view.trade && view.phase === 'auction' && bidHint && <>
                  <label className="am-field">پیشنهاد شما (هزار تومان)
                    <input type="number" inputMode="numeric" min={bidHint.min} max={bidHint.max} value={bid} onChange={(e) => setBid(Number(e.target.value))} />
                  </label>
                  {[1, 10, 50, 100].map((d) => (
                    <button key={d} type="button" className="am-chip" disabled={busy || bidHint.min! + d - 1 > bidHint.max!}
                      onClick={() => setBid(Math.min(bidHint.max!, Math.max(bid, bidHint.min! - 1) + d))}>+{fa(d)}</button>
                  ))}
                  <Button disabled={busy || bid < bidHint.min! || bid > bidHint.max!} onClick={() => send({ type: 'bid', amount: bid })}>ثبت پیشنهاد</Button>
                </>}
                {!view.trade && view.phase === 'auction' && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'pass' })}>کنار می‌کشم</Button>}
                {!view.trade && view.phase === 'debt' && <Button variant="danger" disabled={busy} onClick={() => send({ type: 'bankrupt' })}>اعلام ورشکستگی</Button>}
                {!view.trade && view.phase === 'end' && <Button disabled={busy} variant={expected?.type === 'endTurn' ? 'brand' : 'primary'} onClick={() => send({ type: 'endTurn' })}>پایان نوبت</Button>}
              </div>
              {view.trade && !has('acceptTrade') && <p className="am-help">با وضعیت فعلی این معامله ممکن نیست (پول یا ملک کافی نیست).</p>}
            </section>
          )}
          {myProps.length > 0 && (
            <section className="am-fan" aria-label="سندهای شما">
              {myProps.map((i) => (
                <button key={i} type="button" className="am-fan__card" aria-pressed={selected === i} aria-label={`سند ${BOARD[i]!.nameFa}`} onClick={() => setSelected(i === selected ? null : i)}>
                  <Deed view={view} i={i} seatName={seatName} compact />
                </button>
              ))}
            </section>
          )}
        </DockSlot>
      </div>
    );
  }

  return (
    <div className="am" ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="am-main">
        <div className="am-boardcol">
          <ZoomBoard label="صفحه املاک">
            <AmlakBoard view={view} selected={selected} onSelect={(i) => setSelected(i === selected ? null : i)} seatName={seatName} rollKey={rollKey} rolling={rolling} />
          </ZoomBoard>
          {selected !== null && <SquareCard view={view} i={selected} seatName={seatName} onClose={() => setSelected(null)} />}
        </div>
        <div className="am-side">
          {showCard && card && <CardFace key={cardSeq} seq={cardSeq} id={card.id} text={card.textFa} who={view.lastCard ? seatName(view.lastCard.seat) : ''} />}

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
                  <DockSlot><Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { if (!busy) setRollAsked(rollKey); send({ type: 'roll' }); }}>تاس بریز</Button></DockSlot>
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
                    <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'decline' })}>{view.rules.auction ? `نمی‌خرم (${tx(terms.auction)})` : 'نمی‌خرم'}</Button>
                  </div>
                </>
              )}
              {!view.trade && view.phase === 'auction' && bidHint && (
                <>
                  <h3><T t={terms.auction} /></h3>
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
                <DockSlot><Button size="lg" disabled={busy} variant={expected?.type === 'endTurn' ? 'brand' : 'primary'} onClick={() => send({ type: 'endTurn' })}>پایان نوبت</Button></DockSlot>
              )}
            </section>
          )}

          {mine && !view.trade && view.phase === 'buy' && myProps.some((i) => manage.has(i)) && (
            <details className="am-panel">
              <summary>{tx(terms.mortgage)} یا فروش برای تأمین پول خرید</summary>
              <ManageList view={view} props={myProps} manage={manage} busy={busy} send={send} />
            </details>
          )}

          {mine && !view.trade && (view.phase === 'roll' || view.phase === 'end') && (
            <>
              {myProps.length > 0 && (
                <details className="am-panel" open={manage.size > 0}>
                  <summary>مدیریت املاک (ساخت، فروش، {tx(terms.mortgage)})</summary>
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

          {!framed && <ul className="am-wallets" aria-label="بازیکنان">
            {view.order.map((seat) => {
              const pl = view.p[seat]!;
              const owned = view.owner.map((o, i) => (o === seat ? i : -1)).filter((i) => i >= 0);
              return (
                <li key={seat} data-flip-anchor={`seat-${seat}`} className={['am-wallet', seat === view.current && !view.outcome ? 'am-wallet--turn' : '', pl.bankrupt ? 'am-wallet--out' : ''].join(' ')} style={{ ['--seat' as string]: SEAT_COLORS[seat] }}>
                  <span className="am-wallet__pawn" aria-hidden="true"><svg viewBox="-20 -19 40 36"><Token seat={seat} /></svg><i>{fa(seat + 1)}</i></span>
                  <span className="am-wallet__who">
                    <bdi className="am-wallet__name">{seatName(seat)}</bdi>{seat === mySeat && <span className="am-wallet__me"> (شما)</span>}
                    {pl.inJail && <span className="am-tag"><T t={terms.jail} /></span>}
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
          </ul>}
          {!framed && <p className="am-help">دور {fa(view.round)}{view.rules.rounds ? ` از ${fa(view.rules.rounds)}` : ''}، خانه‌های بانک {fa(view.housesLeft)}، هتل‌ها {fa(view.hotelsLeft)}</p>}

          {!framed && <details className="am-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-8).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>}
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
  const kicker = b.kind === 'street' ? `سند مالکیت، ${GROUP_FA[b.group]}` : b.kind === 'station' ? 'سند ایستگاه' : b.kind === 'utility' ? 'سند شرکت' : 'مالیات';
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
            <span>مالک <bdi>{seatName(owner)}</bdi>{view.mortgaged[i] ? `، در ${tx(terms.mortgage)} (${tx(terms.unmortgage)} ${money(unmortgageCost(i))})` : ''}{view.houses[i] ? `، ${view.houses[i] === 5 ? tx(terms.hotel) : `${fa(view.houses[i]!)} خانه`}` : ''}</span>
          )}
        </footer>
      )}
    </article>
  );
}

/** The drawn card, face up: «شانس» or «صندوق». */
function CardFace({ id, text, who, seq }: { id: string; text: string; who: string; seq: number }) {
  const chance = id.startsWith('ch');
  return (
    <figure data-flip={`card-${seq}`} data-flip-from={chance ? 'deck-chance' : 'deck-chest'} className={chance ? 'am-cardface am-cardface--chance' : 'am-cardface am-cardface--chest'} aria-label={`${chance ? tx(terms.chance) : tx(terms.chest)}: ${text}`}>
      <span className="am-cardface__badge" aria-hidden="true">{chance ? '؟' : '▣'}</span>
      <figcaption><span className="am-cardface__kind">{chance ? tx(terms.chance) : tx(terms.chest)}، <bdi>{who}</bdi></span>{text}</figcaption>
    </figure>
  );
}

function ManageList({ view, props, manage, busy, send }: { view: AmlakView; props: number[]; manage: Map<number, string[]>; busy: boolean; send: (a: Record<string, unknown>) => void }) {
  const LABEL: Record<string, (i: number) => string> = {
    build: (i) => { const b = BOARD[i]!; return `ساخت ${view.houses[i] === 4 ? tx(terms.hotel) : 'خانه'} (${money(b.kind === 'street' ? b.house : 0)})`; },
    sell: (i) => { const b = BOARD[i]!; return `فروش ساختمان (+${money(b.kind === 'street' ? b.house / 2 : 0)})`; },
    mortgage: (i) => `${tx(terms.mortgage)} (+${money(priceOf(i) / 2)})`,
    unmortgage: (i) => `${tx(terms.unmortgage)} (${money(unmortgageCost(i))})`
  };
  return (
    <ul className="am-manage">
      {props.map((i) => {
        const b = BOARD[i]!;
        const acts = manage.get(i) ?? [];
        return (
          <li key={i}>
            <span>{b.kind === 'street' && <span className="am-swatch" style={{ background: GROUP_COLOR[b.group] }} aria-hidden="true" />}{b.nameFa}{view.houses[i] ? `، ${view.houses[i] === 5 ? tx(terms.hotel) : `${fa(view.houses[i]!)} خانه`}` : ''}{view.mortgaged[i] ? `، در ${tx(terms.mortgage)}` : ''}</span>
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
        <label key={i} className="am-check"><input type="checkbox" checked={sideVal.props.includes(i)} onChange={() => toggle(sideVal, set, i)} />{BOARD[i]!.nameFa}{view.mortgaged[i] ? ` (${tx(terms.mortgage)})` : ''}</label>
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
