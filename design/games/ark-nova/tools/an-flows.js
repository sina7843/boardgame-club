// Action and phase boards (desktop): every step, option, label and number is an engine prompt from work/mock.json
// (mock2.mjs runs each answer on a clone of the mid-game state).
const X = require('./an-lib');
const { M, V, SEATS, IMG, ICONS, MAP_W, MAP_H, hexXY, BONUS_FILE, cardFile } = X;
const F = M.flows;

const CSS = `
.an-sheet{padding:28px;display:grid;gap:22px;background:var(--bg);color:var(--text)}
.an-sheet>h1{margin:0;font-size:26px;font-weight:900;color:var(--heading)}
.an-sheet>p{margin:-12px 0 0;font-size:14.5px;color:var(--text-muted)}
.an-flows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
.an-flow{padding:14px;display:grid;gap:12px;align-content:start}
.an-flow__head{display:flex;align-items:center;gap:10px}
.an-flow__n{display:grid;place-items:center;inline-size:30px;block-size:30px;border-radius:8px;background:var(--selected);color:var(--on-selected);font-weight:900}
.an-flow__head h2{margin:0;font-size:17px;font-weight:900;color:var(--heading)}
.an-flow__head small{margin-inline-start:auto;font-size:12.5px;color:var(--text-muted)}
.an-flow .an-bar{position:static}
.an-flow .bgv-felt{padding:10px;border-radius:var(--radius-md)}
.an-note{margin:0;padding:8px 10px;border-radius:var(--radius-sm);background:var(--info-soft);color:var(--text);font-size:13px;line-height:1.7}
.an-note b{color:var(--heading)}
.an-optc{display:inline-flex;align-items:center;gap:6px;text-align:start}
.an-optc img{block-size:42px;inline-size:auto;border-radius:3px}
.an-kinds{display:flex;flex-wrap:wrap;gap:6px}
.an-kind{display:grid;justify-items:center;gap:2px;inline-size:74px;padding:6px 4px;border:0;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:inset 0 0 0 1.5px var(--line);font:inherit;font-size:12px;color:var(--text);cursor:pointer}
.an-kind img{block-size:34px;inline-size:auto}
.an-kind b{font-size:12.5px;font-weight:900;color:var(--heading)}
.an-kind[aria-pressed="true"]{box-shadow:inset 0 0 0 3px var(--pick);background:var(--invite-soft)}
.an-kind:disabled{opacity:.45;cursor:not-allowed}
.an-tiles{display:flex;gap:10px;flex-wrap:wrap}
.an-tilebtn{display:grid;justify-items:center;gap:4px;inline-size:120px;padding:8px;border:0;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:inset 0 0 0 1.5px var(--line);font:inherit;font-size:12.5px;line-height:1.5;color:var(--text);cursor:pointer;text-align:center}
.an-tilebtn img{block-size:56px;inline-size:auto}
.an-tilebtn[aria-pressed="true"]{box-shadow:inset 0 0 0 3px var(--pick);background:var(--invite-soft)}
.an-tbl{inline-size:100%;border-collapse:collapse;font-size:13.5px}
.an-tbl th,.an-tbl td{padding:7px 8px;border-block-end:1px solid var(--line);text-align:start}
.an-tbl th{font-weight:700;color:var(--label);font-size:12.5px}
.an-tbl td b{font-weight:900;color:var(--heading)}
.an-tbl .an-ic{block-size:20px}
.an-maps2{display:flex;gap:12px}
.an-mapbtn{display:grid;gap:4px;padding:6px;border:0;border-radius:var(--radius-sm);background:var(--surface-sunken);box-shadow:inset 0 0 0 1.5px var(--line);font:inherit;font-size:13px;font-weight:700;color:var(--text);cursor:pointer;inline-size:300px;text-align:start}
.an-mapbtn img{inline-size:100%;border-radius:6px}
.an-mapbtn small{font-weight:400;color:var(--text-muted);line-height:1.6}
.an-mapbtn[aria-pressed="true"]{box-shadow:inset 0 0 0 3px var(--pick);background:var(--invite-soft)}
`;

const ui = (n, cls = 'an-ic') => IMG('ui/' + n, `class="${cls}" alt=""`);
const idOf = (v) => { const m = /^(?:sp:|pr:)?(\d{3})/.exec(v); return m ? Number(m[1]) : null; };
function optBtn(l, o, opts = {}) {
  const id = opts.thumb === false ? null : idOf(o.value);
  return `<button class="bgv-btn bgv-btn--${opts.primary ? 'primary' : 'secondary'} bgv-btn--sm an-opt${opts.cls || ''}" type="button" data-opt="${o.value}"${o.value.startsWith('x:') ? ' data-x="1"' : ''}${opts.pressed ? ' aria-pressed="true"' : ''}>${id ? `<span class="an-optc">${IMG(cardFile(id), 'alt=""')}${l.d(o.label)}</span>` : l.d(o.label)}</button>`;
}
function bar(l, { title, text, options = '', skip = false, back = true, steps = '', clock = true, extra = '' }) {
  return `<section class="an-bar an-prompt" aria-live="polite">
  ${steps ? `<div class="an-steps">${steps}</div>` : ''}
  <div class="an-bar__row"><span class="an-bar__text"><b>${title}</b>${text ? ': ' + text : ''}</span>${clock ? `<span class="bgv-clock bgv-clock--chip" data-state="calm" style="--p:0.86;"><span class="bgv-clock__ring"></span><span class="bgv-clock__time">${l.t('۲۱ ساعت', '21h')}</span></span>` : ''}</div>
  ${options ? `<div class="an-bar__row an-options">${options}</div>` : ''}
  ${extra}
  <div class="an-bar__row">${back ? `<button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="undo">${ICONS.undo}${l.t('برگشت (تا قبل از تأیید)', 'Back (until confirmed)')}</button>` : ''}${skip ? `<button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="skip">${l.t('رد کردن', 'Skip')}</button>` : ''}</div>
 </section>`;
}
const step = (t, st) => `<span class="an-step${st === 'done' ? ' is-done' : st === 'cur' ? ' is-cur' : ''}">${st === 'done' ? ICONS.check : ''}${t}</span>`;
const flow = (n, title, sub, body) => `<article class="bgv-card an-flow"><div class="an-flow__head"><span class="an-flow__n">${n}</span><h2>${title}</h2><small>${sub}</small></div>${body}</article>`;

// ---------------- actions ----------------
function actionsDesktop(l, P) {
  const me = P.P(0);
  const sAnimals = me.strengths[me.slots.indexOf('animals')];
  // 1 animals
  const a1 = flow('۱', l.t('حیوانات II', 'Animals II'), l.t(`قدرت ${l.d(sAnimals)}: تا ۲ حیوان؛ از دست یا ویترین در محدودهٔ اعتبار (+شمارهٔ پوشه)`, 'strength 4: up to 2 animals'),
    bar(l, { title: l.t(`حیوانات II با قدرت ${l.d(sAnimals)}`, 'Animals II'), text: l.d(F.animals.label), steps: step(l.t('کارت کنش', 'Card'), 'done') + step(l.t('حیوان ۱ از ۲', 'Animal 1/2'), 'cur') + step(l.t('حیوان ۲ (اختیاری)', 'Animal 2 (optional)')),
      options: F.animals.options.map((o, i) => optBtn(l, o, { pressed: i === 0 })).join('') })
    + `<div class="bgv-felt"><div class="an-hand">${M.handInfo.filter((h) => h.kind === 'animal').map((h) => P.handCard(l, h.id === 486 ? h : { ...h, error: h.error }, { cw: 104, pick: h.id === 486 ? 'picked' : undefined })).join('')}</div></div>`
    + `<div class="bgv-felt">${P.zoo(l, 0, { picks: ['3_4'], ghost: ['3_4'], choose: false, acts: false })}</div>`
    + `<p class="an-note">${l.t('کارت انتخاب‌شده ← محوطه‌های مجاز روی نقشه حلقه می‌گیرند (اینجا فقط محوطهٔ ۱ خانهٔ <b>3_4</b>؛ گورخر «بدون محوطه» است). بعد از تأیید، پرسش بعدی موتور: «', 'Picked card → legal enclosures ring on the map. Next engine prompt: «')}${l.d(F.animals2.label)}${l.t('» با «رد کردن».', '» with Skip.')}</p>`);
  // 2 build
  const bk = F.build.kinds;
  const sel = 'e2';
  const legal = [...new Set(F.build.placements.filter((p) => p.kind === sel).flatMap((p) => p.cells))];
  const ghost = F.build.placements.find((p) => p.kind === sel && p.cells.includes('2_3'))?.cells || F.build.placements.find((p) => p.kind === sel).cells;
  const KFILE = (k) => (/^e\d$/.test(k) ? `enclosures/enclosure-${k[1]}-empty` : X.KIND_FILE[k]);
  const SIZE = { e1: 1, e2: 2, e3: 3, e4: 4, e5: 5, kiosk: 1, pavilion: 1, pz: 3, rh: 5, ba: 5 };
  const kinds = ['e1', 'e2', 'e3', 'e4', 'e5', 'kiosk', 'pavilion', 'pz', 'rh', 'ba'].map((k) => `<button class="an-kind" type="button" data-kind="${k}" aria-pressed="${k === sel}"${bk.includes(k) ? '' : ` disabled="" title="${l.t('قدرت یا جای کافی نیست / از قبل ساخته شده', 'Not enough strength or room / already built')}"`}>${IMG(KFILE(k), 'alt=""')}<b>${l.d(M.KIND_FA[k] || k)}</b>${l.d(SIZE[k] * 2)} ${l.t('پول', '$')}</button>`).join('');
  const sBuild = me.strengths[me.slots.indexOf('build')];
  const a2 = flow('۲', l.t('ساخت II', 'Build II'), l.t(`قدرت ${l.d(sBuild)}: چند ساختمانِ متفاوت تا ${l.d(sBuild)} خانه؛ ۲ پول هر خانه`, 'several different buildings'),
    bar(l, { title: l.t(`ساخت II با قدرت ${l.d(sBuild)}`, 'Build II'), text: l.d(F.build.label), steps: step(l.t('کارت کنش', 'Card'), 'done') + step(l.t('نوع', 'Kind'), 'done') + step(l.t('جا', 'Space'), 'cur') + step(l.t('ساختمان بعدی (اختیاری)', 'Next (optional)')),
      extra: `<div class="an-kinds" role="radiogroup" aria-label="${l.t('نوع ساختمان', 'Building kind')}">${kinds}</div><div class="an-bar__row"><label class="an-small" style="font-size:13px">${l.t('یا از فهرست:', 'or from the list:')} <select data-act="placements" class="bgv-select bgv-select--sm" aria-label="${l.t('جاهای مجاز', 'Legal placements')}"><option>${l.t(`${l.d(F.build.placements.length)} جای مجاز`, `${F.build.placements.length} legal`)}</option><option selected>${M.KIND_FA[sel]}: ${ghost.join('، ')}</option></select></label><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="place">${ICONS.check}${l.t('تأیید ساخت (۴ پول)', 'Build (4 money)')}</button><button class="bgv-btn bgv-btn--ghost bgv-btn--sm" type="button" data-act="rotate">${l.t('چرخاندن ⟳', 'Rotate ⟳')}</button></div>` })
    + `<div class="bgv-felt">${P.zoo(l, 0, { picks: legal, ghost, ghostKind: sel, choose: false, acts: false })}</div>`
    + `<p class="an-note">${l.t(`حلقه = هر خانه‌ای که جزو دست‌کم یک جای مجاز «${M.KIND_FA[sel]}» است (${l.d(legal.length)} خانه از فهرست موتور). کلیک یک خانه → نزدیک‌ترین جای مجاز شامل آن پیش‌نمایش (پررنگ) می‌شود؛ «چرخاندن» جای مجاز بعدی شامل همان خانه را نشان می‌دهد. خانه‌های آب، صخره و علامت‌دار بدون ساخت II حلقه نمی‌گیرند.`, 'Ring = any space in at least one legal placement.')}</p>`);
  // 3 association
  const pr = 101;
  const a3 = flow('۳', l.t('انجمن', 'Association'), l.t('قدرت ۵: یک کار (کارمند لازم)', 'strength 5: one task'),
    bar(l, { title: l.t('انجمن با قدرت ۵', 'Association 5'), text: l.d(F.assoc.label), steps: step(l.t('کارت کنش', 'Card'), 'done') + step(l.t('کار', 'Task'), 'cur') + step(l.t('پاداش حفاظت', 'CP bonus')),
      options: F.assoc.options.map((o, i) => optBtn(l, o, { pressed: i === 2, thumb: o.value.startsWith('pr:') })).join('') })
    + `<div class="bgv-felt">${P.assocBoard(l, { hot: { rep: true, zoo: true, uni: false, project: true } })}<div class="an-projrow" style="margin-block-start:10px">${P.projCard(l, pr, { cw: 120, avail: [0, 2] })}${P.projCard(l, 127, { cw: 120 })}</div></div>`
    + `<p class="an-note">${l.t('کارهای مجاز روی بورد انجمن حلقه دارند (دانشگاهی آزاد نیست، پس آن ستون غیرفعال است). سطح‌های آزاد پروژه روی خود کارت زدنی‌اند. حمایت ۵ حفاظت ← امتیاز به ', 'Legal tasks ring on the board. Supporting gives CP → ')}${l.d(F.assocAfterView.cp)}${l.t(' می‌رسد و موتور پرسش «', ' and the engine asks «')}${l.d(F.assocAfter.label)}${l.t('» را می‌دهد:', '»:')}</p>`
    + `<div class="an-tiles">${F.assocAfter.options.map((o, i) => `<button class="an-tilebtn an-opt" type="button" data-opt="${o.value}" aria-pressed="${i === 1}">${o.value.startsWith('tile:') ? IMG('bonus-tiles/' + BONUS_FILE[o.value.slice(5)], 'alt=""') : ui('money', '')}${l.d(o.label)}</button>`).join('')}</div>`);
  // 4 sponsors
  const a4 = flow('۴', l.t('حامیان با ۲ نشان X', 'Sponsors with 2 X'), l.t('قدرت ۲ + ۲ = ۴', 'strength 2+2 = 4'),
    bar(l, { title: l.t('حامیان با قدرت ۴ (۲ نشان X)', 'Sponsors 4 (2 X)'), text: l.d(F.sponsors4.label), steps: step(l.t('کارت کنش + X', 'Card + X'), 'done') + step(l.t('حامی یا پول', 'Sponsor or money'), 'cur'),
      options: F.sponsors4.options.map((o, i) => optBtn(l, o, { pressed: i === 0 })).join('') })
    + `<div class="bgv-felt" style="display:flex;gap:14px;align-items:flex-start">${P.handCard(l, M.handInfo.find((h) => h.id === 210), { cw: 120, pick: 'picked' })}${P.zoomCard(l, 210)}</div>`
    + `<p class="an-note">${l.t('سطح حامی (۴) ≤ قدرت. «پیشروی در مسیر استراحت و پول» همیشه هست؛ اگر نشان استراحت به ته مسیر برسد بازیکن ۱ نشان X می‌گیرد و استراحت در پایان همین نوبت اجرا می‌شود.', 'Level ≤ strength. The break-and-money option is always there.')}</p>`);
  // 5 cards
  const a5 = flow('۵', l.t('کارت‌ها با ۲ نشان X', 'Cards with 2 X'), l.t('قدرت ۱ + ۲ = ۳: ۲ بکش، ۱ دور بریز', 'strength 3: draw 2, discard 1'),
    bar(l, { title: l.t('کارت‌ها با قدرت ۳', 'Cards 3'), text: l.d(F.cards3.label), steps: step(l.t('کارت کنش + X', 'Card + X'), 'done') + step(l.t('کشیدن', 'Draw'), 'cur') + step(l.t('دور ریختن ۱', 'Discard 1')),
      options: F.cards3.options.map((o) => optBtn(l, o)).join('') + `<button class="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" disabled="" title="${l.t('قاپیدن از قدرت ۵ (سمت I)', 'Snap needs strength 5 (side I)')}">${ui('snapping')}${l.t('قاپیدن از ویترین', 'Snap from display')}</button>` })
    + `<div class="bgv-felt">${P.mainBoard(l)}</div>`
    + `<p class="an-note">${l.t('مسیر استراحت ۲ خانه جلو می‌رود (در خود کنش). پوشه‌های داخل محدودهٔ اعتبار شما (۱ تا ۳) حلقهٔ کهربایی دارند؛ برداشتن از آن‌ها فقط در سمت II است و قاپیدن (هر پوشه) از قدرت ۵ در سمت I یا ۳ در سمت II.', 'Break advances 2. Folders in your reputation range are ringed.')}</p>`);
  // 6 x-token action
  const xs = V.prompt.options.filter((o) => o.value.startsWith('x:'));
  const a6 = flow('۶', l.t('کنش نشان X', 'X-token action'), l.t('بدون اجرا: کارت به خانهٔ ۱ و +۱ نشان X', 'card to slot 1, +1 X'),
    bar(l, { title: l.t('کنش نشان X', 'X-token action'), text: l.t('کدام کارت به خانهٔ ۱ برود؟ (نشان X شما: ۲ از ۵)', 'Which card goes to slot 1?'), steps: step(l.t('حالت X', 'X mode'), 'done') + step(l.t('کارت', 'Card'), 'cur'),
      options: xs.map((o) => optBtn(l, o)).join('') })
    + `<p class="an-note">${l.t('با ۵ نشان X این گزینه‌ها از موتور نمی‌آیند و دکمه غیرفعال با دلیل «حداکثر ۵ نشان X» است. کارتی که نشان دوبرابرکننده دارد به ازای هر نشان ۱ نشان X اضافه می‌دهد.', 'At 5 X-tokens the engine offers none.')}</p>`);
  return `<div class="an-sheet" dir="rtl"><h1>${l.t('آرک نوا: هر کنش قدم‌به‌قدم (از موتور)', 'Ark Nova: every action step by step')}</h1><p>${l.t('همهٔ متن دکمه‌ها برچسب پرسش موتور است (core.ts/flow.ts)؛ عددها با رقم فارسی نشان داده می‌شوند. هر پاسخ همان لحظه فرستاده می‌شود؛ «برگشت» فقط تا قبل از تأیید همان قدم است.', 'All button texts are engine prompt labels.')}</p><div class="an-flows">${a1}${a2}${a3}${a4}${a5}${a6}</div></div>`;
}

// ---------------- phases ----------------
function phasesDesktop(l, P) {
  const d = F.draft;
  const picked = d.cards.slice(0, 2);
  const draft = flow('۱', l.t('انتخاب آغازین (هم‌زمان)', 'Opening draft (simultaneous)'), l.t('۸ کارت ← ۴ نگه دارید؛ پیشرفته: ۱ از ۲ نقشه', 'keep 4 of 8; advanced: 1 of 2 maps'),
    bar(l, { title: l.t('انتخاب آغازین', 'Opening draft'), text: l.t(`۴ کارت نگه دارید (${l.d(picked.length)} از ۴) و یک نقشه انتخاب کنید. بقیهٔ بازیکنان هم‌زمان انتخاب می‌کنند.`, 'Keep 4 cards and pick a map.'), back: false,
      extra: `<div class="an-bar__row"><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="draft" disabled="">${ICONS.check}${l.t('نگه‌داشتن ۴ کارت و نقشه', 'Keep 4 cards and map')}</button><span class="an-small" style="font-size:13px;color:var(--text-muted)">${l.t('آمادهٔ بقیه: نیلوفر ✓، آرش …، سارا …', 'Others: …')}</span></div>` })
    + `<div class="bgv-felt"><div class="an-hand" data-act="draft-cards">${d.cards.map((id) => `<div><button class="an-card" type="button" data-id="${id}" data-pick="${picked.includes(id) ? 'picked' : 'selectable'}" style="--cw:118px">${IMG(cardFile(id), 'alt=""')}${picked.includes(id) ? `<span class="an-check">${ICONS.check}</span>` : ''}</button><span class="an-card__fa" style="inline-size:118px">${l.card(id)}</span></div>`).join('')}</div></div>`
    + `<div class="an-maps2" role="radiogroup">${d.maps.map((m, i) => `<button class="an-mapbtn" type="button" data-map="${m}" aria-pressed="${i === 0}">${IMG('boards/map-' + m, 'alt=""')}${l.t('نقشهٔ', 'Map')} ${l.d(m)}: ${M.maps[m].nameFa}<small>${l.d(M.maps[m].textFa || '')}</small></button>`).join('')}</div>`);
  const cp2 = flow('۲', l.t('پاداش مسیر حفاظت', 'Conservation track bonus'), l.t('در ۲، ۵ و ۸ امتیاز حفاظت؛ ۱۰ = کنار گذاشتن کارت پایانی برای همه', 'at 2, 5, 8 CP'),
    bar(l, { title: l.d(F.cp2.label), text: l.t('یکی را انتخاب کنید', 'Choose one'), back: false, options: F.cp2.options.map((o) => optBtn(l, o, { thumb: false })).join('') })
    + `<p class="an-note">${l.t('در ۵ و ۸: «۵ پول» یا یکی از ۲ کاشی پاداش کنار همان خانه (روی بورد اصلی، زدنی). نمونهٔ ۵ در بورد «کنش‌ها» آمده است.', 'At 5 and 8: 5 money or one of the 2 bonus tiles.')}</p>`);
  const inc = F.income;
  const brk = flow('۳', l.t('استراحت', 'Break'), l.t('سقف دست، برداشتن نشان‌ها، کارمندان، ویترین، درآمد', 'hand limit, tokens, workers, display, income'),
    bar(l, { title: l.t('استراحت', 'Break'), text: l.d(F.breakDiscard.label), back: false, steps: step(l.t('سقف دست', 'Hand limit'), 'cur') + step(l.t('بازگشت کارمندان و نشان‌ها', 'Workers & tokens')) + step(l.t('ویترین ۱ و ۲ دور', 'Folders 1–2 out')) + step(l.t('درآمد', 'Income')),
      extra: `<div class="an-bar__row"><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="submit" disabled="">${ICONS.check}${l.t('دور ریختن (۲ از ۴)', 'Discard (2 of 4)')}</button></div>` })
    + `<div class="bgv-felt"><div class="an-hand" data-act="pick" data-min="${F.breakDiscard.min}">${F.breakDiscard.ids.map((id, i) => `<button class="an-card" type="button" data-id="${id}" data-pick="${i < 2 ? 'picked' : 'selectable'}" style="--cw:92px">${IMG(cardFile(id), 'alt=""')}${i < 2 ? `<span class="an-check">${ICONS.check}</span>` : ''}</button>`).join('')}</div></div>`
    + `<table class="an-tbl"><thead><tr><th>${l.t('بازیکن', 'Player')}</th><th>${ui('appeal')} ${l.t('از جذابیت', 'appeal')}</th><th>${ui('kiosk')} ${l.t('کیوسک', 'kiosks')}</th><th>${l.t('↻ لبهٔ نقشه', '↻ map edge')}</th><th>${ui('money')} ${l.t('جمع پول', 'money')}</th></tr></thead><tbody>${inc.map((r, k) => `<tr><td><b style="color:var(--an-${SEATS[k].color}-ink)">${l.name(k)}</b></td><td>${l.d(r.appeal)}</td><td>${l.d(r.kiosk)}</td><td>${r.left.length ? r.left.map((x) => l.d(x)).join('، ') : '—'}</td><td><b>${l.d(r.appeal + r.kiosk)}</b>${l.t(' + کارت‌ها', ' + cards')}</td></tr>`).join('')}</tbody></table>`);
  const fp = F.finalPoints;
  const fin = flow('۴', l.t('پایان بازی', 'Game end'), l.t('کنار گذاشتن ۱ از ۲ کارت پایانی، بعد امتیاز', 'discard 1 of 2, then score'),
    bar(l, { title: l.d(F.finalDiscard.label), text: l.t('امتیاز هر کارت با وضع فعلی باغ‌وحش زیر آن نوشته شده (حداکثر ۴ حفاظت)', 'Each card shows its points now (max 4 CP)'), back: false,
      extra: `<div class="an-bar__row"><button class="bgv-btn bgv-btn--primary bgv-btn--sm" type="button" data-act="submit">${ICONS.check}${l.t('کنار گذاشتن', 'Discard')}</button></div>` })
    + `<div class="bgv-felt"><div class="an-hand" data-act="pick" data-min="1">${F.finalDiscard.ids.map((id, i) => `<div><button class="an-card" type="button" data-id="${id}" data-pick="${i === 1 ? 'picked' : 'selectable'}" style="--cw:120px">${IMG(cardFile(id), 'alt=""')}${i === 1 ? `<span class="an-check">${ICONS.check}</span>` : ''}</button><span class="an-card__fa" style="inline-size:120px">${l.d(F.scoringNames[id]?.nameFa || '')}</span><span class="an-card__why" style="inline-size:120px">${l.t('الان', 'now')} +${l.d(fp[0].pts[i])} ${l.t('حفاظت', 'CP')}</span></div>`).join('')}</div></div>`
    + `<div class="an-result"><table class="an-tbl"><thead><tr><th>${l.t('رتبه', 'Rank')}</th><th>${l.t('بازیکن', 'Player')}</th><th>${ui('appeal')} ${l.t('جذابیت', 'Appeal')}</th><th>${ui('conservation')} ${l.t('حفاظت + کارت پایانی', 'CP + final card')}</th><th>${l.t('عدد هدف', 'Target')}</th><th>${l.t('امتیاز', 'Score')}</th></tr></thead><tbody>${V.players.map((p, k) => { const cp = Math.min(41, p.cp + fp[k].pts[0]); const T = cp <= 10 ? 114 - 2 * cp : 94 - 3 * (cp - 10); return { k, p, cp, T, vp: p.appeal - T }; }).sort((a, b) => b.vp - a.vp).map((r, i) => `<tr><td>${l.d(i + 1)}</td><td><b style="color:var(--an-${SEATS[r.k].color}-ink)">${l.name(r.k)}</b></td><td>${l.d(r.p.appeal)}</td><td>${l.d(r.p.cp)} + ${l.d(fp[r.k].pts[0])} = <b>${l.d(r.cp)}</b></td><td>${l.d(r.T)}</td><td><b>${l.d(r.vp)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="an-note">${l.t('نمونهٔ عددی روی همین وضعیت (بازی هنوز تمام نشده)؛ صفحهٔ نتیجهٔ کلی همان «Table-Result» دیزاین سیستم است و این جدول داخل آن می‌نشیند. تساوی: پروژه‌های بیشتر.', 'Numbers from the current state; the result page is the DS Table-Result.')}</p>`);
  return `<div class="an-sheet" dir="rtl"><h1>${l.t('آرک نوا: مرحله‌ها', 'Ark Nova: phases')}</h1><p>${l.t('انتخاب آغازین، پاداش مسیر حفاظت، استراحت و پایان بازی؛ همه از پرسش‌های موتور (rules.ts, flow.ts).', 'Draft, CP bonus, break and game end, from engine prompts.')}</p><div class="an-flows">${draft}${cp2}${brk}${fin}</div></div>`;
}

module.exports = { CSS, actionsDesktop, phasesDesktop, optBtn, bar, step };
