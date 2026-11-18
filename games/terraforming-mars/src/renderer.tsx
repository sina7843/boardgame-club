// Terraforming Mars table, BGA style (design/games/terraforming-mars HANDOFF.md, COMPONENTS.md). Every piece and card is
// the publisher's flat art (src/art, resolved through design/content-id-map.json) placed by design/layout.json; nothing
// is drawn with CSS. Desktop: sticky action bar, the hand above the Tharsis board (shown without its TR frame), then the
// player areas (Mars-dust header + collapsible card sections). The rail panels come from publicSummary `detail`
// (tmSeatCard); outside the table shell the renderer shows its own copies. Phone: tabs Mars / hand / players, the
// action bar collapsed at the bottom with an actions sheet.
//
// A move is a local draft until «تأیید» (no auto-confirm): picking a card / project / plaque and the payment can be
// undone with «برگرد» / «لغو کنش»; confirm sends the action, decisions the engine asks for afterwards are answered the
// same way. Buttons, costs, default payments, disabled reasons and legal spaces all come from the engine (legal hints,
// `me.blocked`, `me.values`, `respond.options`).
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Button, ZoomBoard, useFlip, useFresh, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import {
  AWARD_COSTS, AWARDS, CARD, MILESTONE_COST, MILESTONES, PROJECTS, PROJECT_FA, RES, RES_FA, CARDRES_FA, SPACE, NAME_FA, OCEANS_MAX, OXY_MAX, TEMP_MAX,
  type CardDef, type Project, type Res, type Tag, type TmDetail, type TmView
} from './rules.ts';
import LAYOUT from './design/layout.json' with { type: 'json' };
import IDS from './design/content-id-map.json' with { type: 'json' };

// ---------------- art ----------------
const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
/** Web URL of a file under art/ (paths as in content-id-map.json). */
const art = (path: string | undefined) => (path ? ART[`./${path}`] ?? '' : '');
const MAP = IDS as unknown as Record<string, Record<string, string>> & { cardBack: string; firstPlayer: string };
const cardArt = (id: string) => art(MAP.cards![id] ?? MAP.corporations![id]);
const COLORS = LAYOUT.playerColours.order as string[];
const colorOf = (seat: number) => COLORS[seat % COLORS.length]!;
const cubeArt = (seat: number) => art(MAP.cubes![colorOf(seat)]);
const WHITE = art(MAP.cubes!.white);
const RES_ICON: Record<Res, string> = Object.fromEntries(RES.map((r) => [r, art(MAP.resources![r])])) as Record<Res, string>;
const icon = (k: string) => art(MAP.other![k]);
const tagArt = (t: string) => art(MAP.tags![t]);
const CRES_ICON = (r: string) => art(MAP.cardResources![r]);
const BONUS_ICON = { steel: RES_ICON.steel, titanium: RES_ICON.titanium, plants: RES_ICON.plants, card: icon('cardSmall') } as const;

// ---------------- numbers and text ----------------
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const num = (n: number, en: boolean) => (en ? String(n) : fa(n));
const signed = (n: number, en: boolean) => (n > 0 ? `+${num(n, en)}` : n < 0 ? `−${num(-n, en)}` : num(0, en));
const TAGS_ORDER: (Tag | 'event')[] = ['building', 'space', 'science', 'power', 'earth', 'jovian', 'plant', 'microbe', 'animal', 'city', 'event'];
const TAG_FA: Record<Tag | 'event', string> = { building: 'ساختمان', space: 'فضا', science: 'علم', power: 'انرژی', earth: 'زمین', jovian: 'مشتری', plant: 'گیاه', microbe: 'میکروب', animal: 'جانور', city: 'شهر', event: 'رویداد' };
const TILE_FA = { greenery: 'فضای سبز', ocean: 'اقیانوس', city: 'شهر', special: 'کاشی ویژه' } as const;
const PROJECT_EN: Record<Project, string> = { sellPatents: 'Sell patents', powerPlant: 'Power plant', asteroid: 'Asteroid', aquifer: 'Aquifer', greenery: 'Greenery', city: 'City' };
const PROJECT_FX_EN: Record<Project, string> = { sellPatents: '1 M€ per card', powerPlant: '+1 energy production', asteroid: '+1 temperature, +1 TR', aquifer: 'Place an ocean', greenery: 'Greenery, +1 oxygen', city: 'City, +1 M€ production' };
const TILE_EN = { greenery: 'greenery', ocean: 'ocean', city: 'city', special: 'special tile' } as const;
const RES_EN: Record<Res, string> = { mc: 'M€', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy', heat: 'Heat' };
const TAG_EN: Record<Tag | 'event', string> = { building: 'Building', space: 'Space', science: 'Science', power: 'Power', earth: 'Earth', jovian: 'Jovian', plant: 'Plant', microbe: 'Microbe', animal: 'Animal', city: 'City', event: 'Event' };
const PROJECT_FX: Record<Project, string> = { sellPatents: 'هر کارت ۱ مگاکردیت', powerPlant: '۱ تولید انرژی', asteroid: '۱ پلهٔ دما و ۱ رتبه', aquifer: 'یک اقیانوس', greenery: 'فضای سبز و ۱ پلهٔ اکسیژن', city: 'شهر و ۱ تولید مگاکردیت' };
/** Engine error code → text (TM-Actions-Spec «دلیل غیرفعال»). */
const REASON: Record<string, string> = {
  REQUIREMENTS_NOT_MET: 'شرط کارت برقرار نیست', CANNOT_AFFORD: 'پول کافی ندارید', NO_SPACE: 'جای مجاز روی نقشه نیست', PRODUCTION_TOO_LOW: 'تولید برای این کاهش کافی نیست',
  NOT_ENOUGH_RESOURCES: 'منبع لازم را ندارید', NO_TARGET: 'هیچ بازیکنی این تولید را ندارد', CANNOT_PLAY: 'این کارت الان بازی نمی‌شود', PARAMETER_MAXED: 'این پارامتر کامل شده',
  ACTION_USED: 'این نسل استفاده شده', CANNOT_USE: 'کنش الان ممکن نیست', MILESTONE_TAKEN: 'ثبت شده', MILESTONE_NOT_REACHED: 'هنوز نرسیده‌اید', AWARD_TAKEN: 'تأمین شده',
  CANNOT_CONVERT: 'منبع کافی ندارید یا جای مجاز نیست', NOT_YOUR_TURN: 'نوبت شما نیست', FIRST_ACTION_REQUIRED: 'اول کنش شرکتتان', ACTION_TAKEN: 'بعد از کنش فقط «پایان نوبت»'
};
const REASON_EN: Record<string, string> = {
  REQUIREMENTS_NOT_MET: 'Requirements not met', CANNOT_AFFORD: 'Not enough money', NO_SPACE: 'No legal space on the map', PRODUCTION_TOO_LOW: 'Production too low',
  NOT_ENOUGH_RESOURCES: 'Not enough resources', NO_TARGET: 'No player has that production', CANNOT_PLAY: 'Cannot be played now', PARAMETER_MAXED: 'Parameter maxed',
  ACTION_USED: 'Used this generation', CANNOT_USE: 'Action not possible now', MILESTONE_TAKEN: 'Claimed', MILESTONE_NOT_REACHED: 'Not reached yet', AWARD_TAKEN: 'Funded',
  CANNOT_CONVERT: 'Not enough resources or no legal space', NOT_YOUR_TURN: 'Not your turn', FIRST_ACTION_REQUIRED: 'Corporation first action first', ACTION_TAKEN: 'After an action only «End turn»'
};
const LOG_TXT: Record<string, [string, string]> = {
  pass: ['پاس داد', 'passed'], endTurn: ['نوبتش را تمام کرد', 'ended the turn'], convertPlants: ['گیاه را فضای سبز کرد', 'converted plants'], convertHeat: ['گرما را به دما تبدیل کرد', 'converted heat'],
  firstAction: ['کنش اول شرکت', 'corporation first action'], play: ['بازی کرد', 'played'], cardAction: ['کنش کارت', 'used'], project: ['پروژهٔ استاندارد', 'standard project'],
  milestone: ['نقطهٔ عطف ثبت کرد', 'claimed a milestone'], award: ['جایزه تأمین کرد', 'funded an award']
};
const reasonOf = (code: string | undefined, en: boolean) => (code ? (en ? REASON_EN : REASON)[code] ?? code : '');
const cardName = (id: string, en: boolean) => (en ? CARD[id]?.name : CARD[id]?.nameFa) ?? id;
const cardLabel = (c: CardDef, reason?: string, en = false) => en
  ? `${c.name}${c.kind !== 'corporation' ? `, cost ${c.cost}` : ''}${c.tags.length ? `, tags ${c.tags.join(' and ')}` : ''}${reason ? `. ${reason}` : ''}`
  : `${c.nameFa} (${c.name})${c.kind !== 'corporation' ? `، هزینه ${fa(c.cost)}` : ''}${c.tags.length ? `، نشان ${c.tags.map((t) => TAG_FA[t]).join(' و ')}` : ''}. ${c.textFa}${reason ? `. ${reason}` : ''}`;

// ---------------- local settings (per viewer; storage may be blocked) ----------------
function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(`tm.${key}`); return s === null ? init : (JSON.parse(s) as T); } catch { return init; }
  });
  return [v, (n: T) => { setV(n); try { localStorage.setItem(`tm.${key}`, JSON.stringify(n)); } catch { /* storage blocked */ } }];
}
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

// ---------------- cards (kit 1 pick, kit 2 zoom) ----------------
type Pick = 'selectable' | 'picked' | 'none';
function TmCard({ id, w, pick = 'none', reason, onPick, res, used, seat, hint, flip, en, lazy }: {
  id: string; w: number; pick?: Pick; reason?: string; onPick?: () => void; res?: number; used?: boolean; seat?: number; hint?: boolean;
  flip?: { from?: string; exit?: string }; en: boolean; lazy?: boolean;
}) {
  const c = CARD[id];
  if (!c) return null;
  const src = cardArt(id);
  const style = { '--cw': `${w}px` } as CSSProperties;
  const body = (
    <>
      {src ? <img src={src} alt="" loading={lazy ? 'lazy' : undefined} decoding="async" draggable={false} />
        : <span className="tm-ph tm-ph--card">{cardName(id, en)}</span>}
      {pick === 'picked' && <span className="tm-check" aria-hidden="true">✓</span>}
      {res !== undefined && res > 0 && c.resource && <span className="tm-cres" title={CARDRES_FA[c.resource]}><img className="tm-ic" src={CRES_ICON(c.resource)} alt="" />{num(res, en)}</span>}
      {used && seat !== undefined && <img className="tm-cused" src={cubeArt(seat)} alt="" />}
      <span className="tm-zoom" aria-hidden="true">
        {src && <img src={src} alt="" loading="lazy" />}
        <b>{cardName(id, en)}</b>{reason && <small>{reason}</small>}
      </span>
    </>
  );
  const cls = `tm-card${hint ? ' tm-hint' : ''}`;
  const common = {
    className: cls, style, 'data-id': id, 'data-pick': pick, title: reason || undefined,
    ...(flip ? { 'data-flip': `card-${id}`, 'data-flip-from': flip.from, 'data-flip-exit': flip.exit } : {})
  };
  const esc = (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur(); };
  return onPick || reason
    ? <button type="button" {...common} aria-pressed={pick === 'picked'} aria-disabled={!onPick || undefined} aria-label={cardLabel(c, reason, en)}
      onKeyDown={esc} onClick={onPick}>{body}</button>
    : <div {...common} tabIndex={0} role="img" aria-label={cardLabel(c, undefined, en)} onKeyDown={esc}>{body}</div>;
}

// ---------------- the Tharsis board (§3) ----------------
const CROP = LAYOUT.marsBoard.crop;
const WIN = LAYOUT.marsBoard.windowWidthPct;
const pos = (x: number, y: number, w?: number, h?: number): CSSProperties => ({
  left: `${((x - CROP.x) / CROP.w) * 100}%`, top: `${((y - CROP.y) / CROP.h) * 100}%`,
  ...(w !== undefined ? { width: `${w}%` } : {}), ...(h !== undefined ? { height: `${h}%` } : {})
});
const CENTRES = LAYOUT.marsBoard.hexes.centres as unknown as Record<string, [number, number]>;
const R = LAYOUT.marsBoard.hexes.radius;
const hexPts = (x: number, y: number) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`;
}).join(' ');
/** Phone auto-zoom (§9.4): scale/translate that frames every legal space with ~10 % margin, never past the board edge.
 *  Fractions of the board window; applied as `scale(s) translate(tx, ty)` with transform-origin 0 0. */
function autoZoom(ids: Iterable<string>): { s: number; tx: number; ty: number } | null {
  const pts = [...ids].map((id) => CENTRES[id]).filter((c): c is [number, number] => !!c).map(([x, y]) => [(x - CROP.x) / CROP.w, (y - CROP.y) / CROP.h] as const);
  if (!pts.length) return null;
  const padX = R / CROP.w, padY = R / CROP.h;
  const x0 = Math.min(...pts.map((q) => q[0])) - padX, x1 = Math.max(...pts.map((q) => q[0])) + padX;
  const y0 = Math.min(...pts.map((q) => q[1])) - padY, y1 = Math.max(...pts.map((q) => q[1])) + padY;
  const s = Math.min(3, Math.max(1, Math.min(1 / ((x1 - x0) * 1.1), 1 / ((y1 - y0) * 1.1))));
  const clamp = (v: number) => Math.min(0, Math.max(1 / s - 1, v));
  return { s, tx: clamp(0.5 / s - (x0 + x1) / 2), ty: clamp(0.5 / s - (y0 + y1) / 2) };
}
const tileArt = (t: { kind: string; card?: string }) => art(t.card && MAP.specialTiles![t.card] ? MAP.specialTiles![t.card] : MAP.tiles![t.kind]);

interface BoardProps {
  view: TmView; en: boolean; seatName: (k: number) => string;
  picks: Set<string>; picked: string | null; onSpace: (id: string) => void; hint: string | null;
  boardAct: (key: string) => { ok: boolean; reason?: string; hint?: boolean; avail?: boolean; go: () => void };
}
function Board({ view, en, seatName, picks, picked, onSpace, hint, boardAct }: BoardProps) {
  const fresh = useFresh(Object.keys(view.tiles).sort());
  const L = LAYOUT.marsBoard;
  const temp = (L.temperature.cells as unknown as Record<string, [number, number]>)[String(view.temperature)];
  const oxy = (L.oxygen.cells as unknown as Record<string, [number, number]>)[String(view.oxygen)];
  const spaceLabel = (id: string) => {
    const s = SPACE[id]!, t = view.tiles[id];
    return `${s.name ? `${NAME_FA[s.name]}، ` : ''}ناحیهٔ ${fa(Number(id))}${s.ocean ? ' (اقیانوسی)' : ''}${t ? `، ${t.card ? cardName(t.card, false) : TILE_FA[t.kind]}${t.owner !== null ? ` از ${seatName(t.owner)}` : ''}` : ''}`;
  };
  return (
    <div className="tm-board" dir="ltr" data-tm-board="mars" role="group" aria-label="صفحهٔ تارسیس">
      <img className="tm-base" src={art(L.image)} width={L.w} height={L.h} alt="" draggable={false} decoding="async" />
      {Object.entries(view.tiles).map(([id, t]) => {
        const c = CENTRES[id];
        if (!c) return null;
        const src = tileArt(t);
        return (
          <span key={id} className={`tm-at tm-tilebox${fresh.has(id) ? ' bg-pop' : ''}`} style={pos(c[0], c[1], WIN.tile)} data-tm-piece={t.card && MAP.specialTiles![t.card] ? 'special' : t.kind} data-space={id} title={spaceLabel(id)}>
            {src ? <img className="tm-tile" src={src} alt="" /> : <span className="tm-ph tm-ph--hex">{t.card ? cardName(t.card, en) : TILE_FA[t.kind]}</span>}
            {t.owner !== null && <img className="tm-owner" src={cubeArt(t.owner)} alt="" />}
          </span>
        );
      })}
      {Object.entries(view.claims).map(([id, k]) => { const c = CENTRES[id]; return c ? <img key={`c${id}`} className="tm-at tm-cube" style={pos(c[0], c[1], WIN.ownerCube)} src={cubeArt(k)} alt="" title={`ادعای زمین ${seatName(k)}`} /> : null; })}
      {temp && <img className="tm-at tm-cube tm-cube--track" style={pos(temp[0], temp[1], WIN.trackCube)} src={WHITE} alt="" />}
      {oxy && <img className="tm-at tm-cube tm-cube--track" style={pos(oxy[0], oxy[1], WIN.trackCube)} src={WHITE} alt="" />}
      <span className="tm-boardplate tm-boardplate--start" data-flip-anchor="deck"><img className="tm-ic" src={art(MAP.cardBack)} alt="" />{en ? `Deck ${view.deck}` : `دسته ${fa(view.deck)}`}<span className="bgv-sep" />{en ? `Discard ${view.discard}` : `دورریز ${fa(view.discard)}`}</span>
      <span className="tm-boardplate tm-boardplate--end"><img className="tm-ic" src={icon('generation')} alt="" />{en ? `Generation ${view.generation}` : `نسل ${fa(view.generation)}`}</span>
      {(L.standardProjects.ids as Project[]).map((pr, i) => {
        const [x, y] = L.standardProjects.centres[i] as [number, number];
        const a = boardAct(`project:${pr}`);
        return <button key={pr} type="button" className={`tm-spbtn${a.avail ? ' is-avail' : ''}${a.hint ? ' tm-hint' : ''}`} style={pos(x, y, WIN.standardProjectButton[0], WIN.standardProjectButton[1])}
          data-tm-action={`sp-${pr}`} data-act={`project-${pr}`} disabled={!a.ok} title={a.reason} aria-label={`${PROJECT_FA[pr]}${pr !== 'sellPatents' ? `، ${fa(PROJECTS[pr])} مگاکردیت` : ''}${a.reason ? `، ${a.reason}` : ''}`} onClick={a.go} />;
      })}
      {MILESTONES.map((m, i) => {
        const [x, y] = L.milestones.iconCentres[i] as [number, number];
        const t = view.milestones.find((z) => z.id === m.id);
        const a = boardAct(`milestone:${m.id}`);
        return <span key={m.id}>
          <button type="button" className={`tm-mabtn${a.avail ? ' is-avail' : ''}${a.hint ? ' tm-hint' : ''}`} style={pos(x, y + L.milestones.button.centreDy, WIN.plaqueButton[0], WIN.plaqueButton[1])}
            data-tm-action={`milestone-${m.id}`} disabled={!a.ok} title={a.reason}
            aria-label={`نقطهٔ عطف ${m.nameFa}: ${m.textFa}، ${fa(MILESTONE_COST)} مگاکردیت${t ? `، ثبت‌شده برای ${seatName(t.seat)}` : a.reason ? `، ${a.reason}` : ''}`} onClick={a.go} />
          {t && <img className="tm-at tm-cube tm-cube--plaque" style={pos(x, y, WIN.plaqueCube)} src={cubeArt(t.seat)} alt="" />}
        </span>;
      })}
      {AWARDS.map((aw, i) => {
        const [x, y] = L.awards.iconCentres[i] as [number, number];
        const t = view.awards.find((z) => z.id === aw.id);
        const a = boardAct(`award:${aw.id}`);
        const next = view.awards.length < 3 ? AWARD_COSTS[view.awards.length]! : null;
        return <span key={aw.id}>
          <button type="button" className={`tm-mabtn${a.avail ? ' is-avail' : ''}${a.hint ? ' tm-hint' : ''}`} style={pos(x, y + L.awards.button.centreDy, WIN.plaqueButton[0], WIN.plaqueButton[1])}
            data-tm-action={`award-${aw.id}`} disabled={!a.ok} title={a.reason}
            aria-label={`جایزهٔ ${aw.nameFa}: ${aw.textFa}${t ? `، تأمین‌شده توسط ${seatName(t.seat)}` : next !== null ? `، هزینهٔ بعدی ${fa(next)} مگاکردیت` : ''}${!t && a.reason ? `، ${a.reason}` : ''}`} onClick={a.go} />
          {t && <img className="tm-at tm-cube tm-cube--plaque" style={pos(x, y, WIN.plaqueCube)} src={cubeArt(t.seat)} alt="" />}
        </span>;
      })}
      {picks.size > 0 && <svg className="tm-picks" viewBox={`${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}`} aria-hidden="true">
        {[...picks].map((id) => { const c = CENTRES[id]; return c ? <polygon key={id} className={`tm-hex${picked === id ? ' tm-hex--picked' : ''}`} points={hexPts(c[0], c[1])} /> : null; })}
      </svg>}
      {[...picks].map((id) => {
        const c = CENTRES[id];
        if (!c) return null;
        const s = SPACE[id]!;
        return <span key={`p${id}`}>
          <button type="button" className={`tm-hexbtn tm-hex--pick${hint === id ? ' tm-hint' : ''}`} style={pos(c[0], c[1], WIN.hexButton[0], WIN.hexButton[1])} data-space={id}
            aria-pressed={picked === id} aria-label={`${spaceLabel(id)}${s.bonus.length ? `، پاداش ${s.bonus.map((b) => ({ steel: 'فولاد', titanium: 'تیتانیوم', plants: 'گیاه', card: 'کارت' })[b]).join(' و ')}` : ''}`}
            onClick={() => onSpace(id)} />
          {picked === id && <span className="tm-check tm-at" style={pos(c[0], c[1])} aria-hidden="true">✓</span>}
          {s.bonus.length > 0 && <span className="tm-bonus" style={pos(c[0], c[1] + R * 0.55)} aria-hidden="true">{s.bonus.map((b, i) => <img key={i} className="tm-ic" src={BONUS_ICON[b]} alt="" />)}</span>}
        </span>;
      })}
    </div>
  );
}

// ---------------- dashboards (rail §2) ----------------
function Dashboard({ view, en, zoom, setZoom, help, setHelp, settings }: { view: TmView; en: boolean; zoom: number; setZoom: (z: number) => void; help: boolean; setHelp: (b: boolean) => void; settings: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pT = usePop(view.temperature), pO = usePop(view.oxygen), pW = usePop(view.oceans);
  return (
    <section className="tm-dash" aria-label="پارامترهای جهانی">
      <div className="tm-dash__tools">
        <span className="bgv-row">
          <Button size="sm" variant="secondary" className="tm-zoombtn" aria-label="کوچک‌تر" disabled={zoom <= 0.8} onClick={() => setZoom(Math.round((zoom - 0.1) * 10) / 10)}>−</Button>
          <Button size="sm" variant="secondary" className="tm-zoombtn" aria-label="بزرگ‌تر" disabled={zoom >= 1.4} onClick={() => setZoom(Math.round((zoom + 0.1) * 10) / 10)}>+</Button>
        </span>
        <span className="bgv-row">
          <Button size="sm" variant="ghost" icon="book" aria-pressed={help} onClick={() => setHelp(!help)}>راهنما</Button>
          <Button size="sm" variant="ghost" icon="settings" aria-expanded={open} onClick={() => setOpen(!open)}>تنظیمات</Button>
        </span>
      </div>
      {open && <div className="tm-dash__settings">{settings}</div>}
      <div className="tm-dash__params">
        <span className="tm-param" role="meter" aria-label="اکسیژن" aria-valuemin={0} aria-valuemax={OXY_MAX} aria-valuenow={view.oxygen}><img className="tm-ic" src={icon('oxygen')} alt="" /><b key={view.oxygen} className={`tm-num ${pO}`}>{num(view.oxygen, en)}٪</b></span>
        <span className="tm-param" role="meter" aria-label="دما" aria-valuemin={-30} aria-valuemax={TEMP_MAX} aria-valuenow={view.temperature}><img className="tm-ic" src={icon('temperature')} alt="" /><b key={view.temperature} className={`tm-num ${pT}`}>{signed(view.temperature, en)}°C</b></span>
        <span className="tm-param" role="meter" aria-label="اقیانوس" aria-valuemin={0} aria-valuemax={OCEANS_MAX} aria-valuenow={view.oceans}><img className="tm-ic" src={icon('ocean')} alt="" /><b key={view.oceans} className={pW}>{num(view.oceans, en)}</b></span>
        <span className="tm-param" aria-label="نسل"><img className="tm-ic" src={icon('generation')} alt="" /><b>{num(view.generation, en)}</b></span>
      </div>
    </section>
  );
}

/** Panel body shared by the shell rail (tmSeatCard) and the renderer's own rail outside the shell. */
function PanelBody({ d, en, rail }: { d: TmDetail; en: boolean; rail?: boolean }) {
  return (
    <div className="tm-panel">
      <div className="tm-panel__row">
        <span className="tm-tr" style={{ backgroundImage: `url(${icon('tr')})` }} title={en ? 'Terraform rating' : 'رتبهٔ زمین‌سازی'}><b>{num(d.tr, en)}</b></span>
        <span className="tm-handn" title={en ? 'Cards in hand' : 'کارت در دست'}><img className="tm-ic" src={art(MAP.cardBack)} alt="" />{num(d.hand, en)}</span>
        {!rail && d.firstPlayer && <img className="tm-fp" src={art(MAP.firstPlayer)} alt={en ? 'First player' : 'نفر اول'} title={en ? 'First player' : 'نفر اول'} />}
        {d.corp && <span className="tm-logo">{art(MAP.corpLogos![d.corp]) ? <img src={art(MAP.corpLogos![d.corp])} alt={cardName(d.corp, en)} /> : <span className="tm-ph">{cardName(d.corp, en)}</span>}</span>}
      </div>
      <div className="tm-panel__res">
        {RES.map((r) => <span key={r} className="tm-r" title={en ? RES_EN[r] : RES_FA[r]}>
          <span className="tm-r__ic"><img className="tm-ic" src={RES_ICON[r]} alt="" /><b>{num(d.res[r], en)}</b></span>
          <span className={`tm-prodv${d.prod[r] < 0 ? ' is-neg' : ''}`}>{signed(d.prod[r], en)}</span>
        </span>)}
      </div>
      <Tags tags={d.tags} cities={d.cities} greeneries={d.greeneries} en={en} />
    </div>
  );
}
function Tags({ tags, cities, greeneries, en }: { tags: Record<string, number>; cities: number; greeneries: number; en: boolean }) {
  return (
    <div className="tm-tags" aria-label={en ? 'Tags and tiles' : 'نشان‌ها و کاشی‌ها'}>
      {TAGS_ORDER.map((t) => <span key={t} className={`tm-tagc${tags[t] ? '' : ' is-zero'}`} title={en ? TAG_EN[t] : TAG_FA[t]}><img src={tagArt(t)} alt="" /><b>{num(tags[t] ?? 0, en)}</b></span>)}
      <span className={`tm-tagc tm-tagc--hex${cities ? '' : ' is-zero'}`} title={en ? 'Cities' : 'شهر'}><img src={icon('city')} alt="" /><b>{num(cities, en)}</b></span>
      <span className={`tm-tagc tm-tagc--hex${greeneries ? '' : ' is-zero'}`} title={en ? 'Greeneries' : 'فضای سبز'}><img src={icon('greenery')} alt="" /><b>{num(greeneries, en)}</b></span>
    </div>
  );
}

/** Rail panel in the table shell (apps/web SEAT_CARDS): score circle + panel body from publicSummary `detail`. */
export function tmSeatCard(seat: { primary?: { value: number }; status?: string; detail?: unknown; turnOrder?: number }, _turn: boolean) {
  const d = seat.detail as TmDetail | undefined;
  if (!d) return {};
  const fp = d.firstPlayer ? <img className="tm-fp" src={art(MAP.firstPlayer)} alt="نفر اول" title="نفر اول" /> : null;
  const tr = <span className="tm-tr" style={{ backgroundImage: `url(${icon('tr')})` }} title="رتبهٔ زمین‌سازی"><b>{fa(d.tr)}</b></span>;
  // Simultaneous phases (generation 1, draft, research): compact panel, name + TR plate + «در حال انتخاب» / «آماده ✓».
  if (d.phase === 'corp' || d.phase === 'draft' || d.phase === 'research') {
    return {
      stats: undefined, badge: undefined, scoreLabel: undefined, clock: undefined, detail: undefined,
      score: <span className="tm tm-side">{fp}{tr}</span>,
      ...(d.ready ? { done: 'آماده ✓', waiting: undefined } : { done: undefined, waiting: 'در حال انتخاب' })
    };
  }
  return {
    stats: undefined, badge: undefined, scoreLabel: undefined,
    score: <span className="tm tm-side" data-score={d.score}>{fp}<span className="tm-score" title="امتیاز فعلی"><b>{fa(d.score)}</b><small>امتیاز</small></span></span>,
    ...(d.actionsTaken !== null ? { sub: `کنش ${fa(d.actionsTaken + 1)} از ۲` } : seat.status === 'passed' ? { sub: 'پاس داده' } : {}),
    detail: <div className="tm tm-pdetail"><PanelBody d={d} en={false} rail /></div>
  };
}

/** The same panel body from the view (renderer's own rail outside the table shell). */
function detailOf(view: TmView, k: number): TmDetail {
  const p = view.players[k]!;
  const cards = [...(p.corp ? [p.corp] : []), ...p.played].map((id) => CARD[id]!).filter(Boolean);
  const tags: Record<string, number> = { event: cards.filter((c) => c.kind === 'event').length };
  for (const c of cards) if (c.kind !== 'event') for (const t of c.tags) tags[t] = (tags[t] ?? 0) + 1;
  const tiles = Object.values(view.tiles);
  return {
    corp: p.corp, tr: p.tr, score: p.score.total, hand: p.hand, res: p.res, prod: p.prod, tags: tags as TmDetail['tags'],
    cities: tiles.filter((t) => t.kind === 'city' && t.owner === k).length, greeneries: tiles.filter((t) => t.kind === 'greenery' && t.owner === k).length,
    firstPlayer: view.firstPlayer === k, actionsTaken: view.phase === 'action' && view.current === k && !view.outcome ? view.actionsTaken : null, phase: view.phase, ready: p.ready
  };
}

// ---------------- player areas (§5) ----------------
type SecId = 'hq' | 'automated' | 'effects' | 'actions' | 'events';
const SECS: { id: SecId; fa: string; en: string; tone: string; band: number; w: number }[] = [
  { id: 'hq', fa: 'ستاد', en: 'Headquarters', tone: 'grey', band: 1, w: 218 },
  { id: 'automated', fa: 'خودکار', en: 'Automated', tone: 'green', band: 0.19, w: 150 },
  { id: 'effects', fa: 'اثرها', en: 'Effects', tone: 'blue', band: 0.46, w: 150 },
  { id: 'actions', fa: 'کنش‌ها', en: 'Actions', tone: 'blue', band: 0.46, w: 150 },
  { id: 'events', fa: 'رویدادها', en: 'Events', tone: 'red', band: 0.13, w: 150 }
];
const secOf = (c: CardDef): SecId => (c.kind === 'corporation' ? 'hq' : c.kind === 'event' ? 'events' : c.kind === 'automated' ? 'automated' : c.action ? 'actions' : 'effects');

function PlayerArea({ view, k, me, en, seatName, cardPick, convert }: {
  view: TmView; k: number; me: boolean; en: boolean; seatName: (k: number) => string;
  cardPick: (id: string) => { pick: Pick; reason?: string; go?: () => void; hint?: boolean };
  convert: (r: 'plants' | 'heat') => (() => void) | undefined;
}) {
  const p = view.players[k]!;
  const d = detailOf(view, k);
  const popTr = usePop(p.tr);
  const [modes, setModes] = useLocal<Record<string, 'grid' | 'stack'>>('secmode', {});
  const [closed, setClosed] = useLocal<Record<string, boolean>>('secclosed', { events: true });
  const cards = [...(p.corp ? [p.corp] : []), ...p.played];
  return (
    <article className={`tm-player tm-seat-${k}${me ? ' is-you' : ''}`} data-seat={k} data-flip-anchor={`seat-${k}`} style={{ '--pc': `var(--tm-${colorOf(k)})`, '--seat-c': `var(--tm-${colorOf(k)})` } as CSSProperties}
      aria-label={en ? `Area of ${seatName(k)}` : `محوطهٔ ${seatName(k)}`}>
      <header className="tm-ahead">
        <span className="tm-ahead__name" style={{ color: `var(--tm-${colorOf(k)}-ink)` }}><bdi>{seatName(k)}</bdi>{me && <small>{en ? 'you' : 'شما'}</small>}{p.passed && view.phase === 'action' && <small>{en ? 'passed' : 'پاس داده'}</small>}</span>
        {p.corp && <span className="tm-logo">{art(MAP.corpLogos![p.corp]) ? <img src={art(MAP.corpLogos![p.corp])} alt={cardName(p.corp, en)} /> : <span className="tm-ph">{cardName(p.corp, en)}</span>}</span>}
        <span className="tm-score" title={`رتبه ${fa(p.score.tr)} + نقطهٔ عطف ${fa(p.score.milestones)} + جایزه ${fa(p.score.awards)} + فضای سبز ${fa(p.score.greenery)} + شهر ${fa(p.score.city)} + کارت ${fa(p.score.cards)}`}><b>{num(p.score.total, en)}</b><small>{en ? 'VP' : 'امتیاز'}</small></span>
        <span key={p.tr} className={`tm-tr ${popTr}`} style={{ backgroundImage: `url(${icon('tr')})` }} title={en ? 'Terraform rating' : 'رتبهٔ زمین‌سازی'}><b>{num(p.tr, en)}</b></span>
        <span className="tm-handn" title={en ? 'Cards in hand' : 'کارت در دست'}><img className="tm-ic" src={art(MAP.cardBack)} alt="" />{num(p.hand, en)}</span>
        <div className="tm-ahead__res">
          {RES.map((r) => {
            const go = me && (r === 'plants' || r === 'heat') ? convert(r) : undefined;
            const inner = <><img className="tm-ic" src={RES_ICON[r]} alt="" /><span className="tm-rs__nums"><b>{num(p.res[r], en)}</b><span className={`tm-prodv${p.prod[r] < 0 ? ' is-neg' : ''}`}>{signed(p.prod[r], en)}</span></span></>;
            const label = en ? `${RES_EN[r]}: ${p.res[r]}, production ${signed(p.prod[r], true)}` : `${RES_FA[r]}: ${fa(p.res[r])}، تولید ${signed(p.prod[r], false)}`;
            return go ? <button key={r} type="button" className="tm-rs is-avail" aria-label={`${label}؛ ${r === 'plants' ? (en ? 'convert to greenery' : 'تبدیل به فضای سبز') : (en ? 'convert to temperature' : 'تبدیل به دما')}`} data-act={r === 'plants' ? 'convertPlants' : 'convertHeat'} onClick={go}>{inner}</button>
              : <span key={r} className="tm-rs" title={label}>{inner}</span>;
          })}
        </div>
        <div className="tm-ahead__tags"><Tags tags={d.tags} cities={d.cities} greeneries={d.greeneries} en={en} /></div>
      </header>
      <div className="tm-secs">
        {SECS.map((sec) => {
          const ids = cards.filter((id) => CARD[id] && secOf(CARD[id]!) === sec.id);
          // A section holding a card the viewer can pick right now opens by itself (card decisions, available actions).
          const isClosed = (closed[sec.id] ?? false) && !ids.some((id) => cardPick(id).pick !== 'none');
          const mode = modes[sec.id] ?? (sec.id === 'hq' ? 'grid' : 'stack');
          return (
            <section key={sec.id} className={`tm-sec tm-sec--${sec.tone}${isClosed ? ' is-closed' : ''}`} data-tm-section={sec.id} style={{ '--cw': `${sec.w}px`, '--band': sec.band } as CSSProperties}>
              <div className="tm-sec__head">
                <button type="button" className="tm-sec__toggle" aria-expanded={!isClosed} onClick={() => setClosed({ ...closed, [sec.id]: !isClosed })}>
                  <span className="tm-sec__n">{num(ids.length, en)}</span>
                  <span className="tm-sec__t"><b>{en ? sec.en : sec.fa}</b><small>{mode === 'grid' ? (en ? 'grid' : 'شبکه') : (en ? 'stack' : 'دسته')}</small></span>
                </button>
                <button type="button" className="tm-sec__menu" aria-label={mode === 'grid' ? (en ? 'Show as stack' : 'نمایش دسته') : (en ? 'Show as grid' : 'نمایش شبکه')} onClick={() => setModes({ ...modes, [sec.id]: mode === 'grid' ? 'stack' : 'grid' })}>≡</button>
              </div>
              {!isClosed && ids.length > 0 && (
                <div className={`tm-sec__body ${mode === 'grid' ? 'tm-grid' : `tm-stack tm-stack--${sec.tone}`}`}>
                  {ids.map((id) => {
                    const cp = cardPick(id);
                    return <TmCard key={id} id={id} w={sec.w} en={en} lazy res={p.cardRes[id]} used={p.used.includes(id)} seat={k} pick={cp.pick} reason={cp.reason} onPick={cp.go} hint={cp.hint} flip={{ from: `seat-${k}` }} />;
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

// ---------------- the turn draft (§6.9, §7) ----------------
type Flow =
  | { t: 'play'; card: string } | { t: 'cardAction'; card: string } | { t: 'project'; project: Project } | { t: 'sell'; cards: string[] }
  | { t: 'milestone'; id: string } | { t: 'award'; id: string } | { t: 'convertPlants' } | { t: 'convertHeat' } | { t: 'firstAction' } | { t: 'pass' };
type Pay = { mc: number; steel: number; titanium: number; heat: number };
type Hint = GameAction & { cost?: number; steel?: boolean; titanium?: boolean; pay?: Pay | null; card?: string; project?: string; id?: string };
const same = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b);

export default function TerraformingMarsRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<TmView>) {
  const root = useRef<HTMLDivElement>(null);
  const view = previewView(served, queued ?? null, mySeat);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const phone = usePhone();
  const [lang, setLang] = useLocal<'fa' | 'en'>('lang', 'fa');
  const en = lang === 'en';
  const t = (f: string, e: string) => (en ? e : f);
  const tx = t;
  const reasonText = (c: string | undefined) => reasonOf(c, en);
  const [floating, setFloating] = useLocal('floatingHand', false);
  const [zoom, setZoom] = useLocal('zoom', 1);
  const [help, setHelp] = useLocal('help', true);
  const [tab, setTab] = useState<'mars' | 'hand' | 'players'>(() => (served.phase === 'corp' || served.phase === 'draft' || served.phase === 'research' ? 'hand' : 'mars'));
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState<null | 'projects' | 'milestones' | 'awards'>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [pay, setPay] = useState<Pay>({ mc: 0, steel: 0, titanium: 0, heat: 0 });
  const [sel, setSel] = useState<string[]>([]);
  const [corp, setCorp] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | number | null>(null);
  const [amount, setAmount] = useState(0);
  const [playersTab, setPlayersTab] = useState<number | null>(null);
  const [whole, setWhole] = useState(false);
  const prompt = view.prompt;
  useEffect(() => {
    setFlow(null); setSel([]); setCorp(null); setAnswer(null); setMenu(null); setSheet(false); setWhole(false);
    setAmount(prompt?.kind === 'amount' ? prompt.min : 0);
  }, [served.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phones: a space decision opens the Mars tab; a cards decision the hand tab.
  useEffect(() => {
    if (prompt?.kind === 'space') setTab('mars');
    if (prompt?.kind === 'card') { setTab('players'); setPlayersTab(mySeat); }
  }, [prompt?.kind, served.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (served.phase === 'corp' || served.phase === 'draft' || served.phase === 'research') setTab('hand');
    else setTab((x) => (x === 'hand' ? 'mars' : x));
  }, [served.phase]);
  // Tutorial on phones: open the tab that holds the highlighted piece.
  useEffect(() => {
    const h = expected as { type?: string } | null;
    if (!phone || !h?.type) return;
    if (h.type === 'play') setTab('hand');
    else if (h.type === 'project' || h.type === 'milestone' || h.type === 'award' || h.type === 'respond') setTab('mars');
    else if (h.type === 'cardAction') setTab('players');
  }, [phone, JSON.stringify(expected)]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = view.me;
  const meP = mySeat !== null ? view.players[mySeat] : undefined;
  const hint = expected as Hint | null;
  const isHint = (a: Record<string, unknown>) => !!hint && same(a, hint as Record<string, unknown>);
  const find = (pred: (a: Hint) => boolean) => (legalActions as Hint[]).find(pred);
  const has = (t: string) => find((a) => a.type === t);
  const respond = has('respond') as (Hint & { options: (string | number)[]; optional: boolean }) | undefined;
  const corpHint = has('corp') as (Hint & { corps: string[]; cards: string[] }) | undefined;
  const research = has('research') as (Hint & { cards: string[]; max: number }) | undefined;
  const draft = has('draft') as (Hint & { cards: string[] }) | undefined;
  const actionTurn = !prompt && !busy && (view.phase === 'action' || view.phase === 'final') && legalActions.some((a) => a.type !== 'resign' && a.type !== 'respond');
  const blocked = me?.blocked ?? {};
  const plays = legalActions.filter((a) => a.type === 'play') as Hint[];
  const cardActs = legalActions.filter((a) => a.type === 'cardAction') as Hint[];
  const send = (a: GameAction) => { setFlow(null); setSel([]); setCorp(null); setAnswer(null); setMenu(null); setSheet(false); onAction(a); };

  // ----- the action being drafted -----
  const hintFor = (f: Flow): Hint | undefined => {
    switch (f.t) {
      case 'play': return find((a) => a.type === 'play' && a.card === f.card);
      case 'cardAction': return find((a) => a.type === 'cardAction' && a.card === f.card);
      case 'project': return find((a) => a.type === 'project' && a.project === f.project);
      case 'sell': return find((a) => a.type === 'project' && a.project === 'sellPatents');
      case 'milestone': return find((a) => a.type === 'milestone' && a.id === f.id);
      case 'award': return find((a) => a.type === 'award' && a.id === f.id);
      default: return has(f.t);
    }
  };
  const start = (f: Flow) => {
    const h = hintFor(f);
    if (!h || busy) return;
    setMenu(null); setSheet(false); setSel([]);
    setPay(h.pay ?? { mc: 0, steel: 0, titanium: 0, heat: 0 });
    setFlow(f);
  };
  const fh = flow ? hintFor(flow) : undefined;
  const cost = (fh?.cost as number | undefined) ?? 0;
  const vals = me?.values ?? { steel: 2, titanium: 3, heat: false };
  const payRows = fh && cost > 0 && meP ? [
    ...(fh.steel ? [{ r: 'steel' as const, v: vals.steel, max: meP.res.steel }] : []),
    ...(fh.titanium ? [{ r: 'titanium' as const, v: vals.titanium, max: meP.res.titanium }] : []),
    ...(vals.heat ? [{ r: 'heat' as const, v: 1, max: meP.res.heat }] : [])
  ] : [];
  const other = pay.steel * vals.steel + pay.titanium * vals.titanium + pay.heat;
  const mcPay = Math.max(0, cost - other);
  const over = Math.max(0, pay.steel * vals.steel + pay.titanium * vals.titanium - cost);
  const payOk = !!meP && mcPay <= meP.res.mc && mcPay + pay.heat <= cost;
  /** The action to send; `pay` only when it differs from the engine's default (the engine then pays the same way). */
  const built = (): GameAction | null => {
    if (!flow) return null;
    const p = { mc: mcPay, steel: pay.steel, titanium: pay.titanium, heat: pay.heat };
    const withPay = <T extends GameAction>(a: T) => (fh?.pay && same(p, fh.pay) ? a : { ...a, pay: p });
    switch (flow.t) {
      case 'play': return withPay({ type: 'play', card: flow.card });
      case 'cardAction': return cost ? withPay({ type: 'cardAction', card: flow.card }) : { type: 'cardAction', card: flow.card };
      case 'project': return withPay({ type: 'project', project: flow.project });
      case 'sell': return flow.cards.length ? { type: 'project', project: 'sellPatents', cards: flow.cards } : null;
      case 'milestone': return withPay({ type: 'milestone', id: flow.id });
      case 'award': return withPay({ type: 'award', id: flow.id });
      default: return { type: flow.t };
    }
  };
  const action = built();
  const canConfirm = !!action && !busy && (payRows.length === 0 || payOk) && (flow?.t !== 'sell' || flow.cards.length > 0);

  // ----- what can be picked where -----
  const handPick = (id: string): { pick: Pick; reason?: string; go?: () => void; hint?: boolean } => {
    if (flow?.t === 'sell') {
      const on = flow.cards.includes(id);
      return { pick: on ? 'picked' : 'selectable', go: () => setFlow({ t: 'sell', cards: on ? flow.cards.filter((x) => x !== id) : [...flow.cards, id] }) };
    }
    if (prompt?.kind === 'cards' && prompt.cards.includes(id)) return { pick: sel.includes(id) ? 'picked' : 'selectable', go: () => toggle(id, prompt.max) };
    const legal = plays.some((a) => a.card === id);
    if (flow?.t === 'play' && flow.card === id) return { pick: 'picked', go: () => setFlow(null) };
    if (legal && actionTurn && !flow) return { pick: 'selectable', go: () => start({ t: 'play', card: id }), hint: isHint({ type: 'play', card: id }) };
    const reason = view.phase === 'action' && mySeat !== null ? reasonText(blocked[`play:${id}`] ?? (actionTurn ? undefined : 'NOT_YOUR_TURN')) : undefined;
    return { pick: 'none', ...(reason ? { reason } : {}) };
  };
  const tableauPick = (id: string) => {
    if (prompt?.kind === 'card' && prompt.options.includes(id)) return { pick: (answer === id ? 'picked' : 'selectable') as Pick, go: () => setAnswer(id), hint: isHint({ type: 'respond', card: id }) };
    if (mySeat === null || !meP || ![meP.corp, ...meP.played].includes(id) || !CARD[id]?.action) return { pick: 'none' as Pick };
    if (flow?.t === 'cardAction' && flow.card === id) return { pick: 'picked' as Pick, go: () => setFlow(null) };
    if (actionTurn && !flow && cardActs.some((a) => a.card === id)) return { pick: 'selectable' as Pick, go: () => start({ t: 'cardAction', card: id }), hint: isHint({ type: 'cardAction', card: id }) };
    const r = reasonText(blocked[`cardAction:${id}`]);
    return { pick: 'none' as Pick, ...(r ? { reason: r } : {}) };
  };
  const toggle = (id: string, max = 99) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < max ? [...s, id] : s));
  const boardAct = (key: string) => {
    const [kind, id] = key.split(':') as [string, string];
    const f: Flow = kind === 'project' ? (id === 'sellPatents' ? { t: 'sell', cards: [] } : { t: 'project', project: id as Project }) : kind === 'milestone' ? { t: 'milestone', id } : { t: 'award', id };
    const ok = actionTurn && !flow && !!hintFor(f);
    const reason = ok ? undefined : reasonText(blocked[key] ?? (view.phase === 'action' && mySeat !== null && !actionTurn ? 'NOT_YOUR_TURN' : undefined));
    const h = kind === 'project' ? isHint({ type: 'project', project: id }) : isHint({ type: kind, id });
    return { ok, ...(reason ? { reason } : {}), hint: h && ok, avail: ok && kind !== 'project', go: () => start(f) };
  };
  const convert = (r: 'plants' | 'heat') => {
    const t = r === 'plants' ? 'convertPlants' : 'convertHeat';
    return actionTurn && !flow && has(t) ? () => start({ t }) : undefined;
  };
  const spacePick = new Set(prompt?.kind === 'space' && respond ? (respond.options as string[]) : []);

  // ----- texts -----
  const who = (k: number) => seatName(k);
  const actionNo = view.actionsTaken + 1;
  const flowText = (): ReactNode => {
    if (!flow) return null;
    const c = (n: number) => <span className="tm-costpill"><img className="tm-ic" src={RES_ICON.mc} alt="" />{num(n, en)}</span>;
    switch (flow.t) {
      case 'play': return <>{t('بازی', 'Play')} <b>{cardName(flow.card, en)}</b> {c(cost)}</>;
      case 'cardAction': return <>{t('کنش', 'Use')} <b>{cardName(flow.card, en)}</b>{cost ? <> {c(cost)}</> : null}</>;
      case 'project': return <>{t('پروژهٔ استاندارد', 'Standard project')} <b>{en ? PROJECT_EN[flow.project] : PROJECT_FA[flow.project]}</b> {c(cost)}<small> ({en ? PROJECT_FX_EN[flow.project] : PROJECT_FX[flow.project]})</small></>;
      case 'sell': return <>{t('فروش امتیاز اختراع: کارت‌های دست را انتخاب کنید؛', 'Sell patents: pick cards in your hand;')} <b>{en ? `sell ${flow.cards.length} = ${flow.cards.length} M€` : `فروش ${fa(flow.cards.length)} کارت = ${fa(flow.cards.length)} مگاکردیت`}</b></>;
      case 'milestone': return <>{t('ثبت نقطهٔ عطف', 'Claim milestone')} <b>{(en ? MILESTONES.find((m) => m.id === flow.id)?.name : MILESTONES.find((m) => m.id === flow.id)?.nameFa)}</b> {c(cost)}</>;
      case 'award': return <>{t('تأمین جایزهٔ', 'Fund award')} <b>{(en ? AWARDS.find((m) => m.id === flow.id)?.name : AWARDS.find((m) => m.id === flow.id)?.nameFa)}</b> {c(cost)}</>;
      case 'convertPlants': return <><b>{fa(me?.plantsPerGreenery ?? 8)}</b> <img className="tm-ic" src={RES_ICON.plants} alt="گیاه" /> ← <img className="tm-ic" src={icon('greenery')} alt="فضای سبز" />{t('؛ بعد از تأیید جای فضای سبز را انتخاب می‌کنید', '; after confirming, choose the greenery space')}</>;
      case 'convertHeat': return <><b>{fa(8)}</b> <img className="tm-ic" src={RES_ICON.heat} alt="گرما" /> ← <img className="tm-ic" src={icon('temperature')} alt="دما" />{t(': ۱ پلهٔ دما و ۱ رتبه', ': +1 temperature step and +1 TR')}</>;
      case 'firstAction': return <>{t('کنش اول', 'First action of')} <b>{meP?.corp ? cardName(meP.corp, en) : ''}</b></>;
      case 'pass': return <><b>{t('پاس تا آخر نسل؟', 'Pass for the rest of the generation?')}</b> {t('تا پایان این نسل کنش دیگری ندارید.', 'You take no more actions this generation.')}</>;
    }
  };
  const stepsOf = (): { label: string; state: 'done' | 'cur' | 'todo' }[] => {
    if (!flow) return [];
    const first = flow.t === 'play' || flow.t === 'cardAction' ? t('کارت', 'Card') : flow.t === 'project' || flow.t === 'sell' ? t('پروژه', 'Project') : flow.t === 'milestone' || flow.t === 'award' ? t('پلاک', 'Plaque') : t('کنش', 'Action');
    const xs: { label: string; state: 'done' | 'cur' | 'todo' }[] = [{ label: first, state: 'done' }];
    if (flow.t === 'sell') xs.push({ label: t('انتخاب کارت‌ها', 'Pick cards'), state: flow.cards.length ? 'done' : 'cur' });
    if (payRows.length) xs.push({ label: t('پرداخت', 'Payment'), state: 'done' });
    xs.push({ label: t('تأیید', 'Confirm'), state: 'cur' });
    return xs;
  };

  // ----- the action bar (desktop sticky; phone collapsed + sheet) -----
  const reasonAttr = (code: string | undefined) => (code ? { 'data-reason': code, title: reasonText(code) } : {});
  const goalProgress = (id: string, need?: number) => {
    const m = view.metrics[id];
    if (!m || mySeat === null) return '';
    if (en) return need !== undefined ? `${m[mySeat] ?? 0} of ${need}` : `you ${m[mySeat] ?? 0}, best ${Math.max(...m)}`;
    return need !== undefined ? `${fa(m[mySeat] ?? 0)} از ${fa(need)}` : `شما ${fa(m[mySeat] ?? 0)}، بیشترین ${fa(Math.max(...m))}`;
  };
  const actionButtons = (inSheet: boolean) => {
    const plants = has('convertPlants'), heat = has('convertHeat');
    const projects = (Object.keys(PROJECTS) as Project[]);
    const sub = (s: string) => (inSheet ? <small>{s}</small> : null);
    if (has('firstAction')) return <Button data-act="firstAction" className={isHint({ type: 'firstAction' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'firstAction' })}>{t('کنش اول', 'First action:')} {meP?.corp ? cardName(meP.corp, en) : ''}</Button>;
    if (view.phase === 'final') return <>
      <Button data-act="convertPlants" disabled={!plants} {...reasonAttr(plants ? undefined : 'CANNOT_CONVERT')} className={isHint({ type: 'convertPlants' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'convertPlants' })}>
        <span>{fa(me?.plantsPerGreenery ?? 8)} <img className="tm-ic" src={RES_ICON.plants} alt="گیاه" /> ← <img className="tm-ic" src={icon('greenery')} alt="فضای سبز" /></span>
      </Button>
      <Button variant="ghost" data-act="pass" className={isHint({ type: 'pass' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'pass' })}>{t('پاس (پایان)', 'Pass (end)')}</Button>
    </>;
    return <>
      <div className={inSheet ? 'tm-srow' : 'tm-bar__row'}>
        <Button variant="secondary" data-act="play" disabled={!plays.length} onClick={() => { if (plays.length === 1) start({ t: 'play', card: plays[0]!.card! }); else if (phone) { setSheet(false); setTab('hand'); } else root.current?.querySelector<HTMLElement>('.tm-hand [data-pick="selectable"]')?.focus(); }}>
          <span>{inSheet ? t('بازی کارت از دست', 'Play a card from hand') : t('بازی کارت', 'Play a card')}</span><span className="tm-costpill">{en ? `${plays.length} playable` : `${fa(plays.length)} قابل بازی`}</span>
        </Button>
        <Button variant="secondary" data-act="cardAction" disabled={!cardActs.length} onClick={() => { if (cardActs.length === 1) start({ t: 'cardAction', card: cardActs[0]!.card! }); else root.current?.querySelector<HTMLElement>('.tm-player.is-you [data-pick="selectable"]')?.focus(); }}>
          <span>{t('کنش کارت', 'Card action')}</span><span className="tm-costpill">{fa(cardActs.length)}</span>
        </Button>
        {!inSheet && <>
          <Button variant="secondary" aria-expanded={menu === 'projects'} onClick={() => setMenu(menu === 'projects' ? null : 'projects')}>{t('پروژهٔ استاندارد', 'Standard project')}</Button>
          <Button variant="secondary" aria-expanded={menu === 'milestones'} onClick={() => setMenu(menu === 'milestones' ? null : 'milestones')}>{t('نقطهٔ عطف', 'Claim milestone')} <span className="tm-costpill">{fa(MILESTONE_COST)}</span></Button>
          <Button variant="secondary" aria-expanded={menu === 'awards'} disabled={view.awards.length >= 3} onClick={() => setMenu(menu === 'awards' ? null : 'awards')}>{t('تأمین جایزه', 'Fund award')} {view.awards.length < 3 && <span className="tm-costpill">{fa(AWARD_COSTS[view.awards.length]!)}</span>}</Button>
        </>}
        <Button variant="secondary" data-act="convertHeat" disabled={!heat} {...reasonAttr(heat ? undefined : blocked.convertHeat)} className={isHint({ type: 'convertHeat' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'convertHeat' })}>
          <span>{fa(8)} <img className="tm-ic" src={RES_ICON.heat} alt="گرما" /> ← <img className="tm-ic" src={icon('temperature')} alt="دما" /></span>{sub(heat ? t('۱ پلهٔ دما و ۱ رتبه', '+1 temperature, +1 TR') : reasonText(blocked.convertHeat))}
        </Button>
        <Button variant="secondary" data-act="convertPlants" disabled={!plants} {...reasonAttr(plants ? undefined : blocked.convertPlants)} className={isHint({ type: 'convertPlants' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'convertPlants' })}>
          <span>{fa(me?.plantsPerGreenery ?? 8)} <img className="tm-ic" src={RES_ICON.plants} alt="گیاه" /> ← <img className="tm-ic" src={icon('greenery')} alt="فضای سبز" /></span>{sub(plants ? t('یک فضای سبز', 'One greenery') : en ? `${meP?.res.plants ?? 0} of ${me?.plantsPerGreenery ?? 8} plants` : `${fa(meP?.res.plants ?? 0)} از ${fa(me?.plantsPerGreenery ?? 8)} گیاه دارید`)}
        </Button>
      </div>
      {(inSheet || menu === 'projects') && <>
        {inSheet && <b className="tm-label">{t('پروژهٔ استاندارد', 'Standard projects')}</b>}
        <div className={inSheet ? 'tm-sgrid' : 'tm-bar__row'}>{projects.map((pr) => {
          const a = boardAct(`project:${pr}`);
          return <Button key={pr} variant="secondary" data-act={`project-${pr}`} disabled={!a.ok} {...reasonAttr(a.ok ? undefined : blocked[`project:${pr}`])} className={a.hint ? 'tm-hint' : ''} onClick={a.go}>
            <span>{en ? PROJECT_EN[pr] : PROJECT_FA[pr]}</span>{pr !== 'sellPatents' ? <span className="tm-costpill"><img className="tm-ic" src={RES_ICON.mc} alt="" />{fa(PROJECTS[pr])}</span> : sub(t('هر کارت ۱ مگاکردیت', '1 M€ per card'))}
            {inSheet && !a.ok && a.reason && <small>{a.reason}</small>}
          </Button>;
        })}</div>
      </>}
      {(inSheet || menu === 'milestones') && <>
        {inSheet && <b className="tm-label">{en ? `Milestones (${MILESTONE_COST} M€, 5 VP)` : `نقطهٔ عطف (${fa(MILESTONE_COST)} مگاکردیت، ۵ امتیاز)`}</b>}
        <div className={inSheet ? 'tm-sgrid' : 'tm-bar__row'}>{MILESTONES.map((m) => {
          const a = boardAct(`milestone:${m.id}`);
          const taken = view.milestones.find((x) => x.id === m.id);
          return <Button key={m.id} variant="secondary" data-act={`milestone-${m.id}`} disabled={!a.ok} {...reasonAttr(a.ok ? undefined : blocked[`milestone:${m.id}`])} className={a.hint ? 'tm-hint' : ''} onClick={a.go}>
            <span>{en ? m.name : m.nameFa}</span><small>{taken ? `${tx('ثبت شده', 'Claimed')}: ${who(taken.seat)}` : goalProgress(m.id, m.need)}</small>
          </Button>;
        })}</div>
      </>}
      {(inSheet || menu === 'awards') && view.awards.length < 3 && <>
        {inSheet && <b className="tm-label">{en ? `Awards (${AWARD_COSTS[view.awards.length]} M€; 5 and 2 VP)` : `جایزه (${fa(AWARD_COSTS[view.awards.length]!)} مگاکردیت؛ ۵ و ۲ امتیاز)`}</b>}
        <div className={inSheet ? 'tm-sgrid' : 'tm-bar__row'}>{AWARDS.map((aw) => {
          const a = boardAct(`award:${aw.id}`);
          const taken = view.awards.find((x) => x.id === aw.id);
          return <Button key={aw.id} variant="secondary" data-act={`award-${aw.id}`} disabled={!a.ok} {...reasonAttr(a.ok ? undefined : blocked[`award:${aw.id}`])} className={a.hint ? 'tm-hint' : ''} onClick={a.go}>
            <span>{en ? aw.name : aw.nameFa}</span><small>{taken ? `${tx('تأمین شده', 'Funded')}: ${who(taken.seat)}` : goalProgress(aw.id)}</small>
          </Button>;
        })}</div>
      </>}
      <div className={inSheet ? 'tm-srow' : 'tm-bar__row'}>
        {has('endTurn') && <Button data-act="endTurn" className={isHint({ type: 'endTurn' }) ? 'tm-hint' : ''} onClick={() => send({ type: 'endTurn' })}>{t('پایان نوبت', 'End turn')}</Button>}
        {has('pass') && <Button variant="ghost" data-act="pass" className={isHint({ type: 'pass' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'pass' })}>{t('پاس (تا آخر نسل)', 'Pass (rest of generation)')}</Button>}
      </div>
    </>;
  };

  const flowDock = flow && (
    <div className={`tm-flow${payRows.length || (cost > 0 && flow.t !== 'sell') ? ' tm-pay' : ''}`} data-tm-pending={flow.t}>
      <div className="tm-steps">{stepsOf().map((s, i) => <span key={i} className={`tm-step is-${s.state}`}>{s.state === 'done' ? '✓ ' : ''}{s.label}</span>)}</div>
      <div className="tm-dockprompt"><span>{flowText()}</span></div>
      {payRows.length > 0 && meP && <>
        {payRows.map((row) => (
          <div key={row.r} className="tm-payrow">
            <img className="tm-ic" src={RES_ICON[row.r]} alt="" />
            <span><b>{en ? RES_EN[row.r] : RES_FA[row.r]}</b> <small>{row.r === 'heat' ? t('هر واحد ۱ (هلیون)', '1 each (Helion)') : en ? `${row.v} each; ${row.r === 'steel' ? 'building' : 'space'} tag` : `هر واحد ${fa(row.v)}؛ نشان ${row.r === 'steel' ? 'ساختمان' : 'فضا'}`}</small></span>
            <Button size="sm" variant="secondary" aria-label={`${RES_FA[row.r]} کمتر`} disabled={pay[row.r] <= 0} onClick={() => setPay({ ...pay, [row.r]: pay[row.r] - 1 })}>−</Button>
            <b className="tm-num">{fa(pay[row.r])}</b>
            <Button size="sm" variant="secondary" aria-label={`${RES_FA[row.r]} بیشتر`} disabled={pay[row.r] >= row.max} onClick={() => setPay({ ...pay, [row.r]: pay[row.r] + 1 })}>+</Button>
          </div>
        ))}
        <div className="tm-paysum"><span>{t('مگاکردیت', 'M€')} {num(mcPay, en)}{payRows.map((row) => pay[row.r] ? ` + ${en ? RES_EN[row.r] : RES_FA[row.r]} ${num(pay[row.r], en)}` : '').join('')}<span className="bgv-sep" />{en ? `total ${Math.min(cost, mcPay + other)} of ${cost}` : `جمع ${fa(Math.min(cost, mcPay + other))} از ${fa(cost)}`}</span>
          {payOk ? <b>✓</b> : <small className="tm-warn">{mcPay > meP.res.mc ? t('مگاکردیت کافی نیست', 'Not enough M€') : t('این ترکیب پرداخت ممکن نیست', 'This payment is not possible')}</small>}</div>
      </>}
      <div className="tm-bar__row">
        <Button data-tm-confirm="" data-act={payRows.length || (cost > 0 && flow.t !== 'sell') ? 'pay' : 'confirm'} variant={over > 0 ? 'danger' : 'primary'} disabled={!canConfirm}
          className={action && isHint(action as Record<string, unknown>) ? 'tm-hint' : ''} onClick={() => action && send(action)}>
          {flow.t === 'sell' ? (en ? `Sell ${flow.cards.length} cards` : `فروش ${fa(flow.cards.length)} کارت`) : over > 0 ? (en ? `Confirm (overpay ${over})` : `تأیید (اضافه‌پرداخت ${fa(over)})`) : t('تأیید', 'Confirm')}
        </Button>
        <Button variant="secondary" onClick={() => setFlow(null)}>{t('برگرد', 'Back')}</Button>
        <Button variant="ghost" onClick={() => { setFlow(null); setMenu(null); }}>{t('لغو کنش', 'Cancel action')}</Button>
      </div>
    </div>
  );

  // ----- engine decisions (§8) -----
  const promptDock = prompt && respond && (() => {
    const label = prompt.labelFa ?? (prompt.kind === 'space' ? (en ? `Choose a space for the ${TILE_EN[prompt.tile]}` : `جای ${TILE_FA[prompt.tile]} را روی نقشه انتخاب کنید`) : t('انتخاب کنید', 'Choose'));
    const answerAction: GameAction | null = prompt.kind === 'space' ? (answer !== null ? { type: 'respond', space: answer } : null)
      : prompt.kind === 'player' ? (answer !== null ? { type: 'respond', seat: answer } : null)
        : prompt.kind === 'choice' ? (answer !== null ? { type: 'respond', index: answer } : null)
          : prompt.kind === 'card' ? (answer !== null ? { type: 'respond', card: answer } : null)
            : prompt.kind === 'cards' ? { type: 'respond', cards: sel } : { type: 'respond', amount };
    const ok = !!answerAction && !busy && (prompt.kind !== 'cards' || (sel.length >= prompt.min && sel.length <= prompt.max));
    const actName = prompt.kind === 'cards' ? 'cards' : prompt.kind === 'amount' ? 'amount' : prompt.kind;
    return (
      <div className="tm-flow tm-prompt" data-tm-pending={prompt.kind}>
        <div className="tm-dockprompt"><span><b>{label}</b></span>
          {prompt.kind === 'space' && <small className="tm-dockhint">{en ? `${spacePick.size} legal spaces are dashed on the board; until «Confirm space» you can pick another.` : `${fa(spacePick.size)} جای مجاز روی صفحه خط‌چین است؛ تا «تأیید جا» می‌توانید جای دیگری بزنید.`}</small>}
          {prompt.kind === 'cards' && <small className="tm-dockhint">{en ? `Pick ${prompt.min} to ${prompt.max} cards.` : `${fa(prompt.min)} تا ${fa(prompt.max)} کارت انتخاب کنید.`}</small>}
        </div>
        {(prompt.kind === 'player' || prompt.kind === 'choice') && <div className="tm-choice" role="radiogroup">
          {prompt.kind === 'player' ? prompt.options.map((k) => <Button key={k} variant="secondary" role="radio" aria-checked={answer === k} aria-pressed={answer === k} className={isHint({ type: 'respond', seat: k }) ? 'tm-hint' : ''} onClick={() => setAnswer(k)}>
            <img className="tm-ic" src={cubeArt(k)} alt="" /><bdi>{seatName(k)}</bdi></Button>)
            : prompt.options.map((o, i) => <Button key={i} variant="secondary" role="radio" aria-checked={answer === i} aria-pressed={answer === i} className={isHint({ type: 'respond', index: i }) ? 'tm-hint' : ''} onClick={() => setAnswer(i)}>{o}</Button>)}
        </div>}
        {prompt.kind === 'card' && <small className="tm-dockhint">{en ? `Pick one of the ${prompt.options.length} ringed cards in your sections.` : `یکی از ${fa(prompt.options.length)} کارت حلقه‌دار را در بخش‌های خودتان انتخاب کنید.`}{answer !== null ? ` ${t('انتخاب:', 'Chosen:')} ${cardName(String(answer), en)}` : ''}</small>}
        {prompt.kind === 'cards' && <div className="tm-cards">{prompt.cards.map((id) => <TmCard key={id} id={id} w={110} en={en} pick={sel.includes(id) ? 'picked' : 'selectable'} onPick={() => toggle(id, prompt.max)} />)}</div>}
        {prompt.kind === 'amount' && <div className="tm-bar__row">
          <Button size="sm" variant="secondary" aria-label="کمتر" disabled={amount <= prompt.min} onClick={() => setAmount(amount - 1)}>−</Button>
          <b className="tm-num">{fa(amount)}</b>
          <Button size="sm" variant="secondary" aria-label="بیشتر" disabled={amount >= prompt.max} onClick={() => setAmount(amount + 1)}>+</Button>
        </div>}
        <div className="tm-bar__row">
          <Button data-tm-confirm="" data-act={actName} disabled={!ok} className={answerAction && isHint(answerAction as Record<string, unknown>) ? 'tm-hint' : ''} onClick={() => answerAction && send(answerAction)}>
            {prompt.kind === 'space' ? t('تأیید جا', 'Confirm space') : prompt.kind === 'cards' ? `${t('تأیید', 'Confirm')} (${num(sel.length, en)})` : t('تأیید', 'Confirm')}
          </Button>
          {prompt.optional && <Button variant="secondary" data-act="skip" className={isHint({ type: 'respond', skip: true }) ? 'tm-hint' : ''} onClick={() => send({ type: 'respond', skip: true })}>{prompt.kind === 'player' ? t('هیچ‌کس', 'Nobody') : t('رد کردن', 'Skip')}</Button>}
        </div>
      </div>
    );
  })();

  // ----- simultaneous picks (§4.3–4.5) -----
  const pickBar = (() => {
    if (corpHint && me) {
      const startMc = CARD[corp ?? '']?.startMc ?? 0;
      return <div className="tm-flow">
        <div className="tm-dockprompt"><span className="tm-bar__long"><b>{t('نسل ۱:', 'Generation 1:')}</b> {t('یک شرکت و هر تعداد از ۱۰ کارت را انتخاب کنید؛ هر کارت ۳ مگاکردیت از پول شرکت. انتخاب همه هم‌زمان و پنهان است.', 'choose a corporation and any of the 10 cards; each card costs 3 M€ of its money. Everyone chooses at the same time, in secret.')}</span>
          <span className="tm-total"><img className="tm-ic" src={RES_ICON.mc} alt="" />{corp
            ? (en ? `${cardName(corp, en)} + ${sel.length} cards = ${3 * sel.length} of ${startMc}` : `${cardName(corp, en)} + ${fa(sel.length)} کارت = ${fa(3 * sel.length)} از ${fa(startMc)}`)
            : (en ? `${sel.length} cards = ${3 * sel.length}` : `${fa(sel.length)} کارت = ${fa(3 * sel.length)} مگاکردیت`)}</span></div>
        <div className="tm-bar__row">
          <Button data-tm-confirm="" data-act="corp" disabled={busy || !corp || 3 * sel.length > startMc} onClick={() => send({ type: 'corp', corp, cards: sel })}>{t('تأیید انتخاب', 'Confirm choice')}</Button>
          <Button variant="secondary" disabled={!sel.length && !corp} onClick={() => (sel.length ? setSel(sel.slice(0, -1)) : setCorp(null))}>{t('برگرد', 'Back')}</Button>
          {!corp ? <small className="tm-why">{t('یک شرکت انتخاب کنید', 'Choose a corporation')}</small>
            : 3 * sel.length > startMc ? <small className="tm-why">{t('پول شرکت برای این کارت‌ها کافی نیست', 'Not enough corporation money for these cards')}</small> : null}
        </div>
      </div>;
    }
    if (draft) return <div className="tm-flow"><div className="tm-dockprompt"><span className="tm-bar__long"><b>{t('درفت:', 'Draft:')}</b> {en ? `keep one card; the rest go to the ${view.generation % 2 === 0 ? 'next' : 'previous'} player.` : `یک کارت نگه دارید؛ بقیه به نفر ${view.generation % 2 === 0 ? 'بعدی' : 'قبلی'} می‌رسد.`}</span>
      {me && me.drafted.length > 0 && <small className="tm-dockhint">{t('درفت‌شده:', 'Drafted:')} {me.drafted.map((x) => cardName(x, en)).join(en ? ', ' : '، ')}</small>}</div>
      <div className="tm-bar__row"><Button data-tm-confirm="" data-act="draft" disabled={busy || answer === null} onClick={() => answer !== null && send({ type: 'draft', card: String(answer) })}>{t('نگه دار', 'Keep')}</Button>
        {answer === null && <small className="tm-why">{t('یک کارت انتخاب کنید', 'Choose a card')}</small>}</div></div>;
    if (research) return <div className="tm-flow"><div className="tm-dockprompt"><span className="tm-bar__long"><b>{t('پژوهش:', 'Research:')}</b> {en ? `pick the cards you buy (3 M€ each, at most ${research.max}).` : `کارت‌هایی را که می‌خرید انتخاب کنید (هر کدام ۳ مگاکردیت، حداکثر ${fa(research.max)}).`}</span>
      <span className="tm-total"><img className="tm-ic" src={RES_ICON.mc} alt="" />{en ? `${sel.length} cards = ${3 * sel.length} of ${meP?.res.mc ?? 0}` : `${fa(sel.length)} کارت = ${fa(3 * sel.length)} از ${fa(meP?.res.mc ?? 0)}`}</span></div>
      <div className="tm-bar__row">
        <Button data-tm-confirm="" data-act="research" disabled={busy} onClick={() => send({ type: 'research', cards: sel })}>{en ? `Buy ${sel.length} cards` : `تأیید خرید ${fa(sel.length)} کارت`}</Button>
        <Button variant="secondary" disabled={!sel.length} onClick={() => setSel(sel.slice(0, -1))}>{t('برگرد', 'Back')}</Button>
      </div></div>;
    return null;
  })();

  // ----- bar text (§6.1) -----
  const simultaneous = view.phase === 'corp' || view.phase === 'draft' || view.phase === 'research';
  const statusText: ReactNode = view.outcome ? <b>{t('بازی تمام شد', 'Game over')}</b>
    : queued || busy ? t('حرکت شما در حال ثبت است…', 'Sending your move…')
      : prompt ? <><b>{t('تصمیم بگیرید', 'Your decision')}</b></>
        : actionTurn ? (view.phase === 'final' ? <><b>{t('دور پایانی:', 'Final round:')}</b> {t('گیاه را به فضای سبز تبدیل کنید یا پاس بدهید.', 'convert plants into greenery or pass.')}</>
          : has('firstAction') ? <><b>{t('نوبت شماست:', 'Your turn:')}</b> {t('اولین کنش، کنش اجباری شرکتتان است.', "your first action is your corporation's mandatory action.")}</>
            : <><b>{t('نوبت شماست:', 'Your turn:')}</b> {en ? `action ${actionNo} of 2. Choose an action; playable cards in your hand and actions on the boards have an amber ring.${view.actionsTaken === 1 ? ' After the first action: «End turn» or a second action.' : ''}` : `کنش ${fa(actionNo)} از ۲. یک کنش انتخاب کنید؛ کارت‌های قابل بازی حلقهٔ کهربایی دارند.${view.actionsTaken === 1 ? ' بعد از کنش اول «پایان نوبت» یا کنش دوم.' : ''}`}</>)
          : view.promptSeat !== null ? <><bdi>{who(view.promptSeat)}</bdi> {t('در حال تصمیم', 'is deciding')}</>
            : simultaneous ? (corpHint || draft || research ? null : t('انتخاب شما ثبت شد؛ در انتظار بقیه', 'Your choice is in; waiting for the others'))
              : <>{t('نوبت', 'Turn:')} <bdi>{who(view.current)}</bdi></>;
  const waiting = !actionTurn && !prompt && !corpHint && !draft && !research;
  const bar = (
    <section className={`tm-bar${waiting ? ' is-waiting' : ''}`} data-tm-actbar="" aria-label={t('نوار کنش', 'Action bar')}>
      {statusText && <div className="tm-bar__row"><span className="tm-bar__text" role="status" aria-live="polite">{statusText}</span></div>}
      {flowDock ?? promptDock ?? pickBar ?? (actionTurn && (phone && !hint
        ? <div className="tm-bar__row"><Button onClick={() => setSheet(true)}>{t('کنش‌ها', 'Actions')}</Button>{has('pass') && <Button variant="ghost" data-act="pass" className={isHint({ type: 'pass' }) ? 'tm-hint' : ''} onClick={() => start({ t: 'pass' })}>{t('پاس', 'Pass')}</Button>}
          {has('endTurn') && <Button variant="secondary" data-act="endTurn" className={isHint({ type: 'endTurn' }) ? 'tm-hint' : ''} onClick={() => send({ type: 'endTurn' })}>پایان نوبت</Button>}</div>
        : actionButtons(phone)))}
      {help && actionTurn && !flow && !phone && view.phase === 'action' && <p className="tm-bar__hint">{t('پروژه‌های استاندارد، نقطه‌های عطف و جایزه‌ها روی خود صفحهٔ مریخ هم زدنی‌اند؛ کنش کارت‌های آبی روی همان کارت. بعد از کنش اول، «پایان نوبت» یا کنش دوم.', 'Standard projects, milestones and awards can also be clicked on the Mars board; blue-card actions on the card itself. After the first action: «End turn» or a second action.')}</p>}
    </section>
  );

  // ----- zones -----
  const order = (() => {
    const n = view.players.length;
    const turn = Array.from({ length: n }, (_, i) => (view.firstPlayer + i) % n);
    return mySeat !== null ? [mySeat, ...turn.filter((k) => k !== mySeat)] : turn;
  })();
  const pickCards = corpHint ? corpHint.cards : draft ? draft.cards : research ? research.cards : null;
  const handZone = (
    <section className={`tm-zone tm-zone--hand tm-handzone${floating && !pickCards ? ' is-floating' : ''}`} data-zone="hand" aria-label={pickCards ? t('ناحیهٔ انتخاب', 'Pick area') : t('دست شما', 'Your hand')}>
      <div className="tm-zone__head">
        <h2>{corpHint ? t('انتخاب آغازین', 'Starting choice') : draft ? t('درفت', 'Draft') : research ? t('پژوهش', 'Research') : t('دست شما', 'Your hand')}</h2>
        <small>{en ? (corpHint ? `corporation ${corp ? 1 : 0} of 2, cards ${sel.length} of 10` : pickCards ? `${sel.length} picked` : `${me?.hand.length ?? 0} cards; playable ones are ringed. Hover a card to enlarge it.`)
          : corpHint ? `شرکت ${corp ? '۱' : '۰'} از ۲، کارت ${fa(sel.length)} از ۱۰` : pickCards ? `${fa(sel.length)} انتخاب‌شده` : `${fa(me?.hand.length ?? 0)} کارت؛ کارت‌های قابل بازی حلقه دارند، نشانگر را روی کارت نگه دارید تا بزرگ شود.`}</small>
        {!pickCards && !phone && <Button size="sm" variant="ghost" aria-pressed={floating} onClick={() => setFloating(!floating)}>{t('شناور', 'Float')}</Button>}
      </div>
      {corpHint && <div className="tm-pickzone">
        <div className="tm-corps">{corpHint.corps.map((id) => <TmCard key={id} id={id} w={phone ? 160 : 250} en={en} pick={corp === id ? 'picked' : 'selectable'} onPick={() => setCorp(id)} />)}</div>
        <div className="tm-hand">{corpHint.cards.map((id) => <TmCard key={id} id={id} w={phone ? 104 : 128} en={en} pick={sel.includes(id) ? 'picked' : 'selectable'} onPick={() => toggle(id, 10)} />)}</div>
      </div>}
      {draft && <div className="tm-hand tm-hand--desk">{draft.cards.map((id) => <TmCard key={id} id={id} w={150} en={en} pick={answer === id ? 'picked' : 'selectable'} onPick={() => setAnswer(id)} />)}</div>}
      {research && <div className="tm-hand tm-hand--desk">{research.cards.map((id) => <TmCard key={id} id={id} w={150} en={en} flip={{ exit: 'discard' }} pick={sel.includes(id) ? 'picked' : 'selectable'} onPick={() => toggle(id, research.max)} />)}</div>}
      {simultaneous && <div className="tm-ready">{view.players.map((p, k) => <span key={k}><img className="tm-ic" src={cubeArt(k)} alt="" /><bdi>{seatName(k)}</bdi>{p.ready ? t(' ✓ آماده', ' ✓ ready') : t(' در حال انتخاب', ' choosing')}</span>)}</div>}
      {!pickCards && me && (me.hand.length > 0
        ? <div className={phone ? 'tm-hand tm-mhand' : 'tm-hand tm-hand--desk'}>{me.hand.map((id) => {
          const hp = handPick(id);
          return <TmCard key={id} id={id} w={134} en={en} pick={hp.pick} reason={hp.reason} onPick={hp.go} hint={hp.hint} flip={{ from: 'deck', exit: `seat-${mySeat}` }} />;
        })}</div>
        : <p className="tm-empty">{t('کارتی در دست ندارید.', 'No cards in hand.')}</p>)}
      {!pickCards && !me && <p className="tm-empty">تماشاگر: دست بازیکنان پنهان است.</p>}
    </section>
  );
  const boardEl = <Board view={view} en={en} seatName={seatName} picks={spacePick} picked={prompt?.kind === 'space' ? (answer as string | null) : null}
    onSpace={(id) => setAnswer(id)} hint={hint?.type === 'respond' && typeof hint.space === 'string' && answer !== hint.space ? hint.space : null} boardAct={boardAct} />;
  const marsZone = (
    <section className="tm-zone tm-zone--mars tm-boardzone" data-zone="mars" aria-label={t('صفحهٔ مریخ', 'Mars board')}>
      {phone ? <ZoomBoard label="صفحهٔ تارسیس" className="tm-mview">{(() => {
        const z = !whole ? autoZoom(spacePick) : null;
        return <div className="tm-azoom">
          <div className="tm-azoom__in" style={z ? { transform: `scale(${z.s}) translate(${(z.tx * 100).toFixed(2)}%, ${(z.ty * 100).toFixed(2)}%)` } : undefined}>{boardEl}</div>
          {spacePick.size > 0 && <Button size="sm" variant="secondary" className="tm-azoom__btn" aria-pressed={whole} onClick={() => setWhole(!whole)}>{whole ? t('زوم روی جاهای مجاز', 'Zoom to legal spaces') : t('کل صفحه', 'Whole board')}</Button>}
        </div>;
      })()}</ZoomBoard> : boardEl}
    </section>
  );
  const shownPlayers = phone ? [playersTab ?? order[0]!] : order;
  const playersZone = (
    <section className="tm-zone tm-zone--players tm-players" data-zone="players" aria-label={t('محوطهٔ بازیکنان', 'Player areas')}>
      {phone && <div className="tm-subtabs" role="tablist">{order.map((k) => <button key={k} type="button" role="tab" aria-selected={(playersTab ?? order[0]) === k} onClick={() => setPlayersTab(k)}><img className="tm-ic" src={cubeArt(k)} alt="" /><bdi>{seatName(k)}</bdi></button>)}</div>}
      {shownPlayers.map((k) => <PlayerArea key={k} view={view} k={k} me={k === mySeat} en={en} seatName={seatName} cardPick={k === mySeat ? tableauPick : () => ({ pick: 'none' })} convert={convert} />)}
    </section>
  );
  const settings = <div className="tm-settings">
    <span className="tm-lang" role="group" aria-label="زبان لایهٔ بازی"><button type="button" aria-pressed={!en} onClick={() => setLang('fa')}>فا</button><button type="button" aria-pressed={en} onClick={() => setLang('en')}>EN</button></span>
    <label className="tm-check-row"><input type="checkbox" checked={floating} onChange={(e) => setFloating(e.target.checked)} /> {t('دست شناور (پایین صفحه)', 'Floating hand (bottom of the page)')}</label>
  </div>;

  return (
    <div className="tm" ref={root} data-seq={view.seq} data-phase={view.phase} data-tab={tab} lang={lang} dir={en ? 'ltr' : 'rtl'} data-theme={pageTheme()} style={{ '--tm-z': zoom } as CSSProperties}>
      <Dashboard view={view} en={en} zoom={zoom} setZoom={setZoom} help={help} setHelp={setHelp} settings={settings} />
      {/* Own rail outside the table shell (the shell draws these from publicSummary; hidden there by renderer.css). */}
      <aside className="tm-own" aria-label="بازیکنان">
        {order.map((k) => <div key={k} className={`tm-ownpanel${k === mySeat ? ' is-you' : ''}${view.current === k && view.phase === 'action' ? ' is-turn' : ''}`}>
          <div className="tm-panel__head">
            <span className="tm-panel__id"><b style={{ color: `var(--tm-${colorOf(k)}-ink)` }}><bdi>{seatName(k)}</bdi></b>
              <small>{view.players[k]!.passed && view.phase === 'action' ? t('پاس داده', 'passed') : view.current === k && view.phase === 'action' ? (en ? `action ${view.actionsTaken + 1} of 2` : `کنش ${fa(view.actionsTaken + 1)} از ۲`) : ''}</small></span>
            <span className="tm-score"><b>{num(view.players[k]!.score.total, en)}</b><small>{t('امتیاز', 'VP')}</small></span>
          </div>
          <PanelBody d={detailOf(view, k)} en={en} /></div>)}
        {view.log.length > 0 && <ol className="tm-log" aria-live="polite">{view.log.slice(-8).reverse().map((l, i) => <li key={`${view.seq}-${i}`}><bdi>{seatName(l.seat)}</bdi>: {LOG_TXT[l.kind]?.[en ? 1 : 0] ?? l.kind}{l.card ? ` «${cardName(l.card, en)}»` : ''}{l.detail ? ` «${en ? PROJECT_EN[l.detail as Project] ?? MILESTONES.find((m) => m.id === l.detail)?.name ?? AWARDS.find((m) => m.id === l.detail)?.name ?? l.detail : PROJECT_FA[l.detail as Project] ?? MILESTONES.find((m) => m.id === l.detail)?.nameFa ?? AWARDS.find((m) => m.id === l.detail)?.nameFa ?? l.detail}»` : ''}</li>)}</ol>}
      </aside>
      {phone && <div className="tm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mars'} onClick={() => setTab('mars')}>{t('مریخ', 'Mars')}</button>
        <button type="button" role="tab" aria-selected={tab === 'hand'} onClick={() => setTab('hand')}>{corpHint ? t('انتخاب آغازین', 'Start') : draft ? t('درفت', 'Draft') : research ? t('پژوهش', 'Research') : `${t('دست', 'Hand')} ${num(me?.hand.length ?? 0, en)}`}</button>
        <button type="button" role="tab" aria-selected={tab === 'players'} onClick={() => setTab('players')}>{t('بازیکنان', 'Players')}</button>
      </div>}
      {!phone && bar}
      {(me || pickCards) && handZone}
      {marsZone}
      {playersZone}
      {phone && bar}
      {sheet && <div className="tm-sheetwrap" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}>
        <div className="tm-sheet" role="dialog" aria-modal="true" aria-label="همهٔ کنش‌ها">
          <div className="tm-sheet__head"><b>{t('نوبت شماست:', 'Your turn:')}</b> {en ? `action ${actionNo} of 2` : `کنش ${fa(actionNo)} از ۲`}</div>
          {actionButtons(true)}
          <Button variant="ghost" onClick={() => setSheet(false)}>{t('بستن', 'Close')}</Button>
        </div>
      </div>}
      {view.outcome && (
        <section className="tm-zone tm-result" aria-label="امتیاز پایانی">
          <table>
            <thead><tr>{(en ? ['Place', 'Player', 'TR', 'Milestones', 'Awards', 'Greenery', 'Cities', 'Cards', 'Total', 'M€'] : ['رتبه', 'بازیکن', 'رتبهٔ زمین‌سازی', 'نقطهٔ عطف', 'جایزه', 'فضای سبز', 'شهر', 'کارت', 'جمع', 'مگاکردیت']).map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{view.outcome.placements.map((pl) => {
              const sc = view.players[pl.seat]!.score;
              return <tr key={pl.seat}><td>{fa(pl.place)}</td><td><bdi>{seatName(pl.seat)}</bdi></td><td>{fa(sc.tr)}</td><td>{fa(sc.milestones)}</td><td>{fa(sc.awards)}</td><td>{fa(sc.greenery)}</td><td>{fa(sc.city)}</td><td>{fa(sc.cards)}</td><td><b>{fa(sc.total)}</b></td><td>{fa(view.players[pl.seat]!.res.mc)}</td></tr>;
            })}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** The page theme (prefs set it on <html>); the shell forces its stage dark, TM follows the page like the reference. */
function pageTheme(): 'light' | 'dark' {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The served view with my in-flight move applied as far as the client already knows it (shell undo window). */
function previewView(v: TmView, a: GameAction | null, seat: number | null): TmView {
  if (!a || seat === null || !v.me) return v;
  if (a.type === 'play' && typeof a.card === 'string' && v.me.hand.includes(a.card)) {
    const card = a.card;
    return { ...v, me: { ...v.me, hand: v.me.hand.filter((x) => x !== card) }, players: v.players.map((p, k) => (k === seat ? { ...p, hand: p.hand - 1, played: [...p.played, card] } : p)) };
  }
  const q = v.prompt;
  if (a.type === 'respond' && typeof a.space === 'string' && q?.kind === 'space') {
    if (q.claim) return { ...v, claims: { ...v.claims, [a.space]: seat } };
    return { ...v, tiles: { ...v.tiles, [a.space]: { kind: q.tile, owner: q.tile === 'ocean' ? null : seat, ...(q.card ? { card: q.card } : {}) } } };
  }
  return v;
}
