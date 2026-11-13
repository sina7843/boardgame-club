// Screen building blocks shared by desktop and phone boards.
import { fa, esc, ic, aic, pc, board, clock, pbar, moveList, moveStrip, navBtns, gamebar } from './lib.mjs';

export const ME = { name: 'مینا', av: 'م', rating: 1612, tier: 'gold', tierFa: 'طلا', seat: 1, you: true };
export const OPP = { name: 'نیلوفر', av: 'ن', rating: 1684, tier: 'diamond', tierFa: 'الماس', seat: 2 };

/** Move list that may start mid-game (from a FEN). */
export function mlist(sc, o = {}) {
  let hist = sc.hist;
  if (sc.startColor === 'b') hist = [{ san: '…', from: '', to: '' }, ...hist];
  const from = o.tail ? Math.max(0, (Math.ceil(hist.length / 2) - o.tail) * 2) : 0;
  const html = moveList(hist, { cur: o.cur ?? hist.length - 1, from });
  if (sc.startMove === 1) return html;
  // renumber
  return html.replace(/<span class="cx-ml__n">([۰-۹]+)\.<\/span>/g, (m, n) => {
    const v = Number(n.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) + sc.startMove - 1;
    return `<span class="cx-ml__n">${fa(v)}.</span>`;
  });
}
export function mstrip(sc) {
  let hist = sc.hist;
  if (sc.startColor === 'b') hist = [{ san: '…' }, ...hist];
  const html = moveStrip(hist.slice(-12 - (hist.length % 2)), {});
  const off = Math.floor((hist.length - (12 + (hist.length % 2))) / 2);
  const base = Math.max(0, off) + sc.startMove - 1;
  return html.replace(/<span class="cx-ms__n">([۰-۹]+)\.<\/span>/g, (m, n) => {
    const v = Number(n.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) + base;
    return `<span class="cx-ms__n">${fa(v)}.</span>`;
  });
}

/** Players from the scene: white/black captured lists and lead. you = 'w' | 'b' | null (spectator). */
export function players(sc, you, clocks, o = {}) {
  const w = you === 'w' ? ME : you === 'b' ? OPP : { ...ME, you: false };
  const b = you === 'b' ? { ...ME } : you === 'w' ? OPP : { ...OPP };
  const W = { ...w, caps: sc.capsW, lead: sc.leadW, clock: clocks.w, turn: sc.pos.turn === 'w', ...(o.w ?? {}) };
  const B = { ...b, caps: sc.capsB, lead: sc.leadB, clock: clocks.b, turn: sc.pos.turn === 'b', ...(o.b ?? {}) };
  if (you === 'b') { B.you = true; W.you = false; }
  const flip = you === 'b';
  return { top: flip ? W : B, bottom: flip ? B : W, flip };
}

export function felt(sc, you, clocks, bo = {}, o = {}) {
  const P = players(sc, you, clocks, o);
  const sm = !!o.sm;
  const overlay = (bo.overlay ?? '') + (o.bannerTop ?? '');
  return `${pbar(P.top, { sm })}${board(sc.pos.board, { flip: P.flip, last: sc.last, check: sc.check, ...bo, overlay })}${pbar(P.bottom, { sm })}`;
}

export const btn = (label, cls = 'secondary', icon = '', extra = '') => `<button class="bgv-btn bgv-btn--${cls}" type="button"${extra}>${icon ? ic(icon) : ''}${label}</button>`;
export const ibtn = (icon, label, cls = 'ghost', extra = '') => `<button class="bgv-btn bgv-btn--icon bgv-btn--${cls}" type="button" aria-label="${esc(label)}"${extra}>${ic(icon)}</button>`;

export function actionsRow(o = {}) {
  return `<div class="cx-actions">${btn(o.drawLabel ?? 'مساوی', 'secondary', 'hand', o.drawDisabled ? ' disabled' : '')}${btn('تسلیم', 'leave', 'flag', o.resignDisabled ? ' disabled' : '')}${ibtn('flip', 'چرخاندن صفحه', 'secondary')}${ibtn('settings', 'تنظیمات صفحه و مهره', 'secondary')}</div>`;
}

export function chatCol(o = {}) {
  const msgs = (o.msgs ?? [
    ['sys', 'بازی شروع شد. <b>مینا</b> سفید است، <b>نیلوفر</b> سیاه'],
    ['opp', 'سلام، بازی خوبی داشته باشیم'],
    ['me', 'سلام، همچنین 🙂'],
  ]).map(([k, t]) => k === 'sys' ? `<span class="bgv-sys">${t}</span>` : k === 'game' ? `<span class="bgv-sys bgv-sys--game">${t}</span>` : k === 'opp'
    ? `<div class="bgv-msg"><span class="bgv-avatar bgv-avatar--xs seat-2">ن</span><div class="bgv-msg__col"><span class="bgv-msg__meta"><i class="bgv-seat seat-2"></i><b>نیلوفر</b>۳ دقیقه</span><div class="bgv-msg__bubble">${t}</div></div></div>`
    : `<div class="bgv-msg bgv-msg--mine"><div class="bgv-msg__col"><div class="bgv-msg__bubble">${t}</div><span class="bgv-msg__meta">۲ دقیقه</span></div></div>`).join('');
  const composer = o.readonly
    ? `<div class="bgv-composer"><p class="cx-note" style="margin:0;padding:10px 4px;text-align:center">${o.readonly}</p></div>`
    : `<div class="bgv-composer"><div role="group" class="bgv-quicktray" aria-label="پیام سریع"><button class="bgv-chip" type="button">حرکت خوبی بود</button><button class="bgv-chip" type="button">بازی خوبی بود</button><button class="bgv-chip" type="button">👏</button></div><div class="bgv-composer__row">${ibtn('chat', 'شکلک')}<textarea class="bgv-composer__input" rows="1" placeholder="پیام به میز…" aria-label="پیام"></textarea>${ibtn('back', 'ارسال', 'primary')}</div></div>`;
  return `<aside class="cx-chatcol"><section class="bgv-chat" aria-label="گفت‌وگوی میز"><div class="bgv-chat__head"><span class="bgv-chat__title">${ic('chat')}${o.title ?? 'گفت‌وگوی میز'}</span>${o.headExtra ?? ''}</div><div class="bgv-chat__list">${msgs}</div>${composer}</section></aside>`;
}

/** Desktop table frame. */
export function desk({ theme = 'light', gb = {}, rail, feltHtml, chat, over = '', feltCls = '' }) {
  return `<div class="cx-frame bgv" data-theme="${theme}" dir="rtl"><div class="cx-desk">${gamebar(gb)}<aside class="cx-rail" aria-label="وضعیت، حرکت‌ها و دکمه‌ها">${rail}</aside><main class="cx-felt ${feltCls}" aria-label="میز شطرنج">${feltHtml}</main>${chat ?? chatCol()}</div>${over}</div>`;
}

export function railStd(sc, o = {}) {
  return `${o.top ?? ''}<section class="cx-card">${o.status}</section>${o.mid ?? ''}<section class="cx-card cx-card--fill"><h3>حرکت‌ها${o.opening ? `<span class="bgv-spacer"></span><span class="cx-note">${o.opening}</span>` : ''}</h3><div class="cx-mlhead"><span>#</span><span>سفید</span><span>سیاه</span></div>${mlist(sc, o)}${navBtns()}</section>${o.actions ?? actionsRow(o)}`;
}

export const status = (html, o = {}) => `<div class="cx-status${o.check ? ' cx-status--check' : ''}">${o.icon ?? '<i class="cx-dot-turn"></i>'}<span>${html}</span></div>`;
export const tourStrip = (o = {}) => `<section class="cx-card" style="gap:8px"><div class="cx-round">${ic('trophy')}<span><b>مسابقهٔ شطرنج</b>، دور ${fa(o.round ?? 3)} از ${fa(5)}، میز ${fa(o.board ?? 2)}</span></div>${o.more ?? ''}</section>`;

export function resultCard(o) {
  return `<div class="cx-result" role="dialog" aria-label="${esc(o.title)}"><div class="cx-result__head">${aic(o.icon ?? 'crown')}<h3>${o.title}</h3><p>${o.reason}</p></div>
<div class="cx-vs"><div class="cx-vs__p${o.win === 'me' ? ' is-win' : ''}"><span class="bgv-avatar seat-1 is-you">م</span><b>مینا</b><span class="cx-delta ${o.dMe > 0 ? 'cx-delta--up' : o.dMe < 0 ? 'cx-delta--down' : 'cx-delta--eq'}">${fa(o.rMe)} (${o.dMe > 0 ? '+' : o.dMe < 0 ? '−' : '±'}${fa(Math.abs(o.dMe))})</span></div><span class="cx-vs__score">${o.score}</span><div class="cx-vs__p${o.win === 'opp' ? ' is-win' : ''}"><span class="bgv-avatar seat-2">ن</span><b>نیلوفر</b><span class="cx-delta ${o.dOpp > 0 ? 'cx-delta--up' : o.dOpp < 0 ? 'cx-delta--down' : 'cx-delta--eq'}">${fa(o.rOpp)} (${o.dOpp > 0 ? '+' : o.dOpp < 0 ? '−' : '±'}${fa(Math.abs(o.dOpp))})</span></div></div>
<div class="cx-result__btns">${o.btns ?? `${btn(o.primary ?? 'بازی دوباره', 'primary', 'repeat')}${btn('حریف جدید', 'secondary', 'search')}${btn('آنالیز بازی', 'secondary', 'eye')}`}</div>
<div class="cx-result__foot">${btn('PGN', 'ghost bgv-btn--sm', 'download')}${btn('اشتراک', 'ghost bgv-btn--sm', 'share')}${btn('گزارش', 'ghost bgv-btn--sm', 'flag')}</div></div>`;
}
export { fa, esc, ic, aic, pc, board, clock, pbar, gamebar };
