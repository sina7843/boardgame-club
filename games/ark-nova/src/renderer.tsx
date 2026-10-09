// آرک نوا renderer: a zoo-planning table. Your decision panel and your zoo come first (Action cards with their strength,
// tracks, map with painted grass/water/rock and every building), then the shared boards (break track, the six display
// folders with your reputation range, conservation projects and the association board), the rival zoos and a short log.
// Every prompt is answerable by tap or keyboard: option buttons (cards shown as compact cards), card picks with «ثبت»,
// and building placement by tapping map spaces or choosing from a list. The spatial map alone is dir="ltr".
import './renderer.css';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import icBird from './art/ic-bird.webp';
import icHerbivore from './art/ic-herbivore.webp';
import icPredator from './art/ic-predator.webp';
import icPrimate from './art/ic-primate.webp';
import icReptile from './art/ic-reptile.webp';
import icBear from './art/ic-bear.webp';
import icPet from './art/ic-pet.webp';
import icScience from './art/ic-science.webp';
import icAfrica from './art/ic-africa.webp';
import icAmericas from './art/ic-americas.webp';
import icAsia from './art/ic-asia.webp';
import icAustralia from './art/ic-australia.webp';
import icEurope from './art/ic-europe.webp';
import texGrass from './art/tex-grass.webp';
import texWater from './art/tex-water.webp';
import texRock from './art/tex-rock.webp';
import {
  ACTION_FA, ANIMAL, ICON_FA, KIND_FA, PROJECT, REG, SPONSOR, TILES, UNI_FA, CELLS, xy, nameOf,
  type ActionKey, type ArkView, type MapView, type Icon, type Req
} from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
/** Engine prompt texts carry Latin digits; show them in Persian. */
const faDigits = (t: string) => t.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
type PlayerView = ArkView['players'][number];
type Placement = { kind: string; cells: string[] };
type PromptView = { seat: number; k: 'option' | 'pick' | 'place'; label: string; optional: boolean; options?: { value: string; label: string }[];
  ids?: number[]; min?: number; max?: number; kinds?: string[]; placements?: Placement[] };

// Painted emblems (one generated sheet, see DECISIONS.md). Rock and water icons use the map textures.
const ICON_ART: Partial<Record<Icon, string>> = {
  bird: icBird, herbivore: icHerbivore, predator: icPredator, primate: icPrimate, reptile: icReptile, bear: icBear, pet: icPet,
  science: icScience, africa: icAfrica, americas: icAmericas, asia: icAsia, australia: icAustralia, europe: icEurope, rock: texRock, water: texWater
};
export function IconChip({ i, n }: { i: Icon; n?: number }) {
  return (
    <span className={`an-ic an-ic--${i}`} title={ICON_FA[i]}>
      <img src={ICON_ART[i]} alt={ICON_FA[i]} draggable={false} />
      {n !== undefined && n > 1 && <b>{fa(n)}</b>}
    </span>
  );
}

const REQ_FA = (k: string, n: number) =>
  k === 'partner' ? (n > 1 ? `${fa(n)} باغ‌وحش همکار` : 'باغ‌وحش همکار هم‌قاره') : k === 'animals2' ? 'کارت حیوانات ارتقایافته'
  : k === 'sponsors2' ? 'کارت حامیان ارتقایافته' : k === 'appeal25' ? 'جذابیت حداکثر ۲۵' : k === 'rep' ? `اعتبار دست‌کم ${fa(n)}`
  : `${fa(n)} نماد ${ICON_FA[k as Icon] ?? k}`;
const reqText = (r: Req) => (Object.entries(r) as [string, number][]).map(([k, n]) => REQ_FA(k, n)).join('، ');
const rewards = (d: { appeal: number; cp: number; rep: number }) =>
  [d.appeal ? `${fa(d.appeal)} جذابیت` : '', d.cp ? `${fa(d.cp)} حفاظت` : '', d.rep ? `${fa(d.rep)} اعتبار` : ''].filter(Boolean).join(' · ');
const iconCounts = (list: Icon[]) => { const m = new Map<Icon, number>(); for (const i of list) m.set(i, (m.get(i) ?? 0) + 1); return [...m]; };
const SP_FA: Record<string, string> = { pz: 'باغ‌وحش کودکان', rh: 'خانهٔ خزندگان', ba: 'قفس بزرگ پرندگان' };

/** Plain-text summary of a card (for labels and screen readers). */
export function cardLine(id: number): string {
  const a = ANIMAL[id];
  if (a) return `${nameOf(id)} — حیوان، ${fa(a.cost)} پول، ${a.std ? `محوطهٔ ${fa(a.size)}` : 'باغ‌وحش کودکان'}، ${a.icons.map((i) => ICON_FA[i]).join('/')}، +${fa(a.appeal)} جذابیت`;
  const s = SPONSOR[id];
  if (s) return `${nameOf(id)} — حامی سطح ${fa(s.level)}${s.icons.length ? `، ${s.icons.map((i) => ICON_FA[i]).join('/')}` : ''}`;
  if (PROJECT[id]) return `${nameOf(id)} — پروژهٔ حفاظت`;
  return nameOf(id);
}

/** Compact card: type band, name, cost, needs, icons, conditions, rewards and the effect text. */
function CardFace({ id, full = true }: { id: number; full?: boolean }) {
  const a = ANIMAL[id];
  const s = SPONSOR[id];
  const pr = PROJECT[id];
  const d = REG.cards.get(id);
  if (a) {
    const terr = [a.water ? `${fa(a.water)} آب` : '', a.rock ? `${fa(a.rock)} صخره` : ''].filter(Boolean).join(' و ');
    return (
      <>
        <span className="an-card__head"><b>{nameOf(id)}</b><span className="an-cost">{fa(a.cost)}</span></span>
        <span className="an-card__icons">{iconCounts(a.icons).map(([i, n]) => <IconChip key={i} i={i} n={n} />)}</span>
        <small>{a.std ? `محوطهٔ ${fa(a.size)}+` : 'فقط باغ‌وحش کودکان'}{a.sp && a.std ? ` یا ${SP_FA[a.sp.k]}` : ''}{terr ? `، کنار ${terr}` : ''}</small>
        {Object.keys(a.req).length > 0 && <small className="an-req">شرط: {reqText(a.req)}</small>}
        {rewards(a) && <small className="an-gain">{rewards(a)}</small>}
        {full && a.ab.map(([k, v]) => { const impl = REG.abilities[k]; return impl ? <small key={k} className="an-fx"><b>{impl.nameFa}{typeof v === 'number' && v ? ` ${fa(v)}` : ''}:</b> {impl.textFa(v, id)}</small> : null; })}
      </>
    );
  }
  if (s) {
    return (
      <>
        <span className="an-card__head"><b>{nameOf(id)}</b><span className="an-cost an-cost--lvl">{fa(s.level)}</span></span>
        {s.icons.length > 0 && <span className="an-card__icons">{iconCounts(s.icons).map(([i, n]) => <IconChip key={i} i={i} n={n} />)}</span>}
        {(s.rock > 0 || s.water > 0) && <small>{[s.water ? `${fa(s.water)} نماد آب` : '', s.rock ? `${fa(s.rock)} نماد صخره` : ''].filter(Boolean).join('، ')}</small>}
        {Object.keys(s.req).length > 0 && <small className="an-req">شرط: {reqText(s.req)}</small>}
        {rewards(s) && <small className="an-gain">{rewards(s)}</small>}
        {full && d?.textFa && <small className="an-fx">{d.textFa}</small>}
      </>
    );
  }
  if (pr) {
    return (
      <>
        <span className="an-card__head"><b>{nameOf(id)}</b></span>
        {full && REG.projects.get(id)?.textFa && <small className="an-fx">{REG.projects.get(id)!.textFa}</small>}
        <small>{pr.slots.map((sl) => `${sl.need ? fa(sl.need) : sl.size === 4 ? '۴–۵' : sl.size === 2 ? '۱–۲' : fa(sl.size ?? 0)} → ${fa(sl.cp)}${sl.rep ? `+${fa(sl.rep)}ا` : ''}`).join(' · ')} حفاظت</small>
      </>
    );
  }
  const sc = REG.scoring.get(id);
  return <><span className="an-card__head"><b>{nameOf(id)}</b></span>{sc && <small className="an-fx">{sc.textFa}</small>}</>;
}
const kindOf = (id: number) => (ANIMAL[id] ? 'animal' : SPONSOR[id] ? 'sponsor' : PROJECT[id] ? 'project' : 'scoring');
function Card({ id, selected, onClick, disabled, flip, hint, full }: { id: number; selected?: boolean; onClick?: () => void; disabled?: boolean; flip?: boolean; hint?: boolean; full?: boolean }) {
  const cls = ['an-card', `an-card--${kindOf(id)}`, selected ? 'an-card--on' : '', hint ? 'an-hint' : ''].join(' ');
  const motion = flip ? { 'data-flip': `card-${id}`, 'data-flip-from': 'deck' } : {};
  return onClick
    ? <button type="button" className={cls} aria-pressed={selected} onClick={onClick} disabled={disabled} aria-label={cardLine(id)} {...motion}><CardFace id={id} full={full} /></button>
    : <article className={cls} aria-label={cardLine(id)} {...motion}><CardFace id={id} full={full} /></article>;
}

/** A tracked number that pops when it changes. */
function Track({ label, value, extra }: { label: string; value: number; extra?: string }) {
  const pop = usePop(value);
  return <span className="an-track"><small>{label}</small><b key={value} className={pop}>{fa(value)}</b>{extra && <small>{extra}</small>}</span>;
}

// ---------------- Zoo map ----------------
const R = 16;
const H = (Math.sqrt(3) / 2) * R;
const center = (c: string) => { const [x, y] = xy(c); return [x * 1.5 * R + R + 2, y * H + H + 2] as const; };
const hexPath = (c: string) => {
  const [cx, cy] = center(c);
  return Array.from({ length: 6 }, (_, k) => { const t = (Math.PI / 3) * k; return `${(cx + R * 0.97 * Math.cos(t)).toFixed(1)},${(cy + R * 0.97 * Math.sin(t)).toFixed(1)}`; }).join(' ');
};
const KIND_SHORT: Record<string, string> = { e1: '۱', e2: '۲', e3: '۳', e4: '۴', e5: '۵', kiosk: 'ک', pavilion: 'آ', pz: 'کو', rh: 'خز', ba: 'پر' };
const kindName = (k: string) => KIND_FA[k] ?? REG.cards.get(Number(k.slice(1)))?.building?.nameFa ?? nameOf(Number(k.slice(1)));

function ZooMap({ map, player, preview, targets, onCell, label, hintCells }: {
  map: MapView; player: PlayerView; preview?: string[]; targets?: Set<string>; onCell?: (c: string) => void; label: string; hintCells?: string[];
}) {
  const uid = useId().replace(/:/g, '');
  const owner = new Map<string, PlayerView['buildings'][number]>();
  for (const b of player.buildings) for (const c of b.cells) owner.set(c, b);
  const pv = new Set(preview ?? []);
  const hint = new Set(hintCells ?? []);
  return (
    <div dir="ltr" className="an-map-wrap">
      <svg className="an-map" viewBox={`0 0 ${9 * 1.5 * R + R + 4} ${13 * H + H + 4}`} role="group" aria-label={label}>
        <defs>
          {([['g', texGrass], ['w', texWater], ['r', texRock]] as const).map(([k, src]) => (
            <pattern key={k} id={`${uid}${k}`} patternUnits="userSpaceOnUse" width="48" height="48"><image href={src} width="48" height="48" preserveAspectRatio="xMidYMid slice" /></pattern>
          ))}
        </defs>
        {CELLS.map((c) => {
          const b = owner.get(c);
          const water = map.water.includes(c);
          const rock = map.rock.includes(c);
          const blocked = map.blocked.includes(c);
          const fill = b ? undefined : water ? `url(#${uid}w)` : rock ? `url(#${uid}r)` : blocked ? undefined : `url(#${uid}g)`;
          const target = targets?.has(c);
          const cls = ['an-hex', blocked ? 'an-hex--blocked' : '', map.upgrade.includes(c) ? 'an-hex--up' : '',
            b ? `an-hex--b an-hex--${b.kind.startsWith('u') ? 'unique' : b.kind}${b.full ? ' an-hex--full' : ''}` : '',
            pv.has(c) ? 'an-hex--preview' : '', target ? 'an-hex--target' : '', hint.has(c) ? 'an-hex--hint' : ''].join(' ');
          const [cx, cy] = center(c);
          const bonus = map.bonuses[c] && !player.taken.includes(c) ? map.bonuses[c] : null;
          const mark = map.marks[c];
          const title = `${c}${water ? ' — آب' : ''}${rock ? ' — صخره' : ''}${map.upgrade.includes(c) ? ' — نیازمند ساخت II' : ''}${bonus ? ` — پاداش: ${bonus}` : ''}${mark ? ` — ${mark}` : ''}${b ? ` — ${kindName(b.kind)}${b.full ? ' (پر)' : isStdKind(b.kind) ? ' (خالی)' : ''}${b.used ? ` (${fa(b.used)} جای اشغال)` : ''}` : ''}`;
          const click = onCell && target ? () => onCell(c) : undefined;
          return (
            <g key={c} onClick={click} className={click ? `an-hex-g--click${hint.has(c) && !pv.has(c) ? ' an-hint' : ''}` : undefined} tabIndex={click ? 0 : undefined} role={click ? 'button' : undefined}
              aria-label={click ? `خانهٔ ${c}` : undefined} onKeyDown={click ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } } : undefined}>
              <polygon points={hexPath(c)} className={cls} style={fill ? { fill } : undefined}><title>{title}</title></polygon>
              {b && b.cells[0] === c && <text x={cx} y={cy + 4} className="an-hex__t">{KIND_SHORT[b.kind] ?? '★'}{b.full ? '●' : ''}{b.used ? `·${fa(b.used)}` : ''}</text>}
              {bonus && !b && <circle cx={cx} cy={cy} r={4} className="an-hex__bonus" />}
              {mark && !b && <circle cx={cx} cy={cy} r={6} className="an-hex__mark" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
const isStdKind = (k: string) => /^e\d$/.test(k);

// ---------------- Player board ----------------
function ActionRow({ p }: { p: PlayerView }) {
  return (
    <ol className="an-slots" aria-label="کارت‌های کنش (قدرت = شمارهٔ خانه)">
      {p.slots.map((k: ActionKey, i: number) => (
        <li key={k} className={p.up[k] ? 'an-slot an-slot--up' : 'an-slot'} data-flip={`slot-${p.seat}-${k}`}>
          <b className="an-slot__n">{fa(p.strengths[i]!)}</b>
          <span>{ACTION_FA[k]} {p.up[k] ? 'II' : 'I'}</span>
          {(p.tok[k].mult > 0 || p.tok[k].venom > 0 || p.tok[k].con > 0) && (
            <small>{p.tok[k].mult ? `دوبرابر ×${fa(p.tok[k].mult)} ` : ''}{p.tok[k].venom ? 'زهر ' : ''}{p.tok[k].con ? 'فشار (−۲)' : ''}</small>
          )}
        </li>
      ))}
    </ol>
  );
}
function PlayerBoard({ p, map, me, name, active, hand, children }: { p: PlayerView; map: MapView | null; me: boolean; name: string; active: boolean; hand?: number[]; children?: ReactNode }) {
  const left = map ? map.left.map((l, i) => ({ ...l, on: p.left[i]! })) : [];
  return (
    <section className={`an-player${active ? ' an-player--active' : ''}${me ? ' an-player--me' : ''}`} aria-label={`باغ‌وحش ${name}`} data-flip-anchor={`seat-${p.seat}`}>
      <header className="an-player__head">
        <h3><bdi>{name}</bdi>{me ? ' (شما)' : ''}</h3>
        <span className="an-small">{map?.nameFa ?? 'در حال انتخاب نقشه'}</span>
      </header>
      <div className="an-tracks">
        <Track label="جذابیت" value={p.appeal} />
        <Track label="حفاظت" value={p.cp} extra={`هدف ${fa(p.target)}`} />
        <Track label="امتیاز" value={p.vp} />
        <Track label="پول" value={p.money} />
        <Track label="اعتبار" value={p.rep} extra={`ویترین ۱–${fa(p.range)}`} />
        <Track label="نشان X" value={p.x} />
        <Track label="کارمند" value={p.workers} extra={`از ${fa(1 + p.hired)}`} />
        <Track label="دست" value={p.handCount} extra={`سقف ${fa(p.handLimit)}`} />
      </div>
      <ActionRow p={p} />
      <p className="an-small an-icons">
        {(Object.entries(p.icons) as [Icon, number][]).filter(([, n]) => n).map(([i, n]) => <span key={i} className="an-icon-count"><IconChip i={i} /><b>{fa(n)}</b></span>)}
      </p>
      <p className="an-small">همکاران: {p.partners.map((z) => ICON_FA[z]).join('، ') || '—'} · دانشگاه‌ها: {p.unis.map((u) => UNI_FA[u]).join('، ') || '—'} · پروژه‌های پشتیبانی‌شده: {fa(p.supported)}
        {Object.entries(p.underCount).filter(([, n]) => n).map(([k, n]) => ` · ${fa(n)} کارت زیر ${k === 'map' ? 'نقشه' : nameOf(Number(k))}`)}</p>
      {map && <ZooMap map={map} player={p} label={`نقشهٔ باغ‌وحش ${name}`} />}
      {map && (
        <ol className="an-left" aria-label="نشان‌های لبهٔ نقشه (با هر پشتیبانی پروژه یکی برداشته می‌شود)">
          {left.map((l, i) => <li key={i} className={l.on ? 'an-left--on' : 'an-left--off'}>{l.label}{l.income ? ' ↻' : ''}{l.on ? '' : ' ✓'}</li>)}
        </ol>
      )}
      {map?.turnAbility && <p className="an-small">توانایی نقشه: {map.turnAbility}</p>}
      {children}
      {hand && (
        <div className="an-hand" aria-label="دست شما">
          <h4>دست شما ({fa(hand.length)})</h4>
          <div className="an-row">{hand.map((id) => <Card key={id} id={id} flip />)}</div>
        </div>
      )}
      {p.zoo.length > 0 && (
        <details className="an-zoo" open={me}>
          <summary>کارت‌های باغ‌وحش ({fa(p.zoo.length)})</summary>
          <div className="an-row">{p.zoo.map((id) => <Card key={id} id={id} flip full={me} />)}</div>
        </details>
      )}
    </section>
  );
}

// ---------------- Log ----------------
/** Affected seats of an interactive effect (the log line's seat is the player who caused it). */
const victims = (e: Record<string, unknown>, who: (s: number) => string) => ((e.seats as number[] | undefined) ?? []).map(who).join('، ');
function logLine(e: Record<string, unknown>, who: (s: number) => string): string {
  const w = who(e.seat as number);
  const card = typeof e.card === 'number' ? nameOf(e.card) : typeof e.card === 'string' ? ACTION_FA[e.card as ActionKey] ?? '' : '';
  switch (e.t) {
    case 'action': return `${w}: کنش ${card} با قدرت ${fa(e.strength as number)}`;
    case 'xtoken': return `${w}: کنش نشان X با ${card}`;
    case 'animal': return `${w} ${card} را بازی کرد`;
    case 'sponsor': return `${w} حامی ${card} را بازی کرد`;
    case 'build': return `${w} ${kindName(String(e.kind))} ساخت`;
    case 'project': return `${w} از ${card} پشتیبانی کرد`;
    case 'release': return `${w} ${card} را در طبیعت رها کرد`;
    case 'partner': return `${w} باغ‌وحش همکار ${ICON_FA[e.zoo as Icon]} گرفت`;
    case 'uni': return `${w} ${UNI_FA[e.uni as keyof typeof UNI_FA]} گرفت`;
    case 'donate': return `${w} اهدا کرد`;
    case 'rep': return `${w} ۲ اعتبار گرفت`;
    case 'upgrade': return `${w} ${card} را ارتقا داد`;
    case 'snap': return `${w} کارتی از ویترین قاپید`;
    case 'sponsorBreak': return `${w} پول گرفت و استراحت را ${fa(e.n as number)} خانه جلو برد`;
    case 'break': return `${w} استراحت را آغاز کرد`;
    case 'breakRun': return 'استراحت: درآمد و بازنشانی';
    case 'venom': return `${w} به خاطر زهر ۲ پول داد`;
    case 'venomed': return `${victims(e, who)} از ${w} نشان زهر گرفت`;
    case 'constricted': return `${victims(e, who)} از ${w} نشان فشار گرفت`;
    case 'pilferCard': return `${w} یک کارت از دست داد (دستبرد)`;
    case 'pilferMoney': return `${w} پول از دست داد (دستبرد)`;
    case 'end': return 'بازی تمام شد';
    default: return '';
  }
}

// ---------------- Main ----------------
export default function ArkNovaRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<ArkView>) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const prompt = view.prompt as PromptView | null;
  const mine = !!prompt && prompt.seat === mySeat;
  const draft = legalActions.find((a) => a.type === 'draft') as undefined | { cards: number[]; maps: string[] };
  const [picked, setPicked] = useState<number[]>([]);
  const [mapPick, setMapPick] = useState('');
  const [kind, setKind] = useState('');
  const [place, setPlace] = useState<Placement | null>(null);
  const exp = expected as null | { type: string; value?: string; kind?: string; cells?: string[]; ids?: number[]; skip?: boolean };
  const expKey = exp ? JSON.stringify(exp) : '';
  useEffect(() => {
    setPicked([]); setMapPick('');
    // Tutorial: preselect the expected placement so the hint shows where it goes.
    if (exp?.kind && exp.cells) { setKind(exp.kind); setPlace({ kind: exp.kind, cells: exp.cells }); } else { setKind(''); setPlace(null); }
  }, [view.seq, expKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const isExp = (a: Record<string, unknown>) => !!exp && JSON.stringify({ type: 'answer', ...a }) === JSON.stringify(exp);
  const send = (a: Record<string, unknown>) => { if (!busy) onAction({ type: 'answer', ...a }); };
  const placements = useMemo(() => prompt?.placements ?? [], [prompt]);
  const kinds = useMemo(() => [...new Set(placements.map((p) => p.kind))], [placements]);
  const curKind = kind || kinds[0] || '';
  const targets = useMemo(() => new Set(placements.filter((p) => p.kind === curKind).flatMap((p) => p.cells)), [placements, curKind]);
  const clickCell = (c: string) => {
    const opts = placements.filter((p) => p.kind === curKind && p.cells.includes(c));
    if (!opts.length) return;
    const i = place ? opts.findIndex((o) => o.cells.join() === place.cells.join()) : -1;
    setPlace(opts[(i + 1) % opts.length]!);
  };
  const me = mySeat === null ? null : view.players[mySeat] ?? null;
  const status = view.outcome ? 'بازی تمام شد'
    : view.stage === 'draft' ? (draft ? '۴ کارت از ۸ کارت آغازین را نگه دارید' : 'منتظر انتخاب کارت‌های دیگران')
    : prompt ? (mine ? faDigits(prompt.label) : `نوبت ${who(prompt.seat)}: ${faDigits(prompt.label)}`) : '';
  const cardOf = (value: string): number | null => {
    const m = /^(\d+)@/.exec(value) ?? /^sp:(\d+):/.exec(value) ?? /^pr:(\d+):/.exec(value);
    return m ? Number(m[1]) : null;
  };
  const log = view.log.slice(-10).map((e) => logLine(e as Record<string, unknown>, who)).filter(Boolean).reverse();

  const promptPanel = mine && prompt && !busy && (
    <section className="an-panel an-prompt" aria-label="تصمیم شما">
      <h3>{faDigits(prompt.label)}</h3>
      {prompt.k === 'option' && (
        <div className="an-options">{prompt.options!.map((o) => {
          const id = cardOf(o.value);
          const hint = isExp({ value: o.value });
          return (
            <button key={o.value} type="button" className={`an-opt${id ? ' an-opt--card' : ''}${hint ? ' an-hint' : ''}`} data-opt={o.value} data-x={o.value.startsWith('x:') ? '1' : undefined}
              onClick={() => send({ value: o.value })}>
              <span>{faDigits(o.label)}</span>
              {id !== null && <span className={`an-card an-card--${kindOf(id)} an-card--inline`}><CardFace id={id} /></span>}
            </button>
          );
        })}</div>
      )}
      {prompt.k === 'pick' && (
        <>
          <p className="an-small">{prompt.min === prompt.max ? `${fa(prompt.min!)} کارت انتخاب کنید` : `${fa(prompt.min!)} تا ${fa(prompt.max!)} کارت انتخاب کنید`} ({fa(picked.length)} انتخاب شده)</p>
          <div className="an-row" data-act="pick" data-min={prompt.min}>{prompt.ids!.map((id) => (
            <Card key={id} id={id} selected={picked.includes(id)} hint={!!exp?.ids?.includes(id) && !picked.includes(id)}
              onClick={() => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < prompt.max! ? [...x, id] : x))} />
          ))}</div>
          <Button data-act="submit" className={exp?.ids && exp.ids.length === picked.length && exp.ids.every((x) => picked.includes(x)) ? 'an-hint' : ''}
            disabled={picked.length < prompt.min! || picked.length > prompt.max!} onClick={() => send({ ids: picked })}>ثبت</Button>
        </>
      )}
      {prompt.k === 'place' && (
        <>
          {kinds.length > 1 && (
            <div className="an-row" role="group" aria-label="نوع ساختمان">{kinds.map((k) => (
              <Button key={k} variant={k === curKind ? 'primary' : 'secondary'} size="sm" aria-pressed={k === curKind} onClick={() => { setKind(k); setPlace(null); }}>{kindName(k)}</Button>
            ))}</div>
          )}
          <p className="an-small">یک خانهٔ روشن را روی نقشه بزنید؛ ضربهٔ دوباره چرخش بعدی را نشان می‌دهد. هزینه: {prompt.placements && place ? (prompt as { free?: boolean }).free ? 'رایگان' : `${fa(2 * place.cells.length)} پول` : '—'}</p>
          {me && view.maps[me.map] && <ZooMap map={view.maps[me.map]!} player={me} preview={place?.cells} targets={targets} onCell={clickCell} label="انتخاب جای ساختمان" hintCells={exp?.cells} />}
          <label className="an-small an-select">همهٔ جاهای مجاز:
            <select data-act="placements" value={place ? `${place.kind}|${place.cells.join(',')}` : ''}
              onChange={(e) => { const p = placements.find((x) => `${x.kind}|${x.cells.join(',')}` === e.target.value) ?? null; setPlace(p); if (p) setKind(p.kind); }}>
              <option value="">—</option>
              {placements.map((p) => <option key={`${p.kind}|${p.cells.join(',')}`} value={`${p.kind}|${p.cells.join(',')}`}>{kindName(p.kind)}: {p.cells.join(' ')}</option>)}
            </select>
          </label>
          <Button data-act="place" className={place && isExp({ kind: place.kind, cells: place.cells }) ? 'an-hint' : ''} disabled={!place} onClick={() => place && send({ kind: place.kind, cells: place.cells })}>
            ساخت {place ? kindName(place.kind) : ''}
          </Button>
        </>
      )}
      {prompt.optional && <Button variant="ghost" data-act="skip" className={isExp({ skip: true }) ? 'an-hint' : ''} onClick={() => send({ skip: true })}>رد کردن</Button>}
    </section>
  );

  return (
    <div className="an" dir="rtl" ref={root} data-seq={view.seq}>
      <TurnIndicator tone={view.outcome ? 'done' : (mine || draft) ? 'mine' : 'wait'}>{status}</TurnIndicator>

      {draft && !busy && (
        <section className="an-panel an-prompt" aria-label="انتخاب کارت‌های آغازین">
          <h3>کارت‌های آغازین ({fa(picked.length)} از ۴)</h3>
          <div className="an-row" data-act="draft-cards">{draft.cards.map((id) => (
            <Card key={id} id={id} selected={picked.includes(id)} onClick={() => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < 4 ? [...x, id] : x))} />
          ))}</div>
          {draft.maps.length > 0 && (
            <fieldset className="an-maps"><legend>نقشهٔ باغ‌وحش</legend>{draft.maps.map((mId) => (
              <label key={mId}><input type="radio" name="an-map" checked={mapPick === mId} onChange={() => setMapPick(mId)} /> <b>{view.maps[mId]?.nameFa ?? mId}</b>{view.maps[mId]?.textFa ? ` — ${view.maps[mId]!.textFa}` : ''}</label>
            ))}</fieldset>
          )}
          {me && view.me && <p className="an-small">کارت‌های امتیاز پایانی شما: {view.me.finals.map(nameOf).join('، ')}</p>}
          <Button data-act="draft" disabled={picked.length !== 4 || (draft.maps.length > 0 && !mapPick)} onClick={() => onAction({ type: 'draft', keep: picked, ...(draft.maps.length ? { map: mapPick } : {}) })}>ثبت</Button>
        </section>
      )}

      {view.final && (
        <section className="an-panel an-result" aria-label="امتیاز پایانی">
          <h3>امتیاز پایانی (جذابیت منهای عدد هدف حفاظت)</h3>
          <table className="an-table">
            <thead><tr><th>بازیکن</th><th>جذابیت</th><th>حفاظت</th><th>عدد هدف</th><th>امتیاز</th><th>رتبه</th></tr></thead>
            <tbody>{view.final.map((f) => (
              <tr key={f.seat}><td><bdi>{who(f.seat)}</bdi></td><td>{fa(f.appeal)}</td><td>{fa(f.cp)}</td><td>{fa(f.target)}</td><td>{fa(f.vp)}</td>
                <td>{fa(view.outcome?.placements.find((x) => x.seat === f.seat)?.place ?? 0)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <div className="an-layout">
        <div className="an-main">
          {promptPanel}
          {me && (
            <PlayerBoard p={me} map={me.map ? view.maps[me.map] ?? null : null} me name={who(me.seat)} active={view.pending.includes(me.seat)} hand={view.me?.hand}>
              {view.me && view.me.finals.length > 0 && (
                <div className="an-finals"><h4>امتیاز پایانی (فقط شما می‌بینید)</h4><div className="an-row">{view.me.finals.map((id) => <Card key={id} id={id} />)}</div></div>
              )}
            </PlayerBoard>
          )}
        </div>

        <aside className="an-side">
          <section className="an-panel" aria-label="مسیر استراحت و ویترین">
            <div className="an-break" role="meter" aria-valuemin={0} aria-valuemax={view.brkMax} aria-valuenow={view.brk} aria-label="مسیر استراحت">
              <span style={{ inlineSize: `${(100 * view.brk) / view.brkMax}%` }} />
            </div>
            <p className="an-small">استراحت: {fa(view.brk)} از {fa(view.brkMax)} · دسته: <span data-flip-anchor="deck">{fa(view.deckCount)}</span> · دورریخته: {fa(view.discardCount)} · نوبت {fa(view.turnsDone + 1)}
              {view.endAt !== null ? ` · پایان اعلام شد (${fa(Math.max(0, view.endAt - view.turnsDone))} نوبت مانده)` : ''}</p>
            <ol className="an-display" aria-label="ویترین (هزینهٔ برداشتن = شمارهٔ پوشه)">
              {view.display.map((id, i) => (
                <li key={i} className={me && i < me.range ? 'an-folder an-folder--range' : 'an-folder'}>
                  <b>{fa(i + 1)}</b>
                  {id === null ? <span className="an-card an-card--empty">{view.stage === 'draft' ? 'رو به پایین' : 'خالی'}</span> : <Card id={id} flip />}
                </li>
              ))}
            </ol>
          </section>

          <section className="an-panel" aria-label="پروژه‌های حفاظت">
            <h3>پروژه‌های حفاظت</h3>
            <ul className="an-projects">
              {[...view.projects, ...view.baseProjects].map((id) => (
                <li key={id} className={`an-project${view.baseProjects.includes(id) ? ' an-project--base' : ''}`}>
                  <b>{nameOf(id)}</b>{view.baseProjects.includes(id) ? <small> (پایه)</small> : null}
                  {REG.projects.get(id)?.textFa && <small className="an-fx">{REG.projects.get(id)!.textFa}</small>}
                  <span className="an-pslots">{PROJECT[id]!.slots.map((sl, k) => {
                    const o = view.ptoks[id]?.[k];
                    const need = sl.need ? `${fa(sl.need)} نماد` : sl.size === 4 ? 'اندازهٔ ۴–۵' : sl.size === 2 ? 'اندازهٔ ۱–۲' : sl.size ? `اندازهٔ ${fa(sl.size)}` : 'هر سطح';
                    return <span key={k} className={`an-pslot${o === -1 ? ' an-pslot--blocked' : o !== null && o !== undefined ? ' an-pslot--taken' : ''}`}>
                      {need} → {fa(sl.cp)} حفاظت{sl.rep ? ` + ${fa(sl.rep)} اعتبار` : ''} <small>[{o === -1 ? 'بسته' : o === null || o === undefined ? 'آزاد' : who(o)}]</small></span>;
                  })}</span>
                  {view.extraSupports.filter((x) => x.project === id).map((x, k) => <small key={k}> + پشتیبانی دوباره: {who(x.seat)}</small>)}
                </li>
              ))}
            </ul>
          </section>

          <section className="an-panel" aria-label="انجمن">
            <h3>انجمن</h3>
            <ul className="an-assoc">
              <li>۲ اعتبار (قدرت ۲): {fa(view.assoc.rep.length)} کارمند</li>
              <li>باغ‌وحش همکار (قدرت ۳): {fa(view.assoc.zoo.length)} کارمند — {view.zoosAvail.map((z) => ICON_FA[z]).join('، ') || '—'}</li>
              <li>دانشگاه (قدرت ۴): {fa(view.assoc.uni.length)} کارمند — {view.unisAvail.map((u) => UNI_FA[u]).join('، ') || '—'}</li>
              <li>پروژهٔ حفاظت (قدرت ۵): {fa(view.assoc.project.length)} کارمند</li>
              <li>اهدا (فقط انجمن II): {fa(view.donationCost)} پول برای ۱ حفاظت</li>
            </ul>
            <p className="an-small">کاشی‌های پاداش حفاظت — خانهٔ ۵: {view.bonusTiles[5].map((t) => TILES[t]?.nameFa ?? t).join('، ') || '—'} · خانهٔ ۸: {view.bonusTiles[8].map((t) => TILES[t]?.nameFa ?? t).join('، ') || '—'}</p>
          </section>

          {log.length > 0 && (
            <section className="an-panel" aria-label="رویدادهای اخیر">
              <h3>رویدادهای اخیر</h3>
              <ol className="an-log" aria-live="polite">{log.map((l, i) => <li key={`${view.seq}-${i}`}>{l}</li>)}</ol>
            </section>
          )}
        </aside>
      </div>

      <div className="an-players">
        {view.players.filter((p) => p.seat !== mySeat).map((p) => (
          <PlayerBoard key={p.seat} p={p} map={p.map ? view.maps[p.map] ?? null : null} me={false} name={who(p.seat)} active={view.pending.includes(p.seat)} />
        ))}
      </div>
    </div>
  );
}
