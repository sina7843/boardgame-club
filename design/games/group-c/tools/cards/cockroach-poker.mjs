// Cockroach Poker on the card-table frame (as the repo engine: 64 cards, 8 creatures × 8, all dealt; 4 of a kind face up loses).
// Mock: 4 players, 16 rounds done. Sara gave a card to Niloufar claiming «scorpion»; Niloufar looked and passed it to you,
// claim still «scorpion». Seen by Sara + Niloufar, so you may call true / false, or look and pass — only to Reza.
// Face up: you 2 scorpion, 1 toad, 2 rat · Niloufar 3 fly, 1 spider · Reza 2 cockroach, 1 stinkbug, 1 bat · Sara 1 toad, 2 bat.
// Hands: you 11, Niloufar 12, Reza 12, Sara 12 (+1 in play) = 64.
export default function (H) {
  const { img, fa, ic, btn, ibtn } = H;
  const FA = { cockroach: 'سوسک', bat: 'خفاش', fly: 'مگس', toad: 'وزغ', rat: 'موش', scorpion: 'عقرب', spider: 'عنکبوت', stinkbug: 'سن' };
  const c = (k) => `cockroach-poker-${k}`;
  const grp = (k, n) => `<span class="cr-grp${n >= 3 ? ' is-hot' : ''}" title="${fa(n)} ${FA[k]}">${img(c(k), FA[k])}<b>${fa(n)}</b></span>`;
  const row = (...g) => `<span class="cr-row" aria-label="کارت‌های رو جلوی این نفر">${g.map(([k, n]) => grp(k, n)).join('')}</span>`;
  const act = (label, sub, o = {}) => `<button class="cr-act${o.sel ? ' is-sel' : ''}${o.kind ? ` cr-act--${o.kind}` : ''}" type="button"><b>${label}</b><small>${sub}</small></button>`;
  const acts = (ph) => `<div class="cr-acts${ph ? ' cr-acts--ph' : ''}" role="group" aria-label="جواب شما">${act('عقرب است', 'باور می‌کنم', { kind: 'yes' })}${act('عقرب نیست', 'دروغ می‌گوید', { kind: 'no' })}${act('نگاه', 'بعدش باید رد کنید')}${act(ph ? 'رد' : 'رد بی‌نگاه', 'فقط به رضا')}</div>`;
  const hand = [['cockroach', 2], ['bat', 1], ['fly', 1], ['toad', 2], ['rat', 1], ['scorpion', 2], ['spider', 1], ['stinkbug', 1]]
    .flatMap(([k, n]) => Array.from({ length: n }, () => ({ art: c(k), alt: FA[k], dim: true })));
  const { modal } = H;
  const ORDER = ['cockroach', 'bat', 'fly', 'toad', 'rat', 'scorpion', 'spider', 'stinkbug'];
  const who = (name, seatN, st, sel, off) => `<button type="button" class="cr-who${sel ? ' is-sel' : ''}"${off ? ' disabled' : ''}><i style="background:var(--seat-${seatN})"></i>${name}${st ? `<small>${st}</small>` : ''}</button>`;
  const claimRow = (sel, ph) => `<span class="cr-cl" role="group" aria-label="ادعا">${ORDER.map((k) => `<button type="button" class="cr-c${k === sel ? ' is-sel' : ''}">${img(c(k), '')}${ph ? '' : `<small>${FA[k]}</small>`}</button>`).join('')}</span>`;
  const giveBar = (o) => (ph) => `<div class="cr-give${ph ? ' cr-give--ph' : ''}"><div class="cr-give__r"><span class="cr-give__l">${o.lead}</span>${o.people}</div><div class="cr-give__r"><span class="cr-give__l">بگویید</span>${claimRow(o.claim, ph)}</div>${btn(o.go, 'primary', 'check')}</div>`;
  const reveal = (ph) => modal('کارت رو شد', `<div class="cr-rv">${img(c('stinkbug'), 'سن')}<div><p>شما گفتید <b>«عقرب نیست»</b>. کارت <b>سن</b> بود؛ حدستان درست بود.</p><p>کارت به جلوی <b>نیلوفر</b> (آخرین کسی که ادعا کرد) رفت و حالا نیلوفر کارت بعدی را می‌دهد.</p></div></div>`, `${btn('ادامه', 'primary', 'check')}`);
  const ending = (ph) => modal('رضا باخت', `<div class="cr-rv"><span class="cr-four">${[0, 1, 2, 3].map(() => img(c('cockroach'), 'سوسک')).join('')}</span><p>چهارمین سوسک جلوی رضا رفت. چهار کارت یک‌جور یعنی باخت؛ <b>بقیه با هم برنده‌اند</b>.</p></div>
<table class="gd-score"><thead><tr><th>بازیکن</th><th class="n">کارت‌های رو</th><th class="n">نتیجه</th></tr></thead><tbody><tr><td>رضا</td><td class="n">${fa(4)} سوسک، ${fa(2)} سن، ${fa(1)} خفاش</td><td class="n">باخت</td></tr><tr class="is-win"><td>شما</td><td class="n">${fa(7)} کارت</td><td class="n">برد</td></tr><tr class="is-win"><td>نیلوفر</td><td class="n">${fa(6)} کارت</td><td class="n">برد</td></tr><tr class="is-win"><td>سارا</td><td class="n">${fa(5)} کارت</td><td class="n">برد</td></tr></tbody></table><p class="cx-note">کسی که در نوبت دادن کارتی در دست نداشته باشد هم می‌بازد.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);  return {
    slug: 'CockroachPoker', fa: 'سوسک پوکرباز', latin: 'Cockroach Poker', meta: ['زنده', '۴ نفر', '۴ کارت یک‌جور یعنی باخت'],
    opps: [
      { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: `${row(['fly', 3], ['spider', 1])}<span>دست ${fa(12)}</span>` },
      { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', meta: `${row(['cockroach', 2], ['stinkbug', 1], ['bat', 1])}<span>دست ${fa(12)}</span>` },
      { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: `${row(['toad', 1], ['bat', 2])}<span>دست ${fa(12)}</span>` },
    ],
    me: { cards: hand, clock: '0:24', turn: true, note: `${row(['scorpion', 2], ['toad', 1], ['rat', 2])}`, above: (ph) => acts(ph) },
    cardW: 70, phoneCardW: 44, cardRatio: 1.31,
    table: (ph) => `<div class="cr-chain">
<div class="cr-path" aria-label="مسیر کارت"><span class="bgv-avatar bgv-avatar--sm seat-4">س</span><i></i><span class="bgv-avatar bgv-avatar--sm seat-2">ن</span><i></i><span class="bgv-avatar bgv-avatar--sm seat-1 is-you">م</span></div>
<div class="cr-play"><span class="cr-card">${img(c('back'), 'کارت پشت‌ورو')}</span><span class="cr-claim"><small>نیلوفر می‌گوید</small><b>«این عقرب است»</b><span class="cr-claim__m">${img(c('scorpion'), 'عقرب')}</span></span></div>
<p class="cr-seen">${ic('eye')}<span>دیده‌اند: سارا (داد)، نیلوفر (نگاه کرد و رد کرد)</span></p></div>`,
    status: '<b>نوبت شماست.</b> نیلوفر کارتی پشت‌ورو به شما داده و می‌گوید «عقرب». باور می‌کنید، باور نمی‌کنید، یا نگاهش می‌کنید و به رضا رد می‌کنید؟',
    pstatus: '<b>نوبت شما.</b> نیلوفر می‌گوید «عقرب». باور؟',
    railCard: `<section class="cx-card"><h3>عقرب‌ها</h3><div class="gc-pills"><span class="bgv-chip">جلوی شما ${fa(2)}</span><span class="bgv-chip">در دست شما ${fa(2)}</span><span class="bgv-chip">جای دیگر ${fa(4)} از ${fa(8)}</span></div><div class="ga-rule">${ic('info')}<span>حدس درست یعنی کارت جلوی نیلوفر می‌رود؛ حدس غلط یعنی جلوی خودتان و سومین عقرب شما می‌شود. اگر نگاه کنید، باید رد کنید.</span></div></section>`,
    logNote: 'دور ۱۷',
    log: [[6, 'رضا به سارا گفت «خفاش»؛ سارا باور نکرد و خفاش بود'], [4, 'سارا کارت را جلوی خودش گذاشت و حالا او می‌دهد'], [4, 'سارا به نیلوفر کارتی داد: «عقرب»'], [2, 'نیلوفر نگاه کرد و به شما رد کرد: «عقرب»'], [1, 'نوبت شماست']],
    actions: `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`,
    dockItems: [['check', 'باور'], ['x', 'دروغ'], ['eye', 'نگاه و رد'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'نوبت دادن', turnSub: 'کارت، نفر و جانور ادعایی',
        table: (ph) => `<div class="cr-chain"><div class="cr-play"><span class="cr-card">${img(c('back'), 'کارت انتخاب‌شده')}</span><span class="cr-claim"><small>شما به سارا می‌گویید</small><b>«این مگس است»</b><span class="cr-claim__m">${img(c('fly'), 'مگس')}</span></span></div><p class="cr-seen">${ic('info')}<span>کارت انتخابی شما وزغ است؛ ادعا می‌تواند راست یا دروغ باشد</span></p></div>`,
        me: { cards: hand.map((h) => ({ ...h, dim: false, sel: h.alt === 'وزغ' && !hand.slice(0, hand.indexOf(h)).some((x) => x.alt === 'وزغ') })), note: `${row(['scorpion', 3], ['toad', 1], ['rat', 2])}`, above: giveBar({ lead: 'به', people: `${who('نیلوفر', 2)}${who('رضا', 6)}${who('سارا', 4, '', true)}`, claim: 'fly', go: 'دادن کارت' }) },
        status: '<b>نوبت دادن با شماست.</b> یک کارت از دست انتخاب کنید (وزغ)، بگویید به چه کسی (سارا) و چه جانوری است (مگس).',
        pstatus: '<b>نوبت دادن.</b> کارت، نفر و ادعا.',
        phone: true,
        log: [[1, 'شما عقرب نیلوفر را باور نکردید؛ عقرب بود'], [1, 'عقرب جلوی شما رفت و حالا شما می‌دهید']],
      },
      {
        shotTitle: 'نگاه کردید، حالا رد', turnSub: 'کارت دیده‌شده؛ فقط رد به کسی که ندیده',
        table: (ph) => `<div class="cr-chain"><div class="cr-path" aria-label="مسیر کارت"><span class="bgv-avatar bgv-avatar--sm seat-4">س</span><i></i><span class="bgv-avatar bgv-avatar--sm seat-2">ن</span><i></i><span class="bgv-avatar bgv-avatar--sm seat-1 is-you">م</span></div><div class="cr-play"><span class="cr-card cr-card--up">${img(c('stinkbug'), 'کارت: سن (فقط شما می‌بینید)')}</span><span class="cr-claim"><small>ادعای قبلی</small><b>«عقرب»</b><span class="cr-claim__m">${img(c('scorpion'), 'عقرب')}</span></span></div><p class="cr-seen">${ic('eye')}<span>فقط شما می‌بینید: سن است. باور و دروغ دیگر بسته است</span></p></div>`,
        me: { above: giveBar({ lead: 'رد به', people: `${who('رضا', 6, 'ندیده', true)}${who('سارا', 4, 'دیده', false, true)}${who('نیلوفر', 2, 'دیده', false, true)}`, claim: 'scorpion', go: 'رد کردن' }) },
        status: '<b>کارت را نگاه کردید: سن است.</b> حالا باید ردش کنید؛ فقط رضا آن را ندیده. می‌توانید همان «عقرب» را بگویید یا ادعای تازه.',
        pstatus: '<b>نگاه کردید.</b> فقط به رضا رد کنید.',
        log: [[4, 'سارا به نیلوفر کارتی داد: «عقرب»'], [2, 'نیلوفر نگاه کرد و به شما رد کرد: «عقرب»'], [1, 'شما نگاه کردید']],
      },
      {
        shotTitle: 'نتیجهٔ حدس', turnSub: 'کارت رو می‌شود و جلوی بازنده می‌رود',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: `${row(['fly', 3], ['spider', 1], ['stinkbug', 1])}<span>دست ${fa(12)}</span>` },
          { name: 'رضا', av: 'ر', seat: 6, clock: '0:40', meta: `${row(['cockroach', 2], ['stinkbug', 1], ['bat', 1])}<span>دست ${fa(12)}</span>` },
          { name: 'سارا', av: 'س', seat: 4, clock: '0:40', meta: `${row(['toad', 1], ['bat', 2])}<span>دست ${fa(12)}</span>` },
        ],
        table: (ph) => `<div class="cr-chain"><div class="cr-play"><span class="cr-card cr-card--up">${img(c('stinkbug'), 'سن')}</span></div></div>`, overlay: reveal,
        me: { turn: false, above: () => '' },
        status: '<b>حدس شما درست بود.</b> کارت سن بود و جلوی نیلوفر رفت.',
        log: [[2, 'نیلوفر به شما رد کرد: «عقرب»'], [1, 'شما گفتید «عقرب نیست»'], [2, 'سن بود؛ کارت جلوی نیلوفر رفت']],
      },
      {
        shotTitle: 'دونفره', turnSub: '۱۰ کارت نادیده کنار رفته', phone: true, phoneOnly: true, meta: ['زنده', '۲ نفر', '۴ کارت یک‌جور یعنی باخت'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:40', meta: `<span>دست ${fa(27)}</span>` }],
        table: (ph) => `<div class="cr-chain"><div class="gc-pile" style="--pw:80px;--ppw:56px">${img(c('back'), 'کارت‌های کنار رفته')}<span><b>${fa(10)}</b> کارت نادیده کنار رفته</span></div></div>`,
        me: { above: () => '', note: '' },
        pstatus: '<b>بازی دونفره.</b> ۱۰ کارت نادیده کنار رفته و هر نفر ۲۷ کارت دارد.', status: '',
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'بازنده و دلیل',
        opps: [
          { name: 'نیلوفر', av: 'ن', seat: 2, meta: `${row(['fly', 3], ['spider', 1], ['stinkbug', 1])}` },
          { name: 'رضا', av: 'ر', seat: 6, out: true, meta: `${row(['cockroach', 4], ['stinkbug', 2], ['bat', 1])}` },
          { name: 'سارا', av: 'س', seat: 4, meta: `${row(['toad', 1], ['bat', 2], ['rat', 2])}` },
        ],
        table: (ph) => `<div class="cr-chain"><div class="cr-play"><span class="cr-card cr-card--up">${img(c('cockroach'), 'سوسک')}</span></div></div>`, overlay: ending,
        me: { turn: false, clock: '', above: () => '' },
        railCard: '',
        status: '<b>بازی تمام شد.</b> رضا چهار سوسک جلویش دارد و باخت؛ بقیه برنده‌اند.',
        log: [[4, 'سارا به رضا گفت «سوسک»'], [6, 'رضا باور نکرد؛ سوسک بود'], [6, 'رضا با چهار سوسک باخت']],
      },
    ],    css: `.cr-row{display:inline-flex;gap:5px}
.cr-grp{display:inline-flex;align-items:center;gap:2px}.cr-grp img{inline-size:17px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.4)}.cr-grp b{font-size:12px;color:var(--felt-ink)}
.cr-grp.is-hot img{outline:2px solid #F0AAA3;outline-offset:1px}.cr-grp.is-hot b{color:#F0AAA3}
.cx-pbar__note{display:inline-flex}
.cr-chain{display:grid;justify-items:center;gap:14px;color:var(--felt-ink)}
.cr-path{display:flex;align-items:center;gap:6px}.cr-path i{inline-size:28px;block-size:2px;background:var(--felt-gold);position:relative}.cr-path i::after{content:"";position:absolute;inset-inline-end:-2px;inset-block-start:-4px;border:5px solid transparent;border-inline-end-color:var(--felt-gold);border-inline-start:0}
.cr-play{display:flex;align-items:center;gap:18px}
.cr-card img{inline-size:112px;border-radius:8px;transform:rotate(-6deg);box-shadow:0 0 0 3px var(--felt-gold),0 14px 22px -10px rgba(0,0,0,.7)}
.cr-claim{position:relative;display:grid;gap:2px;padding:12px 16px 12px 60px;border-radius:16px;background:var(--felt-control);color:#142B3B;font-size:13px;box-shadow:0 3px 0 #0D1A23}
.cr-claim b{font-size:20px;font-weight:900}.cr-claim small{color:#3A4F5E}
.cr-claim::before{content:"";position:absolute;inset-inline-start:-9px;inset-block-start:50%;margin-block-start:-8px;border:8px solid transparent;border-inline-end-color:var(--felt-control);border-inline-start:0}
.cr-claim__m{position:absolute;inset-inline-end:12px;inset-block-start:50%;transform:translateY(-50%)}.cr-claim__m img{inline-size:36px;border-radius:3px;display:block}
.cr-seen{margin:0;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--felt-muted)}.cr-seen .bgv-icon{inline-size:16px;block-size:16px}
.cr-acts{display:grid;grid-template-columns:repeat(3,minmax(0,150px));gap:8px;justify-content:center}
.cr-act{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:2px;justify-items:center;text-align:center;padding:7px 6px;border-radius:var(--radius-sm);background:var(--felt-control);color:#142B3B;box-shadow:inset 0 0 0 1.5px #8EA7B4,0 3px 0 #0D1A23}
.cr-act b{font-size:14px}.cr-act small{font-size:11px;color:#3A4F5E}
.cr-act--yes{box-shadow:inset 0 0 0 2px #3E9B6A,0 3px 0 #0D1A23}.cr-act--no{box-shadow:inset 0 0 0 2px #C8553D,0 3px 0 #0D1A23}
.cr-acts--ph{margin-inline:10px;grid-template-columns:repeat(3,minmax(0,1fr))}
.cx-phone .cr-card img{inline-size:72px}.cx-phone .cr-claim{padding:8px 12px 8px 48px}.cx-phone .cr-claim b{font-size:16px}.cx-phone .cr-claim__m img{inline-size:28px}.cx-phone .cr-chain{gap:8px}.cx-phone .cr-seen{display:none}
.cx-phone .gc-card{margin-inline-start:calc(var(--cw) * -.5)}.cx-phone .gc-card:first-child{margin-inline-start:0}
.cr-acts{grid-template-columns:repeat(4,minmax(0,140px))}.cr-acts--ph{grid-template-columns:repeat(4,minmax(0,1fr))}
.cr-give{display:grid;gap:6px;justify-items:center;inline-size:100%;padding:6px 10px;border-radius:var(--radius-md);background:rgba(8,20,28,.3);box-sizing:border-box;color:var(--felt-ink)}
.cr-give__r{display:flex;align-items:center;gap:8px}.cr-give__l{font-size:13px;font-weight:700;color:var(--felt-muted)}
.cr-who{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(250,245,236,.1);font-weight:700;white-space:nowrap}
.cr-who i{inline-size:9px;block-size:9px;border-radius:50%}.cr-who small{font-size:10.5px;font-weight:500;color:var(--felt-muted)}
.cr-who.is-sel{background:var(--felt-gold);color:#142B3B}.cr-who.is-sel small{color:#142B3B}.cr-who:disabled{opacity:.45}
.cr-cl{display:flex;gap:3px}.cr-c{all:unset;box-sizing:border-box;cursor:pointer;display:grid;justify-items:center;gap:1px;padding:3px;border-radius:8px}
.cr-c img{inline-size:30px;border-radius:3px;display:block}.cr-c small{font-size:10px;color:var(--felt-muted)}.cr-c.is-sel{background:var(--felt-gold)}.cr-c.is-sel small{color:#142B3B;font-weight:700}
.cr-give--ph{margin-inline:10px;inline-size:auto;padding:6px}.cr-give--ph .cr-give__l{display:none}.cr-give--ph .cr-c img{inline-size:30px}.cr-give--ph .cr-cl{gap:1px}.cr-give--ph .cr-who{padding:6px 9px;font-size:12.5px}
.cr-card--up img{transform:rotate(-3deg)}
.cr-rv{display:flex;gap:14px;align-items:center}.cr-rv>img{inline-size:96px;border-radius:7px;box-shadow:0 0 0 3px var(--felt-gold)}.cr-rv>div{display:grid;gap:8px}
.cr-four{display:flex}.cr-four img{inline-size:56px;border-radius:4px;margin-inline-start:-22px;box-shadow:0 2px 6px rgba(0,0,0,.4)}.cr-four img:first-child{margin-inline-start:0}`,
    shotTitle: 'نوبت شما', turnSub: 'باور، دروغ یا نگاه و رد',
    diffs: [
      ['چیدمان', 'حریف‌ها بالا با کارت‌های روی جلویشان (هر جانور یک کارت ریز با تعداد) و تعداد کارت دست؛ سه‌تای یک‌جور حاشیهٔ قرمز می‌گیرد چون یکی دیگر یعنی باخت'],
      ['کارت در جریان', 'وسط میز کارت پشت‌ورو با حباب ادعای آخرین نفر و مسیرش (چه کسی داد، چه کسی رد کرد) و این‌که چه کسانی دیده‌اند'],
      ['جواب', 'چهار دکمه بالای دست: «… است»، «… نیست»، «نگاه» (بعدش فقط رد، §۵) و «رد بی‌نگاه». رد فقط به کسانی است که کارت را ندیده‌اند؛ بعد از نگاه دو دکمهٔ اول خاموش می‌شوند و دست شما برای انتخاب ادعا و نفر بعد باز می‌شود'],
      ['دست شما', 'وقتی گیرنده‌اید کارت‌های دست کم‌رنگ‌اند؛ در نوبت دادن یک کارت، یک نفر و یک ادعا انتخاب می‌کنید'],
      ['ستون کنار', 'شمارش همان جانوری که ادعا شده (جلوی شما، در دست شما، باقی) تا حدس راحت‌تر شود'],
      ['قوانین', 'مثل موتور: ۲ تا ۶ نفر، ۶۴ کارت؛ چهار یک‌جور جلوی شما یا دست خالی در نوبت دادن یعنی باخت و بقیه با هم برنده‌اند'],
    ],
  };
}
