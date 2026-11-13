// BGA layout of the Ark Nova table (review 1, 2026-10-30: "make it like BGA"). Measured on a live BGA table:
// display = 6 folders with big cards + reputation strip; association area = conservation strip, played projects above
// and base projects below the association board (cards shown as their bottom band); ONE zoo at a time (eye icon in the
// panels switches it): icons summary, map, played cards in 2 stacked columns, action cards hanging from the clip band.
// Overrides the matching functions of an-parts.js; everything else is reused.
const X = require('./an-lib');
const B = require('./an-parts');
const { M, V, MAP_W, MAP_H, MAPC, STRIP, HEX, hexXY, LEFT_XY, WORKER_XY, PARTNER_XY, UNI_XY, CLIP_X, repX, REP_BONUS, cpX, CP_TILE,
  BAB_W, BAB_H, BAB_ZOO, BAB_UNI, BAB_TASK, BAB_HOT, BAB_DONATE, FOLDER_CITY, LEVEL_XY, BONUS_FILE, UNI_FILE,
  cardFile, bldFile, actFile, fitBuilding, SEATS, pct, at, ICON_ORDER, ICON_FILE, IMG, ICONS } = X;
const { ME, P, ORDER, canAct, ui, cardImg, reason } = B;

const CSS = `
.an-desk{grid-template-columns:minmax(0,1fr) 300px}
/* display: 6 folders, card big (BGA card-pool) */
.an-pool{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.an-folder{display:grid;gap:4px;justify-items:center;padding:0 0 6px;border-radius:6px 6px 4px 4px;background:linear-gradient(180deg,#E9D3A3,#D7B983);box-shadow:inset 0 0 0 1px rgba(98,76,10,.45),0 2px 4px rgba(0,0,0,.3)}
.an-folder__tab{display:flex;align-items:center;justify-content:space-between;inline-size:100%;block-size:26px;padding-inline:8px 4px;box-sizing:border-box;direction:ltr}
.an-folder__tab i{font-size:11px;font-style:italic;color:#624C0A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-folder__tab b{display:grid;place-items:center;min-inline-size:22px;block-size:22px;border-radius:3px;background:#1E1E1E;color:#FFFFFF;font-size:15px;font-weight:900}
.an-folder .an-card{--cw:calc(100% - 14px)}
.an-folder.is-range{box-shadow:inset 0 0 0 1px rgba(98,76,10,.45),0 0 0 3px var(--pick)}
.an-folder__cost{font-size:11.5px;font-weight:700;color:#624C0A}
.an-strip{position:relative;inline-size:100%;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.6)}
.an-strip>.an-base{display:block;inline-size:100%;block-size:auto;border-radius:4px}
.an-rep{margin-block-start:-4px}
.an-rep .an-counter{inline-size:2.5%}
.an-repb{position:absolute;inset-block-start:100%;transform:translate(-50%,2px);inline-size:2.4%;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
.an-cons .an-counter{inline-size:2.9%}
.an-cons .an-btile{inline-size:4.75%}
.an-cnum{position:absolute;transform:translate(-50%,-50%);padding:0 5px;border-radius:9px;background:#1E1E1E;color:#FFFFFF;font-size:12px;font-weight:900;box-shadow:0 0 0 1.5px #FFFFFF}
.an-zoomhint{position:absolute;inset-block-start:6px;inset-inline-end:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:0;border-radius:var(--radius-pill);background:rgba(13,26,35,.78);color:#FFFFFF;font:inherit;font-size:12px;font-weight:700;cursor:zoom-in}
.an-zoomhint .bgv-icon{inline-size:14px;block-size:14px}
/* association area (BGA): projects bands above and below the board */
.an-assoc2{display:grid;gap:8px;justify-items:center}
.an-bab{position:relative;inline-size:100%;aspect-ratio:3335/986;border-radius:6px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.45)}
.an-bab>.an-base{display:block;inline-size:100%;block-size:auto}
.an-bab .an-ptile{inline-size:9.4%}
.an-bab .an-utile{inline-size:10.4%}
.an-bab .an-worker{inline-size:2.6%}
.an-bab .an-done{inline-size:3.6%}
.an-projband{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.an-pbot{position:relative;inline-size:var(--pw,230px);aspect-ratio:400/176;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.45);background:#FFFFFF}
.an-pbot>img.an-pimg{position:absolute;inset-inline:0;inset-block-end:0;inline-size:100%;block-size:auto}
.an-pbot .an-lvl{position:absolute;inline-size:9%;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.an-pbot .an-lvl-x{position:absolute;transform:translate(-50%,-50%);inline-size:11%;aspect-ratio:1;border-radius:50%;background:rgba(13,26,35,.8);color:#FFFFFF;display:grid;place-items:center}
.an-pbot .an-lvl-x .bgv-icon{inline-size:70%;block-size:70%}
.an-pbot .an-hot{border-radius:50%}
.an-pslot{inline-size:var(--pw,230px);aspect-ratio:400/176;border-radius:6px;border:1.5px dashed var(--felt-line);display:grid;place-items:center;color:var(--felt-muted);font-size:12px}
.an-pname{display:block;margin-block-start:3px;font-size:12px;font-weight:700;text-align:center;color:var(--felt-ink)}
/* one zoo at a time */
.an-viewer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--felt-ink);font-size:14px}
.an-viewer b{font-weight:900}
.an-seg{display:inline-flex;gap:3px;padding:3px;border-radius:var(--radius-sm);background:rgba(0,0,0,.25)}
.an-seg button{display:inline-flex;align-items:center;gap:6px;block-size:32px;padding-inline:10px;border:0;border-radius:6px;background:none;color:var(--felt-ink);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}
.an-seg button[aria-pressed="true"]{background:var(--felt-control);color:var(--brand-ink)}
.an-seg i{inline-size:10px;block-size:10px;border-radius:50%;background:var(--sc);box-shadow:0 0 0 1.5px #FFFFFF}
.an-isum{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:6px 10px;border-radius:var(--radius-sm);background:linear-gradient(180deg,#F7F1E3,#E6D8B8);box-shadow:inset 0 0 0 1px rgba(91,58,34,.3)}
.an-isum .an-icons{gap:6px}
.an-isum .an-icn{inline-size:34px;block-size:34px}
.an-map{aspect-ratio:1405/905;overflow:hidden;border-radius:var(--radius-sm)}
.an-map>.an-base{position:absolute;inset-inline-start:0;inset-block-start:0;inline-size:142.349%;max-inline-size:none;block-size:auto;border-radius:0}
.an-note2{position:absolute;inset-block-start:10.5%;inset-inline-start:1.1%;inline-size:13.6%;display:grid;justify-items:center;gap:2px;font-family:'Permanent Marker',Vazirmatn,sans-serif;pointer-events:none}
.an-note2 b{font-size:clamp(11px,1.5vw,17px);font-weight:900;color:var(--sc)}
.an-note2 span{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:900;color:#1E2328}
.an-note2 img{block-size:22px}
.an-played{display:flex;gap:18px;align-items:flex-start;justify-content:center;flex-wrap:wrap;padding:10px 12px;border-radius:var(--radius-sm);background:#F4EDB5;box-shadow:inset 0 0 0 1px rgba(91,58,34,.3)}
.an-pcol{display:grid;justify-items:center;gap:6px;min-inline-size:150px;padding:8px;border-radius:8px;border:1px solid rgba(91,58,34,.35);background:#FFFDF1}
.an-pcol h4{display:flex;align-items:center;gap:6px;margin:0;font-size:12.5px;font-weight:900;color:#4A3B12}
.an-pcol h4 img{block-size:22px}
.an-stack2{display:grid;grid-template-columns:repeat(var(--cols,2),var(--cw,120px));column-gap:6px}
.an-stack2>.an-card{--cw:120px;margin-block-end:calc(var(--cw) * -1.395 * .82)}
.an-stack2>.an-card:nth-last-child(-n+2){margin-block-end:0}
.an-stack2>.an-card:hover{z-index:3}
.an-actband{position:relative;margin-block-start:10px}
.an-clips{position:relative;aspect-ratio:2000/136;overflow:hidden;border-radius:6px}
.an-clips>img{position:absolute;inset-inline-start:0;inset-block-start:-665.44%;inline-size:100%;max-inline-size:none}
.an-actband .an-acts{margin-block-start:-3.4%;padding-inline:2%}
`;

// ---------------- rail (BGA panel: money, X, reputation, conservation, appeal + income, hand n/limit; action order; icons) ----------------
const STAR = '<svg class="an-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" /></svg>';
// BGA player-info row: money (dark rounded square, white number), X count + token, reputation cap, conservation shield,
// appeal ticket (+ break income badge), hand n/limit. Numbers sit ON the icons, bold and high-contrast.
function counters(l, k) {
  const p = P(k);
  return `<span class="an-bpi" dir="ltr">
   <span class="an-bc an-bc--money" title="${l.t('پول', 'Money')}">${ui('money', '', '')}<b class="an-num">${l.d(p.money)}</b></span>
   <span class="an-bc an-bc--x" title="${l.t('نشان X (حداکثر ۵)', 'X-tokens')}"><b class="an-num">${l.d(p.x)}</b>${ui('xtoken', '', '')}</span>
   <span class="an-bc an-bc--rep" title="${l.t('اعتبار', 'Reputation')}">${ui('reputation', '', '')}<b class="an-num">${l.d(p.rep)}</b></span>
   <span class="an-bc an-bc--cp" title="${l.t('امتیاز حفاظت', 'Conservation')}">${ui('conservation', '', '')}<b class="an-num">${l.d(p.cp)}</b></span>
   <span class="an-bc an-bc--appeal" title="${l.t('جذابیت', 'Appeal')}">${ui('appeal', '', '')}<b class="an-num">${l.d(p.appeal)}</b><i class="an-inc an-num" title="${l.t('درآمد استراحت', 'Break income')}">${l.d(M.appealIncome[k])}</i></span>
   <span class="an-bc an-bc--hand" title="${l.t('کارت در دست / سقف در استراحت', 'Hand / limit at break')}"><b class="an-num">${l.d(p.handCount)}<small>/${l.d(p.handLimit)}</small></b>${IMG('card-backs/card-back-zoo', 'alt=""')}</span>
  </span>`;
}
// BGA action-cards-summary: the 5 cards in slot order; frame blue = side I, magenta = side II; tokens as a round badge
const actOrder = (l, k) => `<span class="an-bpa" dir="ltr" aria-label="${l.t('ترتیب کارت‌های کنش (چپ = قدرت ۱)', 'Action card order (left = strength 1)')}">${P(k).slots.map((s, i) => {
  const t = P(k).tok[s]; const tok = t.venom ? 'venom' : t.mult ? 'multiplier' : t.con ? 'constriction' : null;
  return `<span class="an-bpa__s${P(k).up[s] ? ' is-up' : ''}" title="${l.act(s)}${P(k).up[s] ? ' II' : ' I'}، ${l.t('قدرت', 'strength')} ${l.d(i + 1)}">${ui('act-' + s, '', '')}${tok ? IMG('tokens/' + tok, 'class="an-bpa__tok" alt=""') : ''}</span>`;
}).join('')}</span>`;
// BGA icons-summary: continents (n + badge) / categories (badge over n) / bear, pet, science, rock, water (n + badge)
function iconCounts(l, k) {
  const row = (keys, cls = '') => `<div class="an-bpr${cls}">${keys.map((i) => { const n = P(k).icons[i] || 0; const terr = i === 'rock' || i === 'water'; return `<span class="an-bpn${n ? '' : ' is-zero'}" title="${l.icon(i)}: ${l.d(n)}"><b class="an-num">${l.d(n)}</b><span class="an-badge2${terr ? ' is-terrain' : ''}">${IMG(terr ? 'ui/' + i : 'icons/' + ICON_FILE[i], 'alt=""')}</span></span>`; }).join('')}</div>`;
  return `<div class="an-bpicons" dir="ltr">${row(['africa', 'europe', 'asia', 'americas', 'australia'])}${row(['bird', 'predator', 'herbivore', 'reptile', 'primate'], ' an-bpr--col')}${row(['bear', 'pet', 'science', 'rock', 'water'])}</div>`;
}
const scoreStar = (l, k) => `<span class="an-bscore" title="${l.t('امتیاز فعلی = جذابیت − عدد هدف حفاظت', 'Score now = appeal − conservation target')}"><b class="an-num">${l.d(P(k).vp)}</b>${STAR}</span>`;
const PANEL_CSS = `
.bgv-pcard.an-bp{padding:0;overflow:hidden}
.an-bp__head{display:flex;align-items:center;gap:8px;padding:8px 10px 6px}
.an-bp__id{flex:1;min-inline-size:0;display:grid;line-height:1.35}
.an-bp__id b{display:flex;align-items:center;gap:6px;font-size:15.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-bp__id small{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted)}
.an-bscore{display:inline-flex;align-items:center;gap:2px;font-size:15px;font-weight:900;color:var(--heading)}
.an-star{inline-size:16px;block-size:16px;fill:#F2B400;stroke:#9A6812;stroke-width:1}
.an-bpi{display:flex;align-items:center;justify-content:space-between;gap:2px;padding:7px 8px 8px;border-block-start:1px solid var(--border)}
.an-bc{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:2px;block-size:36px}
.an-bc>b{font-family:var(--font-fa);font-weight:900;line-height:1;font-size:19px;color:var(--heading)}
.an-bc--money>img{inline-size:36px;block-size:36px;border-radius:20%;box-shadow:0 0 0 1.5px #FFFFFF,0 1px 2px rgba(0,0,0,.5)}
.an-bc--money>b,.an-bc--rep>b,.an-bc--cp>b,.an-bc--appeal>b{position:absolute;inset:0;display:grid;place-items:center}
.an-bc--money>b{color:#FFFFFF;font-size:20px;text-shadow:0 1px 2px #000,0 0 4px rgba(0,0,0,.6)}
.an-bc--x>img{inline-size:26px}
.an-bc--rep>img{inline-size:40px}
.an-bc--rep>b{color:#FFFFFF;font-size:17px;padding-block-end:9px;text-shadow:0 1px 2px #000}
.an-bc--cp>img{inline-size:33px}
.an-bc--cp>b{color:#FFFFFF;font-size:17px;padding-block-end:2px;text-shadow:0 1px 2px #0E3B16,0 0 3px #0E3B16}
.an-bc--appeal{min-inline-size:34px}
.an-bc--appeal>img{inline-size:27px}
.an-bc--appeal>b{color:#3A1410;font-size:18px;text-shadow:0 0 2px #FFFFFF,0 0 3px #FFFFFF}
.an-bc .an-inc{position:absolute;inset-block-start:-7px;inset-inline-end:-8px;min-inline-size:18px;padding:0 3px;border-radius:9px;background:#5A6670;color:#FFFFFF;font-size:11px;font-style:normal;font-weight:900;line-height:1.5;text-align:center;box-shadow:0 0 0 1.5px #FFFFFF}
.an-bc--hand>b{font-size:19px}
.an-bc--hand>b small{font-size:12.5px;font-weight:700;color:var(--text-muted)}
.an-bc--hand>img{block-size:30px;border-radius:3px;box-shadow:0 0 0 1px #FFFFFF}
.an-bpa{display:flex;justify-content:space-around;padding:9px 6px 8px;border-block-start:1px solid var(--border)}
.an-bpa__s{position:relative;display:grid;place-items:center;inline-size:34px;block-size:34px}
.an-bpa__s>img:first-child{inline-size:30px;block-size:30px;box-sizing:border-box;border:2.5px solid #009FE3;border-radius:6px;background:#FFFFFF;box-shadow:0 0 1px 1px rgba(0,0,0,.9)}
.an-bpa__s.is-up>img:first-child{border-color:#A71B71}
.an-bpa__tok{position:absolute;inset-block-start:-6px;inset-inline-start:-6px;inline-size:17px;border-radius:50%;box-shadow:0 0 0 1.5px #FFFFFF,1px 1px 3px rgba(0,0,0,.5)}
.an-bpicons{border-block-start:1px solid var(--border)}
.an-bpr{display:flex;justify-content:space-between;padding:5px 8px;border-block-end:1px solid var(--line)}
.an-bpr:last-child{border-block-end:0}
.an-bpn{display:inline-flex;align-items:center;gap:3px}
.an-bpn>b{min-inline-size:11px;font-family:var(--font-fa);font-size:18px;font-weight:900;color:var(--heading);text-align:center}
.an-bpr--col .an-bpn{flex-direction:column-reverse;gap:1px}
.an-bpn.is-zero{opacity:.38}
.an-badge2{display:grid;place-items:center;inline-size:27px;block-size:27px;border-radius:50%;border:1.5px solid var(--border);box-shadow:0 0 0 1px #FFFFFF,0 1px 2px rgba(0,0,0,.45);overflow:hidden;background:#FFFFFF}
.an-badge2>img{inline-size:100%;block-size:100%;object-fit:cover}
.an-badge2.is-terrain>img{inline-size:88%;block-size:auto;object-fit:contain}
.an-eye{display:grid;place-items:center;inline-size:30px;block-size:30px;padding:0;border:0;border-radius:50%;background:var(--surface-sunken);color:var(--heading);cursor:pointer}
.an-eye[aria-pressed="true"]{background:var(--selected);color:var(--on-selected)}
.an-eye .bgv-icon{inline-size:18px;block-size:18px}
.an-cfg{padding:10px 12px;display:grid;gap:8px}
.an-cfg__row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.an-brkbox{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border-radius:var(--radius-sm);background:#5B3A22;color:#FFFFFF;font-size:20px;font-weight:900}
.an-brkbox img{block-size:30px;filter:invert(1)}
.an-brkbox small{font-size:12px;font-weight:700;opacity:.85}
.an-pile{display:inline-flex;align-items:center;gap:5px;font-size:15px;font-weight:900;color:var(--heading)}
.an-pile img{block-size:34px;border-radius:3px}
.an[data-theme="dark"] .an-bc--x>img,.an[data-theme="dark"] .an-bc--rep>img{filter:drop-shadow(0 0 1px #FFFFFF) drop-shadow(0 0 1px #FFFFFF)}
.an-ahead .an-bpi{border:0;padding:0;gap:14px;justify-content:flex-start}
`;
const EYE = '<svg class="bgv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>';
function dashboard(l) {
  return `<section class="bgv-card an-cfg" data-an-cfg="" aria-label="${l.t('وضعیت میز', 'Table status')}">
  <div class="an-cfg__row"><span class="an-brkbox" title="${l.t('مسیر استراحت', 'Break track')}">${IMG('wooden-pieces/break-token', 'alt=""')}<span class="an-num">${l.d(V.brk)}/${l.d(V.brkMax)}</span><small>${l.t('استراحت', 'break')}</small></span><span class="an-pile" title="${l.t('دسته', 'Deck')}">${IMG('card-backs/card-back-zoo', 'alt=""')}<span class="an-num">${l.d(V.deckCount)}</span></span><span class="an-pile" title="${l.t('دورریخته', 'Discard')}">${ICONS.x}<span class="an-num">${l.d(V.discardCount)}</span></span></div>
  <div class="an-cfg__row"><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button">${ICONS.book}${l.t('راهنما', 'Help')}</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" aria-haspopup="dialog">${ICONS.zoom}${l.t('بورد امتیاز', 'Score board')}</button><button class="bgv-btn bgv-btn--icon bgv-btn--ghost bgv-btn--sm" type="button" aria-label="${l.t('تنظیمات میز', 'Table settings')}">${ICONS.gear}</button></div>
 </section>`;
}
function panel(l, k, view = ME) {
  const you = k === ME, turn = k === V.current;
  return ` <div class="bgv-pcard an-panel an-bp${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" data-seat="${k}">
  <div class="an-bp__head"><span class="bgv-avatar bgv-avatar--sm${you ? ' is-you' : ''}${turn ? ' is-turn' : ''}" style="--seat-c:var(--an-${SEATS[k].color})">${l.t(SEATS[k].ini[0], SEATS[k].ini[1])}</span><div class="an-bp__id"><b style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}</b><small>${scoreStar(l, k)}<span class="bgv-league bgv-league--${SEATS[k].league[0]}">${l.t(SEATS[k].league[1], SEATS[k].league[2])}</span>${turn ? `<span>${l.t('در حال انتخاب', 'choosing')}</span>` : ''}</small></div><button class="an-eye" type="button" aria-pressed="${k === view}" aria-label="${l.t('دیدن باغ‌وحش ', 'View zoo of ')}${l.name(k)}" title="${l.t('دیدن باغ‌وحش', 'View zoo')}">${EYE}</button></div>
  ${counters(l, k)}
  ${actOrder(l, k)}
  ${iconCounts(l, k)}
 </div>`;
}
function rail(l, view = ME) {
  return `<aside class="an-rail" dir="${l.dir}" aria-label="${l.t('بازیکنان', 'Players')}">
 ${dashboard(l)}
${ORDER.map((k) => panel(l, k, view)).join('\n')}
${B.log(l)}
</aside>`;
}

// ---------------- display: 6 folders + reputation strip ----------------
function display(l, opts = {}) {
  const range = P(ME).range;
  return `<div class="an-pool" dir="ltr" role="group" aria-label="${l.t('ویترین (پوشه‌های ۱ تا ۶)', 'Display (folders 1–6)')}">${V.display.map((id, i) => {
    const inR = i < range && opts.range !== false;
    return `<div class="an-folder${inR ? ' is-range' : ''}" data-folder="${i + 1}"><div class="an-folder__tab"><i>${FOLDER_CITY[i]}</i><b class="an-num">${l.d(i + 1)}</b></div><button class="an-card" type="button" data-id="${id}" aria-label="${l.t('پوشهٔ', 'Folder')} ${l.d(i + 1)}: ${l.card(id)}">${cardImg(id)}</button><span class="an-folder__cost">${inR ? l.t(`در محدوده · ${l.d(i + 1)} پول`, `in range · ${i + 1}`) : l.card(id)}</span></div>`;
  }).join('')}</div>`;
}
function repStrip(l) {
  let h = `<div class="an-strip an-rep" data-an-track="rep" dir="ltr" role="group" aria-label="${l.t('مسیر اعتبار', 'Reputation track')}">${IMG('bga/reputation-track', 'class="an-base" alt="" width="2752" height="95"')}`;
  const seen = {};
  for (const p of V.players) { const x = repX(p.rep); const n = seen[x] = (seen[x] || 0) + 1; h += IMG(`pieces/counter-${SEATS[p.seat].color}`, `class="an-at an-piece an-counter" alt="${l.name(p.seat)}: ${l.t('اعتبار', 'reputation')} ${l.d(p.rep)}" style="left:${((x + (n - 1) * 0.012) * 100).toFixed(2)}%;top:${50 - (n - 1) * 8}%"`); }
  for (const [r, ic] of Object.entries(REP_BONUS)) h += IMG('ui/' + ic, `class="an-repb" alt="" title="${l.t('پاداش اعتبار', 'Reputation bonus')} ${l.d(r)}" style="left:${(repX(Number(r)) * 100).toFixed(2)}%"`);
  return h + '</div>';
}
function displayZone(l) {
  return `<section class="bgv-felt an-zone" aria-label="${l.t('ویترین و مسیر اعتبار', 'Display and reputation')}">
 <div class="an-zone__head"><h2>${l.t('ویترین', 'Display')}</h2><small>${l.t(`پوشه‌های ۱ تا ${l.d(P(ME).range)} در محدودهٔ اعتبار شما (حلقهٔ کهربایی)`, 'Folders in your reputation range are ringed')}</small></div>
 ${display(l)}
 ${repStrip(l)}
 <div style="block-size:22px"></div>
</section>`;
}

// ---------------- association area: conservation strip, projects, BGA association board ----------------
function consStrip(l) {
  let h = `<div class="an-strip an-cons" data-an-track="cp" dir="ltr" role="group" aria-label="${l.t('مسیر حفاظت', 'Conservation track')}">${IMG('bga/conservation-track', 'class="an-base" alt="" width="3188" height="330"')}`;
  const seen = {};
  for (const p of V.players) { const x = cpX(p.cp); const n = seen[x] = (seen[x] || 0) + 1; h += IMG(`pieces/counter-${SEATS[p.seat].color}`, `class="an-at an-piece an-counter" alt="${l.name(p.seat)}: ${l.t('حفاظت', 'conservation')} ${l.d(p.cp)}" style="left:${((x + (n - 1) * 0.016) * 100).toFixed(2)}%;top:${22 - (n - 1) * 5}%"`); if (p.cp > 10) h += `<span class="an-cnum an-num" style="left:${(x * 100).toFixed(2)}%;top:6%">${l.d(p.cp)}</span>`; }
  for (const m of ['5', '8']) V.bonusTiles[m].forEach((t, i) => { const [x, y] = CP_TILE[m][i]; h += IMG('bonus-tiles/' + BONUS_FILE[t], `class="an-at an-piece an-btile" alt="${M.tiles[t]}" title="${M.tiles[t]}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%"`); });
  return h + `<button class="an-zoomhint" type="button" aria-haspopup="dialog">${ICONS.zoom}${l.t('مسیر جذابیت', 'Appeal track')}</button></div>`;
}
function projBottom(l, id, opts = {}) {
  const toks = V.ptoks[id] || [null, null, null];
  const lv = toks.map((s, i) => {
    const x = LEVEL_XY[i][0] * 100, y = 68;
    if (s === -1) return `<span class="an-lvl-x" style="left:${x}%;top:${y}%">${ICONS.x}</span>`;
    if (s === null) return opts.avail && opts.avail.includes(i) ? `<button class="an-hot is-avail" type="button" style="left:${x}%;top:${y}%;inline-size:16%;aspect-ratio:1" aria-label="${l.t('سطح', 'Level')} ${l.d(i + 1)}"></button>` : '';
    return IMG(`pieces/cube-${SEATS[s].color}`, `class="an-lvl" alt="${l.name(s)}" style="left:${x}%;top:${y}%"`);
  }).join('');
  return `<div data-project="${id}"><div class="an-pbot" style="--pw:${opts.pw || 230}px" title="${l.card(id)}">${cardImg(id, 'class="an-pimg" alt=""')}${lv}</div><span class="an-pname">${l.card(id)}</span></div>`;
}
function assocBoard(l, opts = {}) {
  const atb = (x, y) => at(x, y, BAB_W, BAB_H);
  let h = `<div class="an-bab" dir="ltr" data-an-board="association" role="group" aria-label="${l.t('بورد انجمن', 'Association board')}">${IMG('bga/association-board', 'class="an-base" alt="" width="3335" height="986"')}\n`;
  for (const z of V.zoosAvail) h += IMG('partner-zoos/partner-' + z, `class="an-at an-piece an-ptile" alt="${l.t('باغ‌وحش همکار', 'Partner zoo')} ${l.icon(z)}" style="${atb(...BAB_ZOO[z])}"`);
  for (const u of V.unisAvail) h += IMG('universities/' + UNI_FILE[u], `class="an-at an-piece an-utile" alt="${M.UNI_FA[u]}" style="${atb(...BAB_UNI[u])}"`);
  for (let i = 0; i < V.donations; i++) h += `<span class="an-done" style="${atb(...BAB_DONATE[Math.min(i, 7)])}">${ICONS.check}</span>`;
  for (const [task, seats] of Object.entries(V.assoc)) seats.forEach((s, i) => { const [x, y] = BAB_TASK[task]; h += IMG(`pieces/worker-${SEATS[s].color}`, `class="an-at an-piece an-worker" alt="${l.name(s)}" style="${atb(x - 90 + i * 90, y)}"`); });
  if (opts.hot) for (const [task, ok] of Object.entries(opts.hot)) { const [x, y, w, hh] = BAB_HOT[task]; h += `<button class="an-hot${ok ? ' is-avail' : ''}" type="button" data-task="${task}" style="${atb(x, y)};inline-size:${pct(w, BAB_W)};block-size:${pct(hh, BAB_H)}"${ok ? '' : ' disabled=""'} aria-label="${task}"></button>`; }
  return h + '</div>';
}
function associationZone(l, opts = {}) {
  const played = V.projects;
  return `<section class="bgv-felt an-zone" aria-label="${l.t('مسیر حفاظت و انجمن', 'Conservation and association')}">
 ${consStrip(l)}
 <div class="an-assoc2">
  <div class="an-projband" aria-label="${l.t('پروژه‌های بازی‌شده', 'Played projects')}">${played.length ? played.map((id) => projBottom(l, id)).join('') : `<span class="an-pslot">${l.t('پروژهٔ بازی‌شده اینجا می‌نشیند', 'Played projects go here')}</span><span class="an-pslot">${l.t('حداکثر ۲ (۳ در ۴ نفره)', 'max 2 (3 with 4 players)')}</span>`}</div>
  ${assocBoard(l, opts)}
  <div class="an-projband" aria-label="${l.t('پروژه‌های پایه', 'Base projects')}">${V.baseProjects.map((id) => projBottom(l, id, { avail: opts.avail && opts.avail[id] })).join('')}</div>
 </div>
</section>`;
}

// ---------------- zoo (one at a time) ----------------
function zoo(l, k, opts = {}) {
  const p = P(k);
  const atm = (x, y) => at(x, y, MAPC.w, MAPC.h);
  let h = `<div class="an-zoomap" dir="ltr" data-an-zoo="${k}"><div class="an-map an-board__map" role="group" aria-label="${l.t('نقشهٔ باغ‌وحش', 'Zoo map')} ${l.name(k)}" style="--sc:var(--an-${SEATS[k].color}-ink)">
  ${IMG('boards/map-' + p.map, `class="an-base" alt="" width="2000" height="1041"`)}\n`;
  h += `  <span class="an-note2" style="--sc:var(--an-${SEATS[k].color}-ink)"><b>${l.name(k)}</b><span>${l.d(p.workers)} × ${IMG(`pieces/worker-${SEATS[k].color}`, 'alt=""')}</span></span>\n`;
  for (const b of p.buildings) {
    const file = bldFile(b); if (!file) continue;
    const f = fitBuilding(file, b.cells);
    h += `  ${IMG(file, `class="an-bld" data-building="${b.id}" data-kind="${b.kind}" alt="${M.KIND_FA[b.kind] || b.kind}${b.full ? l.t('، پر', ', occupied') : ''}" style="left:${pct(f.x, MAPC.w)};top:${pct(f.y, MAPC.h)};inline-size:${pct(f.w, MAPC.w)};transform:translate(-50%,-50%) rotate(${f.deg}deg)${f.mx < 0 ? ' scaleX(-1)' : ''}"`)}\n`;
  }
  { const R = HEX.r * 0.96, poly = (x, y) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (60 * i) * Math.PI / 180; return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
    h += `  <svg class="an-hexes an-hit" viewBox="0 0 ${MAPC.w} ${MAPC.h}" aria-hidden="true">${p.buildings.flatMap((b) => b.cells.map((c) => `<polygon class="an-hex--b" data-building="${b.id}" points="${poly(...hexXY(c))}" />`)).join('')}</svg>\n`;
    if (opts.picks) {
      h += `  <svg class="an-hexes" viewBox="0 0 ${MAPC.w} ${MAPC.h}" aria-hidden="true">${opts.picks.map((c) => `<polygon class="an-hex" points="${poly(...hexXY(c))}" />`).join('')}${(opts.ghost || []).map((c) => `<polygon class="an-hex an-hex--ghost" points="${poly(...hexXY(c))}" />`).join('')}</svg>\n`;
      if (opts.ghostKind) { const gf = /^e\d$/.test(opts.ghostKind) ? `enclosures/enclosure-${opts.ghostKind[1]}-empty` : X.KIND_FILE[opts.ghostKind]; const f = fitBuilding(gf, opts.ghost); h += `  ${IMG(gf, `class="an-bld an-bld--ghost" alt="${l.t('پیش‌نمایش', 'Preview')}" style="left:${pct(f.x, MAPC.w)};top:${pct(f.y, MAPC.h)};inline-size:${pct(f.w, MAPC.w)};transform:translate(-50%,-50%) rotate(${f.deg}deg)${f.mx < 0 ? ' scaleX(-1)' : ''}"`)}\n`; }
      for (const c of opts.picks) h += `  <button class="an-hot" type="button" data-cell="${c}" style="${atm(...hexXY(c))};inline-size:9%;aspect-ratio:1.15;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);border-radius:0" aria-label="${l.t('خانهٔ', 'Space')} ${c}"></button>\n`;
    }
  }
  p.left.forEach((on, i) => { if (on) h += `  ${IMG(`pieces/cube-${SEATS[k].color}`, `class="an-at an-piece an-cube" alt="" style="${atm(...LEFT_XY[i])}"`)}\n`; });
  for (let i = p.hired; i < 3; i++) h += `  ${IMG(`pieces/worker-${SEATS[k].color}`, `class="an-at an-piece an-worker" alt="" style="${atm(...WORKER_XY[i])}"`)}\n`;
  p.partners.forEach((z, i) => { h += `  ${IMG('partner-zoos/partner-' + z, `class="an-at an-piece an-ptile" alt="${l.icon(z)}" style="${atm(...PARTNER_XY[i])}"`)}\n`; });
  p.unis.forEach((u, i) => { h += `  ${IMG('universities/' + UNI_FILE[u], `class="an-at an-piece an-utile" alt="${M.UNI_FA[u]}" style="${atm(...UNI_XY[i])}"`)}\n`; });
  h += ' </div>\n';
  if (opts.acts !== false) h += actBand(l, k, opts);
  return h + '</div>';
}
function actBand(l, k, opts = {}) {
  const p = P(k);
  return ` <div class="an-actband" dir="ltr"><div class="an-clips">${IMG('boards/map-' + p.map, 'alt=""')}</div><div class="an-acts" role="group" aria-label="${l.t('کارت‌های کنش (خانهٔ ۱ تا ۵)', 'Action cards (slots 1–5)')}">${p.slots.map((key, i) => {
    const mine = k === ME && opts.choose !== false;
    const ok = mine && canAct(key);
    const tk = p.tok[key];
    const toks = [...Array(tk.mult).fill('multiplier'), ...Array(tk.venom).fill('venom'), ...Array(tk.con).fill('constriction')];
    return `<button class="an-act an-opt${ok ? ' is-avail' : ''}" type="button" data-opt="a:${key}:0" data-slot="${i + 1}"${mine ? '' : ' disabled=""'} aria-label="${l.act(key)}${p.up[key] ? ' II' : ''}، ${l.t('قدرت', 'strength')} ${l.d(p.strengths[i])}">${IMG(actFile(key, p.up[key]), 'alt=""')}<span class="an-act__str an-num">${l.d(p.strengths[i])}</span>${toks.length ? `<span class="an-act__toks">${toks.map((t) => IMG('tokens/' + t, `alt="${t}"`)).join('')}</span>` : ''}<span class="an-act__fa">${l.act(key)}${p.up[key] ? ' II' : ''}</span></button>`;
  }).join('')}</div></div>\n`;
}
function played(l, k) {
  const p = P(k);
  const animals = p.zoo.filter((id) => id >= 401), sponsors = p.zoo.filter((id) => id < 401);
  const col = (title, icon, ids, cols) => `<div class="an-pcol"><h4>${ui(icon, '', '')}${title} <span class="an-num">(${l.d(ids.length)})</span></h4><div class="an-stack2" style="--cols:${Math.max(1, Math.min(cols, ids.length))}">${ids.map((id) => `<div class="an-card" title="${l.card(id)}" data-flip="card-${id}">${cardImg(id)}</div>`).join('')}</div></div>`;
  const finals = k === ME ? V.me.finals.map((id) => `<div class="an-card" style="--cw:96px" title="${l.card(id)}">${cardImg(id)}</div>`).join('')
    : Array(p.finalsCount).fill(`<div class="an-card" style="--cw:76px">${IMG('card-backs/card-back-final', 'alt=""')}</div>`).join('');
  return `<div class="an-played an-zoo-cards">${col(l.t('حیوانات', 'Animals'), 'act-animals', animals, 2)}${col(l.t('حامیان', 'Sponsors'), 'act-sponsors', sponsors, 2)}<div class="an-pcol"><h4>${ui('endgame', '', '')}${l.t('امتیاز پایانی', 'Final scoring')}${k === ME ? '' : l.t(' (مخفی)', ' (hidden)')}</h4><div style="display:flex;gap:6px">${finals}</div></div></div>`;
}
function iconSummary(l, k) {
  const grp = (keys) => `<span class="an-icons">${keys.map((i) => { const n = P(k).icons[i] || 0; return `<span class="an-icn${n ? '' : ' is-zero'}" title="${l.icon(i)}: ${l.d(n)}">${IMG('icons/' + ICON_FILE[i], 'alt=""')}${n ? `<b class="an-num">${l.d(n)}</b>` : ''}</span>`; }).join('')}</span>`;
  return `<div class="an-isum" dir="ltr">${grp(['africa', 'europe', 'asia', 'americas', 'australia'])}${grp(['bird', 'predator', 'herbivore', 'reptile', 'primate'])}${grp(['bear', 'pet', 'science', 'rock', 'water'])}</div>`;
}
function zooZone(l, k = ME, opts = {}) {
  return `<section class="bgv-felt an-zone an-zoo an-player${k === ME ? ' an-player--me' : ''}" style="--pc:var(--an-${SEATS[k].color})" data-seat="${k}" aria-label="${l.t('باغ‌وحش ', 'Zoo of ')}${l.name(k)}">
 <div class="an-viewer"><b>${l.t('باغ‌وحش', 'Zoo')}</b><span class="an-seg" role="group" aria-label="${l.t('دیدن باغ‌وحش', 'View zoo')}">${[0, 1, 2, 3].map((s) => `<button type="button" aria-pressed="${s === k}" style="--sc:var(--an-${SEATS[s].color})"><i></i>${l.name(s)}${s === ME ? l.t(' (شما)', ' (you)') : ''}</button>`).join('')}</span><small style="color:var(--felt-muted)">${l.t('فقط یک باغ‌وحش دیده می‌شود (مثل BGA)؛ چشمِ پنل‌ها هم عوضش می‌کند.', 'One zoo at a time (like BGA); the eye in the panels switches it too.')}</small></div>
 ${iconSummary(l, k)}
 ${zoo(l, k, { ...opts, acts: false })}
 ${played(l, k)}
 ${actBand(l, k, opts)}
</section>`;
}
function areaHead(l, k) { return `<div class="an-ahead"><span class="an-ahead__name" style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}${k === ME ? l.t('، شما', ' (you)') : ''}</span>${scoreStar(l, k)}${counters(l, k)}</div>`; }
function mainBoard(l, opts = {}) { return `${display(l, opts)}${repStrip(l)}<div style="block-size:22px"></div>`; }

module.exports = { ...B, CSS: CSS + PANEL_CSS, counters, actOrder, iconCounts, scoreStar, scoreBadge: scoreStar, dashboard, panel, rail, display, repStrip, displayZone, consStrip, projBottom, projCard: (l, id, o = {}) => projBottom(l, id, { ...o, pw: o.cw ? o.cw * 1.7 : 230 }), assocBoard, associationZone, zoo, actBand, played, iconSummary, zooZone, areaHead, mainBoard, boardMain: B.mainBoard };
