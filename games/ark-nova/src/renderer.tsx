// آرک نوا — BGA-style table (design/games/ark-nova: HANDOFF.md, COMPONENTS.md, layout.json). Game column: sticky
// action bar, «دست شما», the display with the reputation strip, the conservation strip with projects and the
// association board, then ONE zoo at a time (icon summary, the publisher map window with fitted buildings, played
// cards, the action-card band). Rail: table status box, a BGA panel per seat in turn order and the log.
// Every piece, card, building and icon is publisher art from ./art (copied unchanged from design/games/ark-nova/art);
// nothing is drawn — SVG is only the transparent hit layer and the dashed pick outlines. Every option, label and
// placement comes from the engine prompt; flow = select → «تأیید», «برگرد» before it (no after-send undo window).
import './renderer.css';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Icon, RailSlot, useFlip, type GameAction, type GameRendererProps } from '@bg/ui';
import IDS from './data/content-id-map.json' with { type: 'json' };
import BCELLS from './data/building-cells.json' with { type: 'json' };
import {
  ACTION_FA, ANIMAL, ICON_FA, KIND_FA, PROJECT, REG, SPONSOR, TILES, UNI_FA, CELLS, xy, nameOf, appealIncome,
  type ActionKey, type ArkView, type ArkDetail, type MapView, type Icon as IconKey
} from './rules.ts';

const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
const art = (path: string) => ART[`./${path}`] ?? '';

const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: Math.abs(n) >= 1000 }).replace(/٬/g, ',').replace('-', '−');
/** Engine texts carry Latin digits («4 پول»); show them in Persian. */
const faDigits = (t: string) => t.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
type PlayerView = ArkView['players'][number];
type Placement = { kind: string; cells: string[] };
type PromptView = { seat: number; k: 'option' | 'pick' | 'place'; label: string; optional: boolean; options?: { value: string; label: string }[];
  ids?: number[]; min?: number; max?: number; kinds?: string[]; free?: boolean; placements?: Placement[] };

// Seat colours = the wooden-piece colours (HANDOFF §8): red, blue, yellow, black.
const COLORS = ['red', 'blue', 'yellow', 'black'] as const;
const color = (seat: number) => COLORS[seat % 4]!;
const seatStyle = (seat: number) => ({ '--pc': `var(--an-${color(seat)})`, '--sc': `var(--an-${color(seat)}-ink)`, '--seat-c': `var(--an-${color(seat)})` }) as CSSProperties;
const piece = (k: 'counter' | 'cube' | 'worker', seat: number) => art(`art/pieces/${k}-${color(seat)}.webp`);

const CARD_ART = IDS.cards as Record<string, string>;
const cardArt = (id: number) => art(CARD_ART[String(id)] ?? 'art/card-backs/card-back-zoo.webp');
const BACK = art('art/card-backs/card-back-zoo.webp');
const ICON_ART = IDS.icons as Record<IconKey, string>;
const UI = (k: string) => art(`art/ui/${k}.webp`);
const actArt = (k: ActionKey, up: boolean) => art((IDS.actionCards as Record<string, string>)[`${k}:${up ? 'II' : 'I'}`]!);
const tileArt = (t: string) => art((IDS.bonusTiles as Record<string, string>)[t] ?? 'art/bonus-tiles/bonus-back.webp');
const partnerArt = (z: string) => art((IDS.partnerZoos as Record<string, string>)[z]!);
const uniArt = (u: string) => art((IDS.universities as Record<string, string>)[u]!);
const TOK_ART = { venom: art('art/tokens/venom.webp'), mult: art('art/tokens/multiplier.webp'), con: art('art/tokens/constriction.webp') };
const ICON_ORDER: IconKey[][] = [
  ['africa', 'europe', 'asia', 'americas', 'australia'],
  ['bird', 'predator', 'herbivore', 'reptile', 'primate'],
  ['bear', 'pet', 'science', 'rock', 'water']
];
const ACTION_KEYS: ActionKey[] = ['animals', 'build', 'cards', 'association', 'sponsors'];
const FOLDER_CITY = ['San Diego, USA', 'Frankfurt, GER', 'Johannesburg, SA', 'Sao Paulo, BR', 'Okinawa, JP', 'Sydney, AUS'];

const kindName = (k: string) => KIND_FA[k] ?? REG.cards.get(Number(k.slice(1)))?.building?.nameFa ?? nameOf(Number(k.slice(1)));
const isStdKind = (k: string) => /^e\d$/.test(k);
function cardText(id: number): string {
  const d = REG.cards.get(id) as { textFa?: string } | undefined;
  const a = ANIMAL[id];
  if (a) {
    const fx = a.ab.map(([k, v]) => { const impl = REG.abilities[k]; return impl ? `${impl.nameFa}: ${impl.textFa(v, id)}` : ''; }).filter(Boolean).join(' ');
    return [`حیوان، ${fa(a.cost)} پول، ${a.std ? `محوطهٔ ${fa(a.size)}` : 'باغ‌وحش کودکان'}، ${a.icons.map((i) => ICON_FA[i]).join('/')}`, fx].filter(Boolean).join('. ');
  }
  if (SPONSOR[id]) return `حامی سطح ${fa(SPONSOR[id]!.level)}. ${d?.textFa ?? ''}`;
  if (PROJECT[id]) return REG.projects.get(id)?.textFa ?? 'پروژهٔ حفاظت';
  return REG.scoring.get(id)?.textFa ?? '';
}

// ---------------- zoo map geometry (layout.json → zooMap; tools/an-lib.js) ----------------
const MAPW = { w: 1405, h: 905 };
const HEX = { x0: 327, dx: 100.6, y0: 132.3, dy: 57.75, r: 66.9 };
const hexXY = (c: string) => { const [x, y] = xy(c); return [HEX.x0 + HEX.dx * x, HEX.y0 + HEX.dy * y] as const; };
const hexPts = (c: string, r = HEX.r) => {
  const [cx, cy] = hexXY(c);
  return Array.from({ length: 6 }, (_, k) => { const t = (Math.PI / 3) * k; return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`; }).join(' ');
};
const LEFT_XY = [383, 457, 530, 605, 707, 780, 855].map((y) => [133, y] as const);
const WORKER_XY = [[70, 290], [128, 290], [187, 290]] as const;
const PARTNER_XY = [[1335, 440], [1335, 345], [1335, 215], [1335, 115]] as const;
const UNI_XY = [[1335, 815], [1335, 710], [1335, 600]] as const;
const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
const at = (x: number, y: number, W = MAPW.w, H = MAPW.h): CSSProperties => ({ left: pct(x, W), top: pct(y, H) });
const atP = (q: readonly [number, number] | readonly number[], W = MAPW.w, H = MAPW.h) => at(q[0]!, q[1]!, W, H);

const UNIQUE_FILE = IDS.buildings as Record<string, string>;
function buildingFile(b: { kind: string; full?: boolean }): string {
  const f = UNIQUE_FILE[b.kind];
  if (!f) return '';
  return f.replace('{empty|occupied}', b.full ? 'occupied' : 'empty');
}
const SCALE = HEX.r / 135; // map units per image pixel (the art uses R = 135 px)
type Fit = { x: number; y: number; deg: number; mx: number; w: number };
const fitCache = new Map<string, Fit | null>();
/** Rotation k×30° (+ mirror) of the image's own hex cells onto the engine cells (port of tools/an-lib.js fitBuilding). */
function fitBuilding(file: string, cells: string[]): Fit | null {
  const key = `${file}|${cells.join(',')}`;
  if (fitCache.has(key)) return fitCache.get(key)!;
  const C = (BCELLS as Record<string, { w: number; cells: number[][] }>)[file.replace(/^art\//, '').replace(/\.webp$/, '')];
  let out: Fit | null = null;
  if (C) {
    const t = cells.map(hexXY);
    const tc = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length];
    search: for (let deg = 0; deg < 360; deg += 30) for (const mx of [1, -1]) {
      const a = (deg * Math.PI) / 180;
      const w = C.cells.map(([x0, y]) => { const x = x0! * mx; return [SCALE * (x * Math.cos(a) - y! * Math.sin(a)), SCALE * (x * Math.sin(a) + y! * Math.cos(a))] as const; });
      if (w.length !== t.length) continue;
      const wc = [w.reduce((s, p) => s + p[0], 0) / w.length, w.reduce((s, p) => s + p[1], 0) / w.length];
      const T = [tc[0]! - wc[0]!, tc[1]! - wc[1]!];
      if (w.every(([x, y]) => t.some(([u, v]) => Math.hypot(x + T[0]! - u, y + T[1]! - v) < 18))) { out = { x: T[0]!, y: T[1]!, deg, mx, w: C.w * SCALE }; break search; }
    }
  }
  fitCache.set(key, out);
  return out;
}

// ---------------- strips (layout.json → reputationTrack / conservationTrack / associationBoard / mainBoard) ----------------
const repX = (r: number) => (r <= 1 ? 0.081 : r === 2 ? 0.2025 : r === 3 ? 0.2835 : 0.351 + 0.054 * (Math.min(15, r) - 4));
const REP_BONUS: Record<number, string> = { 5: 'upgrade-card', 8: 'add-worker', 10: 'upgrade-card', 11: 'conservation', 12: 'xtoken', 13: 'take-in-range', 14: 'conservation', 15: 'xtoken' };
const cpX = (c: number) => 0.0461 + 0.09077 * Math.min(10, Math.max(0, c));
const CP_TILE: Record<5 | 8, [number, number][]> = { 5: [[0.446, 0.6933], [0.5553, 0.6933]], 8: [[0.718, 0.6933], [0.8273, 0.6933]] };
const BAB = { w: 3335, h: 986 };
const BAB_ZOO: Record<string, [number, number]> = { americas: [1083, 361], europe: [1444, 181], asia: [1847, 181], africa: [1444, 556], australia: [1847, 556] };
const BAB_UNI: Record<string, [number, number]> = { hand: [2639, 208], science: [2319, 569], rep: [2750, 569] };
const BAB_TASK: Record<string, [number, number]> = { rep: [714, 764], zoo: [1486, 866], uni: [2533, 866], project: [3158, 764] };
const BAB_HOT: Record<string, [number, number, number, number]> = { rep: [714, 490, 290, 880], zoo: [1486, 470, 1140, 900], uni: [2533, 470, 820, 900], project: [3158, 490, 290, 880] };
const BAB_DONATE = [[375, 222], [125, 361], [375, 361], [125, 542], [375, 542], [125, 694], [375, 694], [300, 895]] as const;
const LEVEL_XY = [[0.24, 0.68], [0.5, 0.68], [0.76, 0.68]] as const;
const MB = { w: 3000, h: 814 };
const appealXY = (v: number) => (v <= 51 ? [180 + 53 * v, 735] : v <= 60 ? [2915, 610 - 52.5 * (v - 52)] : [2883 - 53 * (v - 61), 75]) as [number, number];
const cpTarget = (c: number) => (c <= 10 ? 114 - 2 * c : 94 - 3 * (c - 10));
const cpXY = (c: number): [number, number] => {
  if (c <= 0) return [55, 100];
  const T = cpTarget(c);
  const ps = (c <= 10 ? [T, T + 1] : [T, T + 1, T + 2]).map(appealXY);
  const x = ps.reduce((a, p) => a + p[0], 0) / ps.length, y = ps.reduce((a, p) => a + p[1], 0) / ps.length;
  return T >= 61 ? [x, 118] : T >= 52 ? [2858, y] : [x, 672];
};
const REP_MB = [430, 610, 845, 985, 1180, 1270, 1365, 1555, 1650, 1740, 1950, 2040, 2128, 2312, 2400, 2490];
const repMB = (r: number): [number, number] => [REP_MB[Math.max(0, Math.min(15, r))]! - (r > 0 ? 42 : 0), 300];
const breakXY = (brk: number, max: number): [number, number] => [1760 + (max - brk) * 58.7, 200];

// ---------------- small pieces ----------------

/** A publisher card image (zoom on hover / focus / long press via onZoom). */
function CardImg({ id, cw, pick, onClick, onZoom, flip, from, exit, label, hint, reason }: {
  id: number; cw?: number | string; pick?: 'selectable' | 'picked' | 'none'; onClick?: () => void; onZoom?: (id: number | null) => void;
  flip?: boolean; from?: string; exit?: string; label?: string; hint?: boolean; reason?: string;
}) {
  const motion = flip ? { 'data-flip': `card-${id}`, 'data-flip-from': from ?? 'deck', 'data-flip-exit': exit } : {};
  const style = cw !== undefined ? ({ '--cw': typeof cw === 'number' ? `${cw}px` : cw }) as CSSProperties : undefined;
  const zoom = onZoom ? { onMouseEnter: () => onZoom(id), onMouseLeave: () => onZoom(null), onFocus: () => onZoom(id), onBlur: () => onZoom(null) } : {};
  const cls = ['an-card', hint ? 'an-hint' : ''].join(' ');
  const img = <img src={cardArt(id)} alt="" draggable={false} />;
  return onClick || onZoom
    ? <button type="button" className={cls} data-id={id} data-pick={pick} aria-pressed={pick === 'picked' ? true : undefined} aria-disabled={pick === 'none' ? true : undefined}
      data-reason={reason} aria-label={label ?? nameOf(id)} style={style} onClick={onClick} {...zoom} {...motion}>{img}{pick === 'picked' && <span className="an-check" aria-hidden="true">✓</span>}</button>
    : <span className={cls} data-id={id} title={nameOf(id)} style={style} {...motion}>{img}</span>;
}

// ---------------- log ----------------
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
    case 'partner': return `${w} باغ‌وحش همکار ${ICON_FA[e.zoo as IconKey]} گرفت`;
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

/**
 * The served view with my selected (or in-flight) answer applied as far as it is certain: a placed building stands on
 * the map, a played animal or sponsor moves from my hand or the display into my zoo. Rewards wait for the server.
 */
function previewView(v: ArkView, a: GameAction | null, seat: number | null): ArkView {
  const me = seat === null ? undefined : v.players[seat];
  if (!a || !me || !v.me) return v;
  const withMe = (p: PlayerView, hand = v.me!.hand, display = v.display): ArkView =>
    ({ ...v, display, me: { ...v.me!, hand }, players: v.players.map((x) => (x.seat === seat ? p : x)) });
  if (typeof a.kind === 'string' && Array.isArray(a.cells)) return withMe({ ...me, buildings: [...me.buildings, { id: -1, kind: a.kind, cells: a.cells as string[] }] });
  const m = typeof a.value === 'string' ? /^(\d+)@([^@]+)@(\d+)$/.exec(a.value) ?? /^sp:(\d+):()(\d+)$/.exec(a.value) : null;
  if (!m) return v;
  const card = Number(m[1]), home = Number(m[2]), folder = Number(m[3]);
  if (folder ? v.display[folder - 1] !== card : !v.me.hand.includes(card)) return v;
  return withMe(
    { ...me, zoo: [...me.zoo, card], handCount: me.handCount - (folder ? 0 : 1), buildings: me.buildings.map((b) => (b.id === home && isStdKind(b.kind) ? { ...b, full: true } : b)) },
    folder ? v.me.hand : v.me.hand.filter((x) => x !== card),
    folder ? v.display.map((x, i) => (i === folder - 1 ? null : x)) : v.display
  );
}
const cardOf = (value: string): number | null => {
  const m = /^(\d+)@/.exec(value) ?? /^sp:(\d+):/.exec(value) ?? /^pr:(\d+):/.exec(value) ?? /^[fs](\d)$/.exec(value);
  return m ? Number(m[1]) : null;
};

// ---------------- rail panel (§2) ----------------
type PanelData = Pick<PlayerView, 'money' | 'x' | 'rep' | 'cp' | 'appeal' | 'handCount' | 'handLimit' | 'slots' | 'strengths' | 'up' | 'tok' | 'icons'> & { income: number };
/** Panel body shared by the shell rail (arkSeatCard, from publicSummary `detail`) and the renderer's own rail outside the shell. */
function PanelBody({ p }: { p: PanelData }) {
  return (
    <>
      <span className="an-bpi" dir="ltr">
        <span className="an-bc an-bc--money" title="پول"><img src={UI('money')} alt="" /><b className="an-num">{fa(p.money)}</b></span>
        <span className="an-bc an-bc--x" title="نشان X (حداکثر ۵)"><b className="an-num">{fa(p.x)}</b><img src={UI('xtoken')} alt="" /></span>
        <span className="an-bc an-bc--rep" title="اعتبار"><img src={UI('reputation')} alt="" /><b className="an-num">{fa(p.rep)}</b></span>
        <span className="an-bc an-bc--cp" title="امتیاز حفاظت"><img src={UI('conservation')} alt="" /><b className="an-num">{fa(p.cp)}</b></span>
        <span className="an-bc an-bc--appeal" title="جذابیت"><img src={UI('appeal')} alt="" /><b className="an-num">{fa(p.appeal)}</b><i className="an-inc an-num" title="درآمد استراحت">{fa(p.income)}</i></span>
        <span className="an-bc an-bc--hand" title="کارت در دست / سقف در استراحت"><b className="an-num">{fa(p.handCount)}<small>/{fa(p.handLimit)}</small></b><img src={BACK} alt="" /></span>
      </span>
      <span className="an-bpa" dir="ltr" aria-label="ترتیب کارت‌های کنش (چپ = قدرت ۱)">
        {p.slots.map((k, i) => {
          const t = p.tok[k];
          return (
            <span key={k} className={`an-bpa__s${p.up[k] ? ' is-up' : ''}`} title={`${ACTION_FA[k]} ${p.up[k] ? 'II' : 'I'}، قدرت ${fa(p.strengths[i]!)}`}>
              <img src={UI(`act-${k}`)} alt="" />
              {t.venom > 0 && <img className="an-bpa__tok" src={TOK_ART.venom} alt="زهر" />}
              {t.mult > 0 && <img className="an-bpa__tok" src={TOK_ART.mult} alt="دوبرابرکننده" />}
              {t.con > 0 && <img className="an-bpa__tok" src={TOK_ART.con} alt="فشار" />}
            </span>
          );
        })}
      </span>
      <div className="an-bpicons" dir="ltr">
        {ICON_ORDER.map((row, r) => (
          <div key={r} className={`an-bpr${r === 1 ? ' an-bpr--col' : ''}`}>
            {row.map((i) => {
              const n = p.icons[i] ?? 0;
              return (
                <span key={i} className={`an-bpn${n ? '' : ' is-zero'}`} title={`${ICON_FA[i]}: ${fa(n)}`}>
                  <b className="an-num">{fa(n)}</b>
                  <span className={`an-badge2${i === 'rock' || i === 'water' ? ' is-terrain' : ''}`}><img src={i === 'rock' || i === 'water' ? UI(i) : art(ICON_ART[i])} alt="" /></span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
// One zoo at a time (§6.1): the seat being viewed is shared by the renderer and the shell rail cards (eye buttons).
const zooView = { want: null as number | null, shown: null as number | null, subs: new Set<() => void>() };
const zooNotify = () => zooView.subs.forEach((f) => f());
const zooSubscribe = (f: () => void) => { zooView.subs.add(f); return () => { zooView.subs.delete(f); }; };
function EyeButton({ seat, name }: { seat: number; name: string }) {
  const shown = useSyncExternalStore(zooSubscribe, () => zooView.shown, () => null);
  return (
    <button className="an-eye" type="button" aria-pressed={shown === seat} aria-label={`دیدن باغ‌وحش ${name}`} title="دیدن باغ‌وحش"
      onClick={() => { zooView.want = seat; zooNotify(); }}><Icon name="eye" size={18} /></button>
  );
}
/** Rail panel in the table shell (apps/web SEAT_CARDS): score + BGA panel body from publicSummary `detail`. */
export function arkSeatCard(seat: { seat: number; primary?: { value: number }; status?: string; detail?: unknown }, turn: boolean) {
  const d = seat.detail as ArkDetail | undefined;
  if (!d) return {};
  return {
    stats: undefined,
    score: <span className="an-sc an-side" style={seatStyle(d.seat)}><EyeButton seat={d.seat} name={`بازیکن ${fa(d.seat + 1)}`} /><span className="an-bscore" title="امتیاز فعلی = جذابیت − عدد هدف حفاظت"><b className="an-num">{fa(d.vp)}</b><Icon name="star" size={16} className="an-star" /></span></span>,
    scoreLabel: undefined,
    ...(d.out ? { sub: 'انصراف داده' } : turn ? { sub: 'در نوبت' } : {}),
    detail: <div className="an-sc an-bp an-bp--shell" style={seatStyle(d.seat)}><PanelBody p={d} /></div>
  };
}
function Panel({ p, name, me, turn, viewing, onEye, place }: { p: PlayerView; name: string; me: boolean; turn: boolean; viewing: boolean; onEye: () => void; place?: number }) {
  return (
    <div className={['bgv-pcard an-panel an-bp', me ? 'is-you' : '', turn ? 'is-turn' : ''].join(' ')} data-seat={p.seat} style={seatStyle(p.seat)} data-flip-anchor={`seat-${p.seat}`}>
      <div className="an-bp__head">
        <span className="bgv-avatar bgv-avatar--sm an-ava" aria-hidden="true"><img src={piece('worker', p.seat)} alt="" /></span>
        <div className="an-bp__id">
          <b><bdi>{name}</bdi>{me ? <span className="an-you">شما</span> : null}</b>
          <small>
            <span className="an-bscore" title="امتیاز فعلی = جذابیت − عدد هدف حفاظت"><b className="an-num">{fa(p.vp)}</b><Icon name="star" size={16} className="an-star" /></span>
            <span>{place ? `رتبهٔ ${fa(place)}` : turn ? 'در نوبت' : ''}</span>
          </small>
        </div>
        <button className="an-eye" type="button" aria-pressed={viewing} aria-label={`دیدن باغ‌وحش ${name}`} title="دیدن باغ‌وحش" onClick={onEye}><Icon name="eye" size={18} /></button>
      </div>
      <PanelBody p={{ ...p, income: appealIncome(p.appeal) }} />
    </div>
  );
}

// ---------------- zoo (§6) ----------------
const ZOOMS = [1, 1.5, 2, 2.5];
function ZooMap({ map, p, name, targets, preview, onCell, hintCells, focus, phone }: {
  map: MapView; p: PlayerView; name: string; targets?: Set<string>; preview?: Placement | null; onCell?: (c: string) => void; hintCells?: string[]; focus?: boolean; phone?: boolean;
}) {
  const bld = p.buildings; // the selected placement is already in here as id -1 (previewView), drawn as the ghost
  const wrap = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  // Phone (§11.8): placing zooms in and centres the legal spaces; +/−/«کل» change it, the map scrolls inside its frame.
  const tKey = targets ? [...targets].sort().join() : '';
  useEffect(() => { if (phone && focus && targets?.size) setZ(2); else if (!focus) setZ(1); }, [phone, focus, tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = wrap.current;
    if (!el || !targets?.size || z === 1) return;
    const pts = [...targets].map(hexXY);
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length / MAPW.w, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length / MAPW.h;
    el.scrollTo({ left: cx * el.scrollWidth - el.clientWidth / 2, top: cy * el.scrollHeight - el.clientHeight / 2 });
    el.scrollIntoView?.({ block: 'nearest' });
  }, [z, tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hint = new Set(hintCells ?? []);
  return (
    <div className="an-zoomframe">
    {phone && (
      <span className="an-zoomctl" role="group" aria-label="بزرگ‌نمایی نقشه">
        <button type="button" data-act="zoom-in" aria-label="بزرگ‌تر" disabled={z >= ZOOMS.at(-1)!} onClick={() => setZ(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)]!)}>+</button>
        <button type="button" data-act="zoom-out" aria-label="کوچک‌تر" disabled={z <= 1} onClick={() => setZ(ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)]!)}>−</button>
        <button type="button" data-act="zoom-fit" aria-label="کل نقشه" disabled={z === 1} onClick={() => setZ(1)}>کل</button>
      </span>
    )}
    <div className="an-zoomwrap" ref={wrap} data-zoom={z} style={{ '--an-z': z } as CSSProperties}>
    <div className="an-map an-board__map" role="group" aria-label={`نقشهٔ باغ‌وحش ${name}`}>
      <img src={art(`art/boards/map-${map.id}.webp`)} className="an-base" alt="" width={2000} height={1041} draggable={false} />
      <span className="an-note2"><b><bdi>{name}</bdi></b><span>{fa(p.workers)} × <img src={piece('worker', p.seat)} alt="کارمند" /></span></span>
      {bld.map((b) => {
        const file = buildingFile(b);
        const fit = file ? fitBuilding(file, b.cells) : null;
        if (!fit) {
          // Missing art or no fit: a labelled placeholder over the cells (owner decision 2026-11-18), listed in IMPL-PROGRESS.md.
          const [cx, cy] = hexXY(b.cells[0]!);
          return <span key={b.id} className="an-bld an-bld--missing" data-building={b.id} data-kind={b.kind} style={at(cx, cy)}>{kindName(b.kind)}</span>;
        }
        return (
          <img key={b.id} src={art(file)} alt={`${kindName(b.kind)}${b.full ? '، پر' : ''}`} draggable={false}
            className={`an-bld${b.id === -1 ? ' an-bld--ghost' : ''}`} data-building={b.id} data-kind={b.kind}
            style={{ left: pct(fit.x, MAPW.w), top: pct(fit.y, MAPW.h), inlineSize: pct(fit.w, MAPW.w), transform: `translate(-50%,-50%) rotate(${fit.deg}deg)${fit.mx < 0 ? ' scaleX(-1)' : ''}` }} />
        );
      })}
      <svg className="an-hexes an-hit" viewBox={`0 0 ${MAPW.w} ${MAPW.h}`} aria-hidden="true">
        {p.buildings.flatMap((b) => b.cells.map((c) => <polygon key={`b${c}`} className="an-hex--b" data-building={b.id} points={hexPts(c)} />))}
        {preview && preview.cells.map((c) => <polygon key={`g${c}`} className="an-hex an-hex--ghost" points={hexPts(c, HEX.r - 6)} />)}
        {targets && [...targets].filter((c) => !preview?.cells.includes(c)).map((c) => <polygon key={`t${c}`} className="an-hex" points={hexPts(c, HEX.r - 6)} />)}
      </svg>
      {onCell && targets && CELLS.filter((c) => targets.has(c)).map((c) => {
        const [cx, cy] = hexXY(c);
        return <button key={c} type="button" className={`an-cell${hint.has(c) && !preview?.cells.includes(c) ? ' an-hint' : ''}`} data-cell={c} aria-label={`خانهٔ ${c}`} style={at(cx, cy)} onClick={() => onCell(c)} />;
      })}
      {map.left.map((_, i) => p.left[i] && <img key={`l${i}`} src={piece('cube', p.seat)} className="an-at an-piece an-cube" alt="" style={atP(LEFT_XY[i]!)} />)}
      {WORKER_XY.slice(p.hired).map((xy0, i) => <img key={`w${i}`} src={piece('worker', p.seat)} className="an-at an-piece an-worker" alt="" style={atP(xy0)} />)}
      {p.partners.map((z, i) => PARTNER_XY[i] && <img key={z} src={partnerArt(z)} className="an-at an-piece an-ptile" alt={ICON_FA[z]} style={atP(PARTNER_XY[i]!)} />)}
      {p.unis.map((u, i) => UNI_XY[i] && <img key={u} src={uniArt(u)} className="an-at an-piece an-utile" alt={UNI_FA[u]} style={atP(UNI_XY[i]!)} />)}
    </div>
    </div>
    </div>
  );
}

function Played({ p, me, finals, onZoom }: { p: PlayerView; me: boolean; finals: number[] | null; onZoom: (id: number | null) => void }) {
  const animals = p.zoo.filter((id) => ANIMAL[id]);
  const sponsors = p.zoo.filter((id) => SPONSOR[id]);
  const col = (title: string, icon: string, ids: number[]) => (
    <div className="an-pcol">
      <h4><img src={UI(icon)} alt="" />{title} <span className="an-num">({fa(ids.length)})</span></h4>
      <div className="an-stack2">
        {ids.map((id) => (
          <span key={id} className="an-stackcard">
            <CardImg id={id} cw={120} flip from={`seat-${p.seat}`} onZoom={onZoom} />
            {p.underCount[String(id)] ? <b className="an-under an-num" title="کارت زیر این کارت">{fa(p.underCount[String(id)]!)}</b> : null}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="an-played">
      {col('حیوانات', 'act-animals', animals)}
      {col('حامیان', 'act-sponsors', sponsors)}
      <div className="an-pcol">
        <h4><img src={UI('endgame')} alt="" />امتیاز پایانی</h4>
        <div className="an-finals">
          {me && finals ? finals.map((id) => <CardImg key={id} id={id} cw={96} onZoom={onZoom} />)
            : Array.from({ length: p.finalsCount }, (_, i) => <img key={i} className="an-back" src={art('art/card-backs/card-back-final.webp')} alt="کارت امتیاز پایانی (پنهان)" />)}
        </div>
      </div>
    </div>
  );
}

/** Phone layout (< 900px): tabs, hand drawer, prompt sheet at the bottom (§11). */
function usePhone() {
  const q = '(max-width: 899px)';
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
/** The publisher's English card name (shown under the Persian name in the zoom). */
const nameEn = (id: number) => ANIMAL[id]?.name ?? SPONSOR[id]?.name ?? PROJECT[id]?.name ?? nameOf(id);

// ---------------- main ----------------
export default function ArkNovaRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<ArkView>) {
  const root = useRef<HTMLDivElement>(null);
  const prompt = served.prompt as PromptView | null;
  const mine = !!prompt && prompt.seat === mySeat && !served.outcome;
  const draft = legalActions.find((a) => a.type === 'draft') as undefined | { cards: number[]; maps: string[] };
  const [sel, setSel] = useState<string | null>(null); // selected option value (select → confirm)
  const [xSpend, setXSpend] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [mapPick, setMapPick] = useState('');
  const [kind, setKind] = useState('');
  const [place, setPlace] = useState<Placement | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const phone = usePhone();
  const [tab, setTab] = useState<'zoo' | 'boards' | 'players'>('zoo');
  const [drawer, setDrawer] = useState(false);
  const nm = nameOf;
  const exp = expected as null | { type: string; value?: string; kind?: string; cells?: string[]; ids?: number[]; skip?: boolean };
  const expKey = exp ? JSON.stringify(exp) : '';
  useEffect(() => {
    setPicked([]); setMapPick(''); setSel(null); setXSpend(0);
    // Tutorial: preselect the expected placement so the hint shows where it goes.
    if (exp?.kind && exp.cells) { setKind(exp.kind); setPlace({ kind: exp.kind, cells: exp.cells }); } else { setKind(''); setPlace(null); }
  }, [served.seq, expKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview the selection before «تأیید» and the move while it is sent.
  const selAction: GameAction | null = mine && !busy ? (sel ? { type: 'answer', value: sel } : place ? { type: 'answer', kind: place.kind, cells: place.cells } : null) : null;
  const view = previewView(served, queued ?? selAction, mySeat);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}|${sel ?? ''}|${place ? place.cells.join() : ''}`);

  // One zoo at a time (§6.1): own zoo, else the seat in turn; remembered per table.
  const storeKey = typeof location !== 'undefined' ? `an.zoo:${location.pathname}` : 'an.zoo';
  const [viewSeat, setViewSeatRaw] = useState<number | null>(() => { try { const v = localStorage.getItem(storeKey); return v === null ? null : Number(v); } catch { return null; } });
  const setViewSeat = (s: number) => { setViewSeatRaw(s); try { localStorage.setItem(storeKey, String(s)); } catch { /* storage off */ } };
  const placing = mine && prompt?.k === 'place';
  const shownSeat = placing ? mySeat! : viewSeat !== null && viewSeat < view.n ? viewSeat : mySeat ?? view.current;
  // Eye buttons in the shell rail cards (arkSeatCard) switch the zoo through the shared store; publish what is shown.
  const wanted = useSyncExternalStore(zooSubscribe, () => zooView.want, () => null);
  useEffect(() => { if (wanted !== null) { setViewSeat(wanted); zooView.want = null; } }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (zooView.shown !== shownSeat) { zooView.shown = shownSeat; zooNotify(); } }, [shownSeat]);

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
  const rotate = () => {
    const opts = placements.filter((p) => p.kind === curKind && (!place || p.cells.includes(place.cells[0]!)));
    if (!opts.length) return;
    const i = place ? opts.findIndex((o) => o.cells.join() === place.cells.join()) : -1;
    setPlace(opts[(i + 1) % opts.length]!);
  };
  const me = mySeat === null ? null : view.players[mySeat] ?? null;
  const options = mine && prompt?.k === 'option' ? prompt.options ?? [] : [];
  const optionOf = (id: number) => options.find((o) => cardOf(o.value) === id);
  const isTurn = options.some((o) => /^(a|x):/.test(o.value));
  // Phone: a placement opens «باغ‌وحش من»; a prompt that plays a hand card opens the hand drawer (§11.7, §11.8).
  const handOpts = !!view.me && options.some((o) => { const id = cardOf(o.value); return id !== null && view.me!.hand.includes(id); });
  useEffect(() => { if (placing) setTab('zoo'); setDrawer(handOpts); }, [served.seq, placing]); // eslint-disable-line react-hooks/exhaustive-deps
  const turnOpt = (card: ActionKey) => options.find((o) => o.value === `a:${card}:${xSpend}`);
  const order = useMemo(() => Array.from({ length: view.n }, (_, k) => (view.first + k) % view.n), [view.n, view.first]);
  const placeOf = (s: number) => view.outcome?.placements.find((x) => x.seat === s)?.place;
  const log = view.log.slice(-14).map((e) => logLine(e as Record<string, unknown>, who)).filter(Boolean).reverse();

  // ---- action bar (§8.3, §9) ----
  const hintClass = (on: boolean) => (on ? ' an-hint' : '');
  const optButton = (o: { value: string; label: string }) => {
    const id = cardOf(o.value);
    const on = sel === o.value;
    return (
      <button key={o.value} type="button" className={`bgv-btn bgv-btn--secondary bgv-btn--sm an-opt${id ? ' an-opt--card' : ''}${hintClass(isExp({ value: o.value }) && !on)}`}
        data-opt={o.value} data-x={o.value.startsWith('x:') ? '1' : undefined} aria-pressed={on} onClick={() => setSel(on ? null : o.value)}>
        {id !== null && <img src={cardArt(id)} className="an-optcard" alt="" />}
        <span>{faDigits(o.label)}</span>
      </button>
    );
  };
  const confirmRow = (canConfirm: boolean, onConfirm: () => void, act = 'submit', expOn = false) => (
    <div className="an-bar__row an-bar__confirm">
      <button type="button" className={`bgv-btn bgv-btn--primary bgv-btn--sm${hintClass(expOn)}`} data-act={act} disabled={busy || !canConfirm} onClick={onConfirm}>تأیید</button>
      <button type="button" className="bgv-btn bgv-btn--ghost bgv-btn--sm" data-act="undo" disabled={!canConfirm} onClick={() => { setSel(null); setPlace(null); setPicked([]); }}>برگرد</button>
      {prompt?.optional && <button type="button" className={`bgv-btn bgv-btn--ghost bgv-btn--sm${hintClass(isExp({ skip: true }))}`} data-act="skip" onClick={() => send({ skip: true })}>رد کردن</button>}
    </div>
  );
  let bar: ReactNode;
  if (mine && prompt && !busy) {
    const body: ReactNode[] = [];
    if (prompt.k === 'option' && isTurn) {
      const xs = options.filter((o) => o.value.startsWith('x:'));
      const others = options.filter((o) => !/^(a|x):/.test(o.value));
      const maxX = me?.x ?? 0;
      body.push(
        <div key="t" className="an-bar__row an-options" role="toolbar" aria-label="کارت‌های کنش">
          {(me?.slots ?? ACTION_KEYS).map((k, i) => {
            const o = turnOpt(k);
            const on = !!o && sel === o.value;
            return o ? (
              <button key={k} type="button" className={`bgv-btn bgv-btn--secondary bgv-btn--sm an-opt${hintClass(isExp({ value: o.value }) && !on)}`} data-opt={o.value} aria-pressed={on} onClick={() => setSel(on ? null : o.value)}>
                <img src={UI(`act-${k}`)} className="an-ic" alt="" />{ACTION_FA[k]}{me?.up[k] ? ' II' : ''} <span className="an-strength an-num">{fa((me?.strengths[i] ?? 0) + xSpend)}</span>
              </button>
            ) : (
              <button key={k} type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm" disabled title="این کنش با این قدرت کاری نمی‌کند">
                <img src={UI(`act-${k}`)} className="an-ic" alt="" />{ACTION_FA[k]}{me?.up[k] ? ' II' : ''} <span className="an-strength an-num">{fa((me?.strengths[i] ?? 0) + xSpend)}</span>
              </button>
            );
          })}
          {maxX > 0 && (
            <span className="an-xseg" role="group" aria-label="نشان X خرج کنید">
              <span><img src={UI('xtoken')} className="an-ic" alt="" />خرج</span>
              {Array.from({ length: 6 }, (_, x) => (
                <button key={x} type="button" aria-pressed={x === xSpend} disabled={x > maxX} data-xs={x} onClick={() => { setXSpend(x); setSel(null); }}>{fa(x)}</button>
              ))}
            </span>
          )}
          {others.map(optButton)}
          {xs.length > 0 && <details className="an-xmenu"><summary className="bgv-btn bgv-btn--ghost bgv-btn--sm" data-act="x-mode"><img src={UI('xtoken')} className="an-ic" alt="" />کنش نشان X…</summary><div className="an-xmenu__list">{xs.map(optButton)}</div></details>}
        </div>
      );
      body.push(confirmRow(!!sel, () => sel && send({ value: sel }), 'submit', !!sel && isExp({ value: sel })));
      body.push(<p key="h" className="an-bar__hint">هر نشان X یک قدرت اضافه است. «کنش نشان X»: یک کارت را بدون اجرا به خانهٔ ۱ ببرید و ۱ نشان X بگیرید. کارت‌های کنش زیر نقشه هم زدنی‌اند.</p>);
    } else if (prompt.k === 'option') {
      body.push(<div key="o" className="an-bar__row an-options" role="group" aria-label="گزینه‌ها">{options.map(optButton)}</div>);
      body.push(confirmRow(!!sel, () => sel && send({ value: sel }), 'submit', !!sel && isExp({ value: sel })));
    } else if (prompt.k === 'pick') {
      body.push(
        <div key="p" className="an-pick">
          <p className="an-bar__hint">{prompt.min === prompt.max ? `${fa(prompt.min!)} کارت انتخاب کنید` : `${fa(prompt.min!)} تا ${fa(prompt.max!)} کارت انتخاب کنید`} ({fa(picked.length)} انتخاب شده)</p>
          <div className="an-hand an-hand--pick" data-act="pick" data-min={prompt.min}>{prompt.ids!.map((id) => {
            const on = picked.includes(id);
            return <CardImg key={id} id={id} cw={96} pick={on ? 'picked' : 'selectable'} hint={!!exp?.ids?.includes(id) && !on} onZoom={setZoom}
              onClick={() => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < prompt.max! ? [...x, id] : x))} />;
          })}</div>
        </div>
      );
      const okN = picked.length >= prompt.min! && picked.length <= prompt.max!;
      body.push(confirmRow(okN, () => send({ ids: picked }), 'submit', !!exp?.ids && exp.ids.length === picked.length && exp.ids.every((x) => picked.includes(x))));
    } else {
      body.push(
        <div key="k" className="an-bar__row an-kinds" role="group" aria-label="نوع ساختمان">
          {kinds.map((k) => {
            const size = placements.find((p) => p.kind === k)!.cells.length;
            return (
              <button key={k} type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm an-kind" aria-pressed={k === curKind} onClick={() => { setKind(k); setPlace(null); }}>
                {buildingFile({ kind: k }) && <img src={art(buildingFile({ kind: k }))} className="an-ic" alt="" />}{kindName(k)}<small className="an-num">{prompt.free ? 'رایگان' : `${fa(2 * size)} پول`}</small>
              </button>
            );
          })}
          <label className="an-select">جای مجاز:
            <select className="bgv-select" data-act="placements" value={place ? `${place.kind}|${place.cells.join(',')}` : ''}
              onChange={(e) => { const p = placements.find((x) => `${x.kind}|${x.cells.join(',')}` === e.target.value) ?? null; setPlace(p); if (p) setKind(p.kind); }}>
              <option value="">—</option>
              {placements.map((p) => <option key={`${p.kind}|${p.cells.join(',')}`} value={`${p.kind}|${p.cells.join(',')}`}>{kindName(p.kind)}: {p.cells.join(' ')}</option>)}
            </select>
          </label>
          <button type="button" className="bgv-btn bgv-btn--ghost bgv-btn--sm" data-act="rotate" disabled={!place} onClick={rotate} aria-label="جای مجاز بعدی (چرخش)"><Icon name="turn" size={16} />چرخش</button>
        </div>
      );
      body.push(<p key="h" className="an-bar__hint">یک خانهٔ خط‌چین را روی نقشه بزنید؛ ضربهٔ دوباره یا «چرخش» جای مجاز بعدی را نشان می‌دهد. {place ? `${kindName(place.kind)}، ${prompt.free ? 'رایگان' : `${fa(2 * place.cells.length)} پول`}` : ''}</p>);
      body.push(confirmRow(!!place, () => place && send({ kind: place.kind, cells: place.cells }), 'place', !!place && isExp({ kind: place.kind, cells: place.cells })));
    }
    bar = (
      <section className="an-bar an-prompt" aria-live="polite" aria-label="نوار کنش" data-an-actbar="">
        <div className="an-bar__row"><span className="an-bar__text"><b>نوبت شماست</b>: {faDigits(prompt.label)}</span>{!phone && <span data-shell-clock="" className="an-clockslot" />}</div>
        {body}
        {phone && view.me && <div className="an-bar__row an-dock">{isTurn && me && me.slots.map((k, i) => { const o = turnOpt(k); const on = !!o && sel === o.value; return (
          <button key={k} type="button" className={`an-dockact${on ? ' is-picked' : ''}`} disabled={!o} aria-pressed={o ? on : undefined} aria-label={`${ACTION_FA[k]}، قدرت ${fa(me.strengths[i]! + xSpend)}`} onClick={() => o && setSel(on ? null : o.value)}>
            <img src={actArt(k, me.up[k])} alt="" /><span className="an-act__str an-num">{fa(me.strengths[i]! + xSpend)}</span>
          </button>); })}<button type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm" data-act="hand" aria-pressed={drawer} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><img src={BACK} className="an-ic" alt="" />دست ({fa(view.me?.hand.length ?? 0)})</button></div>}
      </section>
    );
  } else {
    const text = view.outcome ? 'بازی تمام شد.' : queued || busy ? 'حرکت شما در حال ثبت است…'
      : view.stage === 'draft' ? (draft ? '۴ کارت از ۸ کارت آغازین را نگه دارید.' : 'منتظر انتخاب کارت‌های آغازین دیگران…')
      : prompt ? <>نوبت <bdi>{who(prompt.seat)}</bdi>: {faDigits(prompt.label)}</> : '';
    bar = <section className="an-bar is-waiting" aria-live="polite" aria-label="نوار کنش"><div className="an-bar__row"><span className="an-bar__text">{text}</span>{!phone && <span data-shell-clock="" className="an-clockslot" />}</div>{phone && view.me && view.stage !== 'draft' && <div className="an-bar__row an-dock"><button type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm" data-act="hand" aria-pressed={drawer} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><img src={BACK} className="an-ic" alt="" />دست ({fa(view.me?.hand.length ?? 0)})</button></div>}</section>;
  }

  // ---- hand (§3) ----
  const hand = view.me?.hand ?? [];
  const handZone = view.me && view.stage !== 'draft' && (
    <section className={`bgv-felt an-zone an-handzone${drawer ? ' is-open' : ''}`} aria-label="دست شما">
      <div className="an-zone__head"><h2>دست شما</h2><small>{fa(hand.length)} کارت از سقف {fa(me?.handLimit ?? 3)} در استراحت؛ قابل بازی‌ها حلقه دارند. نشانگر را نگه دارید تا کارت بزرگ و متن فارسی دیده شود.</small></div>
      <div className="an-hand">
        {hand.map((id) => {
          const o = optionOf(id);
          const on = !!o && sel === o.value;
          return (
            <div key={id} className="an-handcard">
              <CardImg id={id} cw={128} flip exit="discard" onZoom={setZoom} pick={on ? 'picked' : o ? 'selectable' : undefined} hint={!!o && isExp({ value: o.value }) && !on}
                label={nameOf(id)} onClick={o ? () => { setSel(on ? null : o.value); if (phone && !on) setDrawer(false); } : () => setZoom(zoom === id ? null : id)} />
              <span className="an-card__fa">{nm(id)}</span>
              {o && <span className="an-card__why">{faDigits(o.label.split(' — ').slice(1).join(' — ') || o.label)}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );

  // ---- display + reputation strip (§4) ----
  const range = me?.range ?? 0;
  const displayZone = (
    <section className="bgv-felt an-zone an-t-boards" aria-label="ویترین و مسیر اعتبار">
      <div className="an-zone__head"><h2>ویترین</h2><small>{me ? `پوشه‌های ۱ تا ${fa(range)} در محدودهٔ اعتبار شما (حلقهٔ کهربایی)` : 'هزینهٔ برداشتن = شمارهٔ پوشه'}</small></div>
      <div className="an-pool bgv-scroll-x" dir="ltr" role="group" aria-label="ویترین (پوشه‌های ۱ تا ۶)">
        {view.display.map((id, i) => {
          const o = id !== null ? optionOf(id) : undefined;
          const on = !!o && sel === o.value;
          return (
            <div key={i} className={`an-folder${i < range ? ' is-range' : ''}`} data-folder={i + 1}>
              <div className="an-folder__tab"><i>{FOLDER_CITY[i]}</i><b className="an-num">{fa(i + 1)}</b></div>
              {id === null ? <img className="an-back" src={BACK} alt={view.stage === 'draft' ? 'رو به پایین' : 'خالی'} />
                : <CardImg id={id} flip exit={prompt ? `seat-${prompt.seat}` : 'discard'} onZoom={setZoom} pick={on ? 'picked' : o ? 'selectable' : undefined}
                  onClick={o ? () => setSel(on ? null : o.value) : undefined} hint={!!o && isExp({ value: o.value }) && !on} />}
              <span className="an-folder__cost">{id === null ? '' : i < range ? `در محدوده، ${fa(i + 1)} پول` : nm(id)}</span>
            </div>
          );
        })}
      </div>
      <div className="an-strip an-rep" data-an-track="rep" dir="ltr" role="group" aria-label="مسیر اعتبار">
        <img src={art('art/bga/reputation-track.webp')} className="an-base" alt="" width={2752} height={95} />
        {view.players.map((p, k) => <img key={p.seat} src={piece('counter', p.seat)} className="an-at an-piece an-counter" alt={`${who(p.seat)}: اعتبار ${fa(p.rep)}`}
          style={{ left: `${(repX(p.rep) * 100 + (view.players.filter((q) => q.rep === p.rep && q.seat < p.seat).length) * 0.9).toFixed(2)}%`, top: `${50 - k * 0}%` }} />)}
        {Object.entries(REP_BONUS).map(([r, ic]) => <img key={r} src={UI(ic)} className="an-repb" alt="" title={`پاداش اعتبار ${fa(Number(r))}`} style={{ left: `${(repX(Number(r)) * 100).toFixed(2)}%` }} />)}
      </div>
      <div className="an-repgap" />
    </section>
  );

  // ---- conservation strip, projects and association board (§5) ----
  const assocOpt = (task: string) => options.filter((o) => o.value === task || o.value.startsWith(`${task}:`) || (task === 'project' && o.value.startsWith('pr:')));
  const projectBand = (ids: number[], label: string, empty: number) => (
    <div className="an-projband" aria-label={label}>
      {ids.map((id) => (
        <div key={id} data-project={id}>
          <div className="an-pbot" title={nameOf(id)} onMouseEnter={() => setZoom(id)} onMouseLeave={() => setZoom(null)}>
            <img src={cardArt(id)} className="an-pimg" alt="" />
            {PROJECT[id]!.slots.map((_, k) => {
              const o = view.ptoks[id]?.[k];
              const [lx, ly] = LEVEL_XY[k]!;
              if (o === -1) return <span key={k} className="an-lvl-x" style={{ left: `${lx * 100}%`, top: `${ly * 100}%` }} aria-label="سطح بسته">✕</span>;
              if (o !== null && o !== undefined) return <img key={k} src={piece('cube', o)} className="an-lvl" alt={who(o)} style={{ left: `${lx * 100}%`, top: `${ly * 100}%` }} />;
              const po = options.find((x) => x.value.startsWith(`pr:${id}:${k}:`));
              return po ? <button key={k} type="button" className={`an-hot an-lvlhot${sel === po.value ? ' is-picked' : ' is-avail'}${hintClass(isExp({ value: po.value }) && sel !== po.value)}`} style={{ left: `${lx * 100}%`, top: `${ly * 100}%` }}
                aria-label={faDigits(po.label)} onClick={() => setSel(sel === po.value ? null : po.value)} /> : null;
            })}
          </div>
          <span className="an-pname">{nm(id)}</span>
        </div>
      ))}
      {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className="an-pslot">{i === 0 ? 'پروژهٔ بازی‌شده اینجا می‌نشیند' : `حداکثر ${fa(view.n === 4 ? 3 : 2)}`}</span>)}
    </div>
  );
  const consZone = (
    <section className="bgv-felt an-zone an-t-boards" aria-label="مسیر حفاظت و انجمن">
      <div className="an-strip an-cons" data-an-track="cp" dir="ltr" role="group" aria-label="مسیر حفاظت">
        <img src={art('art/bga/conservation-track.webp')} className="an-base" alt="" width={3188} height={330} />
        {view.players.map((p) => {
          const same = view.players.filter((q) => Math.min(10, q.cp) === Math.min(10, p.cp) && q.seat < p.seat).length;
          return <img key={p.seat} src={piece('counter', p.seat)} className="an-at an-piece an-counter" alt={`${who(p.seat)}: حفاظت ${fa(p.cp)}`}
            style={{ left: `${(cpX(p.cp) * 100 + same * 1.4).toFixed(2)}%`, top: `${22 + same * 6}%` }} />;
        })}
        {view.players.filter((p) => p.cp > 10).map((p) => <span key={`n${p.seat}`} className="an-cnum an-num" style={{ left: `${(cpX(10) * 100).toFixed(2)}%`, top: '48%' }}>{fa(p.cp)}</span>)}
        {([5, 8] as const).flatMap((m) => view.bonusTiles[m].map((t, i) => <img key={`${m}${t}`} src={tileArt(t)} className="an-at an-piece an-btile" alt={TILES[t]?.nameFa ?? t} title={TILES[t]?.nameFa ?? t}
          style={{ left: `${CP_TILE[m][i]![0] * 100}%`, top: `${CP_TILE[m][i]![1] * 100}%` }} />))}
        <button className="an-zoomhint" type="button" aria-haspopup="dialog" onClick={() => setScoreOpen(true)}><Icon name="grid" size={16} />مسیر جذابیت</button>
      </div>
      <div className="an-assoc2">
        {projectBand(view.projects, 'پروژه‌های بازی‌شده', Math.max(0, (view.n === 4 ? 3 : 2) - view.projects.length))}
        <div className="an-bab" dir="ltr" data-an-board="association" role="group" aria-label="بورد انجمن">
          <img src={art('art/bga/association-board.webp')} className="an-base" alt="" width={BAB.w} height={BAB.h} />
          {view.zoosAvail.map((z) => BAB_ZOO[z] && <img key={z} src={partnerArt(z)} className="an-at an-piece an-ptile" alt={`باغ‌وحش همکار ${ICON_FA[z]}`} style={atP(BAB_ZOO[z]!, BAB.w, BAB.h)} />)}
          {view.unisAvail.map((u) => BAB_UNI[u] && <img key={u} src={uniArt(u)} className="an-at an-piece an-utile" alt={UNI_FA[u]} style={atP(BAB_UNI[u]!, BAB.w, BAB.h)} />)}
          {(['rep', 'zoo', 'uni', 'project'] as const).flatMap((k) => view.assoc[k].map((sd, j) => (
            <img key={`${k}${j}`} src={piece('worker', sd)} className="an-at an-piece an-worker" alt={who(sd)} style={at(BAB_TASK[k]![0] + j * 70, BAB_TASK[k]![1], BAB.w, BAB.h)} />
          )))}
          {Array.from({ length: Math.min(view.donations, BAB_DONATE.length) }, (_, i) => <span key={`d${i}`} className="an-done" style={atP(BAB_DONATE[i]!, BAB.w, BAB.h)}>✓</span>)}
          {(['rep', 'zoo', 'uni', 'project'] as const).map((k) => {
            const opts = assocOpt(k);
            const [x, y, w, h] = BAB_HOT[k]!;
            const first = opts[0];
            return (
              <button key={k} type="button" data-task={k} className={`an-hot${opts.length ? ' is-avail' : ''}${first && sel === first.value ? ' is-picked' : ''}`} disabled={!opts.length || k === 'project'}
                aria-label={{ rep: '۲ اعتبار', zoo: 'باغ‌وحش همکار', uni: 'دانشگاه', project: 'پروژهٔ حفاظت' }[k]}
                style={{ ...at(x, y, BAB.w, BAB.h), inlineSize: pct(w, BAB.w), blockSize: pct(h, BAB.h) }}
                onClick={() => first && opts.length === 1 && setSel(sel === first.value ? null : first.value)} />
            );
          })}
        </div>
        {projectBand(view.baseProjects, 'پروژه‌های پایه', 0)}
      </div>
    </section>
  );

  // ---- zoo (§6–§8) ----
  const zp = view.players[shownSeat] ?? null;
  const zmap = zp?.map ? view.maps[zp.map] ?? null : null;
  const isMe = zp?.seat === mySeat;
  const isMe0 = mySeat !== null;
  const zooZone = zp && (
    <section className={`bgv-felt an-zone an-t-zoo an-zoo an-player${isMe ? ' an-player--me' : ''}`} style={seatStyle(zp.seat)} data-seat={zp.seat} aria-label={`باغ‌وحش ${who(zp.seat)}`}>
      <div className="an-viewer">
        <b>باغ‌وحش</b>
        <span className="an-seg" role="group" aria-label="دیدن باغ‌وحش">
          {order.map((s) => <button key={s} type="button" aria-pressed={s === zp.seat} style={seatStyle(s)} onClick={() => setViewSeat(s)}><i />{seatName(s)}{s === mySeat ? ' (شما)' : ''}</button>)}
        </span>
        <small>{zmap?.nameFa ?? 'در حال انتخاب نقشه'}</small>
      </div>
      <div className="an-isum" dir="ltr">
        {ICON_ORDER.map((row, r) => (
          <span key={r} className="an-icons">
            {row.map((i) => { const n = zp.icons[i] ?? 0; return <span key={i} className={`an-icn${n ? '' : ' is-zero'}`} title={`${ICON_FA[i]}: ${fa(n)}`}><img src={art(ICON_ART[i])} alt="" />{n > 0 && <b className="an-num">{fa(n)}</b>}</span>; })}
          </span>
        ))}
      </div>
      {zmap && (
        <div className="an-zoomap" dir="ltr" data-an-zoo={zp.seat}>
          <ZooMap map={zmap} p={zp} name={who(zp.seat)} targets={placing ? targets : undefined} preview={placing ? place : null} onCell={placing ? clickCell : undefined} hintCells={placing ? exp?.cells : undefined} focus={placing} phone={phone} />
        </div>
      )}
      {zmap?.textFa && <p className="an-maptext">{zmap.nameFa}: {zmap.textFa}{zmap.turnAbility ? `؛ توانایی نوبت: ${zmap.turnAbility}` : ''}</p>}
      <Played p={zp} me={isMe} finals={isMe ? view.me?.finals ?? null : null} onZoom={setZoom} />
      {zmap && (
        <div className="an-actband" dir="ltr">
          <div className="an-clips"><img src={art(`art/boards/map-${zmap.id}.webp`)} alt="" /></div>
          <div className="an-acts" role="group" aria-label="کارت‌های کنش (خانهٔ ۱ تا ۵)">
            {zp.slots.map((k, i) => {
              const o = isMe && isTurn ? turnOpt(k) : undefined;
              const on = !!o && sel === o.value;
              const t = zp.tok[k];
              return (
                <button key={k} type="button" className={`an-act${o ? ' is-avail' : ''}${on ? ' is-picked' : ''}`} data-slot={i + 1} data-act-card={k} disabled={!o}
                  aria-pressed={o ? on : undefined} aria-label={`${ACTION_FA[k]}${zp.up[k] ? ' II' : ''}، قدرت ${fa(zp.strengths[i]!)}`} data-flip={`slot-${zp.seat}-${k}`}
                  onClick={() => o && setSel(on ? null : o.value)}>
                  <img src={actArt(k, zp.up[k])} alt="" draggable={false} />
                  <span className="an-act__str an-num">{fa(zp.strengths[i]!)}</span>
                  <span className="an-act__toks">
                    {t.venom > 0 && <img src={TOK_ART.venom} alt="نشان زهر" />}
                    {t.mult > 0 && <img src={TOK_ART.mult} alt="نشان دوبرابرکننده" />}
                    {t.con > 0 && <img src={TOK_ART.con} alt="نشان فشار" />}
                  </span>
                  <span className="an-act__fa">{ACTION_FA[k]}{zp.up[k] ? ' II' : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );

  // ---- draft (§10.1) ----
  const draftZone = draft && !busy && (
    <section className="bgv-felt an-zone an-prompt an-draft" aria-label="انتخاب کارت‌های آغازین">
      <div className="an-draft__box">
        {!phone && <span data-shell-clock="" className="an-clockslot" />}
        <p className="an-draft__text"><b>انتخاب آغازین</b>: ۴ کارت از ۸ کارت را نگه دارید{draft.maps.length ? ' و یکی از ۲ نقشه را انتخاب کنید' : ''} ({fa(picked.length)} از ۴ انتخاب شده).
          {view.players.filter((p) => p.drafting).length > 1 ? ` ${fa(view.players.filter((p) => p.drafting).length - 1)} بازیکن دیگر هنوز انتخاب می‌کنند.` : ''}</p>
        <button type="button" className="bgv-btn bgv-btn--primary" data-act="draft" disabled={picked.length !== 4 || (draft.maps.length > 0 && !mapPick)}
          onClick={() => onAction({ type: 'draft', keep: picked, ...(draft.maps.length ? { map: mapPick } : {}) })}>نگه‌داشتن ۴ کارت{draft.maps.length ? ' و نقشه' : ''}</button>
      </div>
      <div className="an-draftgrid" data-act="draft-cards">{draft.cards.map((id) => {
        const on = picked.includes(id);
        return (
          <div key={id} className="an-draftcard">
            <CardImg id={id} cw="100%" pick={on ? 'picked' : 'selectable'} onZoom={setZoom} onClick={() => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < 4 ? [...x, id] : x))} />
            <span className="an-card__fa">{nm(id)}</span>
          </div>
        );
      })}</div>
      {draft.maps.length > 0 && (
        <div className="an-maps" role="radiogroup" aria-label="نقشهٔ باغ‌وحش">{draft.maps.map((mId) => (
          <button key={mId} type="button" role="radio" aria-checked={mapPick === mId} className="an-mapopt" data-pick={mapPick === mId ? 'picked' : 'selectable'} onClick={() => setMapPick(mId)}>
            <img src={art(`art/boards/map-${mId}.webp`)} alt="" />
            <b>{view.maps[mId]?.nameFa ?? mId}</b>{view.maps[mId]?.textFa ? <small>{view.maps[mId]!.textFa}</small> : null}
          </button>
        ))}</div>
      )}
      {view.me && view.me.finals.length > 0 && <div className="an-finals an-draft__finals"><small>کارت‌های امتیاز پایانی شما:</small>{view.me.finals.map((id) => <CardImg key={id} id={id} cw={84} onZoom={setZoom} />)}</div>}
    </section>
  );

  // ---- result (§10.4) ----
  const result = view.final && (
    <section className="bgv-card an-result" aria-label="امتیاز پایانی">
      <h3>امتیاز پایانی (جذابیت منهای عدد هدف حفاظت)</h3>
      <table className="an-table">
        <thead><tr><th>رتبه</th><th>بازیکن</th><th>جذابیت</th><th>حفاظت</th><th>عدد هدف</th><th>پروژه‌های پشتیبانی‌شده</th><th>امتیاز</th></tr></thead>
        <tbody>{[...view.final].sort((a, b) => (placeOf(a.seat) ?? 9) - (placeOf(b.seat) ?? 9)).map((f) => (
          <tr key={f.seat} style={seatStyle(f.seat)}><td>{fa(placeOf(f.seat) ?? 0)}</td><td><bdi>{who(f.seat)}</bdi></td><td>{fa(f.appeal)}</td><td>{fa(f.cp)}</td><td>{fa(f.target)}</td>
            <td>{fa(view.players[f.seat]!.supported)}</td><td><b>{fa(f.vp)}</b></td></tr>
        ))}</tbody>
      </table>
    </section>
  );

  // ---- score board sheet (§5.5) ----
  const scoreSheet = scoreOpen && (
    <div className="bgv-sheet-backdrop an-sheetback" onClick={() => setScoreOpen(false)}>
      <section className="bgv-sheet an-sheet" role="dialog" aria-modal="true" aria-label="بورد امتیاز" onClick={(e) => e.stopPropagation()}>
        <header className="an-sheet__head"><h3>بورد امتیاز</h3><button type="button" className="bgv-btn bgv-btn--ghost bgv-btn--sm" onClick={() => setScoreOpen(false)}>بستن</button></header>
        <div className="an-boardimg an-main-board" dir="ltr">
          <img src={art('art/boards/main-board.webp')} className="an-base" alt="" />
          {view.players.map((p, k) => <img key={`a${p.seat}`} src={piece('counter', p.seat)} className="an-at an-piece an-counter" alt={`${who(p.seat)}: جذابیت ${fa(p.appeal)}`} style={at(appealXY(Math.min(113, p.appeal))[0] + k * 8, appealXY(Math.min(113, p.appeal))[1] - k * 8, MB.w, MB.h)} />)}
          {view.players.map((p, k) => <img key={`c${p.seat}`} src={piece('counter', p.seat)} className="an-at an-piece an-counter" alt={`${who(p.seat)}: حفاظت ${fa(p.cp)}`} style={at(cpXY(p.cp)[0] + k * 8, cpXY(p.cp)[1] - k * 8, MB.w, MB.h)} />)}
          {view.players.map((p, k) => <img key={`r${p.seat}`} src={piece('counter', p.seat)} className="an-at an-piece an-counter" alt={`${who(p.seat)}: اعتبار ${fa(p.rep)}`} style={at(repMB(p.rep)[0] + k * 8, repMB(p.rep)[1] - k * 8, MB.w, MB.h)} />)}
          <img src={art('art/wooden-pieces/break-token.webp')} className="an-at an-piece an-brk" alt={`استراحت ${fa(view.brk)} از ${fa(view.brkMax)}`} style={atP(breakXY(view.brk, view.brkMax), MB.w, MB.h)} />
        </div>
      </section>
    </div>
  );

  // ---- rail (§2) ----
  const rail = (
    <aside className="an-rail an-t-players" aria-label="بازیکنان">
      <RailSlot><div className="rail-top an-sc">
      <section className="bgv-card an-cfg" data-an-cfg="" aria-label="وضعیت میز">
        <div className="an-cfg__row">
          <span className="an-brkbox" title="مسیر استراحت"><img src={art('art/wooden-pieces/break-token.webp')} alt="" /><span className="an-num">{fa(view.brk)}/{fa(view.brkMax)}</span><small>استراحت</small></span>
          <span className="an-pile" title="دسته" data-flip-anchor="deck"><img src={BACK} alt="" /><span className="an-num">{fa(view.deckCount)}</span></span>
          <span className="an-pile" title="دورریخته" data-flip-anchor="discard"><img src={UI('hand-cards')} alt="" /><span className="an-num">{fa(view.discardCount)}</span></span>
        </div>
        <div className="an-cfg__row">
          <small className="an-goal">نوبت {fa(view.turnsDone + 1)}{view.endAt !== null ? `؛ پایان اعلام شد (${fa(Math.max(0, view.endAt - view.turnsDone))} نوبت مانده)` : ''}</small>
          <button className="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" aria-haspopup="dialog" onClick={() => setScoreOpen(true)}><Icon name="grid" size={16} />بورد امتیاز</button>
        </div>
      </section>
      </div></RailSlot>
      {order.map((s) => <Panel key={s} p={view.players[s]!} name={who(s)} me={s === mySeat} turn={view.pending.includes(s)} viewing={s === shownSeat} onEye={() => setViewSeat(s)} place={placeOf(s)} />)}
      {log.length > 0 && (
        <section className="bgv-card an-log" aria-label="گزارش بازی">
          <ol className="bgv-log" aria-live="polite">{log.map((l, i) => <li key={`${view.seq}-${i}`} className="bgv-log__item">{l}</li>)}</ol>
        </section>
      )}
    </aside>
  );

  return (
    <div className="an" dir="rtl" ref={root} data-seq={view.seq} data-tab={tab} data-phone={phone ? '' : undefined} data-stage={view.stage}>
      <div className="an-desk">
        <div className="an-main">
          {!(draft && !busy) && bar}
          <div className="an-phonestat" aria-label="وضعیت میز">
            {phone && <span data-shell-clock="" className="an-clockslot" />}
            {order.map((k) => { const pl = view.players[k]!; return (
              <span key={k} className={`an-chip${view.pending.includes(k) ? ' is-turn' : ''}`} style={seatStyle(k)}><i /><bdi>{who(k)}</bdi><b className="an-num">{fa(pl.vp)}</b><Icon name="star" size={12} className="an-star" /></span>
            ); })}
            <span className="an-chip"><img src={art('art/wooden-pieces/break-token.webp')} alt="" /><span className="an-num">{fa(view.brk)}/{fa(view.brkMax)}</span></span>
          </div>
          {phone && view.stage !== 'draft' && (
            <div className="an-tabs" role="tablist" aria-label="بخش‌های میز">
              {([['zoo', isMe0 ? 'باغ‌وحش من' : 'باغ‌وحش'], ['boards', 'بوردها'], ['players', 'بازیکنان']] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
          )}
          {result}
          {draftZone}
          {handZone}
          {displayZone}
          {consZone}
          {zooZone}
        </div>
        {rail}
      </div>
      {zoom !== null && (
        <div className="an-zoom" role="tooltip">
          <img src={cardArt(zoom)} alt="" />
          <div><h3>{nameOf(zoom)}</h3><bdi className="t-game-latin">{nameEn(zoom)}</bdi><p>{cardText(zoom)}</p><small className="an-num">#{zoom}</small></div>
        </div>
      )}
      {scoreSheet}
    </div>
  );
}
