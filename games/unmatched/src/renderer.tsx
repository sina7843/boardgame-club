// Unmatched renderer: players strip, vector battlefield (spaces, zones, lines, fighters), one decision panel driven by
// the server prompt, combat panel, own hand and event log. Shows only the projection; other hands are counts.
import './renderer.css';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, MOTION, TurnIndicator, ZoomBoard, motionOff, useFlip, usePrevious, type GameAction, type GameRendererProps } from '@bg/ui';
import { CardArt, Emblem, PATHS, PORTRAITS, Scenery, SIDEKICK_EMBLEM } from './art.tsx';
import { BOARDS, type Board } from './boards.ts';
import { HEROES, type CardDef } from './heroes.ts';
import type { CardRef, Fighter, LogEntry, Prompt, UnmatchedView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
type Hint = { type: string; [k: string]: unknown };

const TYPE_FA: Record<CardDef['type'], string> = { attack: 'حمله', defense: 'دفاع', versatile: 'همه‌کاره', scheme: 'نقشه' };
const TYPE_ICON: Record<CardDef['type'], string> = { attack: '✷', defense: '⛨', versatile: '✷⛨', scheme: 'ϟ' };
const WHY_FA: Record<string, string> = {
  maneuver: 'مبارزانتان را یکی‌یکی جابه‌جا کنید',
  effectMove: 'جابه‌جایی اثر کارت',
  combatantMove: 'یکی از دو مبارز نبرد را جابه‌جا کنید',
  storms: 'فرمان طوفان‌ها: هر مبارزی را می‌توانید جابه‌جا کنید',
  deploy: 'یاورتان را در منطقه قهرمان بگذارید',
  bewilderment: 'سردرگمی: می‌توانید مبارزتان را در هر خانه خالی بگذارید',
  lookingGlass: 'آینه: آلیس را در خانه‌ای دیگر بگذارید',
  harpyReturn: 'یک هارپی را به منطقه مدوسا برگردانید',
  medusaGaze: 'توانایی مدوسا: می‌توانید به یک مبارز حریف در منطقه‌اش ۱ آسیب بزنید',
  glance: 'نگاهی گذرا: به یک مبارز در منطقه مدوسا ۲ آسیب بزنید',
  jaws: 'آرواره‌ها: به یک مبارز مجاور جبرواک ۲ آسیب بزنید',
  spiritsFirst: 'ارواح ناآرام: یک خانه در منطقه مرلین انتخاب کنید',
  spiritsSecond: 'ارواح ناآرام: یک خانه مجاور آن را انتخاب کنید',
  handLimit: 'پایان نوبت: کارت‌های اضافه بر ۷ را دور بریزید',
  effect: 'اثر کارت حریف: کارت(هایی) برای دور ریختن انتخاب کنید',
  prophecy: 'پیشگویی: ۲ کارت را برای دست انتخاب کنید؛ بقیه به همان ترتیبِ انتخاب روی دسته برمی‌گردند',
  snicker: 'شرق‌شرق: کارتی از دست حریف را برای دور ریختن انتخاب کنید',
  boostMove: 'تقویت حرکت: یک کارت دور بریزید تا ارزش تقویتش به حرکت اضافه شود (اختیاری)',
  boostAttack: 'می‌توانید این حمله را با دور ریختن یک کارت تقویت کنید',
  defend: 'به شما حمله شده: کارت دفاع رو به پایین بگذارید یا بدون دفاع ادامه دهید',
  size: 'آلیس بزرگ شروع کند یا کوچک؟',
  pickHero: 'قهرمانتان را انتخاب کنید',
  fogDeploy: 'نشان مه را در یک خانه از منطقه مرد نامرئی بگذارید',
  bloodthirsty: 'تشنه خون: می‌توانید به یک مبارز مجاور دراکولا ۱ آسیب بزنید و ۱ کارت بکشید',
  serum: 'سرم: در قالب فعلی بمانید یا تغییر شکل دهید؟',
  deduce: 'استنتاج نقشه: ارزش کارت حریف برابر ارزش تقویتش شود؟',
  beastform: 'هیبت جانور: هر تعداد کارت دور بریزید؛ هر کدام ۱+',
  foreverHyde: 'هاید برای همیشه: کارت‌های «دکتر جکیل» را دور بریزید؛ هر کدام ۲+',
  bidding: 'فرمانم را ببر: کارتی را که حریف باید با آن حمله کند انتخاب کنید',
  confirm: 'تأیید سوءظن: یک کارت با ارزش اعلام‌شده دور بریزید',
  nameValue: 'تأیید سوءظن: یک عدد (ارزش حمله یا دفاع) بگویید',
  chooseOpponent: 'یک حریف انتخاب کنید',
  eliminate: 'حذف ناممکن‌ها: کارتی از دست حریف را برای دور ریختن انتخاب کنید',
  administerAid: 'کمک‌رسانی: دکتر واتسون را کنار هولمز بگذارید',
  mistform: 'هیبت مه: دراکولا را در هر خانه‌ای بگذارید',
  sisterReturn: 'یک خواهر را به منطقه دراکولا برگردانید',
  thirst: 'عطش خوراک: دراکولا را کنار مبارز حریف بگذارید',
  seduction: 'اغوای درنده: مبارزی را انتخاب و تا ۲ خانه جابه‌جا کنید',
  hydeZone: 'هاید را در خانه‌ای از منطقه‌اش بگذارید (یا بمانید)',
  calming: 'پژوهش آرام‌بخش: اولین انتخاب به دست می‌آید؛ بقیه به ترتیب انتخاب زیر دسته می‌روند',
  strangeCase: 'ماجرای عجیب: به یک مبارز مجاور آسیب بزنید',
  fogMove: 'یک نشان مه را جابه‌جا کنید',
  fogMoveOpp: 'اثر کارت حریف: یک نشان مه را جابه‌جا کنید',
  confound: 'سردرگم کردن: یک کارت دور بریزید، یا هیچ (آن‌وقت حریف می‌تواند مه‌ها را جابه‌جا کند)',
  surpriseFog: 'نشان مه زیر مرد نامرئی را به خانه دیگری ببرید',
  slipAway: 'گریز: یک نشان مه را به خانه‌ای بی‌مبارز ببرید؛ مرد نامرئی همان‌جا می‌رود',
  lurking: 'کمین‌نشستن: یک اثر را انتخاب کنید',
  codedNotes: 'یادداشت‌های رمزی: ۲ کارت را روی دسته بگذارید (اولین انتخاب بالاتر)',
  reign: 'حکومت وحشت: به یک مبارز حریف ۲ آسیب بزنید',
  stepLightly: 'آهسته قدم بردار: به یک مبارز مجاور آسیب بزنید',
  rollingFog: 'مه غلتان: یک نشان مه را به هر خانه دیگری ببرید',
  vanishReturn: 'مرد نامرئی برمی‌گردد: او را در هر خانه‌ای بگذارید',
  lurkingPlace: 'مرد نامرئی را به خانه‌ای مه‌دار ببرید',
  action: 'یک اقدام انتخاب کنید'
};
const OPTION_FA: Record<string, string> = {
  draw: '۲ کارت بکشید', heal: 'آلیس ۳ سلامتی بازیابد', place: 'آلیس را در خانه دیگری بگذارید',
  stay: 'همین قالب بماند', switch: 'تغییر شکل', apply: 'بله، تغییر بده', skip: 'نه',
  toFog: 'رفتن به خانه مه‌دار', fogMove: 'جابه‌جایی یک مه تا ۳ خانه'
};
const optionLabel = (p: Prompt, o: string, seatName: (s: number) => string) =>
  p.why === 'chooseOpponent' ? seatName(Number(o)) : p.why === 'nameValue' ? fa(Number(o)) : p.why === 'serum' && o === 'switch' ? 'تغییر شکل (جکیل ⇄ هاید)' : OPTION_FA[o] ?? o;
const formFa = (f: 'jekyll' | 'hyde' | null | undefined) => (f === 'hyde' ? 'آقای هاید' : 'دکتر جکیل');

function cardDefOf(view: UnmatchedView, c: CardRef): CardDef | undefined {
  return HEROES[view.heroes[c.seat] ?? '']?.cards.find((d) => d.slug === c.slug);
}
function bannerFa(view: UnmatchedView, seat: number, d: CardDef) {
  const h = HEROES[view.heroes[seat] ?? ''];
  if (!h || d.banner === 'any') return 'هر مبارز';
  return d.banner === 'hero' ? h.hero.nameFa : h.sidekick.nameFa;
}
function fighterName(view: UnmatchedView, fid: string) {
  const f = view.fighters.find((x) => x.id === fid);
  const h = f ? HEROES[view.heroes[f.seat] ?? ''] : undefined;
  if (!f || !h) return fid;
  if (f.hero) return view.heroes[f.seat] === 'jekyll' ? formFa(view.form[f.seat]) : h.hero.nameFa;
  return h.sidekick.count > 1 ? `${h.sidekick.nameFa} ${fa(f.idx + 1)}` : h.sidekick.nameFa;
}
const spaceLabel = (board: Board, i: number) => `خانه ${fa(i + 1)} (${board.spaces[i]!.zones.map((z) => board.zones.find((x) => x.id === z)?.nameFa ?? z).join('/')})`;
const anyCardName = (slug: string) => Object.values(HEROES).flatMap((h) => h.cards).find((d) => d.slug === slug)?.nameFa ?? slug;
const slugName = (view: UnmatchedView, seat: number, slug: string) => HEROES[view.heroes[seat] ?? '']?.cards.find((d) => d.slug === slug)?.nameFa ?? slug;

function describe(e: LogEntry, view: UnmatchedView, seatName: (s: number) => string): string {
  const fn = (fid: string) => fighterName(view, fid);
  const seatOf = (fid: string) => Number(fid[0]);
  switch (e.t) {
    case 'pick': return `${seatName(e.seat)} ${HEROES[e.hero]?.hero.nameFa ?? e.hero} را انتخاب کرد.`;
    case 'turn': return `نوبت ${fa(e.n)}: ${seatName(e.seat)}.`;
    case 'maneuver': return `${seatName(e.seat)} مانور داد${e.boost ? ` و با «${slugName(view, e.seat, e.boost)}» تقویت کرد` : ''}.`;
    case 'move': return `${fn(e.fighter)} از خانه ${fa(e.from + 1)} به خانه ${fa(e.to + 1)} رفت.`;
    case 'place': return `${fn(e.fighter)} در خانه ${fa(e.to + 1)} قرار گرفت.`;
    case 'scheme': return `${fn(e.fighter)} نقشه «${slugName(view, seatOf(e.fighter), e.card)}» را بازی کرد.`;
    case 'attack': return `${fn(e.fighter)} به ${fn(e.target)} ${e.ranged ? 'از دور ' : ''}حمله کرد.`;
    case 'reveal': return `کارت‌ها رو شد: حمله ${fa(e.aVal)} در برابر دفاع ${fa(e.dVal)}؛ ${e.damage ? `${fa(e.damage)} آسیب نبرد` : 'بدون آسیب نبرد'}${e.cancelA || e.cancelD ? ' (اثری لغو شد)' : ''}.`;
    case 'damage': return `${fn(e.fighter)} ${fa(e.n)} آسیب دید.`;
    case 'heal': return `سلامتی ${fn(e.fighter)} به ${fa(e.to)} رسید.`;
    case 'defeated': return `${fn(e.fighter)} شکست خورد!`;
    case 'draw': return `${seatName(e.seat)} ${fa(e.n)} کارت کشید.`;
    case 'exhausted': return `دسته ${seatName(e.seat)} تمام شده؛ هر مبارزش ${fa(e.n)} آسیب می‌بیند.`;
    case 'discard': return `${seatName(e.seat)} «${slugName(view, e.seat, e.card)}» را دور ریخت${e.why === 'boost' ? ' (تقویت)' : e.why === 'random' ? ' (تصادفی)' : ''}.`;
    case 'fetch': return `${seatName(e.seat)} «${slugName(view, e.seat, e.card)}» را به دست برگرداند.`;
    case 'size': return `آلیس ${e.size === 'big' ? 'بزرگ' : 'کوچک'} شد.`;
    case 'sawHand': return `${seatName(e.seat)} دست ${seatName(e.of)} را دید.`;
    case 'eliminated': return `${seatName(e.seat)} از بازی بیرون رفت${e.reason === 'resign' ? ' (انصراف)' : e.reason === 'timeout' ? ' (غیبت)' : ''}.`;
    case 'timeout': return `زمان ${seatName(e.seat)} تمام شد.`;
    case 'form': return `${seatName(e.seat)} به ${formFa(e.form)} تبدیل شد.`;
    case 'fog': return `یک نشان مه به خانه ${fa(e.to + 1)} رفت.`;
    case 'vanish': return `مرد نامرئی ناپدید شد.`;
    case 'revealTop': return `${seatName(e.seat)} کارت «${slugName(view, e.seat, e.card)}» را از بالای دسته رو کرد.`;
    case 'swap': return `${fn(e.a)} با ${fn(e.b)} جا عوض کرد.`;
    case 'extraAction': return `${seatName(e.seat)} یک اقدام اضافه گرفت.`;
    case 'named': return `${seatName(e.seat)} عدد ${fa(e.value)} را گفت.`;
    case 'shownHand': return `${seatName(e.seat)} دستش را به ${seatName(e.to)} نشان داد.`;
    case 'bidding': return `${seatName(e.seat)} «${anyCardName(e.card)}» را برای حمله حریف تعیین کرد.`;
  }
}

const heroEmblem = (view: UnmatchedView, seat: number) => (view.heroes[seat] === 'jekyll' && view.form[seat] === 'hyde' ? 'hyde' : view.heroes[seat] ?? 'arthur');
const fighterEmblem = (view: UnmatchedView, f: Fighter) => (f.hero ? heroEmblem(view, f.seat) : SIDEKICK_EMBLEM[view.heroes[f.seat] ?? ''] ?? 'harpy');
const heroColor = (view: UnmatchedView, seat: number) => HEROES[view.heroes[seat] ?? '']?.color ?? '#8a5a0b';

// ---------- card ----------

function UmCard({ view, card, state, onClick, hint, small, fan, flip, from, exit, extra }: {
  view: UnmatchedView; card: CardRef; state?: 'selected' | 'playable' | 'dim' | 'boost'; onClick?: () => void; hint?: boolean; small?: boolean; fan?: number; flip?: string; from?: string; exit?: string; extra?: string;
}) {
  const d = cardDefOf(view, card);
  if (!d) return null;
  const label = `${d.nameFa}، ${TYPE_FA[d.type]}${d.value !== null ? ` ${fa(d.value)}` : ''}، تقویت ${fa(d.boost)}، ${bannerFa(view, card.seat, d)}${d.textFa ? `. ${d.textFa}` : ''}`;
  const body = (
    <>
      <span className="um-card__top">
        <span className="um-card__type"><span aria-hidden="true">{TYPE_ICON[d.type]}</span> {TYPE_FA[d.type]}</span>
        {d.value !== null && <span className="um-card__value">{fa(d.value)}</span>}
      </span>
      {!small && <CardArt type={d.type} emblem={d.form ?? (d.banner === 'sidekick' ? SIDEKICK_EMBLEM[view.heroes[card.seat] ?? ''] : undefined) ?? heroEmblem(view, card.seat)} color={heroColor(view, card.seat)} />}
      <span className="um-card__name">{d.nameFa}</span>
      <span className="um-card__banner">{bannerFa(view, card.seat, d)}</span>
      {!small && d.textFa && <span className="um-card__text">{d.textFa}</span>}
      <span className="um-card__boost" title="ارزش تقویت">{fa(d.boost)}</span>
      <span className="um-card__sheen" aria-hidden="true" />
    </>
  );
  const cls = ['um-card', `um-card--${d.type}`, small ? 'um-card--sm' : '', state ? `um-card--${state}` : '', hint ? 'um-card--hint' : '', extra ?? ''].join(' ');
  const fp = { 'data-flip': flip, 'data-flip-from': from, 'data-flip-exit': exit };
  const style = fan === undefined ? undefined : { ['--fd' as string]: fan };
  if (!onClick) return <span className={cls} style={style} role="img" aria-label={label} {...fp}>{body}</span>;
  return <button type="button" className={cls} style={style} aria-label={label} aria-pressed={state === 'selected' || state === 'boost'} onClick={onClick} disabled={state === 'dim'} {...fp}>{body}</button>;
}
const CardBack = ({ label, emblem, color, flip, from, exit }: { label: string; emblem?: string; color?: string; flip?: string; from?: string; exit?: string }) => (
  <span className="um-card um-card--back" role="img" aria-label={label} data-flip={flip} data-flip-from={from} data-flip-exit={exit} style={color ? { ['--hc' as string]: color } : undefined}>
    <span className="um-card__crest" aria-hidden="true">{emblem ? <svg viewBox="-30 -30 60 60" width="34" height="34" focusable="false"><Emblem id={emblem} c={color ?? '#c8921a'} /></svg> : '⚔'}</span>
  </span>
);

// ---------- board ----------

/** Shortest path of spaces along the board's edges (just the two ends when they are not connected). */
function walk(edges: Board['edges'], a: number, b: number): number[] {
  const prev = new Map<number, number>([[a, a]]);
  const queue = [a];
  for (let i = 0; i < queue.length && !prev.has(b); i++) {
    const u = queue[i]!;
    for (const [x, y] of edges) {
      const v = x === u ? y : y === u ? x : -1;
      if (v >= 0 && !prev.has(v)) { prev.set(v, u); queue.push(v); }
    }
  }
  if (!prev.has(b)) return [a, b];
  const out = [b];
  while (out[0] !== a) out.unshift(prev.get(out[0]!)!);
  return out;
}

function slicePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
}

interface BoardMarks { spaces: Set<number>; fighters: Set<string>; fogs: Set<number>; selected: string | null; hintSpace: number | null; hintFighter: string | null }

// Shared SVG paint servers: parchment fibres, bevel, plastic and blur. Decorative only.
function BoardDefs() {
  return (
    <defs>
      <radialGradient id="umb-vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#6b4a1c" stopOpacity="0" /><stop offset="1" stopColor="#6b4a1c" stopOpacity="0.32" /></radialGradient>
      <linearGradient id="umb-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a4527" /><stop offset="1" stopColor="#35200f" /></linearGradient>
      <pattern id="umb-fibre" width="90" height="90" patternUnits="userSpaceOnUse">
        <path d="M6 14 q14 -6 28 0 M52 30 q12 5 26 -1 M12 62 q16 6 30 0 M60 76 q10 -5 24 1" fill="none" stroke="#8a6a35" strokeOpacity="0.16" strokeWidth="1.2" strokeLinecap="round" />
        <g fill="#6b4a1c" fillOpacity="0.14"><circle cx="30" cy="48" r="1.2" /><circle cx="74" cy="12" r="1" /><circle cx="18" cy="82" r="1.1" /><circle cx="66" cy="58" r="1.3" /><circle cx="46" cy="6" r="0.9" /></g>
      </pattern>
      <radialGradient id="umb-bevel" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stopColor="#fff" stopOpacity="0.42" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="0.82" stopColor="#000" stopOpacity="0.1" /><stop offset="1" stopColor="#000" stopOpacity="0.38" /></radialGradient>
      <radialGradient id="umb-plastic" cx="0.35" cy="0.28" r="0.9"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.5" /></radialGradient>
      <linearGradient id="umb-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="0.5" stopColor="#c8921a" /><stop offset="1" stopColor="#7a5208" /></linearGradient>
      <filter id="umb-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
    </defs>
  );
}

function Battlefield({ view, motionKey, marks, onSpace, onFighter, onFog }: { view: UnmatchedView; motionKey: string; marks: BoardMarks; onSpace: (i: number) => void; onFighter: (fid: string) => void; onFog: (t: number) => void }) {
  const board = BOARDS[view.mapId]!;
  const color = (z: string) => board.zones.find((x) => x.id === z)?.color ?? '#ccc';
  const R = 58, INNER = R - 18;
  const path = PATHS[board.id] ?? PATHS.marmoreal!;
  const key = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  const svgRef = useRef<SVGSVGElement>(null);
  const before = usePrevious(motionKey, view.fighters);
  const was = new Map((before ?? []).map((f) => [f.id, f]));
  // Fighters walk along the board's edges from their old space to the new one; newly placed fighters drop in.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !before || motionOff()) return;
    for (const f of view.fighters) {
      if (f.space === null || f.hp <= 0) continue;
      const el = svg.querySelector<SVGGElement>(`[data-fid="${f.id}"]`);
      const a = was.get(f.id)?.space;
      if (!el) continue;
      if (a === null || a === undefined) {
        if (was.has(f.id) || before.length) el.animate([{ transform: 'translateY(-26px) scale(1.15)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOTION.enter + 120, easing: MOTION.ease, composite: 'add' });
        continue;
      }
      if (a === f.space) continue;
      const route = walk(board.edges, a, f.space);
      el.animate(route.map((i) => ({ transform: `translate(${board.spaces[i]!.x}px, ${board.spaces[i]!.y}px)` })), { duration: Math.min(220 * (route.length - 1) + 260, 1400), easing: 'ease-in-out' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionKey]);
  const byspace = new Map(view.fighters.filter((f) => f.space !== null && f.hp > 0).map((f) => [f.space!, f]));
  // Damage numbers pop over the fighters hurt by the most recent events (keyed by log seq so each one animates once).
  const dmg = new Map<string, { n: number; seq: number }>();
  for (const e of view.log.slice(-6)) if (e.t === 'damage') dmg.set(e.fighter, { n: e.n, seq: e.seq });
  const label = `میدان نبرد ${board.nameFa}`;
  return (
    <ZoomBoard label={label}>
    <svg ref={svgRef} className="um-board" viewBox="0 0 1337 866" role="group" aria-label={label} style={{ direction: 'ltr' }}>
      <BoardDefs />
      <g aria-hidden="true">
        <rect x="0" y="0" width="1337" height="866" rx="28" fill="url(#umb-wood)" />
        <clipPath id="umb-clip"><rect x="9" y="9" width="1319" height="848" rx="22" /></clipPath>
        <g clipPath="url(#umb-clip)"><Scenery boardId={board.id} /></g>
        <rect x="9" y="9" width="1319" height="848" rx="22" fill="url(#umb-vignette)" />
        <rect x="11" y="11" width="1315" height="844" rx="20" fill="none" stroke="url(#umb-brass)" strokeWidth="3" />
        {board.edges.map(([a, b]) => <line key={`u${a}-${b}`} x1={board.spaces[a]!.x} y1={board.spaces[a]!.y} x2={board.spaces[b]!.x} y2={board.spaces[b]!.y} className="um-edge-under" stroke={path.edge} />)}
        {board.edges.map(([a, b]) => <line key={`${a}-${b}`} x1={board.spaces[a]!.x} y1={board.spaces[a]!.y} x2={board.spaces[b]!.x} y2={board.spaces[b]!.y} className="um-edge" stroke={path.fill} />)}
        {board.edges.map(([a, b]) => <line key={`t${a}-${b}`} x1={board.spaces[a]!.x} y1={board.spaces[a]!.y} x2={board.spaces[b]!.x} y2={board.spaces[b]!.y} className="um-edge-stone" stroke={path.stone} />)}
        {board.spaces.map((sp, i) => <circle key={`s${i}`} cx={sp.x + 3} cy={sp.y + 7} r={R + 2} className="um-space__shadow" filter="url(#umb-blur)" />)}
      </g>
      {board.spaces.map((sp, i) => {
        const k = sp.zones.length;
        const target = marks.spaces.has(i);
        const occ = byspace.get(i);
        const start = board.starts.indexOf(i);
        const ang = (j: number) => -Math.PI / 2 + (j * 2 * Math.PI) / k;
        return (
          <g key={i} className={['um-space', target ? 'um-space--target' : '', marks.hintSpace === i ? 'um-space--hint' : ''].join(' ')}
            {...(target ? { role: 'button', tabIndex: 0, 'aria-label': `${spaceLabel(board, i)}، انتخاب`, onClick: () => onSpace(i), onKeyDown: key(() => onSpace(i)) } : { 'aria-hidden': true })}>
            {target && <circle cx={sp.x} cy={sp.y} r={R + 10} className="um-space__glow" />}
            {k === 1 ? <circle cx={sp.x} cy={sp.y} r={R} fill={color(sp.zones[0]!)} />
              : sp.zones.map((z, j) => <path key={z} d={slicePath(sp.x, sp.y, R, ang(j), ang(j + 1))} fill={color(z)} />)}
            <circle cx={sp.x} cy={sp.y} r={R} fill="url(#umb-fibre)" />
            {k > 1 && <>
              <circle cx={sp.x} cy={sp.y} r={INNER} fill="#f6efdc" fillOpacity="0.62" />
              {sp.zones.map((z, j) => <line key={z} x1={sp.x + INNER * Math.cos(ang(j))} y1={sp.y + INNER * Math.sin(ang(j))} x2={sp.x + R * Math.cos(ang(j))} y2={sp.y + R * Math.sin(ang(j))} className="um-space__split" />)}
              <circle cx={sp.x} cy={sp.y} r={INNER} className="um-space__engrave" />
            </>}
            <circle cx={sp.x} cy={sp.y} r={R} fill="url(#umb-bevel)" />
            {k === 1 && <circle cx={sp.x} cy={sp.y} r={R - 12} className="um-space__engrave" />}
            <circle cx={sp.x} cy={sp.y} r={R - 3} className="um-space__brass" stroke="url(#umb-brass)" />
            <circle cx={sp.x} cy={sp.y} r={R - 9} className="um-space__shine" pathLength="100" strokeDasharray="20 80" transform={`rotate(189 ${sp.x} ${sp.y})`} />
            <circle cx={sp.x} cy={sp.y} r={R} className="um-space__ring" />
            {!occ && <text x={sp.x} y={sp.y + 10} className="um-space__num">{fa(i + 1)}</text>}
            {start >= 0 && <g className="um-start" transform={`translate(${sp.x - R + 8} ${sp.y})`}>
              <path d="M0 -19 L15 -12 V4 Q15 15 0 21 Q-15 15 -15 4 V-12Z" fill="url(#umb-brass)" /><path d="M0 -19 V21" className="um-start__seam" /><text y="8">{fa(start + 1)}</text>
            </g>}
          </g>
        );
      })}
      {board.passages.map((i) => {
        const cx = board.spaces[i]!.x + R - 6, cy = board.spaces[i]!.y + R - 6;
        return (
          <g key={`p${i}`} className="um-passage" aria-hidden="true" transform={`translate(${cx} ${cy})`}>
            <circle r="18" /><circle r="13" className="um-passage__inner" />
            <circle cy="-3" r="4.2" className="um-passage__key" /><path d="M0 -1 L-3.6 9 H3.6Z" className="um-passage__key" />
          </g>
        );
      })}
      {view.fog.map((sp, t) => (
        <g key={`fog${t}`} className={marks.fogs.has(t) ? 'um-fog um-fog--target' : 'um-fog'} transform={`translate(${board.spaces[sp]!.x - R + 14 + t * 6}, ${board.spaces[sp]!.y - R + 14})`}
          {...(marks.fogs.has(t) ? { role: 'button', tabIndex: 0, 'aria-label': `نشان مه ${fa(t + 1)} در ${spaceLabel(board, sp)}، انتخاب`, onClick: () => onFog(t), onKeyDown: key(() => onFog(t)) } : { role: 'img', 'aria-label': `نشان مه در ${spaceLabel(board, sp)}` })}>
          <ellipse cx="-14" cy="3" rx="14" ry="10" className="um-fog__puff" /><ellipse cx="14" cy="4" rx="13" ry="9" className="um-fog__puff" />
          <ellipse rx="24" ry="15" /><text y="7">☁</text>
        </g>
      ))}
      {view.fighters.filter((f) => f.space !== null && f.hp > 0).map((f) => {
        const sp = board.spaces[f.space!]!;
        const h = HEROES[view.heroes[f.seat] ?? '']!;
        const sel = marks.selected === f.id;
        const target = marks.fighters.has(f.id);
        const name = fighterName(view, f.id);
        const r = f.hero ? 46 : 34;
        const short = f.hero ? name.split(' ').at(-1)! : `${h.sidekick.nameFa}${h.sidekick.count > 1 ? ` ${fa(f.idx + 1)}` : ''}`;
        const plateW = Math.max(44, short.length * 12 + 20);
        const pct = f.maxHp ? (f.hp / f.maxHp) * 100 : 0;
        const hit = dmg.get(f.id);
        return (
          <g key={f.id} data-fid={f.id} className={['um-fighter', target ? 'um-fighter--target' : '', sel ? 'um-fighter--selected' : '', marks.hintFighter === f.id ? 'um-fighter--hint' : '', f.seat === view.current ? 'um-fighter--turn' : ''].join(' ')}
            style={{ transform: `translate(${sp.x}px, ${sp.y}px)` }}
            {...(target ? { role: 'button', tabIndex: 0, 'aria-label': `${name}، ${fa(f.hp)} سلامتی، ${spaceLabel(board, f.space!)}، انتخاب`, onClick: () => onFighter(f.id), onKeyDown: key(() => onFighter(f.id)) }
              : { role: 'img', 'aria-label': `${name}، ${fa(f.hp)} سلامتی، ${spaceLabel(board, f.space!)}` })}>
            <ellipse cx="4" cy={r * 0.62} rx={r * 1.02} ry={r * 0.5} className="um-fighter__shadow" filter="url(#umb-blur)" />
            <circle r={r + 9} className="um-fighter__glow" />
            <g key={f.hp} className={`um-fighter__body ${(was.get(f.id)?.hp ?? f.hp) > f.hp ? 'bg-hit' : ''}`}>
              <circle cy={r * 0.14} r={r} fill="#000" fillOpacity="0.45" />
              <circle r={r} fill={h.color} className="um-fighter__disc" />
              <circle r={r} fill="url(#umb-plastic)" className="um-fighter__gloss" />
              <circle r={r - 6} className="um-fighter__rim" />
              <circle r={r - 10} className="um-fighter__inner" />
              <g transform={`scale(${(r - 13) / 30})`}><Emblem id={fighterEmblem(view, f)} c={h.color} /></g>
              <ellipse cx={-r * 0.34} cy={-r * 0.5} rx={r * 0.3} ry={r * 0.13} transform={`rotate(-35 ${-r * 0.34} ${-r * 0.5})`} className="um-fighter__spec" />
            </g>
            <g transform={`translate(0 ${r + 6})`} className="um-fighter__plate"><rect x={-plateW / 2} y="-3" width={plateW} height="27" rx="13" className="um-fighter__plate-bg" style={{ stroke: h.color }} /><text y="16" className="um-fighter__label">{short}</text></g>
            <g transform={`translate(${r * 0.74}, ${-r * 0.74})`}>
              <g key={f.hp} className={`um-fighter__badge ${(was.get(f.id)?.hp ?? f.hp) !== f.hp ? 'bg-pop' : ''}`}>
                <circle r="25" className="um-fighter__hpbg" /><circle r="29" className="um-fighter__dialring" style={{ stroke: h.color }} />
                <circle r="17" className="um-fighter__dialtrack" />
                <circle r="17" className="um-fighter__dialarc" pathLength="100" strokeDasharray={`${pct} 100`} transform="rotate(-90)" />
                <circle r="21.5" className="um-fighter__ticks" pathLength={f.maxHp} strokeDasharray="0.2 0.8" />
                <text y="7" className="um-fighter__hp">{fa(f.hp)}</text>
              </g>
            </g>
            {hit && <text key={hit.seq} y={-r - 6} className="um-fighter__dmg" aria-hidden="true">−{fa(hit.n)}</text>}
          </g>
        );
      })}
    </svg>
    </ZoomBoard>
  );
}

// ---------- undo-window preview ----------

/** The served view with my queued action applied, using only what I already hold (my hand, the board). */
function preview(v: UnmatchedView, me: number | null, q: GameAction | null | undefined): UnmatchedView {
  if (!q || me === null || !v.myHand) return v;
  const hand = v.myHand;
  const card = (id: unknown) => hand.find((c) => c.id === id) ?? null;
  const without = (...ids: unknown[]) => hand.filter((c) => !ids.includes(c.id));
  if (q.type === 'move') return { ...v, fighters: v.fighters.map((f) => (f.id === q.fighter ? { ...f, space: q.to as number } : f)) };
  if (q.type === 'scheme' && card(q.card)) return { ...v, myHand: without(q.card) };
  if (q.type === 'defend' && v.combat && card(q.card)) return { ...v, myHand: without(q.card), combat: { ...v.combat, dCard: card(q.card), defended: true } };
  if (q.type === 'attack' && card(q.card)) {
    const att = v.fighters.find((f) => f.id === q.fighter), def = v.fighters.find((f) => f.id === q.target);
    if (!att || !def || att.space === null || def.space === null) return v;
    const ranged = !BOARDS[v.mapId]!.edges.some(([a, b]) => (a === att.space && b === def.space) || (b === att.space && a === def.space));
    const combat = {
      attacker: att.id, defender: def.id, aSeat: me, dSeat: def.seat, ranged, aCard: card(q.card), dCard: null, boost: card(q.boost), hasBoost: !!q.boost,
      defended: false, revealed: false, cancelA: false, cancelD: false, boostVoid: false, shield: null,
      aBase: 0, dBase: 0, aAdd: 0, dAdd: 0, aVal: null, dVal: null, damage: null, won: null, dFaceUp: false, predict: null, aZero: false, dZero: false
    } as UnmatchedView['combat'];
    return { ...v, myHand: without(q.card, q.boost), combat };
  }
  return v;
}

// ---------- renderer ----------

export default function UnmatchedRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<UnmatchedView>) {
  // Undo-window preview: my queued move walks the fighter, an attack / defence card leaves the hand for the combat
  // panel, a scheme card goes to the discard pile. Draws, effects and combat results wait for the server.
  const view = preview(served, mySeat, queued);
  const motionKey = `${view.log.at(-1)?.seq ?? 0}|${queued ? JSON.stringify(queued) : ''}`;
  const hints = legalActions as Hint[];
  const p = view.prompt;
  const mine = !!p && p.seat === mySeat && !view.outcome && !queued;
  const board = BOARDS[view.mapId]!;
  const hand = view.myHand ?? [];
  const exp = expected as Hint | null;

  // Local selection state, reset whenever the prompt changes.
  const [mode, setMode] = useState<'attack' | 'scheme' | null>(null);
  const [selFighter, setSelFighter] = useState<string | null>(null);
  const [selTarget, setSelTarget] = useState<string | null>(null);
  const [selCard, setSelCard] = useState<string | null>(null);
  const [selBoost, setSelBoost] = useState<string | null>(null);
  const [boostPick, setBoostPick] = useState(false);
  const [selFog, setSelFog] = useState<number | null>(null);
  const [predict, setPredict] = useState<number | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const promptKey = JSON.stringify(p) + view.log.at(-1)?.seq;
  // Changes whenever a new decision is shown (lets tests and assistive tooling detect identical consecutive prompts).
  const promptHash = [...promptKey].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0).toString(36);
  useEffect(() => { setMode(null); setSelFighter(null); setSelTarget(null); setSelCard(null); setSelBoost(null); setBoostPick(false); setPicks([]); setSelFog(null); setPredict(null); }, [promptKey]);

  const root = useRef<HTMLDivElement>(null);
  useFlip(root, motionKey);
  const before = usePrevious(motionKey, view);
  const send = (a: Hint) => { if (!busy) onAction(a); };
  const attacks = hints.filter((h) => h.type === 'attack') as unknown as { fighter: string; target: string; card: string; boostable: boolean }[];
  const schemes = hints.filter((h) => h.type === 'scheme') as unknown as { card: string; fighter: string }[];
  const moves = hints.filter((h) => h.type === 'move') as unknown as { fighter: string; to: number[] }[];
  const chooseIds = hints.filter((h) => h.type === 'choose' && Array.isArray(h.ids)).map((h) => (h.ids as string[])[0]!);

  // Announce new events politely.
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, view, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, view, seatName]);

  // ----- board marks + clicks -----
  const marks: BoardMarks = { spaces: new Set(), fighters: new Set(), fogs: new Set(), selected: selFighter, hintSpace: null, hintFighter: null };
  const fogOpts = p?.kind === 'fog' ? p.fogs ?? [] : [];
  const curFog = fogOpts.length === 1 ? fogOpts[0]! : fogOpts.find((o) => o.token === selFog);
  if (mine && p?.kind === 'fog') {
    for (const o of fogOpts) marks.fogs.add(o.token);
    for (const t of curFog?.to ?? []) marks.spaces.add(t);
  }
  if (mine && p) {
    if (p.kind === 'move') {
      for (const mv of moves) marks.fighters.add(mv.fighter);
      const cur = moves.find((mv) => mv.fighter === selFighter);
      if (cur) for (const t of cur.to) marks.spaces.add(t);
    }
    if (p.kind === 'place' || p.kind === 'space') for (const s of p.spaces ?? []) marks.spaces.add(s);
    if (p.kind === 'fighter') for (const f of p.fighters ?? []) marks.fighters.add(f);
    if (p.kind === 'action' && mode === 'attack') {
      for (const a of attacks) {
        marks.fighters.add(a.fighter);
        if (a.fighter === selFighter) marks.fighters.add(a.target);
      }
    }
  }
  if (exp?.type === 'move') { marks.hintSpace = (exp.to as number) ?? null; marks.hintFighter = exp.fighter as string; }
  if (exp?.type === 'attack') marks.hintFighter = (selFighter ? exp.target : exp.fighter) as string;
  const onSpace = (i: number) => {
    if (!mine || !p) return;
    if (p.kind === 'move' && selFighter) send({ type: 'move', fighter: selFighter, to: i });
    if (p.kind === 'place' || p.kind === 'space') send({ type: 'choose', ids: [String(i)] });
    if (p.kind === 'fog' && curFog) send({ type: 'choose', ids: [`${curFog.token}@${i}`] });
  };
  const onFighter = (fid: string) => {
    if (!mine || !p) return;
    if (p.kind === 'move') setSelFighter(fid === selFighter ? null : fid);
    if (p.kind === 'fighter') send({ type: 'choose', ids: [fid] });
    if (p.kind === 'action' && mode === 'attack') {
      // Own fighters choose the attacker; opposing fighters choose the target.
      if (attacks.some((a) => a.fighter === fid)) { setSelFighter(fid === selFighter ? null : fid); setSelTarget(null); setSelCard(null); setSelBoost(null); }
      else if (selFighter && attacks.some((a) => a.fighter === selFighter && a.target === fid)) { setSelTarget(fid); setSelCard(null); }
    }
  };
  // Single movable fighter: select it automatically.
  useEffect(() => {
    if (mine && p?.kind === 'move' && !selFighter && moves.length === 1) setSelFighter(moves[0]!.fighter);
  }, [mine, p?.kind, moves, selFighter]);

  // ----- hand interaction -----
  const handState = (c: CardRef): 'selected' | 'playable' | 'dim' | 'boost' | undefined => {
    if (!mine || !p) return undefined;
    if (selBoost === c.id) return 'boost';
    if (p.kind === 'action' && mode === 'attack' && selFighter && selTarget) {
      if (selCard === c.id) return 'selected';
      if (boostPick) return 'playable';
      return attacks.some((a) => a.fighter === selFighter && a.target === selTarget && a.card === c.id) ? 'playable' : 'dim';
    }
    if (p.kind === 'action' && mode === 'scheme') return schemes.some((s) => s.card === c.id) ? (selCard === c.id ? 'selected' : 'playable') : 'dim';
    if (p.kind === 'defend') return hints.some((h) => h.type === 'defend' && h.card === c.id) ? (selCard === c.id ? 'selected' : 'playable') : 'dim';
    if (p.kind === 'boost' || p.kind === 'cards') return picks.includes(c.id) ? 'selected' : (p.cards ?? []).includes(c.id) ? 'playable' : 'dim';
    return undefined;
  };
  const tapHand = (c: CardRef) => {
    if (!mine || !p || busy) return;
    const st = handState(c);
    if (st === 'dim') return;
    if (p.kind === 'action' && mode === 'attack') {
      if (boostPick) { if (c.id !== selCard) setSelBoost(selBoost === c.id ? null : c.id); setBoostPick(false); return; }
      // One tap attacks, unless the attack can also take a boost (Arthur): then the card is selected and «ثبت حمله» sends it.
      const atk = attacks.find((a) => a.fighter === selFighter && a.target === selTarget && a.card === c.id);
      if (atk && !atk.boostable) { send({ type: 'attack', fighter: selFighter, target: selTarget, card: c.id }); return; }
      setSelCard(selCard === c.id ? null : c.id);
      if (selBoost === c.id) setSelBoost(null);
      return;
    }
    if (p.kind === 'action' && mode === 'scheme') {
      const opts = schemes.filter((s) => s.card === c.id);
      if (opts.length === 1) send({ type: 'scheme', card: c.id, fighter: opts[0]!.fighter });
      else setSelCard(c.id);
      return;
    }
    // Defending: one tap plays the card, except Elementary, which also needs a predicted value.
    if (p.kind === 'defend') {
      if (c.slug !== 'elementary') { send({ type: 'defend', card: c.id }); return; }
      setSelCard(selCard === c.id ? null : c.id);
      return;
    }
    if (p.kind === 'boost' || p.kind === 'cards') pickCard(c.id);
  };
  /** Exactly one card to choose → the tap is the choice; otherwise toggle and send with «تأیید». */
  const pickCard = (id: string) => {
    if (p && (p.max ?? 1) === 1 && (p.kind === 'boost' || (p.min ?? 0) === 1)) send({ type: 'choose', ids: [id] });
    else togglePick(id, p?.max ?? 1);
  };
  const togglePick = (cardId: string, max: number) =>
    setPicks((cur) => (cur.includes(cardId) ? cur.filter((x) => x !== cardId) : max === 1 ? [cardId] : cur.length < max ? [...cur, cardId] : cur));

  // ----- status line -----
  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome && p) {
    if (mine) status = { tone: 'mine', text: p.kind === 'action' ? `نوبت شماست — اقدام ${fa(3 - view.actionsLeft)} از ۲` : WHY_FA[p.why] ?? 'تصمیم شما' };
    else status = { tone: 'wait', text: `در انتظار ${seatName(p.seat)}${p.kind === 'defend' ? ' (انتخاب دفاع)' : p.kind === 'pickHero' ? ' (انتخاب قهرمان)' : ''}` };
  }

  const lastReveal = useMemo(() => [...view.log].reverse().find((e) => e.t === 'reveal') as Extract<LogEntry, { t: 'reveal' }> | undefined, [view.log]);
  const fromHand = (p?.cards ?? []).every((id) => hand.some((h) => h.id === id));
  const selectedAttack = attacks.find((a) => a.fighter === selFighter && a.target === selTarget && a.card === selCard);

  return (
    <div className="um" data-prompt={promptHash} ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="um__meta">
        <span>میدان: <strong>{board.nameFa}</strong></span>
        {view.turnNo > 0 && <span>نوبت {fa(view.turnNo)}</span>}
        <span>{view.players === 2 ? 'نبرد تن‌به‌تن' : 'همه علیه همه'}</span>
      </div>

      <ul className="um-players" aria-label="بازیکنان">
        {view.order.map((seat) => <PlayerPanel key={seat} view={view} was={before} seat={seat} me={seat === mySeat} name={seatName(seat)} />)}
      </ul>

      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="um-main">
        <div className="um-board-wrap">
          {view.heroes.some((h) => h) ? <Battlefield view={view} motionKey={motionKey} marks={marks} onSpace={onSpace} onFighter={onFighter} onFog={(t) => setSelFog(t === selFog ? null : t)} /> : <HeroGallery view={view} />}
          <ul className="um-zones" aria-label="منطقه‌ها">
            {board.zones.map((z) => <li key={z.id}><span className="um-zones__dot" style={{ background: z.color }} aria-hidden="true" />{z.nameFa}</li>)}
          </ul>
        </div>

        <div className="um-side">
          {view.combat && <CombatPanel view={view} mySeat={mySeat} />}
          {!view.combat && lastReveal && <LastCombat e={lastReveal} />}

          {view.reveal && (
            <section className="um-panel" aria-labelledby="um-reveal-h">
              <h3 id="um-reveal-h">دست <bdi>{seatName(view.reveal.seat)}</bdi> (فقط برای شما)</h3>
              <div className="um-cards">{view.reveal.cards.map((c) => <UmCard key={c.id} view={view} card={c} small />)}</div>
            </section>
          )}

          {mine && p && (
            <DecisionPanel title={p.kind === 'action' ? `اقدام ${fa(3 - view.actionsLeft)} از ۲` : WHY_FA[p.why] ?? 'تصمیم'}>
              {p.kind === 'pickHero' && (
                <div className="um-heroes">
                  {hints.filter((h) => h.type === 'pickHero').map((h, i, all) => {
                    const hero = HEROES[h.hero as string]!;
                    const newSet = i === 0 || HEROES[all[i - 1]!.hero as string]!.set !== hero.set;
                    return (<Fragment key={hero.id}>{newSet && <h4 className="um-heroes__set"><bdi>{hero.set}</bdi></h4>}
                      <button type="button" className={['um-hero', exp?.hero === hero.id ? 'um-hero--hint' : ''].join(' ')} style={{ ['--hc' as string]: hero.color }} disabled={busy} onClick={() => send({ type: 'pickHero', hero: hero.id })}>
                        <svg className="um-hero__emblem" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
                          <path d="M24 3 L44 10 V28 C44 40 35 49 24 53 C13 49 4 40 4 28 V10 Z" fill={hero.color} stroke="#2a2520" strokeWidth="2.5" />
                          <path d="M24 3 L44 10 V28 C44 40 35 49 24 53 Z" fill="#000" fillOpacity="0.18" />
                          <path d="M10 12 L24 7 L24 30 C16 30 11 22 10 12 Z" fill="#fff" fillOpacity="0.28" />
                          <circle cx="24" cy="27" r="16" fill="#f6efdc" stroke="#2a2520" strokeWidth="2" /><g transform="translate(24 27) scale(.5)"><Emblem id={hero.id} c={hero.color} /></g>
                        </svg>
                        <strong>{hero.hero.nameFa}</strong>
                        <span className="um-hero__stats">
                          <span className="um-stat"><span aria-hidden="true">♥</span> سلامتی {fa(hero.hero.hp)}</span>
                          <span className="um-stat"><span aria-hidden="true">➜</span> حرکت {fa(hero.move)}</span>
                          <span className="um-stat"><span aria-hidden="true">{hero.hero.ranged ? '➶' : '⚔'}</span> {hero.hero.ranged ? 'دوربرد' : 'نزدیک‌زن'}</span>
                        </span>
                        <span>{hero.sidekick.count ? <>یاور: {hero.sidekick.nameFa}{hero.sidekick.count > 1 ? ` ×${fa(hero.sidekick.count)}` : ''} ({fa(hero.sidekick.hp)} سلامتی، {hero.sidekick.ranged ? 'دوربرد' : 'نزدیک‌زن'})</> : 'بدون یاور'}</span>
                        <small>{hero.abilityFa}</small>
                      </button></Fragment>
                    );
                  })}
                </div>
              )}

              {p.kind === 'size' && (
                <div className="row">
                  <Button disabled={busy} onClick={() => send({ type: 'size', size: 'big' })}>بزرگ (حمله ۲+)</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'size', size: 'small' })}>کوچک (دفاع ۱+)</Button>
                </div>
              )}

              {p.kind === 'action' && (
                <>
                  <div className="um-actions" role="group" aria-label="اقدام‌ها">
                    <Button disabled={busy} variant={exp?.type === 'maneuver' ? 'brand' : 'primary'} onClick={() => send({ type: 'maneuver' })}>مانور (کشیدن + حرکت)</Button>
                    <Button disabled={busy || !schemes.length} variant={mode === 'scheme' ? 'brand' : 'secondary'} onClick={() => setMode(mode === 'scheme' ? null : 'scheme')}>نقشه{schemes.length ? '' : ' (کارتی نیست)'}</Button>
                    <Button disabled={busy || !attacks.length} variant={mode === 'attack' || exp?.type === 'attack' ? 'brand' : 'secondary'} onClick={() => { setMode(mode === 'attack' ? null : 'attack'); setSelFighter(null); setSelTarget(null); setSelCard(null); setSelBoost(null); }}>
                      حمله{attacks.length ? '' : ' (هدفی نیست)'}
                    </Button>
                  </div>
                  {mode === 'scheme' && (
                    <>
                      <p className="um-help">یک کارت نقشه از دستتان انتخاب کنید.</p>
                      {selCard && (
                        <ChoiceList label="کدام مبارز نقشه را اجرا کند؟" items={schemes.filter((s) => s.card === selCard).map((s) => ({ id: s.fighter, label: fighterName(view, s.fighter) }))}
                          onPick={(fid) => send({ type: 'scheme', card: selCard, fighter: fid })} busy={busy} />
                      )}
                    </>
                  )}
                  {mode === 'attack' && (
                    <div className="um-attack">
                      <ChoiceList label="مبارز مهاجم" selected={selFighter} items={[...new Set(attacks.map((a) => a.fighter))].map((f) => ({ id: f, label: fighterName(view, f) }))}
                        onPick={(f) => { setSelFighter(f); setSelTarget(null); setSelCard(null); setSelBoost(null); }} busy={busy} hint={exp?.fighter as string} />
                      {selFighter && (
                        <ChoiceList label="هدف" selected={selTarget} items={[...new Set(attacks.filter((a) => a.fighter === selFighter).map((a) => a.target))].map((t) => ({ id: t, label: fighterName(view, t) }))}
                          onPick={(t) => { setSelTarget(t); setSelCard(null); }} busy={busy} hint={exp?.target as string} />
                      )}
                      {selFighter && selTarget && <p className="um-help">{boostPick ? 'کارت تقویت را از دستتان بزنید.' : 'کارت حمله را از دستتان انتخاب کنید.'}</p>}
                      {selectedAttack?.boostable && (
                        <Button size="sm" variant={boostPick ? 'brand' : 'ghost'} disabled={busy} onClick={() => setBoostPick(!boostPick)}>
                          {selBoost ? 'تغییر کارت تقویت (توانایی آرتور)' : 'افزودن تقویت رو به پایین (توانایی آرتور)'}
                        </Button>
                      )}
                      {selectedAttack && (
                        <Button disabled={busy} onClick={() => send({ type: 'attack', fighter: selFighter, target: selTarget, card: selCard, ...(selBoost ? { boost: selBoost } : {}) })}>
                          ثبت حمله{selBoost ? ' با تقویت' : ''}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {p.kind === 'defend' && selCard && selCard.split('.')[1] === 'elementary' && (
                <div className="um-choices" role="group" aria-label="پیش‌بینی ارزش چاپی حمله حریف">
                  <span className="um-help">بدیهی است: ارزش چاپی حمله حریف را پیش‌بینی کنید (کارت شما رو به بالا بازی می‌شود).</span>
                  {Array.from({ length: 9 }, (_, v) => <button key={v} type="button" className={predict === v ? 'um-choice um-choice--on' : 'um-choice'} aria-pressed={predict === v} onClick={() => setPredict(v)}>{fa(v)}</button>)}
                </div>
              )}
              {p.kind === 'defend' && (
                <div className="row">
                  {!selCard && <p className="um-help">کارت دفاع را از دستتان بزنید.</p>}
                  {selCard && (
                    <Button disabled={busy || predict === null}
                      onClick={() => send({ type: 'defend', card: selCard, predict })}>دفاع با کارت انتخاب‌شده</Button>
                  )}
                  <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'defend', card: null })}>بدون دفاع</Button>
                </div>
              )}

              {p.kind === 'boost' && (
                <div className="row">
                  <p className="um-help">کارت تقویت را از دستتان بزنید.</p>
                  <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'choose', ids: [] })}>بدون تقویت</Button>
                </div>
              )}

              {p.kind === 'move' && (
                <>
                  <ChoiceList label="کدام مبارز؟" selected={selFighter} items={moves.map((mv) => ({ id: mv.fighter, label: fighterName(view, mv.fighter) }))} onPick={setSelFighter} busy={busy} hint={exp?.fighter as string} />
                  {selFighter && (
                    <ChoiceList label="مقصد (روی صفحه هم می‌توانید بزنید)" items={(moves.find((mv) => mv.fighter === selFighter)?.to ?? []).map((t) => ({ id: String(t), label: spaceLabel(board, t) }))}
                      onPick={(t) => send({ type: 'move', fighter: selFighter, to: Number(t) })} busy={busy} hint={exp?.type === 'move' && exp.fighter === selFighter ? String(exp.to) : undefined} compact />
                  )}
                  <Button variant={exp?.type === 'done' ? 'brand' : 'secondary'} disabled={busy} onClick={() => send({ type: 'done' })}>پایان حرکت</Button>
                </>
              )}

              {(p.kind === 'place' || p.kind === 'space') && (
                <>
                  {p.fighter && <p className="um-help">{fighterName(view, p.fighter)}: یک خانه روشن روی صفحه را بزنید.</p>}
                  <ChoiceList label="خانه‌ها" items={(p.spaces ?? []).map((s) => ({ id: String(s), label: spaceLabel(board, s) }))} onPick={(s) => send({ type: 'choose', ids: [s] })} busy={busy} compact />
                  {p.may && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'done' })}>رد کردن</Button>}
                </>
              )}

              {p.kind === 'fog' && (
                <>
                  {fogOpts.length > 1 && <ChoiceList label="کدام نشان مه؟ (روی صفحه هم می‌توانید بزنید)" selected={selFog === null ? null : String(selFog)}
                    items={fogOpts.map((o) => ({ id: String(o.token), label: `مه ${fa(o.token + 1)} — ${spaceLabel(board, view.fog[o.token]!)}` }))} onPick={(t) => setSelFog(Number(t))} busy={busy} />}
                  {curFog && <ChoiceList label="مقصد" items={curFog.to.map((t) => ({ id: String(t), label: spaceLabel(board, t) }))} onPick={(t) => send({ type: 'choose', ids: [`${curFog.token}@${t}`] })} busy={busy} compact />}
                  {p.may && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'done' })}>جابه‌جا نکن</Button>}
                </>
              )}

              {p.kind === 'fighter' && (
                <>
                  <ChoiceList label="مبارز" items={chooseIds.map((f) => ({ id: f, label: `${fighterName(view, f)} (${fa(view.fighters.find((x) => x.id === f)?.hp ?? 0)} سلامتی)` }))} onPick={(f) => send({ type: 'choose', ids: [f] })} busy={busy} />
                  {p.may && <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'done' })}>رد کردن</Button>}
                </>
              )}

              {p.kind === 'cards' && (
                <>
                  {!fromHand && (
                    <div className="um-cards">{(p.cards ?? []).map((id) => {
                      const c = { id, seat: Number(id.split('.')[0]), slug: id.split('.')[1] ?? '' };
                      const order = picks.indexOf(id);
                      return (
                        <span key={id} className="um-pickwrap">
                          <UmCard view={view} card={c} state={order >= 0 ? 'selected' : 'playable'} onClick={() => pickCard(id)} />
                          {order >= 0 && <span className="um-pickwrap__n">{fa(order + 1)}</span>}
                        </span>
                      );
                    })}</div>
                  )}
                  {fromHand && <p className="um-help">کارت‌ها را از دستتان (پایین) انتخاب کنید{(p.max ?? 0) > (p.min ?? 0) ? '؛ می‌توانید کمتر هم انتخاب کنید' : ''}.</p>}
                  <Button disabled={busy || picks.length < (p.min ?? 0) || picks.length > (p.max ?? 1)} onClick={() => send({ type: 'choose', ids: picks })}>
                    تأیید ({fa(picks.length)} از {fa(p.min ?? 0)}{(p.max ?? 0) > (p.min ?? 0) ? `–${fa(p.max ?? 0)}` : ''})
                  </Button>
                </>
              )}

              {p.kind === 'option' && (p.max ?? 1) === 1 && (
                <div className="um-actions">{(p.options ?? []).map((o) => (
                  <Button key={o} variant="secondary" disabled={busy} onClick={() => send({ type: 'choose', ids: [o] })}>{optionLabel(p, o, seatName)}</Button>
                ))}</div>
              )}
              {p.kind === 'option' && (p.max ?? 1) > 1 && (
                <>
                  <div className="um-options">{(p.options ?? []).map((o) => (
                    <label key={o} className="um-option"><input type="checkbox" checked={picks.includes(o)} onChange={() => togglePick(o, p.max ?? 1)} />{optionLabel(p, o, seatName)}</label>
                  ))}</div>
                  <Button disabled={busy || picks.length !== (p.min ?? 1)} onClick={() => send({ type: 'choose', ids: picks })}>تأیید</Button>
                </>
              )}
            </DecisionPanel>
          )}
        </div>
      </div>

      {view.myHand && mySeat !== null && view.heroes[mySeat] && !view.outcome && (
        <section className="um-hand" aria-label={`دست شما، ${fa(hand.length)} کارت`}>
          <div className="um-hand__bar"><strong>دست شما ({fa(hand.length)})</strong>{hand.length > 7 && <span className="um-warn">بیش از ۷ کارت: پایان نوبت باید دور بریزید</span>}</div>
          <div className="um-cards um-cards--hand">
            {hand.map((c, i) => {
              const st = handState(c);
              const hinted = (exp?.type === 'choose' && (exp.ids as string[]).includes(c.id)) || (exp?.type === 'attack' && exp.card === c.id);
              return <UmCard key={c.id} view={view} card={c} flip={`card-${c.id}`} from={`deck-${mySeat}`} exit={`discard-${mySeat}`} state={st} hint={hinted} fan={i - (hand.length - 1) / 2} onClick={st && st !== 'dim' ? () => tapHand(c) : undefined} />;
            })}
          </div>
        </section>
      )}

      <details className="um-discards">
        <summary>کارت‌های دورریخته</summary>
        {view.order.map((seat) => (
          <div key={seat} className="um-discards__row">
            <strong><bdi>{seatName(seat)}</bdi> ({fa(view.discards[seat]?.length ?? 0)})</strong>
            <div className="um-cards">{(view.discards[seat] ?? []).slice().reverse().map((c) => <UmCard key={c.id} view={view} card={c} small />)}</div>
          </div>
        ))}
      </details>

      <details className="um-log" open>
        <summary>رویدادها</summary>
        <ol>{view.log.slice(-8).reverse().map((e) => <li key={e.seq}>{describe(e, view, seatName)}</li>)}</ol>
      </details>
    </div>
  );
}

function DecisionPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="um-panel um-panel--decide" aria-label={title}><h3>{title}</h3>{children}</section>;
}

function ChoiceList({ label, items, onPick, busy, selected, hint, compact }: {
  label: string; items: { id: string; label: string }[]; onPick: (id: string) => void; busy: boolean; selected?: string | null; hint?: string; compact?: boolean;
}) {
  return (
    <fieldset className={compact ? 'um-choices um-choices--compact' : 'um-choices'}>
      <legend>{label}</legend>
      {items.map((it) => (
        <button key={it.id} type="button" className={['um-choice', selected === it.id ? 'um-choice--on' : '', hint === it.id ? 'um-choice--hint' : ''].join(' ')}
          aria-pressed={selected === it.id} disabled={busy} onClick={() => onPick(it.id)}>{it.label}</button>
      ))}
    </fieldset>
  );
}

/**
 * A player's hero character card, laid out like the printed one: the painted art window with the hero's name banner,
 * the health dial, move and attack-type stats, the sidekick dials, the special-ability box and the card stacks.
 * Everything is public: opponents get the same card in a compact form (ability folded away), never their hand.
 */
function PlayerPanel({ view, was, seat, me, name }: { view: UnmatchedView; was?: UnmatchedView; seat: number; me: boolean; name: string }) {
  const hero = HEROES[view.heroes[seat] ?? ''];
  const fighters = view.fighters.filter((f) => f.seat === seat);
  const turn = view.current === seat && !view.outcome && view.turnNo > 0;
  const lead = fighters.find((f) => f.hero);
  const kicks = fighters.filter((f) => !f.hero);
  const counts = { hand: view.handCounts[seat] ?? 0, deck: view.deckCounts[seat] ?? 0, discard: view.discards[seat]?.length ?? 0 };
  const pop = (a: number, b: number | undefined) => (was && b !== undefined && a !== b ? 'bg-pop' : '');
  const notes = hero ? [view.size[seat] ? (view.size[seat] === 'big' ? 'آلیس بزرگ' : 'آلیس کوچک') : '', view.form[seat] ? `اکنون ${formFa(view.form[seat])}` : '', view.vanished[seat] ? 'ناپدید' : '', view.fogSeat === seat ? `${fa(view.fog.length)} نشان مه` : ''].filter(Boolean) : [];
  return (
    <li data-flip-anchor={`seat-${seat}`} className={['um-player', turn ? 'um-player--turn' : '', view.alive[seat] ? '' : 'um-player--out', me ? 'um-player--me' : ''].join(' ')} style={{ ['--hc' as string]: hero?.color ?? '#8a7a60' }}>
      <div className="um-hc__art">
        {hero && <img src={PORTRAITS[heroEmblem(view, seat)] ?? PORTRAITS.arthur} alt="" aria-hidden="true" draggable={false} />}
        <div className="um-hc__banner">
          <strong>{hero ? (view.heroes[seat] === 'jekyll' && view.form[seat] ? formFa(view.form[seat]) : hero.hero.nameFa) : 'بدون قهرمان'}</strong>
          <span className="um-player__head">
            <bdi className="um-player__name">{name}</bdi>{me && <span> (شما)</span>}
            {turn && <span className="um-badge">نوبت</span>}
            {!view.alive[seat] && <span className="um-badge um-badge--out">بیرون</span>}
          </span>
        </div>
      </div>
      {hero ? (
        <div className="um-hc__body">
          <div className="um-hc__row">
            <div className="um-hc__stats">
              {lead && <HpDial f={lead} name={fighterName(view, lead.id)} big />}
              <div className="um-hc__facts">
                <span className="um-hc__fact"><span aria-hidden="true">➜</span>حرکت <b>{fa(hero.move)}</b></span>
                <span className="um-hc__fact"><span aria-hidden="true">{hero.hero.ranged ? '➶' : '⚔'}</span>{hero.hero.ranged ? 'دوربرد' : 'نزدیک‌زن'}</span>
                {notes.length > 0 && <span className="um-hc__note">{notes.join(' · ')}</span>}
              </div>
            </div>
            {kicks.length > 0 && (
              <div className="um-hc__kicks">
                <small>یاور: {hero.sidekick.nameFa} · {hero.sidekick.ranged ? 'دوربرد' : 'نزدیک‌زن'}</small>
                <ul className="um-hp">{kicks.map((f) => <li key={f.id}><HpDial f={f} name={fighterName(view, f.id)} /></li>)}</ul>
              </div>
            )}
          </div>
          {me ? <p className="um-hc__ability"><b>توانایی ویژه: </b>{hero.abilityFa}</p>
            : <details className="um-hc__ability"><summary>توانایی ویژه</summary><p>{hero.abilityFa}</p></details>}
          <div className="um-player__counts">
            <span className="um-stackc"><i className="um-stackc__ic um-stackc__ic--hand" aria-hidden="true" />دست <b key={counts.hand} className={pop(counts.hand, was?.handCounts[seat])}>{fa(counts.hand)}</b></span>
            <span className="um-stackc" data-flip-anchor={`deck-${seat}`}><i className="um-stackc__ic um-stackc__ic--deck" aria-hidden="true" />دسته <b key={counts.deck} className={pop(counts.deck, was?.deckCounts[seat])}>{fa(counts.deck)}</b>{counts.deck === 0 ? ' (خسته!)' : ''}</span>
            <span className="um-stackc" data-flip-anchor={`discard-${seat}`}><i className="um-stackc__ic um-stackc__ic--discard" aria-hidden="true" />دورریخته <b key={counts.discard} className={pop(counts.discard, was?.discards[seat]?.length)}>{fa(counts.discard)}</b></span>
          </div>
        </div>
      ) : <div className="um-hc__body um-muted">در حال انتخاب قهرمان…</div>}
    </li>
  );
}

/** The printed health dial: one notch per health point around the wheel, lit notches = health left, the number in the hub. */
function HpDial({ f, name, big }: { f: Fighter; name: string; big?: boolean }) {
  const n = Math.max(1, f.maxHp), gap = n > 1 ? 0.07 : 0, T = Math.PI * 2;
  return (
    <span className={['um-dial', big ? 'um-dial--big' : '', f.hp === 0 ? 'um-dial--dead' : ''].join(' ')} role="meter" aria-valuemin={0} aria-valuemax={f.maxHp} aria-valuenow={f.hp} aria-label={`سلامتی ${name}: ${fa(f.hp)} از ${fa(f.maxHp)}`}>
      <svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
        <circle r="47" className="um-dial__rim" />
        {n === 1 ? <circle r="40" className={f.hp > 0 ? 'um-dial__notch um-dial__notch--on' : 'um-dial__notch'} />
          : Array.from({ length: n }, (_, i) => <path key={i} d={slicePath(0, 0, 40, (i / n) * T + gap / 2 - Math.PI / 2, ((i + 1) / n) * T - gap / 2 - Math.PI / 2)} className={i < f.hp ? 'um-dial__notch um-dial__notch--on' : 'um-dial__notch'} />)}
        <circle r="28" className="um-dial__hub" />
        <text y="9" className="um-dial__num">{f.hp === 0 ? '✕' : fa(f.hp)}</text>
      </svg>
      <small><bdi>{name}</bdi>{f.hp === 0 ? ' — شکست' : ` ${fa(f.hp)}/${fa(f.maxHp)}`}</small>
    </span>
  );
}

function HeroGallery({ view }: { view: UnmatchedView }) {
  return (
    <div className="um-gallery">
      {Object.values(HEROES).map((h) => (
        <div key={h.id} className={view.heroes.includes(h.id) ? 'um-gallery__hero um-gallery__hero--taken' : 'um-gallery__hero'} style={{ ['--hc' as string]: h.color }}>
          <strong>{h.hero.nameFa}</strong><span>{view.heroes.includes(h.id) ? 'انتخاب شد' : 'آزاد'}</span>
        </div>
      ))}
    </div>
  );
}

function CombatPanel({ view, mySeat }: { view: UnmatchedView; mySeat: number | null }) {
  const c = view.combat!;
  const fn = (f: string) => fighterName(view, f);
  const aSeat = Number(c.attacker[0]);
  const back = (seat: number) => ({ emblem: heroEmblem(view, seat), color: heroColor(view, seat) });
  // My own cards keep their hand id (they fly hand → combat); the opponent's come from their seat. All go to the discard pile.
  const fid = (slot: string, seat: number, card: CardRef | null) => (card && seat === mySeat ? `card-${card.id}` : slot);
  const stand = (fid: string) => { const f = view.fighters.find((x) => x.id === fid); return f ? <span className="um-combat__who" style={{ ['--hc' as string]: heroColor(view, f.seat) }}><svg viewBox="-34 -34 68 68" width="46" height="46" aria-hidden="true" focusable="false"><circle r="32" fill={heroColor(view, f.seat)} stroke="#fff" strokeWidth="3" /><circle r="25" fill="#f6efdc" stroke="#1d1812" strokeWidth="2" /><g transform="scale(.8)"><Emblem id={fighterEmblem(view, f)} c={heroColor(view, f.seat)} /></g></svg></span> : null; };
  return (
    <section className="um-panel um-combat" aria-labelledby="um-combat-h">
      <h3 id="um-combat-h">نبرد: {fn(c.attacker)} <span aria-hidden="true">⚔</span> {fn(c.defender)}{c.ranged ? ' (از دور)' : ''}</h3>
      <div className="um-combat__row">
        <div className="um-combat__side">
          {stand(c.attacker)}
          <span className="um-muted">حمله</span>
          {c.aCard ? <UmCard view={view} card={c.aCard} small flip={fid('play-a', aSeat, c.aCard)} from={`seat-${aSeat}`} exit={`discard-${aSeat}`} extra={aSeat === mySeat ? '' : 'bg-flip-in'} /> : <CardBack label="کارت حمله رو به پایین" flip="play-a" from={`seat-${aSeat}`} exit={`discard-${aSeat}`} {...back(aSeat)} />}
          {c.hasBoost && (c.boost ? <span className="um-combat__boost">تقویت: <UmCard view={view} card={c.boost} small flip={fid('play-b', aSeat, c.boost)} from={`seat-${aSeat}`} exit={`discard-${aSeat}`} extra={aSeat === mySeat ? '' : 'bg-flip-in'} /></span> : <CardBack label="کارت تقویت رو به پایین" flip="play-b" from={`seat-${aSeat}`} exit={`discard-${aSeat}`} {...back(aSeat)} />)}
        </div>
        <span className="um-vs" aria-hidden="true"><span>VS</span></span>
        <div className="um-combat__side">
          {stand(c.defender)}
          <span className="um-muted">دفاع</span>
          {c.dCard ? <UmCard view={view} card={c.dCard} small flip={fid('play-d', c.dSeat, c.dCard)} from={`seat-${c.dSeat}`} exit={`discard-${c.dSeat}`} extra={c.dSeat === mySeat ? '' : 'bg-flip-in'} /> : c.defended ? (c.revealed ? <span className="um-muted">بدون کارت دفاع</span> : <CardBack label="کارت دفاع رو به پایین" flip="play-d" from={`seat-${c.dSeat}`} exit={`discard-${c.dSeat}`} {...back(c.dSeat)} />) : <span className="um-muted">{c.dSeat === mySeat ? 'انتخاب کنید…' : 'مدافع در حال انتخاب…'}</span>}
        </div>
        {c.aVal !== null && <span className="um-combat__dmg" aria-hidden="true">{(c.damage ?? 0) > 0 ? `−${fa(c.damage ?? 0)}` : '۰'}</span>}
      </div>
      {c.aVal !== null && <p className="um-combat__result">حمله {fa(c.aVal)} − دفاع {fa(c.dVal ?? 0)} = <strong>{fa(c.damage ?? 0)} آسیب</strong> · {c.won === 'a' ? 'مهاجم برد' : 'مدافع برد'}</p>}
    </section>
  );
}

function LastCombat({ e }: { e: Extract<LogEntry, { t: 'reveal' }> }) {
  return (
    <section className="um-panel um-panel--quiet" aria-label="آخرین نبرد">
      <p>آخرین نبرد: حمله {fa(e.aVal)} در برابر دفاع {fa(e.dVal)} — {e.damage ? `${fa(e.damage)} آسیب` : 'بدون آسیب'}.</p>
    </section>
  );
}

export type { Prompt };
