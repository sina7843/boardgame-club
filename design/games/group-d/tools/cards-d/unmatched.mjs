// Unmatched (آنمچد) on the group D frame. No BGA version: the pack art is the site's own render (Marmoreal board 1349×878 with
// space/edge/zone data in unmatched-marmoreal.json, fighter tokens 114×114, cards 278×398, backs 258×358, character cards 440 wide).
// Mock: 2-player duel on Marmoreal. You (Mina) play Medusa + Harpies (2 left); Niloufar plays King Arthur + Merlin.
// Moves are checked against the board graph (BFS, own fighters passable, enemies block); ranged = same zone, melee = adjacent.
import { readFileSync } from 'node:fs';
const B = JSON.parse(readFileSync(new URL('./unmatched-marmoreal.json', import.meta.url), 'utf8'));
export default function (H) {
  const { img, fa, ic, btn, modal } = H;
  const EMB = {};
  const im = (n, alt = '', cls = '') => H.ART[n] ? img(n, alt, cls) : `<img${cls ? ` class="${cls}"` : ''} src="${EMB[n] ??= 'data:image/webp;base64,' + readFileSync(`E:/AI/Claude/bgv-groupa/art/embed-d/${n}.webp`).toString('base64')}" alt="${alt}">`;
  const ADJ = B.spaces.map(() => new Set());
  for (const [a, b] of B.edges) { ADJ[a].add(b); ADJ[b].add(a); }
  const zoneOf = (i) => new Set(B.spaces[i].zones);
  const sameZone = (a, b) => [...zoneOf(a)].some((z) => zoneOf(b).has(z));
  const reach = (from, n, enemy) => { const seen = new Map([[from, 0]]), q = [from]; while (q.length) { const s = q.shift(), d = seen.get(s); if (d === n) continue; for (const t of ADJ[s]) if (!seen.has(t) && !enemy.includes(t)) { seen.set(t, d + 1); q.push(t); } } return [...seen.keys()].filter((s) => s !== from); };
  const NM = { 'medusa-hero': 'مدوسا', 'medusa-sidekick': 'هارپی', 'arthur-hero': 'شاه آرتور', 'arthur-sidekick': 'مرلین', 'alice-hero': 'آلیس', 'alice-sidekick': 'جبرواک', 'invisible-hero': 'مرد نامرئی', 'sinbad-hero': 'سندباد', 'sinbad-sidekick': 'باربر', 'jekyll-hero': 'جکیل و هاید' };
  const CHN = { medusa: 'مدوسا', arthur: 'شاه آرتور', alice: 'آلیس', invisible: 'مرد نامرئی', sinbad: 'سندباد', jekyll: 'جکیل و هاید' };
  const CN = { 'medusa-gaze-of-stone': 'نگاه سنگی', 'medusa-second-shot': 'تیر دوم', 'medusa-hiss-and-slither': 'هیس و خزیدن', 'medusa-snipe': 'تک‌تیر', 'medusa-a-momentary-glance': 'نگاهی گذرا', 'medusa-clutching-claws': 'چنگال‌های گیرا', 'arthur-swift-strike': 'ضربهٔ سریع', 'arthur-prophecy': 'پیشگویی', 'arthur-noble-sacrifice': 'فداکاری شرافتمندانه', 'alice-looking-glass': 'آینه', 'alice-eat-me': 'مرا بخور', 'alice-drink-me': 'مرا بنوش', 'alice-snicker-snack': 'شَرَق‌شُرُق', 'alice-i-m-late-i-m-late': 'دیرم شد، دیرم شد', 'invisible-covert-preparation': 'تدارک پنهانی', 'invisible-lurking': 'کمین‌نشستن', 'invisible-slip-away': 'گریز', 'invisible-rolling-fog': 'مه غلتان', 'invisible-into-thin-air': 'دود شدن در هوا' };
  const OX = 7, OY = 6; // board image offset of the data coordinates (calibrated on the render)
  const P = (i) => [(B.spaces[i].x + OX) / 1349 * 100, (B.spaces[i].y + OY) / 878 * 100];
  // fighters: [token, space, hp, max]
  const F0 = { me: [['medusa-hero', 17, 12, 16], ['medusa-sidekick', 14, 1, 1], ['medusa-sidekick', 21, 1, 1]], op: [['arthur-hero', 18, 11, 18], ['arthur-sidekick', 12, 7, 7]] };
  const board = (o, W) => {
    const f = o.f ?? F0;
    let h = `<div class="um-b" style="--bw:${W}px" role="img" aria-label="میدان مارموریال">${im('unmatched-board', '')}`;
    for (const i of o.hl ?? []) { const [x, y] = P(i); h += `<i class="um-hl" style="left:${x}%;top:${y}%"></i>`; }
    for (const i of o.tgt ?? []) { const [x, y] = P(i); h += `<i class="um-hl is-tgt" style="left:${x}%;top:${y}%"></i>`; }
    for (const i of o.fog ?? []) { const [x, y] = P(i); h += `<span class="um-fog" style="left:${x}%;top:${y}%">${im('unmatched-fog', `نشان مه، خانهٔ ${fa(i + 1)}`)}</span>`; }
    for (const [side, list] of [['me', f.me], ['op', f.op]]) for (const [t, s, hp, mx] of list) { const [x, y] = P(s); h += `<span class="um-f is-${side}${o.sel === s ? ' is-sel' : ''}${hp === 0 ? ' is-out' : ''}" style="left:${x}%;top:${y}%${o.ring?.[t] ? `;--rc:var(--seat-${o.ring[t]})` : ''}">${im('unmatched-f-' + t, `${NM[t]}، خانهٔ ${fa(s + 1)}، ${fa(hp)} جان`)}${mx > 1 ? `<b>${fa(hp)}</b>` : ''}</span>`; }
    for (const [s, t] of o.path ?? []) { const [x1, y1] = P(s), [x2, y2] = P(t); h += `<svg class="um-path" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></svg>`; }
    for (const [s, txt, seat] of o.marks ?? []) { const [x, y] = P(s); h += `<b class="um-tagb" style="left:${x}%;top:${y}%;--sc:var(--seat-${seat})">${txt}</b>`; }
    for (const [s, txt] of o.pops ?? []) { const [x, y] = P(s); h += `<b class="um-pop" style="left:${x}%;top:${y}%">${txt}</b>`; }
    return h + '</div>';
  };
  const table = (o = {}) => (ph) => board(o, ph ? 370 : 640);
  const C = (id, w, o = {}) => `<span class="um-card${o.cls ? ' ' + o.cls : ''}" style="--w:${w}px">${im('unmatched-' + id, CN[id.replace(/^c-/, '')] ?? '')}${o.tag ? `<b>${o.tag}</b>` : ''}</span>`;
  const hand = (list, o = {}) => list.map((id) => ({ ...(H.ART['unmatched-c-' + id] ? { art: 'unmatched-c-' + id } : { html: im('unmatched-c-' + id, CN[id]) }), alt: CN[id], ok: o[id] === 'ok', sel: o[id] === 'sel', dim: o[id] === 'dim' }));
  const H5 = ['medusa-gaze-of-stone', 'medusa-second-shot', 'medusa-hiss-and-slither', 'medusa-snipe', 'medusa-a-momentary-glance'];
  const pile = (who, deck, disc, top) => `<span class="um-pile"><span>${im('unmatched-back-' + who, 'دسته')}<b>${fa(deck)}</b></span>${top ? `<span>${im('unmatched-c-' + top, 'رو؛ ' + (CN[top] ?? ''))}<b>${fa(disc)}</b></span>` : ''}</span>`;
  const hpRow = (list) => `<span class="um-hps">${list.map(([t, , hp, mx]) => `<span class="um-hp${hp === 0 ? ' is-out' : ''}">${im('unmatched-f-' + t, NM[t])}${fa(hp)}${mx > 1 ? `<small>/${fa(mx)}</small>` : ''}</span>`).join('')}</span>`;
  const above = (o = {}) => (ph) => `<div class="um-me${ph ? ' um-me--ph' : ''}">${o.acts ? `<div class="um-acts">${o.acts(ph)}</div>` : ''}<div class="um-panel">${hpRow(o.f ?? F0.me)}${o.mark ? `<span class="um-sm">${im('unmatched-sm-' + o.mark[0], o.mark[1])}</span>` : ''}${ph ? '' : pile(o.who ?? 'medusa', o.deck ?? 17, o.disc ?? 8, o.top === undefined ? 'medusa-clutching-claws' : o.top)}</div></div>`;
  const opps = (turn, o = {}) => [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '3:20', turn: !!turn, meta: `${hpRow(o.f ?? F0.op)}<span>دست ${fa(o.hand ?? 5)}</span><span>دسته ${fa(o.deck ?? 15)}</span>${o.tag ?? ''}` }];
  const note = (o = {}) => `<span class="cx-note">دست ${fa(o.hand ?? 5)}<span class="bgv-sep"></span>${o.extra ?? `اکشن ${fa(1)} از ${fa(2)}`}</span>`;
  const rail = (chars = ['medusa', 'arthur']) => `<section class="cx-card"><h3>قهرمان‌ها</h3><div class="um-chars${chars.length > 2 ? ' um-chars--4' : ''}">${chars.map((c) => im('unmatched-ch-' + c, 'کارت ' + CHN[c])).join('')}</div><div class="ga-rule">${ic('info')}<span>هر نوبت ۲ اکشن: مانور (۱ کارت بکشید و تا عدد حرکت جابه‌جا شوید، با تقویت)، نقشه، یا حمله. دوربرد هر مبارز هم‌منطقه را می‌زند، نزدیک‌زن فقط مجاور را. آخر نوبت دست حداکثر ${fa(7)} کارت. دسته که تمام شود، هر بار باید کشید همهٔ مبارزان ${fa(2)} آسیب می‌خورند.</span></div></section>`;

  // ---------- states ----------
  const ENEMY = F0.op.map((x) => x[1]);
  const MOVE = reach(14, 4, ENEMY).filter((s) => ![...F0.me, ...F0.op].some((x) => x[1] === s));
  const startSide = { me: [['medusa-hero', 26, 16, 16], ['medusa-sidekick', 23, 1, 1]], op: [['arthur-hero', 15, 18, 18], ['arthur-sidekick', 7, 7, 7]] };
  const zoneEmpty = (hero, f) => B.spaces.map((_, i) => i).filter((i) => i !== hero && sameZone(i, hero) && ![...f.me, ...f.op].some((x) => x[1] === i));
  const DEF = { me: [['medusa-hero', 17, 12, 16], ['medusa-sidekick', 14, 1, 1], ['medusa-sidekick', 21, 1, 1]], op: [['arthur-hero', 21, 11, 18], ['arthur-sidekick', 12, 7, 7]] };
  DEF.me = DEF.me.map((x) => (x[1] === 21 ? [x[0], 24, 1, 1] : x));
  const AFTER = { me: [['medusa-hero', 17, 7, 16], ['medusa-sidekick', 14, 1, 1], ['medusa-sidekick', 24, 1, 1]], op: [['arthur-hero', 21, 11, 18], ['arthur-sidekick', 12, 7, 7]] };
  const pickModal = (ph) => modal('قهرمانتان را انتخاب کنید', `<p>نیلوفر شاه آرتور را برداشت. یکی از هفت قهرمان دیگر مال شماست.</p><div class="um-pick">${['medusa', 'arthur', 'sinbad', 'alice', 'holmes', 'dracula', 'jekyll', 'invisible'].map((h) => `<button type="button" class="um-pk${h === 'medusa' ? ' is-sel' : ''}${h === 'arthur' ? ' is-taken' : ''}"${h === 'arthur' ? ' disabled' : ''}>${im('unmatched-ch-' + h, h)}</button>`).join('')}</div>`, btn('انتخاب مدوسا', 'primary', 'check'));
  const gazeModal = () => modal('نگاه مدوسا', `<p>شروع نوبت شماست. می‌توانید به یک مبارز حریف در منطقهٔ مدوسا ${fa(1)} آسیب بزنید.</p><div class="um-tg">${[['arthur-hero', 'شاه آرتور', 11, true], ['arthur-sidekick', 'مرلین', 7, false]].map(([t, n, hp, on]) => `<button type="button" class="um-t${on ? ' is-on' : ''}" aria-pressed="${on}">${im('unmatched-f-' + t, n)}<b>${n}</b><small>${fa(hp)} جان</small></button>`).join('')}</div>`, `${btn('رد', 'secondary', 'x')}${btn('بزن به شاه آرتور', 'primary', 'zap')}`);
  const defModal = (ph) => modal('شاه آرتور به مدوسا حمله کرد', `<p>با یک کارت رو به پایین و یک کارت تقویت. فقط کارت‌های دفاع و همه‌کاره را می‌شود بازی کرد.</p><div class="um-row">${C('back-arthur', ph ? 70 : 90, { tag: 'حمله' })}${C('back-arthur', ph ? 52 : 66, { cls: 'is-boost', tag: 'تقویت' })}</div>`, `${btn('بی‌دفاع', 'secondary', 'x')}${btn(ph ? 'دفاع' : 'دفاع با هیس و خزیدن', 'primary', 'check')}`);
  const fightModal = (ph) => modal('نبرد رو شد', `<div class="um-fight"><figure>${C('c-arthur-swift-strike', ph ? 92 : 120)}<figcaption>نیلوفر: ${fa(3)} + تقویت ${fa(2)} = <b>${fa(5)}</b></figcaption></figure><span class="um-vs">${fa(5)} در برابر ${fa(4)}</span><figure>${C('c-medusa-hiss-and-slither', ph ? 92 : 120)}<figcaption>شما: <b>${fa(4)}</b></figcaption></figure></div><ol class="um-steps"><li><span class="gc-tag gc-tag--soft">حین نبرد</span>اثری نیست</li><li><span class="gc-tag">نتیجه</span>مدوسا ${fa(1)} آسیب خورد؛ مهاجم برد</li><li><span class="gc-tag gc-tag--soft">پس از نبرد</span>هیس و خزیدن: نیلوفر ${fa(1)} کارت دور می‌ریزد</li><li><span class="gc-tag gc-tag--soft">پس از نبرد</span>ضربهٔ سریع: آرتور تا ${fa(4)} خانه جابه‌جا می‌شود</li></ol>`, btn('ادامه', 'primary', 'check'));
  // other games (same players): Invisible Man fog setup; 4-player free-for-all with Alice, Invisible Man, Sinbad, Jekyll & Hyde.
  // Marmoreal starts are spaces 16, 27, 1, 10 (index 15, 26, 0, 9). Fog goes on separate empty spaces of the Invisible Man's zone.
  const INV5 = ['invisible-covert-preparation', 'invisible-lurking', 'invisible-slip-away', 'invisible-rolling-fog', 'invisible-into-thin-air'];
  const ALI5 = ['alice-eat-me', 'alice-drink-me', 'alice-snicker-snack', 'alice-looking-glass', 'alice-i-m-late-i-m-late'];
  const ALI4 = ['alice-eat-me', 'alice-snicker-snack', 'alice-i-m-late-i-m-late', 'alice-drink-me'];
  const FOG13 = { me: [['invisible-hero', 15, 15, 15]], op: [] };
  const FOG13_OK = B.spaces.map((_, i) => i).filter((i) => i !== 15 && i !== 20 && sameZone(i, 15) && !B.starts.includes(i));
  const S14 = { me: [['alice-hero', 26, 13, 13], ['alice-sidekick', 30, 8, 8]], op: [['invisible-hero', 15, 15, 15]] };
  const F15 = { me: [['alice-hero', 25, 9, 13], ['alice-sidekick', 24, 8, 8]], op: [['invisible-hero', 20, 12, 15], ['sinbad-hero', 12, 11, 15], ['sinbad-sidekick', 5, 6, 6], ['jekyll-hero', 23, 13, 16]] };
  const RING = { 'invisible-hero': 2, 'sinbad-hero': 6, 'sinbad-sidekick': 6, 'jekyll-hero': 4 };
  if (!ADJ[23].has(25) || ![7, 20, 22].every((i) => sameZone(i, 15)) || !sameZone(30, 26)) throw new Error('unmatched other-hero mock');
  const chip = (t, x = '') => `<span class="um-chip">${x}${t}</span>`;
  const seat4 = (turn, o) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: o.c?.[0] ?? '3:00', turn: turn === 2, meta: o[2] },
    { name: 'رضا', av: 'ر', seat: 6, clock: o.c?.[1] ?? '3:00', turn: turn === 6, meta: o[6] },
    { name: 'سارا', av: 'س', seat: 4, clock: o.c?.[2] ?? '3:00', turn: turn === 4, meta: o[4] },
  ];
  const sizeModal = (ph) => modal('آلیس بزرگ شروع کند یا کوچک؟', `<p>اندازه را همین حالا انتخاب می‌کنید و همه آن را می‌بینند. بعضی کارت‌ها وسط بازی اندازه را عوض می‌کنند.</p><div class="um-sz">${[['big', 'بزرگ'], ['small', 'کوچک']].map(([k, nm], i) => `<button type="button" class="um-szb${i ? '' : ' is-on'}" aria-pressed="${!i}">${im('unmatched-sm-' + k, 'آلیس ' + nm)}</button>`).join('')}</div>`, btn('آلیس بزرگ', 'primary', 'check'));
  const glassModal = (ph) => modal('آینه: ۲ اثر متفاوت انتخاب کنید', `<div class="um-glass">${C('c-alice-looking-glass', ph ? 72 : 88)}<div class="um-opts">${[['۲ کارت بکشید', false], ['آلیس ۳ جان بگیرد', true, `جان آلیس ${fa(9)} ← ${fa(12)}`], ['آلیس را در هر خانهٔ خالی دیگری بگذارید', true, 'بعد از تأیید، خانه را روی میدان بزنید']].map(([t, on, sub]) => `<button type="button" class="um-opt${on ? ' is-on' : ''}" aria-pressed="${on}"><i>${on ? ic('check') : ''}</i><span>${t}${sub ? `<small>${sub}</small>` : ''}</span></button>`).join('')}<small class="um-cnt">${fa(2)} از ${fa(2)} انتخاب شد</small></div></div><p class="cx-note">دفاع ${fa(3)} (آینه ${fa(2)} و آلیس کوچک ${fa(1)}+) در برابر حملهٔ ${fa(5)} هاید: ${fa(2)} آسیب. اول اثر مدافع اجرا می‌شود، بعد اثر کارت سارا.</p>`, btn(`انجام ${fa(2)} اثر`, 'primary', 'check'));
  const states = `<section class="cx-card"><h3>وضع قهرمان‌ها</h3><div class="um-states"><figure>${im('unmatched-sm-small', 'آلیس کوچک')}<figcaption>شما</figcaption></figure><figure>${im('unmatched-sm-hyde', 'آقای هاید')}<figcaption>سارا</figcaption></figure><figure>${im('unmatched-fog', 'نشان مه')}<figcaption>مه نیلوفر: ${fa(3)} نشان</figcaption></figure><figure><b>${fa(2)}</b><figcaption>کارت «سفر» در دورریختهٔ رضا</figcaption></figure></div></section>`;
  const endModal = () => modal('قهرمان نیلوفر شکست خورد؛ شما بردید', `<table class="gd-score"><thead><tr><th>مبارز</th><th class="n">جان</th><th class="n">وضع</th></tr></thead><tbody><tr class="is-win"><td>${ic('trophy')} مدوسا (شما)</td><td class="n">${fa(5)} از ${fa(16)}</td><td class="n">سر پا</td></tr><tr><td>هارپی‌ها</td><td class="n">${fa(1)} از ${fa(3)}</td><td class="n">دوتا افتادند</td></tr><tr><td>شاه آرتور (نیلوفر)</td><td class="n">${fa(0)} از ${fa(18)}</td><td class="n">شکست</td></tr><tr><td>مرلین</td><td class="n">${fa(4)} از ${fa(7)}</td><td class="n">از بازی بیرون</td></tr></tbody></table><p class="cx-note">با شکست قهرمان، بازی همان لحظه تمام می‌شود؛ یارها مهم نیستند.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'Unmatched', fa: 'آنمچد', latin: 'Unmatched', meta: ['زنده', '۲ نفر', 'مارموریال'],
    opps: opps(false),
    me: { cards: hand(H5), clock: '3:05', turn: true, note: note(), above: above({ acts: (ph) => `${btn('مانور', 'primary', 'repeat')}${btn('نقشه', 'secondary', 'list')}${btn('حمله', 'secondary', 'swords')}` }) },
    cardW: 92, phoneCardW: 56, cardRatio: 1.432,
    table: table({}),
    status: '<b>نوبت شماست: اکشن ۱ از ۲.</b> مانور، نقشه یا حمله. مدوسا دوربرد است و شاه آرتور هم‌منطقهٔ اوست، پس حمله ممکن است.',
    pstatus: '<b>اکشن ۱ از ۲.</b> مانور، نقشه یا حمله.',
    railCard: rail(),
    logNote: `نوبت ${fa(6)}`,
    log: [[2, 'نیلوفر مانور داد: آرتور به خانهٔ ۱۹ رفت'], [2, 'آرتور به هارپی حمله کرد؛ هارپی افتاد'], [1, 'نگاه مدوسا: ۱ آسیب به آرتور'], [1, 'اکشن ۱ از ۲']],
    dockItems: [['list', 'رویدادها'], ['users', 'قهرمان‌ها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'انتخاب قهرمان', turnSub: 'به نوبت، قهرمان گرفته‌شده خاکستری', meta: ['زنده', '۲ نفر', 'شروع بازی'],
        opps: opps(false, { f: [], hand: 0, deck: 30, tag: '<span class="gc-tag">شاه آرتور</span>' }),
        table: table({ f: { me: [], op: [] } }), overlay: pickModal,
        me: { cards: [], note: note({ hand: 0, extra: 'انتخاب قهرمان' }), above: above({ f: [], deck: 30, disc: 0, top: null }) },
        status: '<b>انتخاب قهرمان.</b> هشت قهرمان دو جلد «نبرد افسانه‌ها» و «سنگفرش و مه». نیلوفر اول انتخاب کرد.',
        pstatus: '<b>انتخاب قهرمان.</b>',
        log: [[1, 'میدان: مارموریال'], [2, 'نیلوفر شاه آرتور را انتخاب کرد'], [1, 'نوبت انتخاب شما']],
      },
      {
        shotTitle: 'چیدن یارها', turnSub: 'هارپی ۲ از ۳ در منطقهٔ مدوسا', meta: ['زنده', '۲ نفر', 'شروع بازی'],
        opps: opps(false, { f: startSide.op, hand: 5, deck: 25 }),
        table: table({ f: startSide, hl: zoneEmpty(26, startSide) }),
        me: { cards: hand(['medusa-snipe', 'medusa-second-shot', 'medusa-clutching-claws', 'medusa-hiss-and-slither', 'medusa-gaze-of-stone']), note: note({ extra: 'چیدن' }), above: above({ f: [['medusa-hero', 26, 16, 16], ['medusa-sidekick', 23, 1, 1], ['medusa-sidekick', -1, 1, 1], ['medusa-sidekick', -1, 1, 1]], deck: 25, disc: 0, top: null, acts: () => `<span class="um-ask">هارپی ${fa(2)} از ${fa(3)} را بگذارید</span>` }) },
        status: '<b>چیدن یارها.</b> مدوسا خودکار روی خانهٔ شروع ۲ نشست. هر هارپی را در یک خانهٔ خالی همین منطقه (بنفش یا قهوه‌ای) بگذارید؛ خانه‌های مجاز روشن‌اند.',
        pstatus: '<b>هارپی ۲ از ۳.</b> یک خانهٔ روشن را بزنید.',
        log: [[2, 'آرتور روی خانهٔ ۱۶، مرلین روی خانهٔ ۸'], [1, 'مدوسا روی خانهٔ ۲۷'], [1, 'هارپی ۱ روی خانهٔ ۲۴']],
      },
      {
        shotTitle: 'شروع نوبت', turnSub: 'توانایی اختیاری مدوسا',
        table: table({ tgt: [18, 12] }), overlay: gazeModal,
        me: { note: note({ extra: 'شروع نوبت' }), above: above({}) },
        status: '<b>شروع نوبت.</b> نگاه مدوسا اختیاری است. آرتور و مرلین هر دو در منطقهٔ مدوسا هستند.',
        log: [[2, 'نیلوفر نوبتش را تمام کرد'], [1, 'شروع نوبت شما']],
      },
      {
        shotTitle: 'مانور', turnSub: 'کشیدن ۱ کارت، تقویت، جابه‌جایی',
        table: table({ sel: 14, hl: MOVE }),
        me: { cards: hand([...H5, 'medusa-clutching-claws'], { 'medusa-snipe': 'sel' }), note: note({ hand: 6 }), above: above({ acts: (ph) => `<span class="um-ask">${ph ? 'هارپی: ' : 'هارپی: حرکت '}${fa(3)} + تقویت ${fa(1)}</span>${btn(ph ? 'پایان' : 'پایان حرکت', 'primary', 'check')}${btn(ph ? 'بی‌تقویت' : 'بی‌تقویت', 'secondary', 'x')}` }) },
        status: '<b>مانور.</b> ۱ کارت کشیدید (چنگال‌های گیرا). تک‌تیر را برای تقویت حرکت انتخاب کردید (+۱). هارپی انتخاب‌شده تا ۴ خانه می‌رود؛ از روی مبارزان خودی رد می‌شود ولی نه از روی حریف. خانه‌های قابل رسیدن روشن‌اند.',
        pstatus: '<b>مانور.</b> خانهٔ مقصد هارپی را بزنید.',
        log: [[1, 'شما مانور دادید'], [1, '۱ کارت کشیدید'], [1, 'تقویت حرکت: تک‌تیر (+۱)']],
      },
      {
        shotTitle: 'حمله', turnSub: 'مبارز، هدف، کارت',
        table: table({ sel: 17, tgt: [18, 12] }),
        me: { cards: hand(H5, { 'medusa-gaze-of-stone': 'sel', 'medusa-second-shot': 'ok', 'medusa-snipe': 'ok', 'medusa-hiss-and-slither': 'dim', 'medusa-a-momentary-glance': 'dim' }), note: note({ extra: `اکشن ${fa(2)} از ${fa(2)}` }), above: above({ acts: (ph) => `<span class="um-ask">${ph ? '' : 'مدوسا ← شاه آرتور: '}حمله ${fa(2)}؛ اگر ببرید ${fa(8)} آسیب</span>${btn('حمله', 'primary', 'swords')}` }) },
        status: '<b>حمله.</b> مدوسا را انتخاب کردید؛ دوربرد است، پس آرتور و مرلین (هم‌منطقه) هدف مجازند. نگاه سنگی: حمله ۲، ولی اگر نبرد را ببرید ۸ آسیب می‌زند. کارت دفاع و نقشه در حمله بازی نمی‌شوند.',
        pstatus: '<b>حمله به آرتور</b> با نگاه سنگی.',
        log: [[1, 'هارپی به خانهٔ ۲۲ رفت'], [1, 'اکشن ۲ از ۲: حمله']],
      },
      {
        shotTitle: 'دفاع', turnSub: 'در نوبت حریف',
        opps: opps(true, { f: DEF.op, hand: 3 }),
        table: table({ f: DEF, sel: 21, tgt: [17] }), overlay: defModal,
        me: { turn: false, cards: hand(H5, { 'medusa-hiss-and-slither': 'sel', 'medusa-snipe': 'ok', 'medusa-gaze-of-stone': 'dim', 'medusa-second-shot': 'dim', 'medusa-a-momentary-glance': 'dim' }), note: note({ extra: 'دفاع' }), above: above({ f: DEF.me }) },
        status: '<b>آرتور به شما حمله کرد.</b> کارت حمله و تقویتش رو به پایین است. یک کارت دفاع یا همه‌کاره بازی کنید، یا بی‌دفاع بمانید.',
        pstatus: '<b>دفاع کنید.</b>',
        log: [[2, 'آرتور به خانهٔ ۲۲ آمد'], [2, 'آرتور با کارت رو به پایین به مدوسا حمله کرد'], [1, 'نوبت دفاع شما']],
      },
      {
        shotTitle: 'رو شدن نبرد', turnSub: 'فوری، حین نبرد، پس از نبرد',
        opps: opps(true, { f: DEF.op, hand: 2 }),
        table: table({ f: { ...DEF, me: DEF.me.map((x) => (x[0] === 'medusa-hero' ? [x[0], x[1], 11, 16] : x)) }, pops: [[17, `${fa(1)}− جان`]] }), overlay: fightModal,
        me: { turn: false, cards: hand(['medusa-gaze-of-stone', 'medusa-second-shot', 'medusa-snipe', 'medusa-a-momentary-glance']), note: note({ hand: 4, extra: 'نبرد' }), above: above({ f: DEF.me.map((x) => (x[0] === 'medusa-hero' ? [x[0], x[1], 11, 16] : x)), top: 'medusa-hiss-and-slither', disc: 9 }) },
        status: '<b>نبرد رو شد.</b> ضربهٔ سریع ۳ با تقویت ۲ می‌شود ۵ و دفاع شما ۴؛ مدوسا ۱ آسیب خورد. اثرهای «پس از نبرد» به ترتیب: اول مدافع، بعد مهاجم.',
        log: [[2, 'ضربهٔ سریع + تقویت ۲'], [1, 'هیس و خزیدن'], [1, 'مدوسا ۱ آسیب خورد'], [2, 'نیلوفر ۱ کارت دور ریخت']],
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'نقشه‌ها رو، نبردها پشت‌ورو',
        opps: opps(true, { f: AFTER.op, hand: 2 }),
        table: table({ f: AFTER, sel: 12, pops: [[12, 'پیشگویی']] }),
        me: { turn: false, cards: hand(['medusa-gaze-of-stone', 'medusa-second-shot', 'medusa-snipe', 'medusa-a-momentary-glance']), note: note({ hand: 4, extra: 'منتظر' }), above: above({ f: AFTER.me, top: 'medusa-hiss-and-slither', disc: 9, acts: () => `<span class="um-played">${C('c-arthur-prophecy', 46)}<span>نیلوفر با مرلین «پیشگویی» بازی کرد: ۴ کارت بالای دسته را می‌بیند و ۲ تا برمی‌دارد.</span></span>` }) },
        status: '<b>نوبت نیلوفر است.</b> کارت‌های نقشه همان لحظه برای همه رو می‌شوند؛ کارت‌های نبرد تا لحظهٔ رو شدن پشت‌ورو می‌مانند.',
        pstatus: '<b>نوبت نیلوفر.</b> پیشگویی بازی شد.',
        log: [[2, 'آرتور ۴ خانه رفت'], [2, 'نیلوفر نقشه بازی کرد: پیشگویی']],
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'جان باقی‌مانده و ترتیب شکست', meta: ['پایان', '۲ نفر', 'مارموریال'],
        opps: opps(false, { f: [['arthur-hero', 18, 0, 18], ['arthur-sidekick', 12, 4, 7]], hand: 3 }),
        table: table({ f: { me: [['medusa-hero', 17, 5, 16], ['medusa-sidekick', 24, 1, 1]], op: [['arthur-hero', 18, 0, 18], ['arthur-sidekick', 12, 4, 7]] } }), overlay: endModal,
        me: { turn: false, clock: '', cards: [], note: note({ hand: 2, extra: 'برنده' }), above: above({ f: [['medusa-hero', 17, 5, 16], ['medusa-sidekick', 24, 1, 1], ['medusa-sidekick', 0, 0, 1], ['medusa-sidekick', 0, 0, 1]], deck: 3, disc: 21, top: 'medusa-gaze-of-stone' }) },
        status: '<b>بازی تمام شد.</b> نگاه سنگی برد و ۸ آسیب به آرتور زد.',
        log: [[1, 'مدوسا با نگاه سنگی به آرتور حمله کرد'], [1, 'شما بردید؛ ۸ آسیب'], [2, 'شاه آرتور شکست خورد']],
      },
      {
        shotTitle: 'چیدن نشان مه', turnSub: 'بازی دیگر: شما مرد نامرئی؛ نشان ۲ از ۳', meta: ['زنده', '۲ نفر', 'شروع بازی'],
        opps: opps(false, { f: [], hand: 5, deck: 25, tag: '<span class="gc-tag">شاه آرتور</span><span>منتظر چیدن</span>' }),
        table: table({ f: FOG13, fog: [20], hl: FOG13_OK }), railCard: rail(['invisible', 'arthur']), logNote: 'شروع بازی',
        me: { cards: hand(INV5), note: note({ extra: 'چیدن مه' }), above: above({ who: 'invisible', f: FOG13.me, deck: 25, disc: 0, top: null, acts: () => `<span class="um-ask">نشان مه ${fa(2)} از ${fa(3)} را بگذارید</span>` }) },
        status: `<b>چیدن نشان مه.</b> مرد نامرئی روی خانهٔ شروع ${fa(1)} نشست. سه نشان مه را هر کدام در یک خانهٔ خالی همین منطقه (قرمز یا زرد) بگذارید؛ نشان اول روی خانهٔ ${fa(21)} است و خانه‌های مجاز روشن‌اند. روی خانهٔ مه‌دار، دفاع مرد نامرئی ${fa(1)}+ می‌گیرد.`,
        log: [[1, 'میدان: مارموریال'], [1, 'مرد نامرئی روی خانهٔ ۱۶'], [1, 'نشان مه ۱ روی خانهٔ ۲۱']],
      },
      {
        shotTitle: 'اندازهٔ آلیس', turnSub: 'بازی دیگر، ۴ نفره: چیدن آلیس', meta: ['زنده', '۴ نفر', 'شروع بازی'],
        opps: seat4(0, { 2: `${hpRow(S14.op)}${chip(`مه ${fa(3)}`, im('unmatched-fog', ''))}`, 6: '<span class="gc-tag">سندباد</span><span>منتظر چیدن</span>', 4: '<span class="gc-tag">جکیل و هاید</span><span>منتظر چیدن</span>' }),
        table: table({ f: S14, fog: [7, 20, 22], sel: 26, ring: RING }), overlay: sizeModal, railCard: rail(['alice', 'invisible', 'sinbad', 'jekyll']), logNote: 'شروع بازی',
        me: { cards: hand(ALI5), note: note({ extra: 'اندازهٔ آلیس' }), above: above({ who: 'alice', f: S14.me, deck: 25, disc: 0, top: null }) },
        status: `<b>اندازهٔ آلیس.</b> نیلوفر مرد نامرئی را روی خانهٔ شروع ${fa(1)} گذاشت و سه نشان مه را در منطقه‌اش چید. آلیس روی خانهٔ شروع ${fa(2)} و جبرواک در همان منطقه نشست. حالا انتخاب کنید آلیس بزرگ شروع کند یا کوچک؛ بعد رضا و سارا می‌چینند.`,
        log: [[2, 'مرد نامرئی روی خانهٔ ۱۶'], [2, 'نشان‌های مه روی خانه‌های ۸، ۲۱ و ۲۳'], [1, 'آلیس روی خانهٔ ۲۷، جبرواک روی خانهٔ ۳۱'], [1, 'نوبت انتخاب اندازهٔ آلیس']],
      },
      {
        shotTitle: 'وضع قهرمان‌ها و انتخاب اثر', turnSub: 'همان بازی ۴ نفره: آینه، ۲ اثر از ۳', meta: ['زنده', '۴ نفر', 'مارموریال'],
        opps: seat4(4, { c: ['2:40', '2:15', '1:50'], 2: `${hpRow([F15.op[0]])}${chip('روی مه', im('unmatched-fog', ''))}`, 6: `${hpRow([F15.op[1]])}${chip(`سفر ${fa(2)}`)}`, 4: `${hpRow([F15.op[3]])}${chip('هاید')}` }),
        table: table({ f: F15, fog: [7, 20, 22], ring: RING, sel: 23, tgt: [25], marks: [[25, 'کوچک', 1], [23, 'هاید', 4]], pops: [[25, `${fa(2)}− جان`]] }), overlay: glassModal, railCard: states, logNote: `نوبت ${fa(9)}`,
        me: { turn: false, cards: hand(ALI4), note: note({ hand: 4, extra: 'آینه' }), above: above({ who: 'alice', f: F15.me, mark: ['small', 'آلیس کوچک'], deck: 14, disc: 9, top: 'alice-looking-glass' }) },
        status: `<b>سارا با آقای هاید به آلیس حمله کرد.</b> با «آینه» دفاع کردید و آلیس ${fa(2)} آسیب خورد. حالا اثر «پس از نبرد» آینه: دو اثر متفاوت از سه اثر را انتخاب کنید. وضع هر قهرمان روی میدان، کنار اسمش و در ستون کنار پیداست: آلیس کوچک، هاید، نشان‌های مه و شمار سفرهای سندباد.`,
        log: [[1, 'مرا بنوش: آلیس کوچک شد'], [4, 'سارا به هاید تبدیل شد'], [4, 'هاید با کارت رو به پایین به آلیس حمله کرد'], [1, 'دفاع با آینه؛ آلیس ۲ آسیب خورد']],
      },
    ],
    css: `.gc-table{flex-direction:column}
.um-fog{position:absolute;inline-size:calc(var(--bw) * .088);transform:translate(-50%,-50%)}.um-fog img{display:block;inline-size:100%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))}
.um-f.is-op[style*="--rc"]{box-shadow:0 0 0 2.5px var(--rc)}
.um-tagb{position:absolute;transform:translate(-50%,95%);padding:1px 7px;border-radius:999px;background:#FAF5EC;color:#142B3B;font-size:11.5px;white-space:nowrap;box-shadow:0 0 0 2px var(--sc),0 3px 6px rgba(0,0,0,.4)}
.um-chip{display:inline-flex;align-items:center;gap:3px;padding:0 7px;block-size:20px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:12px;font-weight:700}
.um-chip img{inline-size:22px;block-size:auto}
.um-sm img{display:block;block-size:56px;inline-size:auto;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))}
.um-chars.um-chars--4{grid-template-columns:repeat(4,1fr);gap:5px}
.um-sz{display:flex;gap:14px;justify-content:center}
.um-szb{all:unset;cursor:pointer;display:block;padding:8px;border-radius:14px;box-shadow:inset 0 0 0 1px var(--border)}.um-szb img{display:block;block-size:108px;inline-size:auto}
.um-szb.is-on{box-shadow:inset 0 0 0 3px #E8A642;background:var(--surface-sunken)}
.gd-modal:has(.um-glass){place-items:end center;background:rgba(6,14,20,.32);padding-block-end:10px}.gd-modal:has(.um-glass) .gd-modal__box{inline-size:min(640px,100%);gap:10px;padding:14px 18px}
.um-glass{display:flex;gap:14px;align-items:flex-start}
.um-opts{display:grid;gap:6px;flex:1}
.um-opt{all:unset;cursor:pointer;display:flex;gap:10px;align-items:flex-start;padding:6px 12px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--border);font-size:13.5px;font-weight:700;color:var(--heading)}
.um-opt>span{display:grid;gap:2px}.um-opt small{font-weight:400;font-size:12.5px;color:var(--text-muted)}
.um-opt i{flex:none;display:grid;place-items:center;inline-size:20px;block-size:20px;border-radius:6px;box-shadow:inset 0 0 0 2px var(--border);margin-block-start:1px}
.um-opt.is-on{box-shadow:inset 0 0 0 2px #E8A642;background:var(--surface-sunken)}.um-opt.is-on i{background:#E8A642;box-shadow:none;color:#142B3B}.um-opt.is-on i .bgv-icon{inline-size:14px;block-size:14px}
.um-cnt{color:var(--text-muted);font-size:12.5px}
.um-states{display:grid;grid-template-columns:1fr 1fr;gap:10px 8px}.um-states figure{margin:0;display:grid;justify-items:center;align-content:start;gap:4px;text-align:center}
.um-states img{block-size:64px;inline-size:auto;max-inline-size:100%}.um-states figure>b{display:grid;place-items:center;block-size:64px;font-size:30px;color:var(--heading)}
.um-states figcaption{font-size:12px;color:var(--text-muted);line-height:1.5}
.um-b{position:relative;inline-size:var(--bw);flex:none;direction:ltr}
.um-b>img:first-child{display:block;inline-size:100%;block-size:auto;filter:drop-shadow(0 10px 16px rgba(0,0,0,.5))}
.um-hl{position:absolute;inline-size:calc(var(--bw) * .085);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 0 3px var(--felt-gold),0 0 12px 2px rgba(232,166,66,.7);background:rgba(232,166,66,.18)}
.um-hl.is-tgt{box-shadow:0 0 0 3px #E0505C,0 0 12px 2px rgba(224,80,92,.7);background:rgba(224,80,92,.15)}
.um-f{position:absolute;inline-size:calc(var(--bw) * .066);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%}
.um-f img{display:block;inline-size:100%;block-size:100%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}
.um-f.is-me{box-shadow:0 0 0 2.5px var(--seat-1)}.um-f.is-op{box-shadow:0 0 0 2.5px var(--seat-2)}
.um-f.is-sel{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.um-f.is-out img{filter:grayscale(1) brightness(.6)}
.um-f b{position:absolute;inset-block-end:-6px;inset-inline-end:-8px;min-inline-size:20px;block-size:20px;padding-inline:3px;border-radius:10px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:11.5px;box-shadow:0 0 0 1.5px #FAF5EC;box-sizing:border-box}
.um-path{position:absolute;inset:0;inline-size:100%;block-size:100%;overflow:visible}.um-path line{stroke:var(--felt-gold);stroke-width:.8;stroke-dasharray:1.6 1.2}
.um-pop{position:absolute;transform:translate(-50%,-190%);padding:2px 8px;border-radius:999px;background:#FAF5EC;color:#142B3B;font-size:12px;white-space:nowrap;box-shadow:0 3px 6px rgba(0,0,0,.4)}
.um-me{display:grid;gap:8px;justify-items:center;inline-size:100%}
.um-acts{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.um-ask{color:var(--felt-ink);font-size:14px;font-weight:700}
.um-panel{display:flex;gap:16px;align-items:center;justify-content:center}
.um-hps{display:inline-flex;gap:6px;align-items:center}
.um-hp{display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 3px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:14px;font-weight:800;white-space:nowrap}
.um-hp img{inline-size:24px;block-size:24px;border-radius:50%}.um-hp small{font-size:11px;color:var(--felt-muted);font-weight:600}
.um-hp.is-out{opacity:.45}.um-hp.is-out img{filter:grayscale(1)}
.gc-seat__meta .um-hp{font-size:12px;padding:1px 6px 1px 2px}.gc-seat__meta .um-hp img{inline-size:18px;block-size:18px}
.gc-seat__meta>*{white-space:nowrap}.gc-seat{max-inline-size:400px}
.gc-hand .gc-card{margin-inline-start:6px}.gc-hand .gc-card:first-child{margin-inline-start:0}.cx-phone .gc-hand .gc-card{margin-inline-start:4px}.cx-phone .gc-hand .gc-card:first-child{margin-inline-start:0}
.um-pile{display:inline-flex;gap:8px}.um-pile>span{position:relative}.um-pile img{display:block;inline-size:40px;border-radius:3px}.um-pile b{position:absolute;inset-block-end:-6px;inset-inline-start:50%;transform:translateX(50%);padding:0 5px;border-radius:8px;background:#142B3B;color:#FAF5EC;font-size:11px}
.um-card{position:relative;display:inline-block;inline-size:var(--w)}.um-card img{display:block;inline-size:100%;border-radius:6px;box-shadow:0 4px 10px -4px rgba(0,0,0,.5)}
.um-card>b{position:absolute;inset-block-start:-9px;inset-inline-start:50%;transform:translateX(50%);padding:1px 7px;border-radius:999px;background:#E8A642;color:#142B3B;font-size:11.5px;white-space:nowrap}
.um-row{display:flex;gap:12px;justify-content:center;align-items:flex-end}
.um-chars{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-block-end:8px}.um-chars img{inline-size:100%;border-radius:6px}
.um-pick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.um-pk{all:unset;cursor:pointer;display:block;border-radius:6px}.um-pk img{display:block;inline-size:100%;border-radius:6px}
.um-pk.is-sel{box-shadow:0 0 0 3px #E8A642}.um-pk.is-taken{filter:grayscale(1);opacity:.45;cursor:default}
.um-tg{display:flex;gap:10px;justify-content:center}
.um-t{all:unset;cursor:pointer;display:grid;justify-items:center;gap:4px;padding:10px 14px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--border);font-size:14px}.um-t img{inline-size:64px;block-size:64px}.um-t small{color:var(--text-muted)}
.um-t.is-on{box-shadow:inset 0 0 0 2.5px #E8A642}
.um-fight{display:flex;gap:12px;align-items:center;justify-content:center}.um-fight figure{margin:0;display:grid;justify-items:center;gap:6px}.um-fight figcaption{font-size:13px}
.um-vs{font-weight:800;color:var(--heading);font-size:15px;white-space:nowrap}
.um-steps .gc-tag--soft{background:var(--surface-sunken);color:var(--text)}
.um-steps{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:13.5px}.um-steps li{display:flex;gap:8px;align-items:center}
.um-played{display:flex;gap:10px;align-items:center;max-inline-size:460px;color:var(--felt-ink);font-size:13.5px;line-height:1.7}
.cx-phone .gc-table{gap:6px}
.um-me--ph{gap:6px}.um-me--ph .um-acts{gap:6px;padding-inline:8px}.um-me--ph .um-ask{font-size:13px}
.um-me--ph .um-hp{font-size:12.5px}.um-me--ph .um-hp img{inline-size:20px;block-size:20px}
.cx-phone .gc-seat{max-inline-size:none}
.cx-phone .um-pick{grid-template-columns:repeat(4,1fr);gap:5px}
.cx-phone .um-fight{gap:6px}.cx-phone .um-vs{font-size:13px}
.cx-phone .um-played{font-size:12.5px;padding-inline:10px}`,
    shotTitle: 'نوبت شما', turnSub: 'انتخاب اکشن',
    diffs: [
      ['چیدمان', 'میدان مارموریال وسط میز با شمارهٔ خانه‌ها و رنگ منطقه‌ها؛ مبارزان با حلقهٔ رنگ صندلی و عدد جان. جان هر مبارز، دسته و کارت روی دورریختهٔ شما بالای دست؛ جان مبارزان حریف کنار اسمش. کارت شخصیت هر دو قهرمان در ستون کناری. BGA این بازی را ندارد'],
      ['حرکت و هدف', 'خانه‌های قابل رسیدن از گراف میدان حساب شده‌اند (مبارز خودی رد می‌شود، حریف نه) (§۷)؛ هدف‌های مجاز حمله با حلقهٔ قرمز: دوربرد هم‌منطقه، نزدیک‌زن مجاور (§۸)'],
      ['نبرد', 'مدافع پنجرهٔ کارت‌های رو به پایین را می‌بیند و فقط دفاع و همه‌کاره بازی‌کردنی است (§۹)؛ رو شدن با جمع ارزش و تقویت و اثرها به ترتیب «حین نبرد» و «پس از نبرد» (§۱۰)'],
      ['شروع و نوبت', 'انتخاب قهرمان به نوبت (§۴)، چیدن یارها در منطقهٔ قهرمان (§۵)، توانایی اختیاری شروع نوبت (§۶)؛ دور ریختن تا ۷ کارت و خستگی با همین پنجره‌ها و پیام وضعیت. قهرمان‌های دیگر در دو بازی جدا با همین بازیکنان: چیدن نشان مه (§۱۳)، پنجرهٔ اندازهٔ آلیس (§۱۴)، وضع قهرمان‌ها روی میدان و پنجرهٔ انتخاب اثر کارت (§۱۵)'],
      ['آرت', 'میدان، کارت‌ها، نشان مبارزان، نشان مه، برچسب‌های وضع و کارت شخصیت رندر خود سایت‌اند و در MISSING-ART با اندازه ثبت شدند تا با نسخهٔ وفادار به ناشر عوض شوند'],
      ['موتور', 'متن کارت‌ها برگردان موتور است و با دفترچهٔ رسمی تطبیق نشده؛ بازی تیمی ۲ به ۲ ندارد (RULES E1، E2)'],
    ],
  };
}
