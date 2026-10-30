// خشم خون renderer: Midgard on a night sea. The map is an SVG ring of eight provinces around Yggdrasil with four fjords;
// figures stand in village slots. Under it: the clans (glory, Rage, stat tracks, upgrades), your reserve, your hand and the
// pillage battle. Hidden things (hands, drafted packs, quests, chosen battle cards) are only drawn for their owner.
import './renderer.css';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, DockSlot, ZoomBoard, type GameAction, type GameRendererProps } from '@bg/ui';
import {
  adjacent, CARD_BY_ID, CARDS, FJORDS, FJORD_IDS, PROVINCES, REGION_FA, REWARD_FA, RING, STAT_FA, STATS, TRACKS, LAST_STEP, RAGNAROK_GLORY,
  type CardDef, type FjordId, type Place, type ProvinceId, type Stat
} from './data.ts';
import { villagesFree, type BRView, type BattleView, type Figure, type LogEntry } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const CLAN_FA = ['آبی', 'زرد', 'قرمز', 'عاج', 'بنفش'];
const clanColor = (seat: number) => `var(--seat-${(seat % 5) + 1})`;
/** Seat → clan of the printed game (raven, serpent, wolf, bear, ram): emblem and figure portraits in cards.webp. */
const CLAN_NAME = ['کلاغ', 'مار', 'گرگ', 'خرس', 'قوچ'];
const CLAN_ART = [
  { emblem: 139, warrior: 140, leader: 141, ship: 142 },
  { emblem: 135, warrior: 136, leader: 137, ship: 138 },
  { emblem: 131, warrior: 132, leader: 133, ship: 134 },
  { emblem: 143, warrior: 144, leader: 145, ship: 146 },
  { emblem: 147, warrior: 148, leader: 149, ship: 150 }
];
const cell = (k: number) => ({ x: (k % 14) * 150, y: Math.floor(k / 14) * 230 });
const spritePos = (k: number) => `${((k % 14) / 13) * 100}% ${(Math.floor(k / 14) / 10) * 100}%`;
const KIND_FA: Record<string, string> = { leader: 'رهبر', warrior: 'جنگجو', ship: 'کشتی', monster: 'هیولا' };
const CARD_KIND_FA: Record<CardDef['kind'], string> = { clan: 'ارتقای قبیله', warrior: 'ارتقای جنگجو', ship: 'ارتقای کشتی', leader: 'ارتقای رهبر', monster: 'هیولا', battle: 'نبرد', quest: 'مأموریت' };
const REWARD_GLYPH: Record<string, string> = { rage: 'خ+', axes: 'ت+', horns: 'ش+', glory: '۵', all: '★' };
const PHASE_FA: Record<string, string> = {
  draft: 'هدیهٔ خدایان (درفت)', action: 'کنش‌ها', discard: 'دور ریختن', quest: 'مأموریت‌ها', ragnarok: 'راگناروک', release: 'آزادی والهالا', endage: 'پایان عصر', over: 'پایان بازی'
};
const STAGE_FA: Record<BattleView['stage'], string> = {
  call: 'فراخوان نبرد', cards: 'انتخاب کارت', reveal: 'آشکار شدن کارت‌ها', tide: 'سیل اودین', late: 'کارت‌های دیررس', protect: 'حمایت فریگا', apply: 'نتیجه', after: 'پایان نبرد'
};
const iso = (s: string) => `⁨${s}⁩`;

// ---------- geometry (coordinates of the printed board in the rulebook, 441 x 441) ----------
/** Where the island picture (board.webp) sits in these coordinates. */
const PIC = { x: -1.5, y: -3.9, size: 450.7 };
/** Village circles and the pillage-reward square of every province, read off the board picture. */
const SLOTS: Record<Exclude<ProvinceId, 'ygg'>, { v: [number, number][]; reward: [number, number] }> = {
  myr: { v: [[107, 122], [148, 105], [138, 160]], reward: [135, 130] },
  elv: { v: [[178, 43], [218, 52], [157, 68], [207, 130]], reward: [207, 90] },
  ang: { v: [[290, 82], [330, 95], [263, 127], [330, 135], [298, 165]], reward: [300, 125] },
  mus: { v: [[323, 197], [358, 210], [295, 232], [375, 247], [323, 268]], reward: [337, 233] },
  hor: { v: [[267, 292], [320, 322], [235, 347], [278, 367]], reward: [282, 322] },
  utg: { v: [[193, 313], [157, 348], [207, 373]], reward: [188, 345] },
  and: { v: [[83, 288], [143, 290], [108, 347]], reward: [113, 302] },
  gim: { v: [[47, 203], [90, 185], [142, 190], [68, 238], [107, 247]], reward: [98, 215] }
};
const YGG: [number, number] = [212, 232];
const FJORD_AT: Record<FjordId, [number, number]> = { f1: [281, 50], f2: [353, 317], f3: [120, 373], f4: [70, 147] };
function slotPositions(p: ProvinceId): { x: number; y: number }[] {
  if (p === 'ygg') return Array.from({ length: 20 }, (_, k) => ({ x: YGG[0] - 40 + (k % 5) * 20, y: YGG[1] + 10 + Math.floor(k / 5) * 20 }));
  return SLOTS[p].v.map(([x, y]) => ({ x, y }));
}
const rewardAt = (p: Exclude<ProvinceId, 'ygg'>) => ({ x: SLOTS[p].reward[0], y: SLOTS[p].reward[1] });
const fjordSlot = (f: FjordId, k: number) => { const c = FJORD_AT[f]; return { x: c[0] + ((k % 2) - 0.5) * 22, y: c[1] + (Math.floor(k / 2) - 0.5) * 22 }; };


// ---------- card art (cards.webp: 14 × 11 sprite of illustrations) ----------
const ART: Record<string, number[]> = {
  "Loki's Trickery": [0], "Thor's Hammer": [2], "Heimdall's Sight": [3], "Odin's Smite": [4], "Frigga's Grace": [6], "Tyr's Bash": [8],
  "Tyr's Smash": [9, 42], "Tyr's Crush": [11, 43, 77], "Tyr's Smite": [12, 44, 78], 'Manheim!': [13, 47, 81], 'Jotunheim!': [15, 49, 83],
  'Alfheim!': [17, 51, 85], 'Glorious Death!': [19, 54, 88], 'Yggdrasil!': [20, 53, 86], 'Brothers in Arms': [22], "Loki's Dragons": [23],
  Troll: [24], 'Lord of Hammers': [25], 'Dwarf Chieftain': [26], 'Sea Serpent': [27], "Loki's Blessing": [28], "Loki's Domain": [29],
  "Frigga's Charm": [30], "Tyr's Domain": [31], "Thor's Glory": [32], "Frigga's Succor": [33], "Loki's Backstab": [34], "Odin's Tide": [36],
  "Heimdall's Eye": [38], "Thor's Oath": [41], "Tyr's Rage": [45, 79], "Heimdall's Watch": [46, 80], 'Experts in Arms': [56], 'Fire Dragons': [57],
  'Lord of Axes': [58], Valkyrie: [59], 'Dark Elf': [60], 'Fire Giant': [61], "Odin's Inspiration": [62], "Thor's Domain": [63],
  "Loki's Eminence": [64], "Frigga's Protection": [65], "Tyr's Challenge": [66], "Tyr's Prowess": [67], "Loki's Poison": [68],
  "Thor's Ascension": [69], "Heimdall's Gaze": [71], "Odin's Judgement": [72], "Thor's Primacy": [75], 'Masters in Arms': [90],
  'Eternal Dragons': [91], 'Lord of Spears': [92], 'Volur Witch': [93], 'Frost Giant': [94], 'Soldier from Hel': [95], "Frigga's Domain": [96],
  "Odin's Throne": [97], "Tyr's Wrath": [98], "Loki's Wrath": [99], "Frigga's Sacrifice": [100], "Thor's Conquest": [101], 'Widespread!': [106],
  "Tyr's Judgement": [120]
};
function artStyle(def: CardDef): CSSProperties | undefined {
  const cells = ART[def.nameEn];
  if (!cells) return undefined;
  const k = cells[Math.min(def.age, cells.length) - 1]!;
  return { backgroundPosition: spritePos(k) };
}

/** One SVG pattern per portrait (clan warriors, leaders, ships and monsters), cut from cards.webp. */
const PORTRAITS = [
  ...CLAN_ART.flatMap((c) => [`f${c.warrior}`, `f${c.leader}`, `s${c.ship}`]),
  ...CARDS.filter((d) => d.kind === 'monster').map((d) => `f${ART[d.nameEn]?.[0] ?? 0}`)
];
function FigurePatterns() {
  return (
    <defs>
      {[...new Set(PORTRAITS)].map((id) => {
        const c = cell(Number(id.slice(1)));
        const box = id.startsWith('s') ? { x: c.x + 15, y: c.y + 60, w: 120 } : { x: c.x + 25, y: c.y + 22, w: 100 };
        return (
          <pattern key={id} id={`blr-pat-${id}`} width="1" height="1" patternContentUnits="objectBoundingBox" viewBox={`${box.x} ${box.y} ${box.w} ${box.w}`} preserveAspectRatio="xMidYMid slice">
            <image href="/games/blood-rage/cards.webp" width="2100" height="2530" />
          </pattern>
        );
      })}
    </defs>
  );
}

type Hint = GameAction;

function CardView({ def, selected, dim, onClick, children, label }: { def: CardDef; selected?: boolean; dim?: boolean; onClick?: () => void; children?: ReactNode; label?: string }) {
  const big = def.kind === 'battle' ? (def.str === null ? 'X' : `+${fa(def.str!)}`) : def.kind === 'quest' ? fa(def.glory!) : def.mstr !== undefined ? fa(def.mstr) : fa(def.cost ?? 0);
  const sub = def.kind === 'battle' ? 'قدرت' : def.kind === 'quest' ? 'افتخار' : def.mstr !== undefined ? `قدرت · هزینه ${fa(def.cost ?? 0)}` : 'خشم';
  const inner = (
    <>
      <span className="blr-card__art" style={artStyle(def)} aria-hidden />
      <span className="blr-card__kind">{CARD_KIND_FA[def.kind]}<i>{fa(def.age)}</i></span>
      <b className="blr-card__num" aria-hidden>{big}</b>
      <small className="blr-card__sub">{sub}</small>
      <span className="blr-card__name">{def.nameFa}</span>
      <span className="blr-card__text">{def.textFa}</span>
    </>
  );
  return (
    <div className={`blr-card blr-card--${def.kind}${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}>
      {onClick
        ? <button type="button" className="blr-card__face" aria-pressed={selected} aria-label={label ?? `${def.nameFa}، ${CARD_KIND_FA[def.kind]}`} onClick={onClick}>{inner}</button>
        : <div className="blr-card__face" role="img" aria-label={label ?? `${def.nameFa}، ${CARD_KIND_FA[def.kind]}`}>{inner}</div>}
      {children}
    </div>
  );
}
const CardBack = ({ label = 'کارت پنهان' }: { label?: string }) => <div className="blr-card blr-card--back" role="img" aria-label={label}><span aria-hidden>ᚱ</span></div>;

function describe(e: LogEntry, name: (s: number) => string): string {
  const who = e.seat >= 0 ? iso(name(e.seat)) : '';
  const pf = (x?: string) => (x && x in PROVINCES ? PROVINCES[x as ProvinceId].nameFa : x?.startsWith('f') ? 'خلیج' : '');
  switch (e.e) {
    case 'age': return `عصر ${fa(e.n ?? 1)} شروع شد.`;
    case 'end-action': return 'مرحلهٔ کنش‌ها تمام شد.';
    case 'invade': return `${who} در ${pf(e.at)} نیرو آورد.`;
    case 'march': return `${who} به ${pf(e.at)} لشکر کشید.`;
    case 'pillage': return `${who} غارت ${pf(e.at)} را اعلام کرد.`;
    case 'call': return `${who} نیرویی را به نبرد فراخواند.`;
    case 'upgrade': return `${who} ارتقا داد: ${e.card ? CARD_BY_ID[e.card]?.nameFa : ''}.`;
    case 'commit': return `${who} به یک مأموریت تعهد داد.`;
    case 'pass': return `${who} گذشت.`;
    case 'win': return `${who} نبرد ${pf(e.at)} را برد.`;
    case 'tie': return `نبرد ${pf(e.at)} مساوی شد؛ همه باختند.`;
    case 'reward': return `${who} پاداش ${pf(e.at)} را گرفت.`;
    case 'watch': return `${who} با دیده‌بانی هایمدال ${fa(e.n ?? 0)} افتخار گرفت.`;
    case 'quest': return `${who} مأموریت را انجام داد (${fa(e.n ?? 0)} افتخار).`;
    case 'quest-failed': return `${who} مأموریت را انجام نداد.`;
    case 'ragnarok': return `راگناروک: ${pf(e.at)} نابود شد.`;
    case 'final': return `${who} امتیاز نهایی ${fa(e.n ?? 0)}.`;
    case 'resign': return `${who} انصراف داد.`;
    case 'sacrifice': return `${who} دو نیرو قربانی کرد.`;
    default: return '';
  }
}

// ---------- the renderer ----------
type Mode = { t: 'invade'; group?: string } | { t: 'march'; from?: ProvinceId; sel: number[] } | { t: 'pillage' } | { t: 'sacrifice'; sel: number[] } | null;
const monShip = (f: Figure) => f.kind === 'ship' || f.mon === 'm1-serpent';

export default function BloodRageRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<BRView>) {
  const hints = legalActions as Hint[];
  const me = mySeat !== null && view.me ? mySeat : null;
  const [mode, setMode] = useState<Mode>(null);
  const [pickCards, setPickCards] = useState<number[]>([]);
  const [pickFigs, setPickFigs] = useState<number[]>([]);
  const [slotFor, setSlotFor] = useState<number | null>(null);
  useEffect(() => { setMode(null); setPickCards([]); setPickFigs([]); setSlotFor(null); }, [view.seq, view.step, view.battle?.stage, view.choice?.k]);

  const act = (a: Hint) => { if (!busy) onAction(a); };
  const has = (type: string) => hints.some((h) => h.type === type);
  const hintsOf = (type: string) => hints.filter((h) => h.type === type);
  const nm = (seat: number) => iso(seatName(seat));
  const myClan = me === null ? null : view.seats[me]!;
  const figs = view.figs;
  const byPlace = (p: Place) => figs.filter((f) => f.at === p).sort((a, b) => a.id - b.id);
  const reserve = me === null ? [] : figs.filter((f) => f.seat === me && f.at === 'reserve');
  const valhalla = (seat: number) => figs.filter((f) => f.seat === seat && f.at === 'valhalla');
  const mineOnBoard = me === null ? [] : figs.filter((f) => f.seat === me && f.at !== 'reserve' && f.at !== 'valhalla');
  const defOf = (id: number) => CARD_BY_ID[view.me?.hand.find((c) => c.id === id)?.def ?? view.me?.pack.find((c) => c.id === id)?.def ?? view.me?.quests.find((c) => c.id === id)?.def ?? '']!;
  const myTurn = view.step === 'action' && view.turn === me && !view.battle && !view.choice && !view.spent;
  const choice = view.choice && view.choice.seat === me ? view.choice : null;
  const battle = view.battle;
  const exp = expected as Hint | null;

  // ----- which places the board offers right now -----
  const targets = new Set<string>();
  const sources = new Set<string>();
  const hintedFigs = new Set<number>();
  if (me !== null && !busy) {
    if (choice?.k === 'freeInvade') {
      const f = figs.find((x) => x.id === choice.fig);
      if (f) {
        const ship = monShip(f);
        if (ship) FJORD_IDS.forEach((p) => targets.add(p));
        else {
          RING.filter((p) => !view.destroyed.includes(p) && villagesFree(view, p) > 0).forEach((p) => targets.add(p));
          if (f.mon === 'm2-elf') targets.add('ygg');
        }
      }
    } else if (choice?.k === 'hammer') {
      const f = figs.find((x) => x.id === choice.fig);
      if (f) (['ygg', ...RING] as ProvinceId[]).filter((p) => p !== f.at && !view.destroyed.includes(p) && adjacent(f.at as ProvinceId, p) && villagesFree(view, p) > 0).forEach((p) => targets.add(p));
    } else if (battle?.stage === 'call' && battle.caller === me) {
      hintsOf('call').forEach((h) => { if (typeof h.figure === 'number') hintedFigs.add(h.figure as number); });
    } else if (myTurn && mode) {
      if (mode.t === 'invade' && mode.group) for (const h of hintsOf('invade')) if (groupOf(figs.find((f) => f.id === h.figure)) === mode.group) targets.add(h.at as string);
      if (mode.t === 'march') {
        if (!mode.from) hintsOf('march').forEach((h) => sources.add(h.from as string));
        else (['ygg', ...RING] as ProvinceId[]).filter((p) => p !== mode.from && !view.destroyed.includes(p) && (p === 'ygg' || villagesFree(view, p) >= Math.max(1, mode.sel.length))).forEach((p) => targets.add(p));
      }
      if (mode.t === 'pillage') hintsOf('pillage').concat(hintsOf('challenge')).forEach((h) => targets.add(h.at as string));
    }
  }
  function groupOf(f?: Figure): string { return f ? `${f.at === 'valhalla' ? 'v-' : ''}${f.kind}${f.mon ? `:${f.mon}` : ''}` : ''; }

  const clickPlace = (p: Place) => {
    if (busy) return;
    if (choice?.k === 'freeInvade' && targets.has(p)) return act({ type: 'decide', yes: true, at: p });
    if (choice?.k === 'hammer' && targets.has(p)) return act({ type: 'decide', yes: true, at: p });
    if (!myTurn || !mode) return;
    if (mode.t === 'invade' && mode.group && targets.has(p)) {
      const fig = hintsOf('invade').find((h) => groupOf(figs.find((f) => f.id === h.figure)) === mode.group && h.at === p);
      if (fig) act({ type: 'invade', figure: fig.figure, at: p });
    } else if (mode.t === 'march') {
      if (!mode.from && sources.has(p)) setMode({ t: 'march', from: p as ProvinceId, sel: figs.filter((f) => f.seat === me && f.at === p && !monShip(f)).map((f) => f.id) });
      else if (mode.from && targets.has(p) && mode.sel.length) act({ type: 'march', from: mode.from, to: p, figures: mode.sel });
    } else if (mode.t === 'pillage' && targets.has(p)) {
      const h = hintsOf('pillage').find((x) => x.at === p) ?? hintsOf('challenge').find((x) => x.at === p);
      if (h) act({ type: h.type, at: p });
    }
  };
  const clickFig = (f: Figure) => {
    if (busy) return;
    if (battle?.stage === 'call' && battle.caller === me && hintedFigs.has(f.id)) return act({ type: 'call', figure: f.id });
    if (choice?.k === 'tide' && choice.figs?.includes(f.id)) return setPickFigs([f.id]);
    if (choice?.k === 'protect' && choice.figs?.includes(f.id)) return setPickFigs((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : s.length < (myClan?.rage ?? 0) ? [...s, f.id] : s));
    if (mode?.t === 'march' && mode.from && f.seat === me && f.at === mode.from && !monShip(f)) setMode({ ...mode, sel: mode.sel.includes(f.id) ? mode.sel.filter((x) => x !== f.id) : [...mode.sel, f.id] });
    else if (mode?.t === 'sacrifice' && f.seat === me && mineOnBoard.some((x) => x.id === f.id)) setMode({ ...mode, sel: mode.sel.includes(f.id) ? mode.sel.filter((x) => x !== f.id) : mode.sel.length < 2 ? [...mode.sel, f.id] : mode.sel });
    else if (mode?.t === 'march' && !mode.from && sources.has(f.at as string)) clickPlace(f.at as Place);
    else if (f.at !== 'reserve' && f.at !== 'valhalla' && (targets.has(f.at as string))) clickPlace(f.at as Place);
  };

  // ----- hand actions -----
  const upgradeHint = (id: number) => hintsOf('upgrade').find((h) => h.card === id);
  const needSlot = (def: CardDef) => (def.kind === 'monster' && myClan!.monsters.every(Boolean)) || (def.kind === 'clan' && myClan!.clans.every(Boolean));
  const doUpgrade = (id: number) => { const d = defOf(id); if (needSlot(d)) setSlotFor(id); else act({ type: 'upgrade', card: id }); };

  // ----- status line -----
  let status: string;
  if (view.outcome) status = 'بازی تمام شد.';
  else if (battle) status = `نبرد ${PROVINCES[battle.at].nameFa}: ${STAGE_FA[battle.stage]}${battle.stage === 'call' && battle.caller !== null ? ` — نوبت ${nm(battle.caller)}` : ''}`;
  else if (view.choice) status = view.choice.seat === me ? 'تصمیم شما لازم است' : `منتظر تصمیم ${nm(view.choice.seat)}`;
  else if (view.step === 'draft') status = view.me && view.me.pack.length ? `از بسته ${fa(view.draft?.need ?? 1)} کارت بردارید و بقیه را به نفر بعد بدهید` : 'منتظر بقیه برای برداشتن کارت';
  else if (view.step === 'action') status = view.turn === me ? 'نوبت شماست؛ یک کنش انجام دهید' : view.turn !== null ? `نوبت ${nm(view.turn)}` : '';
  else if (view.step === 'discard') status = view.discarded[me ?? 0] ? 'منتظر بقیه' : 'یک کارت را برای عصر بعد نگه دارید';
  else status = PHASE_FA[view.step] ?? '';

  const doomed = view.step === 'over' ? null : view.doom;
  const tokenAge = (p: ProvinceId) => view.ragnarok.indexOf(p) + 1;
  const names = (seat: number) => nm(seat);

  const renderFigure = (f: Figure, pos: { x: number; y: number }) => {
    const sel = pickFigs.includes(f.id) || (mode?.t === 'march' && mode.sel.includes(f.id)) || (mode?.t === 'sacrifice' && mode.sel.includes(f.id));
    const clickable = hintedFigs.has(f.id) || (choice?.k === 'tide' && choice.figs?.includes(f.id)) || (choice?.k === 'protect' && choice.figs?.includes(f.id))
      || (mode?.t === 'march' && mode.from === f.at && f.seat === me && !monShip(f)) || (mode?.t === 'sacrifice' && f.seat === me);
    const dead = battle?.dead.includes(f.id);
    const label = `${KIND_FA[f.kind]}${f.mon ? ` ${CARD_BY_ID[f.mon]?.nameFa}` : ''} ${names(f.seat)} (${CLAN_FA[f.seat % 5]})`;
    return (
      <g key={f.id} transform={`translate(${pos.x} ${pos.y}) scale(0.6)`} className={`blr-fig blr-fig--${f.kind}${sel ? ' is-sel' : ''}${clickable ? ' is-hot' : ''}${dead ? ' is-dead' : ''}${exp && typeof exp.figure === 'number' && exp.figure === f.id ? ' is-hint' : ''}`}
        style={{ ['--c' as string]: clanColor(f.seat) }} role={clickable ? 'button' : 'img'} aria-label={label} tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? (e) => { e.stopPropagation(); clickFig(f); } : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickFig(f); } } : undefined}>
        <ellipse cy="12" rx={f.kind === 'ship' ? 18 : 12} ry="4" className="blr-fig__shadow" />
        {(() => {
          const r = f.kind === 'warrior' ? 12 : 16;
          const k = f.kind === 'monster' ? ART[CARD_BY_ID[f.mon ?? '']?.nameEn ?? '']?.[0] : CLAN_ART[f.seat % 5]![f.kind as 'warrior' | 'leader' | 'ship'];
          return <>
            {f.kind === 'monster' ? <path d={`M0 ${-r - 6} L${r + 6} 0 L0 ${r + 6} L${-r - 6} 0Z`} className="blr-fig__body" /> : <circle r={r + 3} className="blr-fig__body" />}
            <circle r={r} fill={`url(#blr-pat-${f.kind === 'ship' ? 's' : 'f'}${k ?? 0})`} />
            {f.kind === 'leader' && <path d="M-9 -19 L-7 -27 L-2 -22 L0 -29 L2 -22 L7 -27 L9 -19Z" className="blr-fig__crown" />}
          </>;
        })()}
      </g>
    );
  };

  const seatsOrdered = view.seats;

  return (
    <div className="blr" data-phase={view.step} data-seq={view.seq}>
      <div className="blr__head">
        <span className="blr-chip blr-chip--age">عصر {fa(view.age)} از ۳</span>
        <span className="blr-chip">{PHASE_FA[view.step]}</span>
        {doomed && <span className="blr-chip blr-chip--doom">راگناروک: {PROVINCES[doomed].nameFa}</span>}
        <span className="blr-chip blr-chip--ragn" title="استان نابودشونده در هر عصر">
          {view.ragnarok.map((p, i) => <span key={p} className={view.destroyed.includes(p) ? 'is-gone' : view.age === i + 1 ? 'is-now' : ''}>{fa(i + 1)}: {PROVINCES[p].nameFa}</span>)}
        </span>
      </div>
      <p className={`blr__status${myTurn || choice || (battle && (battle.caller === me || battle.waiting.includes(me ?? -1))) ? ' is-mine' : ''}`} role="status" aria-live="polite">{status}</p>

      <div className="blr__main">
        <div className="blr__board">
          <ZoomBoard label="نقشهٔ میدگارد">
            <svg className="blr-map" viewBox={`${PIC.x} ${PIC.y} ${PIC.size} ${PIC.size}`} role="group" aria-label="نقشهٔ میدگارد">
              <FigurePatterns />
              <image href="/games/blood-rage/sea.webp" x={PIC.x} y={PIC.y} width={PIC.size} height={PIC.size} preserveAspectRatio="xMidYMid slice" className="blr-board" />
              <image href="/games/blood-rage/board.webp" x={PIC.x} y={PIC.y} width={PIC.size} height={PIC.size} className="blr-board" />
              {RING.map((p) => {
                const dead = view.destroyed.includes(p);
                const tg = targets.has(p), src = sources.has(p), pl = view.pillaged.includes(p);
                const here = byPlace(p);
                const inBattle = battle?.at === p;
                const slots = slotPositions(p);
                const rw = rewardAt(p);
                const clickable = tg || src;
                const spots = [...slots, { x: rw.x, y: rw.y }];
                return (
                  <g key={p} className={`blr-prov blr-prov--${PROVINCES[p].region}${dead ? ' is-destroyed' : ''}${tg ? ' is-target' : ''}${src ? ' is-source' : ''}${inBattle ? ' is-battle' : ''}${doomed === p ? ' is-doom' : ''}`}
                    role={clickable ? 'button' : 'group'} tabIndex={clickable ? 0 : undefined} aria-label={`${PROVINCES[p].nameFa}، ${REGION_FA[PROVINCES[p].region!]}${dead ? '، نابودشده' : ''}${pl ? '، غارت‌شده' : ''}${tg ? '، قابل انتخاب' : ''}`}
                    onClick={clickable ? () => clickPlace(p) : undefined} onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickPlace(p); } } : undefined}>
                    <g className="blr-prov__land">{spots.map((q, k) => <circle key={k} cx={q.x} cy={q.y} r="30" />)}</g>
                    {!dead && slots.map((q, k) => <circle key={k} cx={q.x} cy={q.y} r="12" className="blr-slot" />)}
                    {!dead && here.map((f, k) => renderFigure(f, slots[k] ?? slots[0]!))}
                    <text x={rw.x} y={rw.y + 25} className="blr-prov__name" textAnchor="middle">{PROVINCES[p].nameFa}</text>
                    {dead
                      ? <text x={rw.x} y={rw.y + 4} className="blr-prov__dead" textAnchor="middle">نابود شد</text>
                      : <g transform={`translate(${rw.x} ${rw.y})`} className={`blr-token${pl ? ' is-flipped' : ''}`}>
                        <circle r="11" /><text textAnchor="middle" dy="4">{pl ? '✕' : REWARD_GLYPH[view.rewards[p]]}</text>
                        <title>{pl ? 'غارت شده' : `پاداش: ${REWARD_FA[view.rewards[p]]}`}</title>
                      </g>}
                    {tokenAge(p) > 0 && !dead && <g transform={`translate(${rw.x + 16} ${rw.y - 14})`} className="blr-ragn"><circle r="7" /><text textAnchor="middle" dy="3">{fa(tokenAge(p))}</text><title>راگناروک عصر {fa(tokenAge(p))}</title></g>}
                  </g>
                );
              })}
              {FJORD_IDS.map((f) => {
                const c = FJORD_AT[f];
                const here = byPlace(f);
                const tg = targets.has(f);
                const inBattle = battle && (FJORDS[f] as ProvinceId[]).includes(battle.at);
                return (
                  <g key={f} className={`blr-fjord${tg ? ' is-target' : ''}${inBattle ? ' is-battle' : ''}`} role={tg ? 'button' : 'group'} tabIndex={tg ? 0 : undefined}
                    aria-label={`خلیج میان ${PROVINCES[FJORDS[f][0]].nameFa} و ${PROVINCES[FJORDS[f][1]].nameFa}${tg ? '، قابل انتخاب' : ''}`}
                    onClick={tg ? () => clickPlace(f) : undefined} onKeyDown={tg ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickPlace(f); } } : undefined}>
                    <ellipse cx={c[0]} cy={c[1]} rx="30" ry="24" className="blr-fjord__water" />
                    {here.map((fg, k) => renderFigure(fg, fjordSlot(f, k)))}
                  </g>
                );
              })}
              <g className={`blr-prov blr-ygg${targets.has('ygg') ? ' is-target' : ''}${sources.has('ygg') ? ' is-source' : ''}${battle?.at === 'ygg' ? ' is-battle' : ''}`}
                role={targets.has('ygg') || sources.has('ygg') ? 'button' : 'group'} tabIndex={targets.has('ygg') || sources.has('ygg') ? 0 : undefined}
                aria-label={`ایگدراسیل${view.pillaged.includes('ygg') ? '، غارت‌شده' : ''}`}
                onClick={targets.has('ygg') || sources.has('ygg') ? () => clickPlace('ygg') : undefined}>
                <circle cx={YGG[0]} cy={YGG[1] + 30} r="75" className="blr-prov__land blr-ygg__land" />
                <text x={YGG[0]} y={YGG[1] - 12} className="blr-prov__name" textAnchor="middle">ایگدراسیل</text>
                {byPlace('ygg').map((f, k) => renderFigure(f, slotPositions('ygg')[k] ?? slotPositions('ygg')[0]!))}
                <g transform={`translate(${YGG[0]} ${YGG[1]})`} className={`blr-token${view.pillaged.includes('ygg') ? ' is-flipped' : ''}`}>
                  <circle r="11" /><text textAnchor="middle" dy="4">{view.pillaged.includes('ygg') ? '✕' : REWARD_GLYPH.all}</text>
                  <title>{view.pillaged.includes('ygg') ? 'غارت شده' : 'پاداش: یک پله به هر سه ویژگی'}</title>
                </g>
              </g>
            </svg>
          </ZoomBoard>
          <ul className="blr-legend" aria-label="راهنمای نقشه">
            <li><i className="lg lg--leader" />رهبر (قدرت ۲)</li><li><i className="lg lg--warrior" />جنگجو (۱)</li><li><i className="lg lg--ship" />کشتی (۳، فقط خلیج)</li><li><i className="lg lg--monster" />هیولا</li>
            <li>خ+ / ت+ / ش+: پلهٔ خشم / تبر / شاخ؛ ۵: پنج افتخار؛ ★: هر سه</li>
          </ul>
        </div>

        <div className="blr__side">
          <section className="blr-seats" aria-label="قبیله‌ها">
            {seatsOrdered.map((s) => {
              const v = valhalla(s.seat).length;
              const onBoard = figs.filter((f) => f.seat === s.seat && f.at !== 'reserve' && f.at !== 'valhalla').length;
              const turn = view.turn === s.seat && view.step === 'action';
              return (
                <article key={s.seat} className={`blr-seat${s.seat === me ? ' is-me' : ''}${turn ? ' is-turn' : ''}${s.resigned ? ' is-out' : ''}`} style={{ ['--c' as string]: clanColor(s.seat) }}>
                  <header>
                    <i className="blr-seat__dot blr-emblem" style={{ backgroundPosition: spritePos(CLAN_ART[s.seat % 5]!.emblem) }} aria-hidden />
                    <b>{nm(s.seat)}</b><small>قبیلهٔ {CLAN_NAME[s.seat % 5]} · {CLAN_FA[s.seat % 5]}{s.seat === me ? ' · شما' : ''}{s.seat === view.first ? ' · آغازگر' : ''}{s.resigned ? ' · انصراف' : ''}</small>
                    <span className="blr-seat__glory" aria-label={`${fa(s.glory)} افتخار`}><b>{fa(s.glory)}</b> افتخار</span>
                  </header>
                  <dl className="blr-seat__stats">
                    <div className={s.rage === 0 && view.step === 'action' ? 'is-zero' : ''}><dt>خشم</dt><dd>{view.step === 'action' ? `${fa(s.rage)}/` : ''}{fa(TRACKS.rage[s.steps.rage]!)}</dd></div>
                    <div><dt>تبر</dt><dd>{fa(TRACKS.axes[s.steps.axes]!)}</dd></div>
                    <div><dt>شاخ</dt><dd>{fa(onBoard)}/{fa(TRACKS.horns[s.steps.horns]!)}</dd></div>
                    <div><dt>والهالا</dt><dd>{fa(v)}</dd></div>
                    <div><dt>کارت</dt><dd>{fa(s.hand)}</dd></div>
                    <div><dt>مأموریت</dt><dd>{fa(s.quests)}</dd></div>
                  </dl>
                  <div className="blr-tracks" aria-hidden>
                    {STATS.map((st) => TRACKS[st].map((v, k) => <i key={`${st}${k}`} className={k === s.steps[st] ? 'on' : k < s.steps[st] ? 'past' : ''} title={`${STAT_FA[st]}: پلهٔ ${fa(s.steps[st] + 1)} از ${fa(LAST_STEP + 1)}`}>{fa(v)}</i>))}
                  </div>
                  <ul className="blr-slots" aria-label={`ارتقاهای ${CLAN_FA[s.seat % 5]}`}>
                    {[s.warrior, s.leader, s.ship, ...s.monsters, ...s.clans].filter(Boolean).map((d, i) => <li key={i} title={CARD_BY_ID[d!]?.textFa}>{CARD_BY_ID[d!]?.nameFa}</li>)}
                  </ul>
                </article>
              );
            })}
          </section>
          {me !== null && (
            <section className="blr-reserve" aria-label="ذخیرهٔ شما">
              <h3>ذخیرهٔ شما</h3>
              <ul>
                {Object.entries(Object.groupBy(reserve, (f) => groupOf(f))).map(([g, list]) => (
                  <li key={g}><b>{fa(list!.length)}×</b> {KIND_FA[list![0]!.kind]}{list![0]!.mon ? ` (${CARD_BY_ID[list![0]!.mon!]?.nameFa})` : ''}</li>
                ))}
                {reserve.length === 0 && <li className="bgv-muted">ذخیره خالی است</li>}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ----- battle ----- */}
      {battle && (
        <section className="blr-battle" aria-label="نبرد">
          <h3>نبرد در {PROVINCES[battle.at].nameFa}{battle.rep ? ' (غارت دوباره)' : ''} <small>{STAGE_FA[battle.stage]}</small></h3>
          {battle.stage === 'call' && <p className="blr__hint">فراخوان نبرد: هر بازیکن می‌تواند یک نیرو از استان مجاور بیاورد.</p>}
          <ul className="blr-battle__sides">
            {[...new Set(figs.filter((f) => f.at === battle.at || (FJORD_IDS as string[]).includes(f.at) && (FJORDS[f.at as FjordId] as string[]).includes(battle.at)).map((f) => f.seat).concat(Object.keys(battle.chosen).map(Number)))].sort((a, b) => a - b).map((seat) => {
              const v = battle.chosen[String(seat)];
              return (
                <li key={seat} style={{ ['--c' as string]: clanColor(seat) }} className={battle.winner === seat ? 'is-winner' : battle.losers.includes(seat) ? 'is-loser' : ''}>
                  <b>{nm(seat)}</b>
                  {v === undefined ? <small>{battle.waiting.includes(seat) ? 'در حال انتخاب کارت…' : ''}</small> : v === 'hidden' ? <CardBack label={`کارت پنهان ${nm(seat)}`} /> : v === 'none' ? <small>بدون کارت</small> : <CardView def={CARD_BY_ID[v]!} />}
                  {battle.totals[String(seat)] !== undefined && <span className="blr-total">قدرت {fa(battle.totals[String(seat)]!)}</span>}
                  {battle.muted.includes(seat) && <small>متن کارت بی‌اثر شد</small>}
                </li>
              );
            })}
          </ul>
          {battle.waiting.length > 0 && <p className="blr__hint">منتظر انتخاب کارت: {battle.waiting.map(nm).join('، ')}</p>}
        </section>
      )}

      {/* ----- decisions ----- */}
      {choice && me !== null && (
        <section className="blr-choice" aria-label="تصمیم">
          {choice.k === 'freeInvade' && <><p>حمله رایگان با نیروی ارتقاگرفته: روی یک جای روشن نقشه بزنید.</p><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>نه، بگذرید</Button></>}
          {choice.k === 'succor' && <><p>یاری فریگا: یک جنگجوی دیگر را هم رایگان در {PROVINCES[choice.at!].nameFa} بگذارید؟</p><div className="blr-row"><Button disabled={busy} onClick={() => act({ type: 'decide', yes: true })}>بله</Button><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>نه</Button></div></>}
          {choice.k === 'domain' && <><p>قلمرو ثور: ۲ خشم بدهید و {PROVINCES[choice.at!].nameFa} را بی‌درنگ غارت کنید؟</p><div className="blr-row"><Button disabled={busy || (myClan?.rage ?? 0) < 2} onClick={() => act({ type: 'decide', yes: true })}>بله (۲ خشم)</Button><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>نه</Button></div></>}
          {choice.k === 'blessing' && <><p>برکت لوکی: یک جنگجو را رایگان در {PROVINCES[choice.at!].nameFa} بگذارید؟</p><div className="blr-row"><Button disabled={busy} onClick={() => act({ type: 'decide', yes: true })}>بله</Button><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>نه</Button></div></>}
          {choice.k === 'stat' && <><p>یکی از ویژگی‌هایتان را یک پله بالا ببرید:</p><div className="blr-row">{STATS.map((st: Stat) => <Button key={st} disabled={busy || (myClan?.steps[st] ?? 0) >= LAST_STEP} onClick={() => act({ type: 'decide', stat: st })}>{STAT_FA[st]} ← {fa(TRACKS[st][Math.min(LAST_STEP, (myClan?.steps[st] ?? 0) + 1)]!)}</Button>)}</div></>}
          {choice.k === 'hammer' && <><p>سالار چکش‌ها: رهبر را به استانی مجاور ببرید (روی نقشه بزنید) یا همان‌جا بمانید.</p><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>همان‌جا بماند</Button></>}
          {choice.k === 'prowess' && <><p>دلیری تیر: هر کارت بازی‌شده را با ۱ خشم نگه دارید.</p><div className="blr-cards">{choice.cards?.map((id) => <CardView key={id} def={defOf(id) ?? CARD_BY_ID[view.me?.hand.find((c) => c.id === id)?.def ?? '']!} selected={pickCards.includes(id)} onClick={() => setPickCards((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />)}</div><Button disabled={busy} onClick={() => act({ type: 'decide', cards: pickCards })}>{pickCards.length ? `نگه داشتن (${fa(pickCards.length)} خشم)` : 'هیچ‌کدام'}</Button></>}
          {choice.k === 'protect' && <><p>حمایت فریگا: روی نیروهای خودتان در نبرد بزنید تا با ۱ خشم برای هر کدام نجات پیدا کنند ({fa(pickFigs.length)} انتخاب‌شده، خشم {fa(myClan?.rage ?? 0)}).</p><Button disabled={busy} onClick={() => act({ type: 'decide', figures: pickFigs })}>{pickFigs.length ? 'نجات انتخاب‌شده‌ها' : 'هیچ‌کدام'}</Button></>}
          {choice.k === 'tide' && <><p>سیل اودین: روی تنها نیرویی که می‌ماند بزنید؛ بقیه نابود می‌شوند.</p><Button disabled={busy || pickFigs.length !== 1} onClick={() => act({ type: 'decide', figures: pickFigs })}>تأیید</Button></>}
          {choice.k === 'late' && <><p>کارت دیررس: بازیش کنید؟ قدرت‌ها تا اینجا: {battle ? Object.entries(battle.totals).map(([k, v]) => `${nm(Number(k))} ${fa(v)}`).join('، ') : ''}</p><div className="blr-row"><Button disabled={busy} onClick={() => act({ type: 'decide', yes: true })}>بازی کن</Button><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'decide', yes: false })}>نگه دار</Button></div></>}
        </section>
      )}

      {/* ----- action phase controls ----- */}
      {myTurn && me !== null && (
        <section className="blr-actions" aria-label="کنش‌های شما">
          <div className="blr-row">
            <Button variant={mode?.t === 'invade' ? 'primary' : 'secondary'} disabled={busy || !has('invade')} onClick={() => setMode(mode?.t === 'invade' ? null : { t: 'invade' })}>حمله</Button>
            <Button variant={mode?.t === 'march' ? 'primary' : 'secondary'} disabled={busy || !has('march')} onClick={() => setMode(mode?.t === 'march' ? null : { t: 'march', sel: [] })}>لشکرکشی (۱ خشم)</Button>
            <Button variant={mode?.t === 'pillage' ? 'primary' : 'secondary'} disabled={busy || !(has('pillage') || has('challenge'))} onClick={() => setMode(mode?.t === 'pillage' ? null : { t: 'pillage' })}>غارت</Button>
            {has('sacrifice') && <Button variant={mode?.t === 'sacrifice' ? 'primary' : 'secondary'} disabled={busy} onClick={() => setMode(mode?.t === 'sacrifice' ? null : { t: 'sacrifice', sel: [] })}>قربانی</Button>}
          </div>
          {mode?.t === 'invade' && (
            <div className="blr-row blr-groups" aria-label="نیرویی را برای حمله انتخاب کنید">
              {Object.entries(Object.groupBy(hintsOf('invade').map((h) => figs.find((f) => f.id === h.figure)!).filter(Boolean), (f) => groupOf(f))).map(([g, list]) => {
                const f = list![0]!;
                const cost = hintsOf('invade').find((h) => h.figure === f.id);
                void cost;
                return <Button key={g} variant={mode.group === g ? 'primary' : 'secondary'} disabled={busy} onClick={() => setMode({ t: 'invade', group: g })}>{KIND_FA[f.kind]}{f.mon ? ` ${CARD_BY_ID[f.mon]?.nameFa}` : ''}{f.at === 'valhalla' ? ' (از والهالا)' : ''}</Button>;
              })}
              <p className="blr__hint">{mode.group ? 'روی یک جای روشن نقشه بزنید.' : 'ابتدا نیرو را انتخاب کنید.'}</p>
            </div>
          )}
          {mode?.t === 'march' && <p className="blr__hint">{!mode.from ? 'استانی را که می‌خواهید از آن لشکر ببرید انتخاب کنید.' : `از ${PROVINCES[mode.from].nameFa}: ${fa(mode.sel.length)} نیرو انتخاب‌شده (روی نیروها بزنید تا کم/زیاد شوند)؛ حالا مقصد را انتخاب کنید.`}</p>}
          {mode?.t === 'pillage' && <p className="blr__hint">استانی را انتخاب کنید که نیرویی در آن (یا خلیج کنارش) دارید.</p>}
          {mode?.t === 'sacrifice' && <>
            <p className="blr__hint">دو نیروی خودتان را روی نقشه انتخاب کنید ({fa(mode.sel.length)}/۲) و ویژگی را بالا ببرید:</p>
            <div className="blr-row">{STATS.map((st: Stat) => <Button key={st} disabled={busy || mode.sel.length !== 2 || (myClan?.steps[st] ?? 0) >= LAST_STEP} onClick={() => act({ type: 'sacrifice', figures: mode.sel, stat: st })}>{STAT_FA[st]}</Button>)}</div>
          </>}
        </section>
      )}

      {/* ----- hand ----- */}
      {view.me && (view.me.hand.length > 0 || view.me.pack.length > 0 || view.me.quests.length > 0) && (
        <section className="blr-hand" aria-label="کارت‌های شما">
          {view.step === 'draft' && view.me.pack.length > 0 && (
            <>
              <h3>بستهٔ درفت <small>{fa(view.draft?.need ?? 1)} کارت بردارید</small></h3>
              <div className="blr-cards">
                {view.me.pack.map((c) => (
                  <CardView key={c.id} def={CARD_BY_ID[c.def]!} selected={pickCards.includes(c.id)} onClick={() => setPickCards((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : s.length < (view.draft?.need ?? 1) ? [...s, c.id] : [...s.slice(1), c.id]))} />
                ))}
              </div>
              <DockSlot><Button disabled={busy || pickCards.length !== (view.draft?.need ?? 1)} onClick={() => act({ type: 'pick', cards: pickCards })}>برداشتن {fa(pickCards.length)}/{fa(view.draft?.need ?? 1)}</Button></DockSlot>
            </>
          )}
          {view.me.hand.length > 0 && (
            <>
              <h3>دست شما <small>{fa(view.me.hand.length)} کارت</small></h3>
              <div className="blr-cards">
                {view.me.hand.map((c) => {
                  const def = CARD_BY_ID[c.def]!;
                  const picking = (battle?.stage === 'cards' && battle.waiting.includes(me ?? -1)) || (view.step === 'discard' && !view.discarded[me ?? 0]);
                  const up = myTurn && upgradeHint(c.id);
                  const qh = myTurn && hintsOf('quest').some((h) => h.card === c.id);
                  return (
                    <CardView key={c.id} def={def} selected={pickCards.includes(c.id)} onClick={picking ? () => setPickCards([c.id]) : undefined}>
                      {up && <Button size="sm" disabled={busy} onClick={() => doUpgrade(c.id)}>ارتقا ({fa(def.cost ?? 0)} خشم)</Button>}
                      {qh && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act({ type: 'quest', card: c.id })}>تعهد به مأموریت</Button>}
                    </CardView>
                  );
                })}
              </div>
              {slotFor !== null && myClan && (
                <div className="blr-row blr-slotpick" role="group" aria-label="جایگزین کدام ارتقا شود؟">
                  <p>جایگزین کدام کارت شود؟</p>
                  {(defOf(slotFor).kind === 'monster' ? myClan.monsters : myClan.clans).map((d, i) => <Button key={i} variant="secondary" disabled={busy} onClick={() => act({ type: 'upgrade', card: slotFor, slot: i })}>{d ? CARD_BY_ID[d]!.nameFa : 'خالی'}</Button>)}
                  <Button variant="ghost" onClick={() => setSlotFor(null)}>انصراف</Button>
                </div>
              )}
              {battle?.stage === 'cards' && battle.waiting.includes(me ?? -1) && <DockSlot><Button disabled={busy || pickCards.length !== 1} onClick={() => act({ type: 'play', card: pickCards[0]! })}>بازی کارت</Button></DockSlot>}
              {view.step === 'discard' && !view.discarded[me ?? 0] && !battle && (
                <DockSlot><div className="blr-row">
                  <Button disabled={busy || pickCards.length !== 1} onClick={() => act({ type: 'keep', card: pickCards[0]! })}>نگه داشتن برای عصر بعد</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => act({ type: 'keep', card: null })}>دور ریختن همه</Button>
                </div></DockSlot>
              )}
            </>
          )}
          {view.me.quests.length > 0 && (
            <>
              <h3>مأموریت‌های تعهدشده <small>تا پایان عصر پنهان است</small></h3>
              <div className="blr-cards">{view.me.quests.map((c) => <CardView key={c.id} def={CARD_BY_ID[c.def]!} />)}</div>
            </>
          )}
        </section>
      )}

      {/* ----- dock buttons ----- */}
      {me !== null && myTurn && <DockSlot><Button variant="secondary" disabled={busy || !has('pass')} onClick={() => act({ type: 'pass' })}>گذشتن (رها کردن خشم)</Button></DockSlot>}
      {me !== null && battle?.stage === 'call' && battle.caller === me && <DockSlot><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'call' })}>فراخوانی نمی‌کنم</Button></DockSlot>}

      <section className="blr-log" aria-label="رویدادها">
        <h3>رویدادهای اخیر</h3>
        <ol>{view.log.slice(-8).reverse().map((e, i) => { const t = describe(e, seatName); return t ? <li key={`${view.seq}-${i}`}>{t}</li> : null; })}</ol>
        <p className="blr__hint">افتخار مردن در راگناروک برای هر نیرو: {RAGNAROK_GLORY.slice(1).map((g, i) => `عصر ${fa(i + 1)}: ${fa(g)}`).join('، ')}</p>
      </section>
    </div>
  );
}

// (kept for the table shell: the renderer module's default export is the component)
export type { BRView };
