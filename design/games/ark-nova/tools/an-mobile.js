// Phone screens (390 x 844), 4 per artboard (the canvas is near its 512-file cap). Tabs: my zoo / boards / players;
// the 5 action cards stay docked at the bottom, the hand is a bottom drawer (user choice 2026-10-29).
const X = require('./an-lib');
const { M, V, SEATS, IMG, ICONS, MAP_W, MAP_H, hexXY, cardFile, BONUS_FILE } = X;
const FL = require('./an-flows');
const F = M.flows;

const CSS = `
.an-phones{display:flex;gap:40px;padding:28px;background:var(--bg);align-items:flex-start}
.an-phonecol{display:grid;gap:10px;justify-items:center}
.an-phonecol>p{margin:0;inline-size:390px;font-size:13.5px;line-height:1.7;color:var(--text-muted);text-align:center}
.an-phonecol>p b{color:var(--heading)}
.an-phone{position:relative;inline-size:390px;block-size:844px;overflow:hidden;border-radius:28px;background:var(--bg);box-shadow:0 0 0 10px #1B1F24,0 12px 30px rgba(0,0,0,.35);display:flex;flex-direction:column}
.an-phone>.bgv-gamebar{flex:none}
.an-mstat{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);box-shadow:inset 0 -1px 0 var(--line);font-size:13.5px;line-height:1.55;color:var(--text)}
.an-mstat b{color:var(--heading);font-weight:900}
.an-mstat>span:first-child{flex:1;min-inline-size:0}
.an-tabs{flex:none;display:flex;gap:4px;padding:6px 10px;background:var(--surface)}
.an-tabs button{flex:1;block-size:34px;border:0;border-radius:var(--radius-sm);background:var(--surface-sunken);font:inherit;font-size:13.5px;font-weight:700;color:var(--text-muted)}
.an-tabs button[aria-selected="true"]{background:var(--selected);color:var(--on-selected)}
.an-mbody{flex:1;min-block-size:0;overflow:hidden;padding:8px;display:flex;flex-direction:column;gap:8px}
.an-mbody>*{flex:none}
.an-mbody .an-played{padding:6px;gap:8px}
.an-mbody .an-pcol{min-inline-size:0;padding:4px}
.an-mbody .an-stack2>.an-card{--cw:64px}
.an-mbody .an-stack2{--cw:64px}
.an-mbody .an-isum{padding:4px 6px;gap:4px}
.an-mbody .an-isum .an-icn{inline-size:22px;block-size:22px}
.an-mbody .an-zone{padding:8px;gap:6px}
.an-mbody .an-ahead{padding:6px 8px;gap:6px}
.an-mbody .an-cnt>img{block-size:30px}
.an-mbody .an-cnt>b{font-size:14px;min-inline-size:18px}
.an-mbody .an-icn{inline-size:24px;block-size:24px}
.an-mbody .an-icn b{font-size:10.5px;min-inline-size:14px}
.an-mbody .an-score{inline-size:42px;block-size:42px}
.an-mbody .an-score b{font-size:15px}
.an-mbody .an-acts{display:none}
.an-mbody .an-tableau .an-card{--cw:56px}
.an-mbody .an-tableau .an-card__fa{display:none}
.an-dock{flex:none;display:grid;gap:6px;padding:8px 8px 14px;background:var(--surface);box-shadow:0 -1px 0 var(--line),0 -6px 14px rgba(0,0,0,.08)}
.an-dock__acts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
.an-dock .an-act>img{border-radius:5px}
.an-dock .an-act__str{inline-size:24px;block-size:24px;font-size:14px;inset-block-start:-8px}
.an-dock .an-act__fa{font-size:11px;color:var(--text)}
.an-dock .an-act__toks img{inline-size:18px}
.an-dock__row{display:flex;align-items:center;gap:6px}
.an-dock__row .an-xseg button{min-inline-size:28px;block-size:28px}
.an-dock__row .bgv-btn{margin-inline-start:auto}
.an-scroll{overflow:auto hidden;border-radius:var(--radius-sm)}
.an-scroll>.an-boardimg{inline-size:760px}
.an-hint2{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--felt-muted)}
.an-sheetm{position:absolute;inset-inline:0;inset-block-end:0;z-index:5;display:flex;flex-direction:column;gap:8px;max-block-size:72%;padding:10px 10px 16px;border-radius:18px 18px 0 0;background:var(--surface);box-shadow:0 -8px 24px rgba(0,0,0,.25)}
.an-sheetm__grip{align-self:center;inline-size:44px;block-size:5px;border-radius:3px;background:var(--line)}
.an-sheetm h3{margin:0;font-size:15px;font-weight:900;color:var(--heading)}
.an-scrim{position:absolute;inset:0;z-index:4;background:var(--scrim)}
.an-mhand{display:flex;gap:10px;overflow:auto hidden;padding-block:6px}
.an-mhand .an-card__fa{color:var(--text)}
.an-mhand .an-card__why{color:var(--text-muted)}
.an-mzoom{display:grid;grid-template-columns:120px 1fr;gap:10px;font-size:13px;line-height:1.75}
.an-mzoom>img{inline-size:120px;border-radius:6px}
.an-mzoom b{font-size:14.5px;color:var(--heading)}
.an-mopts{display:grid;gap:6px}
.an-mopts .an-opt{justify-content:flex-start;inline-size:100%;block-size:auto;min-block-size:44px;padding-block:4px;white-space:normal;text-align:start}
.an-mmap{position:relative;overflow:hidden;border-radius:var(--radius-sm);block-size:330px}
.an-mmap>.an-zoomap{position:absolute;inline-size:var(--zw);inset-inline-start:var(--zx);inset-block-start:var(--zy)}
.an-mmap .an-acts{display:none}
.an-mzoomctl{position:absolute;inset-block-start:8px;inset-inline-end:8px;z-index:3;display:grid;gap:4px}
.an-mzoomctl .bgv-btn{background:var(--surface)}
.an-mplayers{display:grid;gap:8px;overflow:hidden}
.an-mplayer{display:grid;gap:6px;padding:8px;border-radius:var(--radius-md);background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--line)}
.an-mplayer.is-open{box-shadow:inset 0 0 0 2px var(--pc)}
.an-mplayer__row{display:flex;align-items:center;gap:8px}
.an-mplayer__row b{font-size:14.5px;font-weight:900}
.an-mplayer .an-cnts{gap:4px}
.an-mplayer .an-cnt>img{block-size:28px}
.an-mplayer .an-cnt>b{font-size:13px;min-inline-size:16px}
.an-mplayer .an-score{inline-size:38px;block-size:38px;margin-inline-start:auto}
.an-mplayer .an-score b{font-size:14px}
.an-mplayer .an-acts{display:none}
.an-mgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 6px}
.an-mgrid .an-card{--cw:100%}
.an-mgrid .an-card__fa{font-size:11px;color:var(--text)}
`;

const ui = (n, cls = 'an-ic') => IMG('ui/' + n, `class="${cls}" alt=""`);
function phone(l, P, { stat, tabs = 0, body, dock = true, overlay = '' }) {
  const T = [l.t('باغ‌وحش من', 'My zoo'), l.t('بوردها', 'Boards'), l.t('بازیکنان', 'Players')];
  return `<div class="an-phone">${P.gamebar(l, true)}<div class="an-mstat"><span>${stat}</span>${P.clock(l)}</div>${tabs === null ? '' : `<div class="an-tabs" role="tablist">${T.map((t, i) => `<button type="button" role="tab" aria-selected="${i === tabs}">${t}</button>`).join('')}</div>`}<div class="an-mbody">${body}</div>${dock ? dockActs(l, P) : ''}${overlay}</div>`;
}
function dockActs(l, P, opts = {}) {
  const p = P.P(0);
  return `<div class="an-dock"><div class="an-dock__acts an-options" dir="ltr" role="group" aria-label="${l.t('کارت‌های کنش', 'Action cards')}">${p.slots.map((k, i) => {
    const tk = p.tok[k];
    const toks = [...Array(tk.mult).fill('multiplier'), ...Array(tk.venom).fill('venom'), ...Array(tk.con).fill('constriction')];
    return `<button class="an-act an-opt${opts.dim ? '' : ' is-avail'}" type="button" data-opt="a:${k}:0" aria-label="${l.act(k)}">${IMG(X.actFile(k, p.up[k]), 'alt=""')}<span class="an-act__str an-num">${l.d(p.strengths[i])}</span>${toks.length ? `<span class="an-act__toks">${toks.map((t) => IMG('tokens/' + t, 'alt=""')).join('')}</span>` : ''}<span class="an-act__fa">${l.act(k)}${p.up[k] ? ' II' : ''}</span></button>`;
  }).join('')}</div><div class="an-dock__row"><span class="an-xseg"><span>${ui('xtoken')}</span>${[0, 1, 2].map((n) => `<button type="button" aria-pressed="${n === 0}">${l.d(n)}</button>`).join('')}</span><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="x-mode">${l.t('کنش X', 'X action')}</button><button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-act="hand">${ICONS.hand}${l.t('دست', 'Hand')} <span class="an-pill an-num">${l.d(M.handInfo.length)}</span></button></div></div>`;
}
// map window zoomed on a set of cells (phone auto-zoom to the legal area)
function mapWindow(l, P, cells, opts, zoom = 1.9) {
  const pts = cells.map(hexXY);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const W = 374 * zoom, H = W * MAP_H / MAP_W;
  const zx = Math.min(0, Math.max(374 - W, 187 - cx / MAP_W * W)), zy = Math.min(0, Math.max(330 - H, 165 - cy / MAP_H * H));
  return `<div class="an-mmap bgv-felt" style="--zw:${W}px;--zx:${zx.toFixed(0)}px;--zy:${zy.toFixed(0)}px">${P.zoo(l, 0, { choose: false, acts: false, ...opts })}<div class="an-mzoomctl"><button class="bgv-btn bgv-btn--icon bgv-btn--sm" type="button" aria-label="${l.t('بزرگ‌تر', 'Zoom in')}">${ICONS.plus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--sm" type="button" aria-label="${l.t('کوچک‌تر', 'Zoom out')}">${ICONS.minus}</button><button class="bgv-btn bgv-btn--icon bgv-btn--sm" type="button" aria-label="${l.t('کل نقشه', 'Fit')}">${ICONS.fit}</button></div></div>`;
}
const col = (note, ph) => `<div class="an-phonecol">${ph}<p>${note}</p></div>`;

function turnMobile(l, P) {
  const yourTurn = `<b>${l.t('نوبت شماست', 'Your turn')}</b>${l.t(': یک کارت کنش از پایین', ': pick an action card below')}`;
  const p1 = phone(l, P, { stat: yourTurn, tabs: 0, body: `${P.areaHead(l, 0)}${P.iconSummary(l, 0)}<div class="bgv-felt" style="padding:6px;border-radius:var(--radius-md)">${P.zoo(l, 0, { choose: false, acts: false })}</div>${P.played(l, 0)}` });
  const p2 = phone(l, P, { stat: yourTurn, tabs: 1, body: `<div class="bgv-felt an-zone"><div class="an-hint2">${l.t('ویترین و اعتبار ← با انگشت بکشید', 'Display and reputation ← swipe')}</div><div class="an-scroll"><div style="inline-size:900px;padding-block-end:4px">${P.mainBoard(l)}</div></div><div class="an-hint2">${l.t('حفاظت و انجمن', 'Conservation and association')}</div>${P.consStrip(l)}${P.assocBoard(l)}<div class="an-scroll"><div class="an-projband" style="flex-wrap:nowrap;justify-content:flex-start;inline-size:max-content">${V.baseProjects.map((id) => P.projBottom(l, id, { pw: 170 })).join('')}</div></div></div>` });
  const sel = M.handInfo.find((h) => h.id === 486);
  const t = M.cardFa[486] || {};
  const p3 = phone(l, P, { stat: yourTurn, tabs: 0, body: `${P.areaHead(l, 0)}<div class="bgv-felt" style="padding:6px;border-radius:var(--radius-md)">${P.zoo(l, 0, { choose: false, acts: false })}</div>`,
    overlay: `<div class="an-scrim"></div><div class="an-sheetm" role="dialog" aria-label="${l.t('دست شما', 'Your hand')}"><span class="an-sheetm__grip"></span><h3>${l.t('دست شما', 'Your hand')} (${l.d(M.handInfo.length)})</h3><div class="an-mhand an-hand">${M.handInfo.map((h) => P.handCard(l, h, { cw: 104, pick: h.id === 486 ? 'picked' : undefined })).join('')}</div><div class="an-mzoom">${IMG(cardFile(486), 'alt=""')}<div><b>${l.card(486)}</b><br>${l.d(t.textFa || '')}<br><span class="an-pill">${l.d(sel.cost)} ${ui('money')}</span></div></div><button class="bgv-btn bgv-btn--primary" type="button" data-opt="a:animals:0">${l.t('بازی با «حیوانات II» (قدرت ۴)', 'Play with Animals II (strength 4)')}</button></div>` });
  const players = [0, 1, 2, 3].map((k) => `<div class="an-mplayer${k === 1 ? ' is-open' : ''}" style="--pc:var(--an-${SEATS[k].color})"><div class="an-mplayer__row"><span class="bgv-avatar bgv-avatar--sm" style="--seat-c:var(--an-${SEATS[k].color})">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><b style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}${k === 0 ? l.t('، شما', '') : ''}</b>${P.scoreBadge(l, k)}</div>${P.counters(l, k)}${k === 1 ? `${P.iconCounts(l, k)}${P.zoo(l, 1, { choose: false, acts: false })}` : ''}</div>`).join('');
  const p4 = phone(l, P, { stat: yourTurn, tabs: 2, body: `<div class="an-mplayers">${players}</div>` });
  return `<div class="an-phones" dir="rtl">${col(l.t('<b>باغ‌وحش من</b>: سربرگ با شمارنده‌ها، نقشه هم‌عرض صفحه (دو انگشت = زوم)، کارت‌های باغ‌وحش کوچک. ۵ کارت کنش همیشه پایین‌اند؛ قدرت روی هر کارت.', '<b>My zoo</b>'), p1)}${col(l.t('<b>بوردها</b>: بورد اصلی دو برابر عرض با کشیدن افقی، بورد انجمن هم‌عرض، پروژه‌ها در ردیف افقی.', '<b>Boards</b>'), p2)}${col(l.t('<b>دست</b>: کشوی پایین؛ لمس کارت = بزرگ‌نمایی با متن فارسی و دکمهٔ کنش پیشنهادی (همان گزینهٔ موتور).', '<b>Hand</b> drawer'), p3)}${col(l.t('<b>بازیکنان</b>: پنل فشردهٔ هر بازیکن؛ لمس = باز شدن نقشه و نمادها.', '<b>Players</b>'), p4)}</div>`;
}

function flowsMobile(l, P) {
  const me = P.P(0);
  // build
  const sel = 'e2';
  const legal = [...new Set(F.build.placements.filter((p) => p.kind === sel).flatMap((p) => p.cells))];
  const ghost = F.build.placements.find((p) => p.kind === sel && p.cells.includes('2_3'))?.cells || F.build.placements.find((p) => p.kind === sel).cells;
  const KFILE = (k) => (/^e\d$/.test(k) ? `enclosures/enclosure-${k[1]}-empty` : X.KIND_FILE[k]);
  const kinds = ['e1', 'e2', 'e3', 'kiosk', 'pavilion', 'pz'].map((k) => `<button class="an-kind" type="button" aria-pressed="${k === sel}">${IMG(KFILE(k), 'alt=""')}<b>${l.d(M.KIND_FA[k])}</b></button>`).join('');
  const p1 = phone(l, P, { stat: `<b>${l.t('ساخت II، قدرت ۳', 'Build II, 3')}</b>: ${l.d(F.build.label)}`, tabs: null, dock: false,
    body: `${mapWindow(l, P, legal, { picks: legal, ghost, ghostKind: sel })}<div class="an-kinds" style="flex-wrap:nowrap;overflow:auto hidden">${kinds}</div><div class="an-dock__row" style="flex-wrap:wrap"><button class="bgv-btn bgv-btn--primary" type="button" data-act="place">${ICONS.check}${l.t('تأیید (۴ پول)', 'Build (4)')}</button><button class="bgv-btn bgv-btn--secondary" type="button" data-act="rotate">⟳</button><button class="bgv-btn bgv-btn--ghost" type="button" data-act="undo">${ICONS.undo}${l.t('برگشت', 'Back')}</button></div><p class="an-note" style="margin:0">${l.t('نقشه خودکار روی خانه‌های مجاز زوم می‌شود؛ لمس خانه = پیش‌نمایش، ⟳ = جای مجاز بعدی شامل همان خانه.', 'Auto-zoom to legal spaces.')}</p>` });
  // animals
  const p2 = phone(l, P, { stat: `<b>${l.t('حیوانات II، قدرت ۴', 'Animals II, 4')}</b>: ${l.d(F.animals.label)}`, tabs: null, dock: false,
    body: mapWindow(l, P, ['3_4', '4_5', '2_5'], { picks: ['3_4'], ghost: ['3_4'] }, 1.6),
    overlay: `<div class="an-sheetm"><span class="an-sheetm__grip"></span><h3>${l.d(F.animals.label)} · ${l.t('حیوان ۱ از ۲', 'animal 1 of 2')}</h3><div class="an-mopts an-options">${F.animals.options.map((o, i) => FL.optBtn(l, o, { pressed: i === 0 })).join('')}</div><button class="bgv-btn bgv-btn--primary" type="button">${ICONS.check}${l.t('تأیید', 'Confirm')}</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="undo">${ICONS.undo}${l.t('برگشت', 'Back')}</button></div>` });
  // association
  const p3 = phone(l, P, { stat: `<b>${l.t('انجمن، قدرت ۵', 'Association, 5')}</b>: ${l.d(F.assoc.label)}`, tabs: null, dock: false,
    body: `<div class="bgv-felt an-zone">${P.assocBoard(l, { hot: { rep: true, zoo: true, uni: false, project: true } })}</div>`,
    overlay: `<div class="an-sheetm"><span class="an-sheetm__grip"></span><h3>${l.d(F.assoc.label)}</h3><div class="an-mopts an-options">${F.assoc.options.slice(0, 5).map((o, i) => FL.optBtn(l, o, { pressed: i === 2, thumb: o.value.startsWith('pr:') })).join('')}</div></div>` });
  // draft
  const d = F.draft, picked = d.cards.slice(0, 2);
  const p4 = phone(l, P, { stat: `<b>${l.t('انتخاب آغازین', 'Opening draft')}</b>: ${l.t('۴ کارت (۲ از ۴) و ۱ نقشه', '4 cards (2/4) and 1 map')}`, tabs: null, dock: false,
    body: `<div class="an-mgrid" data-act="draft-cards">${d.cards.map((id) => `<div><button class="an-card" type="button" data-pick="${picked.includes(id) ? 'picked' : 'selectable'}">${IMG(cardFile(id), 'alt=""')}${picked.includes(id) ? `<span class="an-check">${ICONS.check}</span>` : ''}</button><span class="an-card__fa">${l.card(id)}</span></div>`).join('')}</div><div class="an-maps2">${d.maps.map((m, i) => `<button class="an-mapbtn" type="button" aria-pressed="${i === 0}" style="inline-size:50%">${IMG('boards/map-' + m, 'alt=""')}${l.t('نقشهٔ', 'Map')} ${l.d(m)}</button>`).join('')}</div><button class="bgv-btn bgv-btn--primary" type="button" data-act="draft" disabled="">${ICONS.check}${l.t('نگه‌داشتن ۴ کارت و نقشه', 'Keep 4 and map')}</button>` });
  return `<div class="an-phones" dir="rtl">${col(l.t('<b>ساخت</b>: زوم خودکار روی جاهای مجاز، پیش‌نمایش ساختمان، انتخاب نوع در ردیف افقی.', '<b>Build</b>'), p1)}${col(l.t('<b>حیوانات</b>: شیت گزینه‌های موتور با تصویر کارت؛ محوطهٔ مقصد روی نقشه حلقه دارد.', '<b>Animals</b>'), p2)}${col(l.t('<b>انجمن</b>: کارهای مجاز روی بورد حلقه دارند و همان‌ها در شیت.', '<b>Association</b>'), p3)}${col(l.t('<b>انتخاب آغازین</b>: ۸ کارت در شبکهٔ ۴تایی، ۲ نقشهٔ پیشرفته.', '<b>Draft</b>'), p4)}</div>`;
}

module.exports = { CSS, turnMobile, flowsMobile };
