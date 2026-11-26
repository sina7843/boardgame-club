// شگفتی‌ها: دوئل renderer: a sandstone court. The age structure is laid out as overlapping cards (face-down backs by
// age, purple for guilds); uncovered cards lift and can be picked to build, sell or turn into a wonder. Between the two
// cities runs the conflict track with its pawn and coin tokens; progress tokens sit on discs above it.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, T, tx, getTermsLang, type Term, useTermsLang, useFlip, useFresh, useInFrame, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import artBrown from './art/col-brown.webp';
import artGrey from './art/col-grey.webp';
import artBlue from './art/col-blue.webp';
import artRed from './art/col-red.webp';
import artGreen from './art/col-green.webp';
import artYellow from './art/col-yellow.webp';
import artPurple from './art/col-purple.webp';
import pAgr from './art/wd-p1.png';
import pArc from './art/wd-p2.png';
import pEco from './art/wd-p3.png';
import pLaw from './art/wd-p4.png';
import pMas from './art/wd-p5.png';
import pMat from './art/wd-p6.png';
import pStr from './art/wd-p8.png';
import pThe from './art/wd-p9.png';
import wPyr from './art/wd-w1.png';
import wCol from './art/wd-w2.png';
import wMau from './art/wd-w5.png';
import wLib from './art/wd-w6.png';
import wZeus from './art/wd-w9.png';
import pen2 from './art/wd-pen2.png';
import pen5 from './art/wd-pen5.png';
import boardArt from './art/wd-board.png';
import { terms, phrases, nameOf, PROGRESS_DESC } from './terms.ts';
import { CARDS, WONDERS, type Card, type Color, type DuelView, type Progress, type Res } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const SCI: Record<string, string> = { wheel: '⚙', compass: '⌖', quill: '✒', mortar: '⚗', sundial: '◷', globe: '◍', law: '⚖' };
const COLOR_T: Record<Color, Term> = { brown: terms.raw, grey: terms.manufactured, blue: terms.civilian, red: terms.military, green: terms.science, yellow: terms.commercial, purple: terms.guild };
const colorName = (c: Color) => tx(COLOR_T[c]);
const RES_T: Record<Res, Term> = { W: terms.wood, C: terms.clay, S: terms.stone, G: terms.glass, P: terms.papyrus };
const resName = (r: Res) => tx(RES_T[r]);
const PROG_T: Record<Progress, Term> = { agriculture: terms.agriculture, architecture: terms.architecture, economy: terms.economy, law: terms.law, masonry: terms.masonry, mathematics: terms.mathematics, philosophy: terms.philosophy, strategy: terms.strategy, theology: terms.theology, urbanism: terms.urbanism };
const progName = (p: Progress) => tx(PROG_T[p]);
// One BGA 7 Wonders Duel card picture per card colour (see DECISIONS.md).
const ART: Record<Color, string> = { brown: artBrown, grey: artGrey, blue: artBlue, red: artRed, green: artGreen, yellow: artYellow, purple: artPurple };
// Printed art (design/games/group-d/art/wonders-duel). Only the progress tokens and wonders the engine shares with the printed set have art; others keep the text token.
const PROG_ART: Partial<Record<Progress, string>> = { agriculture: pAgr, architecture: pArc, economy: pEco, law: pLaw, masonry: pMas, mathematics: pMat, strategy: pStr, theology: pThe };
const WONDER_ART: Record<number, string> = { 8: wPyr, 2: wCol, 6: wMau, 3: wLib, 10: wZeus };
const RES_LETTER_FA: Record<Res, string> = { W: 'چ', C: 'ر', S: 'س', G: 'ش', P: 'پ' };
const resLetter = (r: Res) => (getTermsLang() === 'fa-bg' ? r : RES_LETTER_FA[r]);
const progDesc = (p: Progress) => tx(PROGRESS_DESC[p]!);

export function Cost({ cost, coins }: { cost: string; coins?: number }) {
  useTermsLang();
  if (!cost && !coins) return <span className="wd-cost wd-cost--free">{tx(terms.free)}</span>;
  return (
    <span className="wd-cost" aria-label={`${tx(terms.cost)}: ${[coins ? `${fa(coins)} ${tx(terms.coin)}` : '', ...[...cost].map((r) => resName(r as Res))].filter(Boolean).join('، ')}`}>
      {coins ? <i className="wd-coin">{fa(coins)}</i> : null}
      {[...cost].map((r, i) => <i key={i} className={`wd-res wd-res--${r}`}>{resLetter(r as Res)}</i>)}
    </span>
  );
}

export function effectText(c: Card) {
  const out: string[] = [];
  if (c.prod) out.push([...c.prod].map((r) => resName(r as Res)).join('+'));
  if (c.choice) out.push([...c.choice].map((r) => resName(r as Res)).join('/'));
  if (c.shields) out.push(`${'⚔'.repeat(c.shields)}`);
  if (c.sci) out.push(SCI[c.sci]!);
  if (c.vp) out.push(`${fa(c.vp)}★`);
  if (c.trade) out.push(`${[...c.trade].map((r) => resName(r as Res)).join('/')} ${tx(terms.toOne)}`);
  if (c.gain) out.push(`${fa(c.gain)} ${tx(terms.coin)}`);
  if (c.per) out.push(`${tx(terms.coinsFor)} ${c.per === 'wonder' ? tx(terms.wonder) : colorName(c.per)}`);
  if (c.guild) out.push(c.guild === 'wonder' ? tx(terms.wonders) : c.guild === 'coins' ? tx(terms.wealth) : c.guild.map((g) => colorName(g)).join('+'));
  return out.join('، ');
}

export function CardFace({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  useTermsLang();
  const c = CARDS[id]!;
  return (
    <span className={`wd-card wd-card--${size} wd-c--${c.color}`} aria-label={`${nameOf(c.name)}: ${effectText(c)}`}>
      <img className="wd-card__art" src={ART[c.color]} alt="" draggable={false} />
      <span className="wd-card__band">{effectText(c)}</span>
      <span className="wd-card__name">{nameOf(c.name)}</span>
      {size === 'md' && <Cost cost={c.cost} coins={c.coins} />}
      {c.chain && size === 'md' && <small className="wd-card__chain" title={tx(terms.chain)}>⛓</small>}
    </span>
  );
}

export function WonderPlate({ id, built, size = 'md' }: { id: number; built?: boolean; size?: 'sm' | 'md' }) {
  useTermsLang();
  const w = WONDERS[id]!;
  const fx = [w.vp ? `${fa(w.vp)}★` : '', w.coins ? `${fa(w.coins)} ${tx(terms.coin)}` : '', w.steal ? `${tx(terms.opponent)} −${fa(w.steal)}` : '', w.shields ? '⚔'.repeat(w.shields) : '',
    w.choice ? [...w.choice].map((r) => resName(r as Res)).join('/') : '', w.replay ? tx(terms.replay) : '', w.destroy ? `${tx(terms.destroyN)} ${colorName(w.destroy)}` : '',
    w.mausoleum ? tx(terms.fromDiscard) : '', w.library ? tx(terms.hiddenToken) : ''].filter(Boolean).join('، ');
  return (
    <span className={`wd-wonder wd-wonder--${size} ${built ? 'is-built bg-pop' : ''}`} aria-label={`${nameOf(w.name)}${built ? tx(terms.builtP) : ''}: ${fx}`}>
      {WONDER_ART[id] ? <img className="wd-wonder__art" src={WONDER_ART[id]} alt="" draggable={false} /> : <>
        <span className="wd-wonder__name">{nameOf(w.name)}</span>
        <span className="wd-wonder__fx">{fx}</span>
      </>}
      {size === 'md' && !built && <Cost cost={w.cost} />}
    </span>
  );
}

function City({ view, seat, label, framed }: { view: DuelView; seat: number; label: string; framed: boolean }) {
  useTermsLang();
  const cards = view.cities[seat]!.map((id) => CARDS[id]!);
  const colors: Color[] = ['brown', 'grey', 'yellow', 'blue', 'red', 'green', 'purple'];
  const pop = usePop(view.coins[seat]);
  return (
    <section className={`wd-city ${view.current === seat && !view.outcome ? 'wd-city--now' : ''}`} aria-label={`${tx(terms.city)} ${label}`} data-flip-anchor={`city-${seat}`}>
      <div className="wd-city__head">
        {!framed && <bdi className="wd-city__name">{label}</bdi>}
        {!framed && <span className={`wd-coin wd-coin--lg ${pop}`} key={view.coins[seat]}>{fa(view.coins[seat]!)}</span>}
        {view.progress[seat]!.map((p) => <span key={p} data-flip={`t${p}`} className="wd-token wd-token--sm" title={progDesc(p)}>{PROG_ART[p] ? <img className="wd-token__art" src={PROG_ART[p]} alt={progName(p)} draggable={false} /> : progName(p)}</span>)}
      </div>
      <div className="wd-city__wonders">{view.wonders[seat]!.map((w) => <span key={w.id} className="wd-fly" data-flip={`w${w.id}`}><WonderPlate id={w.id} built={w.built} size="sm" /></span>)}</div>
      <div className="wd-city__cols">
        {colors.map((col) => {
          const xs = cards.filter((c) => c.color === col);
          return xs.length ? <span key={col} className={`wd-stack wd-c--${col}`} title={xs.map((c) => nameOf(c.name)).join('، ')}>{xs.map((c) => <span key={c.id} className="wd-fly" data-flip={`c${c.id}`} data-flip-exit="drop"><CardFace id={c.id} size="sm" /></span>)}</span> : null;
        })}
        {!cards.length && <small>{tx(terms.noBuildings)}</small>}
      </div>
    </section>
  );
}

type Hint = { type: string; slot?: number; token?: string; wonder?: number } | null;

/** The served view with my queued move already made, from what the client knows: the picked (face-up) card or wonder,
 * the coins it costs or earns. Card effects and newly revealed cards wait for the server. */
function preview(v: DuelView, me: number, q: GameAction | null | undefined, legal: readonly GameAction[]): DuelView {
  if (!q || q.type === 'resign') return v;
  const same = legal.find((a) => a.type === q.type && a.slot === q.slot && a.wonder === q.wonder && a.token === q.token) as { cost?: number; coins?: number } | undefined;
  const coins = v.coins.map((c, s) => (s === me ? c - (same?.cost ?? 0) + (q.type === 'discard' ? same?.coins ?? 0 : 0) : c));
  const mine = <T,>(xs: T[][], f: (x: T[]) => T[]) => xs.map((x, s) => (s === me ? f(x) : x));
  if (q.type === 'draftWonder') return { ...v, draftPool: v.draftPool.filter((w) => w !== q.wonder), wonders: mine(v.wonders, (ws) => [...ws, { id: q.wonder as number, built: false }]) };
  if (q.type === 'progress') return { ...v, progressBoard: v.progressBoard.filter((p) => p !== q.token), progress: mine(v.progress, (ps) => [...ps, q.token as Progress]) };
  if (q.type === 'build' || q.type === 'discard' || q.type === 'wonder') {
    const slot = v.structure[q.slot as number];
    if (!slot || slot.card === null) return v;
    return {
      ...v, coins,
      structure: v.structure.map((x, i) => (i === q.slot ? { ...x, taken: true } : x)),
      accessible: v.accessible.filter((i) => i !== q.slot),
      cities: q.type === 'build' ? mine(v.cities, (c) => [...c, slot.card!]) : v.cities,
      wonders: q.type === 'wonder' ? mine(v.wonders, (ws) => ws.map((w) => (w.id === q.wonder ? { ...w, built: true } : w))) : v.wonders
    };
  }
  return v;
}

export default function WondersDuelRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<DuelView>) {
  useTermsLang();
  const me = mySeat ?? 0;
  // Undo-window preview: my queued pick/build/sale is shown at once; undo clears `queued` and everything flies back.
  const view = preview(served, me, queued, legalActions);
  const opp = 1 - me;
  // Cards glide pyramid → city, wonders draft → city, progress tokens board → city; newly revealed pyramid cards flip face-up.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const fresh = useFresh(view.structure.filter((x) => !x.taken && x.card !== null).map((x) => `c${x.card}`));
  let fi = 0;
  const hint = expected as unknown as Hint;
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { setPick(null); }, [view.seq]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const of = (t: string) => legalActions.filter((a) => a.type === t);
  const myTurn = view.phase === 'play' && view.current === me && legalActions.some((a) => a.type === 'discard') && !queued;
  const sel = pick;
  const build = of('build').find((a) => a.slot === sel) as { cost: number } | undefined;
  const sell = of('discard').find((a) => a.slot === sel) as { coins: number } | undefined;
  const wonders = of('wonder').filter((a) => a.slot === sel) as unknown as { wonder: number; cost: number }[];
  const drafting = queued ? [] : of('draftWonder');
  const choosing = view.choice && view.choice.seat === me && !queued ? view.choice : null;

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : drafting.length ? { tone: 'mine' as const, text: tx(phrases.pickWonder) }
      : choosing ? { tone: 'mine' as const, text: choosing.kind === 'destroy' ? tx(phrases.destroyCard) : choosing.kind === 'mausoleum' ? tx(phrases.buildDiscarded) : tx(phrases.takeProgress) }
        : myTurn ? { tone: 'mine' as const, text: sel === null ? tx(phrases.pickFree) : tx(phrases.buildSellWonder) }
          : { tone: 'wait' as const, text: view.phase === 'draft' ? `${seatName(1 - me)} ${tx(terms.wonder)} ${tx(terms.picks)}` : `نوبت ${seatName(view.current)}` };

  const framed = useInFrame() !== null; // the shell draws players, coins, whose-turn
  const lead = me === 0 ? view.military : -view.military;
  const maxX = Math.max(...view.structure.map((x) => x.x)) + 2;
  const rows = Math.max(...view.structure.map((x) => x.row), 0) + 1;

  return (
    <div className="wd" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>با <T t={terms.conflict} /> ۹ خانه‌ای، ۶ <T t={terms.scienceSymbol} /> متفاوت یا امتیاز پایانی بالاتر برنده شوید. هر نوبت یک <T t={terms.card} /> آزاد را <T t={terms.buildV} />، <T t={terms.sellV} /> یا برای <T t={terms.wonder} /> بنا کنید.</p>
        </RailSlot>
      )}
      <City view={view} seat={opp} label={who(opp)} framed={framed} />

      {/* Printed board (handoff wd-board.png, 1300×367): the conflict track's 19 positions run x 80 → 1218 at y 205
          (the opponent's capital on the left), the military tokens lie in the bottom slots and the progress tokens in
          the five circles at the top. Positions are percentages of the art. */}
      <section className="wd-track wd-board" dir="ltr" style={{ backgroundImage: `url(${boardArt})` }} aria-label={`${tx(terms.conflict)}: ${lead > 0 ? `شما ${fa(lead)} خانه جلوترید` : lead < 0 ? `حریف ${fa(-lead)} خانه جلوتر است` : 'برابر'}`}>
        {([[opp, 1, -6, 30.6, pen5, '۵'], [opp, 0, -3, 42.2, pen2, '۲'], [me, 0, 3, 56.8, pen2, '۲'], [me, 1, 6, 69.2, pen5, '۵']] as const).map(([s, i, k, x, src, alt]) => !view.milTokens[s]![i] && (
          <i key={k} className="wd-mtok wd-board__tok" style={{ left: `${x}%` }} data-flip={`m${s}${k}`} data-flip-exit={`city-${s}`}><img src={src} alt={alt} draggable={false} /></i>
        ))}
        <span className="wd-pawn" data-flip="pawn" style={{ left: `${((80 + (9 - lead) * 63.2) / 1300) * 100}%` }} aria-hidden />

      <div className="wd-progress wd-board__prog" aria-label={tx(terms.progressTokens)}>
        {view.progressBoard.map((p) => {
          const can = choosing && (choosing.kind === 'progress') && legalActions.some((a) => a.type === 'progress' && a.token === p);
          return can
            ? <button key={p} type="button" data-flip={`t${p}`} className={`wd-token ${hint?.token === p ? 'wd-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'progress', token: p })} title={progDesc(p)}>{PROG_ART[p] ? <img className="wd-token__art" src={PROG_ART[p]} alt={progName(p)} draggable={false} /> : <><b>{progName(p)}</b><small>{progDesc(p)}</small></>}</button>
            : <span key={p} data-flip={`t${p}`} className="wd-token" title={progDesc(p)}>{PROG_ART[p] ? <img className="wd-token__art" src={PROG_ART[p]} alt={progName(p)} draggable={false} /> : <><b>{progName(p)}</b><small>{progDesc(p)}</small></>}</span>;
        })}
      </div>
      </section>

      {drafting.length > 0 || view.phase === 'draft' ? (
        <section className="wd-draft" aria-label={`${tx(terms.pick)} ${tx(terms.wonder)}`}>
          {view.draftPool.map((w) => drafting.length
            ? <button key={w} type="button" data-flip={`w${w}`} className="wd-pickw" disabled={busy} onClick={() => onAction({ type: 'draftWonder', wonder: w })}><WonderPlate id={w} /></button>
            : <span key={w} data-flip={`w${w}`} className="wd-pickw"><WonderPlate id={w} /></span>)}
        </section>
      ) : (
        <section className="wd-age" aria-label={`${tx(terms.age)} ${fa(view.age)}`}>
          <p className="wd-age__title">{tx(terms.age)} {getTermsLang() === 'fa-bg' ? ['', 'I', 'II', 'III'][view.age] : ['', 'یکم', 'دوم', 'سوم'][view.age]}</p>
          <div className="wd-pyr" dir="ltr" style={{ ['--cols' as string]: maxX, ['--rows' as string]: rows }}>
            {view.structure.map((x, i) => {
              if (x.taken) return null;
              const free = view.accessible.includes(i);
              const style = { insetInlineStart: `calc(${x.x} * var(--hw))`, insetBlockStart: `calc(${x.row} * var(--rh))`, zIndex: x.row + 1 };
              const isNew = x.card !== null && fresh.has(`c${x.card}`);
              const face = x.card !== null
                ? <span className={isNew ? 'wd-flipwrap bg-flip-in' : 'wd-flipwrap'} style={isNew ? { ['--i' as string]: Math.min(fi++, 8) } : undefined}><CardFace id={x.card} /></span>
                : <span className={`wd-back wd-back--${x.back}`} aria-label={tx(terms.faceDown)} />;
              const fid = x.card !== null ? `c${x.card}` : `b${view.age}-${i}`;
              return free && myTurn
                ? <button key={i} type="button" data-flip={fid} data-flip-exit="drop" data-flip-enter={isNew ? 'none' : undefined} style={style} disabled={busy} aria-pressed={sel === i} onClick={() => setPick(sel === i ? null : i)}
                  className={['wd-slot wd-slot--free', sel === i ? 'wd-slot--on' : '', hint?.slot === i && sel !== i ? 'wd-hint' : ''].join(' ')}>{face}</button>
                : <span key={i} data-flip={fid} data-flip-exit="drop" data-flip-enter={isNew ? 'none' : undefined} style={style} className={`wd-slot ${free ? 'wd-slot--free' : ''}`}>{face}</span>;
            })}
          </div>
        </section>
      )}

      {myTurn && sel !== null && (
        <div className="wd-acts" role="group" aria-label={tx(terms.cardActions)}>
          <Button size="sm" disabled={busy || !build} className={hint?.type === 'build' ? 'wd-hint' : ''} onClick={() => onAction({ type: 'build', slot: sel })}>
            {build ? `${tx(terms.build)} (${build.cost ? `${fa(build.cost)} ${tx(terms.coin)}` : tx(terms.free)})` : `${tx(terms.build)} (${tx(terms.cantBuild)})`}
          </Button>
          {sell && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'discard' ? 'wd-hint' : ''} onClick={() => onAction({ type: 'discard', slot: sel })}>{tx(terms.sell)} (+{fa(sell.coins)} {tx(terms.coin)})</Button>}
          {wonders.map((w) => <Button key={w.wonder} size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'wonder', slot: sel, wonder: w.wonder })}>{tx(terms.wonderOf)} {nameOf(WONDERS[w.wonder]!.name)} ({fa(w.cost)} {tx(terms.coin)})</Button>)}
        </div>
      )}

      {choosing && choosing.kind === 'library' && choosing.options && (
        <div className="wd-acts">{(choosing.options as Progress[]).map((p) => <Button key={p} size="sm" disabled={busy} onClick={() => onAction({ type: 'progress', token: p })}>{progName(p)}</Button>)}</div>
      )}
      {choosing && (choosing.kind === 'destroy' || choosing.kind === 'mausoleum') && (
        <div className="wd-acts">{(choosing.options as number[]).map((id) => <button key={id} type="button" className="wd-pickw" disabled={busy} onClick={() => onAction({ type: choosing.kind, card: id })}><CardFace id={id} /></button>)}</div>
      )}

      {!framed && view.last && view.last.kind !== 'draft' && view.phase !== 'draft' && (
        <p className="wd-last" key={view.seq}><bdi>{who(view.last.seat)}</bdi>: {view.last.kind === 'build' ? `${tx(terms.build)} ${nameOf(CARDS[view.last.card!]!.name)}` : view.last.kind === 'discard' ? `${tx(terms.sale)} ${nameOf(CARDS[view.last.card!]!.name)} (+${fa(view.last.coins!)})` : view.last.kind === 'wonder' ? `${tx(terms.wonderOf)} ${nameOf(WONDERS[view.last.wonder!]!.name)}` : view.last.kind === 'progress' ? `${tx(terms.take)} ${tx(terms.progressToken)}` : view.last.kind === 'destroy' ? `${tx(terms.destroyN)} ${nameOf(CARDS[view.last.card!]!.name)}` : `${tx(terms.buildFromDiscard)}: ${nameOf(CARDS[view.last.card!]!.name)}`}</p>
      )}
      <City view={view} seat={me} label={who(me)} framed={framed} />
    </div>
  );
}
