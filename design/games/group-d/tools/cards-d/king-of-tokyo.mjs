// King of Tokyo («پادشاه توکیو») on the group D frame. Repo engine: 2–6 players, one Tokyo spot at every count (no Tokyo Bay, E1),
// 23 curated power cards with Persian names (E3). BGA layout: the Tokyo board with the monster in Tokyo City, the market of 3 power
// cards beside it, every monster's board with the blue (VP) and red (health) wheels, the dice tray under the board.
// Art: board, monster boards/figures/icons, wheels, dice, energy cube, card back = BGA; power cards = the site's ready-to-use renders
// (242×257, shown at ½ and ¼ only). Wheel geometry and angles are BGA's (kingoftokyo.css/js: POINTS_DEG, HEALTH_DEG).
// Mock: 4 players, order مینا → نیلوفر → رضا → سارا. Every number below follows the engine (rules.ts) turn by turn:
//  S0 you 7♥ 12★ 5⚡ [محبوب بچه‌ها]; نیلوفر 9/10/2 [زره]; رضا 4/8/7; سارا in Tokyo 5/15/1 [غول آلفا]. Market 4,11,18; deck 13.
//  roll 2 → 3,3,claw,claw,heart,3: +3★ (15), +1♥ (8), 2 hits on سارا (3). سارا leaves; you enter (+1★ = 16).
//  buy شعله‌افکن (3⚡ → 2): 2 hits to the others: نیلوفر 9→7 (armor blocks single hits only), رضا 4→2, سارا 3→1. Market refills 6.
//  نیلوفر: claw,claw,2,bolt,2,heart → you 8→6, she 7→8 ♥, 2→3 ⚡. You stay. رضا: 1,1,1,bolt,bolt,claw → 9★, 9⚡, you 6→5.
//  سارا: heart,heart,bolt,… → 1→3 ♥, 2⚡. Your turn in Tokyo: +2★ (18). Roll claw,claw,1,1,bolt,heart from Tokyo: نیلوفر 8→6,
//  رضا 2→0 (out), سارا 3→1; bolt +1 and محبوب بچه‌ها +1 → 4⚡; heart heals nothing in Tokyo. Buy قطار شهری (4⚡): +2★ = 20, you win.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['kot-' + n];
  const PD = [25, 40, 56, 73, 89, 105, 122, 138, 154, 170, 187, 204, 221, 237, 254, 271, 288, 305, 322, 339, 359];
  const HD = [360, 326, 301, 274, 249, 226, 201, 174, 149, 122, 98, 64, 39];
  const FN = { 1: '۱', 2: '۲', 3: '۳', heart: 'قلب', bolt: 'صاعقه', claw: 'پنجه' };
  const P = { 1: ['جعبهٔ کمک‌های اولیه', 3, '+۲ جان', 'دورریختنی'], 4: ['قطار شهری', 4, '+۲ امتیاز', 'دورریختنی'], 6: ['آسمان‌خراش', 6, '+۴ امتیاز', 'دورریختنی'], 9: ['تانک‌ها', 4, '+۴ امتیاز، ۳ ضربه به خودتان', 'دورریختنی'], 11: ['شعله‌افکن', 3, '۲ ضربه به همهٔ هیولاهای دیگر', 'دورریختنی'], 13: ['زره', 4, 'ضربهٔ تکی به شما نمی‌خورد', 'نگه‌دار'], 14: ['حملهٔ اسیدی', 6, 'هر نوبت ۱ ضربهٔ اضافه', 'نگه‌دار'], 16: ['محبوب بچه‌ها', 3, 'هر بار انرژی می‌گیرید، ۱ انرژی بیشتر', 'نگه‌دار'], 18: ['گیاه‌خوار', 5, 'نوبتی که ضربه نزنید +۱ امتیاز', 'نگه‌دار'], 20: ['غول آلفا', 5, 'هر حمله +۱ امتیاز', 'نگه‌دار'] };
  const MON = { 1: 4, 2: 3, 6: 5, 4: 6 }; // seat → BGA monster: The King, Cyber Kitty, Gigazaur, Meka Dragon
  const NM = { 1: 'شما', 2: 'نیلوفر', 6: 'رضا', 4: 'سارا' };
  const im = (n, alt = '', cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${A(n)}" alt="${alt}">`;
  // monster board with BGA wheels behind the windows
  const mboard = (seat, p, cls = '') => `<div class="kt-mb${cls ? ' ' + cls : ''}${p.out ? ' is-out' : ''}" role="img" aria-label="صفحهٔ ${NM[seat]}: ${fa(p.vp)} امتیاز، ${fa(p.hp)} جان">${im('wheel-blue', '', 'kt-wb" style="transform:rotate(' + PD[Math.min(20, p.vp)] + 'deg)')}${im('wheel-red', '', 'kt-wr" style="transform:rotate(' + HD[Math.min(12, p.hp)] + 'deg)')}${im('mboard-' + MON[seat], '', 'kt-mbi')}${p.out ? `<span class="kt-out">${im('ic-skull')}حذف شد</span>` : ''}${p.hit ? `<span class="kt-hit">−${fa(p.hit)}</span>` : ''}${p.gain ? `<span class="kt-gain">${p.gain}</span>` : ''}</div>`;
  const stat = (k, n, of) => `<span class="kt-st">${im(k === 'e' ? 'energy' : 'ic-' + k)}<b>${fa(n)}</b>${of ? `<small>از ${fa(of)}</small>` : ''}</span>`;
  const card = (id, o = {}) => `<span class="kt-c${o.ok ? ' is-ok' : ''}${o.sel ? ' is-sel' : ''}${o.no ? ' is-no' : ''}">${im('power-' + id, `${P[id][0]}، ${fa(P[id][1])} انرژی: ${P[id][2]}`)}</span>`;
  const die = (f, o = {}) => `<button type="button" class="kt-d${o.keep ? ' is-keep' : ''}${o.off ? ' is-off' : ''}" aria-label="${FN[f]}${o.keep ? '، نگه داشته' : ''}">${im('die-' + f)}${o.keep ? im('ic-lock', '', 'kt-lock') : ''}</button>`;
  const blank = '<span class="kt-d kt-d--blank"></span>';
  // tray: { who, label, dice:[faces], keep:[i], off, chips:[html], wait }
  const tray = (t) => `<div class="kt-tray${t.dice ? '' : ' is-empty'}" aria-label="تاس‌ها"><div class="kt-dice">${t.dice ? t.dice.map((f, i) => die(f, { keep: t.keep?.includes(i), off: t.off })).join('') : Array.from({ length: 6 }, () => blank).join('')}</div><div class="kt-tinfo"><span class="kt-tl">${t.label}</span>${(t.chips ?? []).map((c) => `<span class="kt-chip">${c}</span>`).join('')}</div></div>`;
  const market = (m, ph) => `<div class="kt-mk" aria-label="بازار کارت قدرت"><div class="kt-mkg">${m.cards.map((id) => card(id, m.o?.[id] ?? {})).join('')}<span class="kt-c kt-deck">${im('back', '')}<b>${fa(m.deck)}</b></span></div>${ph ? '' : `<small>بازار و دسته</small>`}</div>`;
  const boardTokyo = (who) => `<div class="kt-bd" role="img" aria-label="${who ? `توکیو: ${NM[who]}` : 'توکیو خالی است'}">${im('board', '')}<div class="kt-city">${who ? im('mfig-' + MON[who], '') : ''}</div></div>`;
  const keepChip = (ids) => ids.length ? ids.map((id) => `<span class="kt-kc">${P[id][0]}</span>`).join('') : '<span class="kt-kc is-none">بدون کارت</span>';
  const oppB = (seat, p, turn) => `<figure class="kt-ob${turn ? ' is-turn' : ''}"><figcaption><i style="background:var(--seat-${seat})"></i>${NM[seat]}<span>${im('energy')}${fa(p.e)}</span></figcaption>${mboard(seat, p)}<div class="kt-oc">${keepChip(p.k)}</div></figure>`;
  const seatMeta = (p) => p.out ? `<span class="gc-tag gc-tag--soft">${im('ic-skull', '', 'kt-mi')}حذف شد</span><span>${fa(p.vp)} امتیاز</span>` : `<span class="kt-sm">${im('ic-heart')}${fa(p.hp)}</span><span class="kt-sm">${im('ic-star')}${fa(p.vp)}</span><span class="kt-sm">${im('energy')}${fa(p.e)}</span>${p.k.length ? `<span>کارت ${fa(p.k.length)}</span>` : ''}`;
  const opps = (st, turn) => [2, 6, 4].map((s) => ({ name: NM[s], av: NM[s][0], seat: s, clock: st[s].out ? '' : ({ 2: '1:10', 6: '0:55', 4: '1:25' })[s], turn: turn === s, out: st[s].out, meta: seatMeta(st[s]) }));
  // st: {1:{hp,vp,e,k},2:…,6:…,4:…, tokyo, mk:{cards,deck,o}, tray, turn, banner}
  const table = (st) => (ph) => `${st.banner ? `<div class="kt-banner">${ic(st.bannerIc ?? 'zap')}<span>${st.banner}</span></div>` : ''}<div class="kt-row">${ph ? '' : `<div class="kt-opps">${[2, 6, 4].map((s) => oppB(s, st[s], st.turn === s)).join('')}</div>`}${boardTokyo(st.tokyo)}${market(st.mk, ph)}</div>${tray(st.tray)}`;
  const above = (st, acts) => (ph) => `<div class="kt-me${ph ? ' kt-me--ph' : ''}">${mboard(1, st[1], 'kt-mb--me')}<div class="kt-stats">${stat('heart', st[1].hp, 10)}${stat('star', st[1].vp, 20)}${stat('e', st[1].e)}${st.tokyo === 1 ? `<span class="gc-tag">در توکیو</span>` : ''}</div><div class="kt-keep">${st[1].k.map((id) => card(id)).join('')}</div>${acts ? `<div class="kt-acts">${acts(ph)}</div>` : ''}</div>`;
  const note = (vp) => `<span class="cx-note">${fa(vp)} از ${fa(20)} امتیاز</span>`;
  const tbl = (head, rows) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const rail = (round, tokyo, deck) => `<section class="cx-card"><h3>دور ${fa(round)}</h3><div class="gc-pills"><span class="bgv-chip">${tokyo ? `توکیو: ${NM[tokyo]}` : 'توکیو خالی'}</span><span class="bgv-chip">${im('back')}دسته: ${fa(deck)}</span></div><div class="ga-rule">${ic('info')}<span>سه عدد یکسان همان عدد امتیاز دارد و هر تاس اضافه ${fa(1)}+. قلب ${fa(1)} جان (در توکیو نه)، صاعقه ${fa(1)} انرژی، پنجه ${fa(1)} ضربه. هر کس به ${fa(20)} امتیاز برسد یا آخرین هیولای زنده باشد برنده است.</span></div></section>`;

  // ---------- states ----------
  const MK0 = { cards: [4, 11, 18], deck: 13 };
  const S0 = { 1: { hp: 7, vp: 12, e: 5, k: [16] }, 2: { hp: 9, vp: 10, e: 2, k: [13] }, 6: { hp: 4, vp: 8, e: 7, k: [] }, 4: { hp: 5, vp: 15, e: 1, k: [20] }, tokyo: 4, mk: MK0, turn: 1 };
  const ROLL1 = ['3', '3', 'claw', '1', 'heart', '3'];
  const ROLL2 = ['3', '3', 'claw', 'claw', 'heart', '3'];
  const S2 = { ...S0, 1: { ...S0[1], vp: 15, hp: 8 }, 4: { ...S0[4], hp: 3, hit: 2 } };
  const S3 = { ...S2, 1: { ...S2[1], vp: 16, gain: `+${fa(1)}` }, 4: { ...S2[4], hit: 0 }, tokyo: 1 };
  const S4 = { ...S3, 1: { ...S3[1], gain: '' } };
  const MK1 = { cards: [4, 18, 6], deck: 12 };
  const S5 = { 1: { hp: 8, vp: 16, e: 2, k: [16] }, 2: { hp: 7, vp: 10, e: 2, k: [13] }, 6: { hp: 2, vp: 8, e: 7, k: [] }, 4: { hp: 1, vp: 15, e: 1, k: [20] }, tokyo: 1, mk: MK1, turn: 2 };
  const NROLL = ['claw', 'claw', '2', 'bolt', '2', 'heart'];
  const S6 = { ...S5, 1: { ...S5[1], hp: 6, hit: 2 }, 2: { ...S5[2], hp: 8, e: 3 } };
  const S7 = { 1: { hp: 5, vp: 18, e: 2, k: [16], gain: `+${fa(2)}` }, 2: { hp: 8, vp: 10, e: 3, k: [13] }, 6: { hp: 2, vp: 9, e: 9, k: [] }, 4: { hp: 3, vp: 15, e: 2, k: [20] }, tokyo: 1, mk: MK1, turn: 1 };
  const MROLL = ['claw', 'claw', '1', '1', 'bolt', 'heart'];
  const S8 = { ...S7, 1: { ...S7[1], e: 4, gain: '' }, 2: { ...S7[2], hp: 6, hit: 2 }, 6: { ...S7[6], hp: 0, out: true }, 4: { ...S7[4], hp: 1, hit: 2 } };
  const S9 = { ...S8, 1: { ...S8[1], vp: 20, e: 0 }, 2: { ...S8[2], hit: 0 }, 4: { ...S8[4], hit: 0 }, mk: { cards: [18, 6, 1], deck: 11 }, turn: 0 };
  // sanity: the mock must add up
  const chk = (c, m) => { if (!c) throw new Error('king-of-tokyo mock: ' + m); };
  chk(S2[1].vp === 12 + 3 && S2[1].hp === 7 + 1 && S2[4].hp === 5 - 2, 'resolve');
  chk(S5[2].hp === 9 - 2 && S5[6].hp === 4 - 2 && S5[4].hp === 3 - 2 && S5[1].e === 5 - 3, 'flamethrower');
  chk(S7[1].vp === 16 + 2 && S7[1].hp === 6 - 1, 'start in tokyo');
  chk(S8[1].e === 2 + 1 + 1 && S8[2].hp === 8 - 2 && S8[4].hp === 3 - 2 && S9[1].vp === 18 + 2 && S8[1].e - 4 === S9[1].e, 'last turn');

  const rollActs = (left) => (ph) => `${btn(ph ? `دوباره (${fa(left)})` : `ریختن دوباره (${fa(left)} مانده)`, 'secondary', 'repeat')}${btn('حل تاس‌ها', 'primary', 'check')}`;
  const buyActs = (ph) => `${btn(ph ? 'جارو' : `جارو (${fa(2)} انرژی)`, 'secondary', 'repeat')}${btn('پایان نوبت', 'secondary', 'next')}`;
  const LOG0 = [[6, 'رضا ۲ انرژی گرفت'], [4, 'سارا در توکیو ماند و ۲ امتیاز گرفت'], [1, 'نوبت شما']];

  const buyM = (ph) => modal('خرید شعله‌افکن؟', `<div class="kt-mrow">${card(11, { sel: true })}<div><p><b>${P[11][0]}</b>، ${fa(3)} انرژی، دورریختنی: ${P[11][2]}. کارت همین حالا اثر می‌کند و دور ریخته می‌شود.</p>${tbl(['هیولا', 'جان', 'بعد از کارت'], [{ c: ['نیلوفر', fa(9), fa(7)] }, { c: ['رضا', fa(4), fa(2)] }, { c: ['سارا', fa(3), fa(1)] }])}<p class="cx-note">زرهِ نیلوفر فقط ضربهٔ تکی را می‌گیرد، پس هر دو ضربه می‌خورد. بعد از خرید ${fa(2)} انرژی می‌ماند و جای کارت از دسته پر می‌شود.</p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('خرید', 'primary', 'check')}`);
  const yieldM = (ph) => modal('۲ ضربه خوردید', `<p>نیلوفر با دو پنجه به شما زد و ${fa(6)} جان مانده است. از توکیو بیرون می‌روید؟</p><p class="kt-mline"><span class="kt-chip">${im('ic-heart')}${fa(8)} ← ${fa(6)}</span><span class="cx-note">اگر بروید ضربه را باز هم خورده‌اید و نیلوفر وارد توکیو می‌شود (${fa(1)}+ امتیاز). اگر بمانید، شروع نوبت بعد ${fa(2)}+ امتیاز می‌گیرید.</span></p>`, `${btn('بیرون رفتن', 'secondary', 'flag')}${btn('ماندن', 'primary', 'check')}`);
  const endM = (ph) => modal('مینا پادشاه توکیو شد', `<p>شما با خرید قطار شهری به ${fa(20)} امتیاز رسیدید و بازی همان لحظه تمام شد.</p>${tbl(['هیولا', 'امتیاز', 'جان', 'وضعیت'], [{ c: [`${ic('trophy')} شما`, fa(20), fa(5), 'زنده، در توکیو'], win: true }, { c: ['سارا', fa(15), fa(1), 'زنده'] }, { c: ['نیلوفر', fa(10), fa(6), 'زنده'] }, { c: ['رضا', fa(9), fa(0), 'حذف شد'] }])}<p class="cx-note">برندهٔ دیگر هم ممکن بود: آخرین هیولای زنده. اگر همه با هم حذف شوند، کسی نمی‌برد.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'KingOfTokyo', fa: 'پادشاه توکیو', latin: 'King of Tokyo', meta: ['زنده', '۴ نفر', 'دور ۶'],
    opps: opps(S0, 1),
    me: { cards: [], clock: '0:52', turn: true, note: note(12), above: above(S0, rollActs(2)) },
    table: table({ ...S0, tray: { dice: ROLL1, keep: [0, 1, 2, 5], label: `ریختن ${fa(1)} از ${fa(3)}`, chips: [`نگه داشته: ${fa(4)} تاس`] } }),
    status: `<b>نوبت شماست.</b> اولین ریختن: سه تا ${fa(3)}، یک پنجه، یک ${fa(1)} و یک قلب. سه‌تا ${fa(3)} و پنجه را نگه داشته‌اید؛ دو تاس دیگر را می‌شود دوباره ریخت، تا دو بار دیگر.`,
    pstatus: `<b>نوبت شما.</b> روی تاس بزنید تا قفل شود؛ دو ریختن مانده.`,
    railCard: rail(6, 4, 13), logNote: `دور ${fa(6)}`, log: LOG0,
    dockItems: [['list', 'رویدادها'], ['users', 'هیولاها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    cardW: 0,
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'هر هیولا ۱۰ جان و ۰ امتیاز',
        meta: ['زنده', '۴ نفر', 'دور ۱'],
        opps: opps({ 2: { hp: 10, vp: 0, e: 0, k: [] }, 6: { hp: 10, vp: 0, e: 0, k: [] }, 4: { hp: 10, vp: 0, e: 0, k: [] } }, 2),
        me: { turn: false, clock: '1:30', note: note(0), above: above({ 1: { hp: 10, vp: 0, e: 0, k: [] } }, null) },
        table: table({ 1: { hp: 10, vp: 0, e: 0, k: [] }, 2: { hp: 10, vp: 0, e: 0, k: [] }, 6: { hp: 10, vp: 0, e: 0, k: [] }, 4: { hp: 10, vp: 0, e: 0, k: [] }, tokyo: 0, mk: { cards: [1, 9, 14], deck: 20 }, turn: 2, tray: { label: 'منتظر ریختن نیلوفر' } }),
        railCard: rail(1, 0, 20),
        status: `<b>بازی شروع شد.</b> هر هیولا ${fa(10)} جان و صفر امتیاز دارد. دستهٔ کارت قدرت بُر خورد و ${fa(3)} کارت رو شد. نیلوفر به قید قرعه نفر اول است؛ توکیو خالی است، پس او اول وارد می‌شود.`,
        log: [[1, 'بازی با ۴ هیولا شروع شد'], [2, 'نیلوفر نفر اول است']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'حل تاس‌ها', turnSub: 'نتیجه و منتظر تصمیم سارا',
        opps: opps(S2, 4),
        me: { note: note(15), above: above(S2, null) },
        table: table({ ...S2, banner: 'منتظر تصمیم سارا: ماندن یا بیرون رفتن از توکیو', bannerIc: 'clock', tray: { dice: ROLL2, off: true, label: 'حل شد', chips: [`${im('die-3')}سه‌تا ${fa(3)}: ${fa(3)}+ امتیاز`, `${im('ic-heart')}${fa(1)}+ جان`, `${im('die-claw')}${fa(2)} ضربه به سارا`] } }),
        status: `<b>تاس‌ها حل شد.</b> سه‌تا ${fa(3)} سه امتیاز داد (${fa(15)})، قلب یک جان (${fa(8)}) و دو پنجه به سارا که در توکیوست خورد (${fa(3)} جان). حالا سارا باید بگوید می‌ماند یا بیرون می‌رود.`,
        pstatus: `<b>${fa(3)}+ امتیاز، ${fa(1)}+ جان، ${fa(2)} ضربه.</b> منتظر سارا.`,
        log: [[1, 'شما دو تاس را دوباره ریختید'], [1, 'سه‌تا ۳: ۳+ امتیاز'], [1, '۲ ضربه به سارا'], [4, 'سارا دارد تصمیم می‌گیرد']],
        phone: true,
      },
      {
        shotTitle: 'ورود به توکیو', turnSub: 'سارا بیرون رفت؛ ۱+ امتیاز',
        opps: opps(S3, 1),
        me: { note: note(16), above: above(S3, buyActs) },
        table: table({ ...S3, banner: `شما وارد توکیو شدید: ${fa(1)}+ امتیاز`, bannerIc: 'zap', tray: { dice: ROLL2, off: true, label: 'حل شد' } }),
        railCard: rail(6, 1, 13),
        status: `<b>سارا از توکیو بیرون رفت</b> و شما جای او را گرفتید: یک امتیاز (${fa(16)}). از این به بعد پنجه‌هایتان به همهٔ هیولاهای بیرون می‌خورد، ولی قلب در توکیو جان نمی‌دهد. حالا نوبت خرید است.`,
        log: [[1, '۲ ضربه به سارا'], [4, 'سارا از توکیو بیرون رفت'], [1, 'شما وارد توکیو شدید: ۱+ امتیاز']],
      },
      {
        shotTitle: 'خرید کارت', turnSub: 'کارت‌های خریدنی روشن‌اند',
        opps: opps(S4, 1),
        me: { note: note(16), above: above(S4, buyActs) },
        table: table({ ...S4, mk: { ...MK0, o: { 4: { ok: true }, 11: { sel: true }, 18: { ok: true } } }, tray: { dice: ROLL2, off: true, label: 'حل شد' } }),
        overlay: buyM, railCard: rail(6, 1, 13),
        status: `<b>خرید:</b> ${fa(5)} انرژی دارید و هر سه کارت بازار خریدنی است. شعله‌افکن را زدید؛ قبل از خرید اثرش را می‌بینید. با ${fa(2)} انرژی هم می‌شود بازار را جارو کرد.`,
        pstatus: `<b>خرید.</b> شعله‌افکن، ${fa(3)} انرژی.`,
        log: [[4, 'سارا از توکیو بیرون رفت'], [1, 'شما وارد توکیو شدید: ۱+ امتیاز'], [1, 'شما شعله‌افکن را زدید']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'تاس‌های نیلوفر زنده',
        opps: opps(S5, 2),
        me: { turn: false, note: note(16), above: above(S5, null) },
        table: table({ ...S5, tray: { dice: NROLL, keep: [0, 1], label: `نیلوفر: ریختن ${fa(2)} از ${fa(3)}`, chips: [`${im('die-claw')}${fa(2)} پنجه نگه داشته`] } }),
        railCard: rail(6, 1, 12),
        status: `<b>نوبت نیلوفر است.</b> دو پنجه را قفل کرده و یک ریختن دیگر دارد. اگر همین بماند، چون شما در توکیو هستید هر دو ضربه به شما می‌خورد.`,
        pstatus: `<b>نوبت نیلوفر.</b> دو پنجه نگه داشته.`,
        log: [[1, 'شما شعله‌افکن خریدید: ۲ ضربه به همه'], [6, 'جان رضا به ۲ رسید'], [2, 'نوبت نیلوفر']],
        
      },
      {
        shotTitle: 'تسلیم توکیو', turnSub: 'ماندن یا بیرون رفتن',
        opps: opps(S6, 2),
        me: { turn: false, clock: '0:20', note: note(16), above: above(S6, null) },
        table: table({ ...S6, tray: { dice: NROLL, off: true, label: 'نیلوفر: حل شد', chips: [`${im('die-claw')}${fa(2)} ضربه به شما`, `${im('ic-heart')}${fa(1)}+`, `${im('energy')}${fa(1)}+`] } }),
        overlay: yieldM, railCard: rail(6, 1, 12),
        status: `<b>نیلوفر دو ضربه به شما زد.</b> فقط هیولای توکیو تصمیم می‌گیرد؛ بقیه منتظر شما هستند.`,
        pstatus: `<b>${fa(2)} ضربه خوردید.</b> می‌مانید یا می‌روید؟`,
        log: [[2, 'نیلوفر تاس‌ها را حل کرد'], [2, '۲ ضربه به مینا'], [1, 'منتظر تصمیم شما']],
        phone: true,
      },
      {
        shotTitle: 'شروع نوبت در توکیو', turnSub: '۲+ امتیاز، ریختن ۱ از ۳',
        opps: opps(S7, 1),
        me: { clock: '1:00', note: note(18), above: above(S7, (ph) => btn('ریختن تاس', 'primary', 'repeat')) },
        table: table({ ...S7, banner: `شروع نوبت در توکیو: ${fa(2)}+ امتیاز`, bannerIc: 'zap', tray: { label: `ریختن ${fa(1)} از ${fa(3)}` } }),
        railCard: rail(7, 1, 12), meta: ['زنده', '۴ نفر', 'دور ۷'],
        status: `<b>نوبت شماست و در توکیو ماندید.</b> شروع نوبت در توکیو دو امتیاز داد (${fa(18)}). رضا و سارا هم نوبتشان را بازی کردند؛ رضا یک ضربهٔ دیگر زد و ${fa(5)} جان دارید.`,
        pstatus: `<b>${fa(2)}+ امتیاز.</b> تاس بریزید.`,
        log: [[6, 'رضا سه‌تا ۱: ۱+ امتیاز و ۱ ضربه به مینا'], [4, 'سارا ۲ جان گرفت'], [1, 'شروع نوبت در توکیو: ۲+ امتیاز']], logNote: `دور ${fa(7)}`,
        
      },
      {
        shotTitle: 'حذف', turnSub: 'جان رضا به صفر رسید',
        opps: opps(S8, 1),
        me: { clock: '0:41', note: note(18), above: above(S8, buyActs) },
        table: table({ ...S8, mk: { ...MK1, o: { 4: { ok: true }, 18: { no: true }, 6: { no: true } } }, banner: 'رضا حذف شد', bannerIc: 'x', tray: { dice: MROLL, off: true, label: 'حل شد', chips: [`${im('die-claw')}${fa(2)} ضربه به همه`, `${im('energy')}${fa(1)}+${fa(1)} انرژی`, 'قلب در توکیو اثر ندارد'] } }),
        railCard: rail(7, 1, 12), meta: ['زنده', '۴ نفر', 'دور ۷'],
        status: `<b>رضا حذف شد.</b> دو پنجهٔ شما از توکیو به همهٔ هیولاهای بیرون خورد و جان رضا صفر شد. صاعقه با کارت محبوب بچه‌ها دو انرژی داد (${fa(4)}). اگر خودتان حذف شوید، پیام «حذف شدید؛ می‌توانید تماشا کنید» و دکمهٔ ترک میز می‌آید.`,
        pstatus: `<b>رضا حذف شد.</b> ${fa(4)} انرژی دارید.`,
        log: [[1, 'شما ۲ پنجه از توکیو زدید'], [6, 'رضا حذف شد'], [1, 'شما ۲ انرژی گرفتید']], logNote: `دور ${fa(7)}`,
        
      },
      {
        shotTitle: 'پایان بازی', turnSub: '۲۰ امتیاز',
        meta: ['تمام‌شده', '۴ نفر'],
        opps: opps(S9, 0).map((o) => ({ ...o, clock: '' })),
        me: { turn: false, clock: '', note: note(20), above: above(S9, null) },
        table: table({ ...S9, tray: { dice: MROLL, off: true, label: 'حل شد' } }),
        overlay: endM, railCard: rail(7, 1, 11),
        status: `<b>بازی تمام شد.</b> شما با ${fa(20)} امتیاز پادشاه توکیو شدید.`,
        log: [[1, 'شما قطار شهری خریدید: ۲+ امتیاز'], [1, 'شما به ۲۰ امتیاز رسیدید'], [1, 'شما بردید']], logNote: `دور ${fa(7)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.kt-row{display:flex;align-items:center;justify-content:center;gap:12px;direction:rtl}
.kt-bd{position:relative;inline-size:var(--bs,300px);flex:none;border-radius:6px;overflow:hidden;box-shadow:2px 2px 5px 2px rgba(0,0,0,.6)}
.kt-bd>img{display:block;inline-size:100%}
.kt-city{position:absolute;left:-3.5%;top:18%;inline-size:50%;block-size:37.5%;display:flex;align-items:flex-end;justify-content:center}
.kt-city img{block-size:100%;inline-size:auto;filter:drop-shadow(0 4px 4px rgba(0,0,0,.6))}
.kt-mk{display:grid;gap:4px;justify-items:center;color:var(--felt-muted);font-size:12px}
.kt-mkg{display:grid;grid-template-columns:repeat(2,auto);gap:8px;direction:ltr}
.kt-c{position:relative;display:block;inline-size:121px;flex:none}
.kt-c img{display:block;inline-size:100%;border-radius:8px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 12px -8px rgba(0,0,0,.6)}
.kt-c.is-no img{filter:grayscale(.7) brightness(.75)}
.kt-c.is-ok img{box-shadow:0 0 0 3px #5FBF7A,0 8px 12px -8px rgba(0,0,0,.6)}
.kt-c.is-sel{transform:translateY(-5px)}.kt-c.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.kt-deck img{inline-size:66px;margin:20px auto 0;border-radius:6px}
.kt-deck b{position:absolute;inset-block-end:-4px;inset-inline:0;margin-inline:auto;inline-size:max-content;padding:2px 8px;border-radius:999px;background:rgba(10,20,28,.8);color:#FAF5EC;font-size:12.5px}
.kt-opps{display:grid;gap:6px}
.kt-ob{margin:0;display:grid;gap:3px;inline-size:126px;padding:5px;border-radius:10px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink)}
.kt-ob.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.kt-ob figcaption{display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700}
.kt-ob figcaption i{inline-size:9px;block-size:9px;border-radius:50%}
.kt-ob figcaption span{margin-inline-start:auto;display:inline-flex;align-items:center;gap:2px;font-weight:400;font-size:12px;color:var(--felt-muted)}
.kt-ob figcaption img{inline-size:13px}
.kt-mb{position:relative;inline-size:100%;aspect-ratio:280/219;overflow:hidden;border-radius:6%/8%;flex:none}
.kt-mb img{position:absolute}
.kt-wb{left:-1.79%;top:3.2%;inline-size:58.93%}
.kt-wr{right:-1.79%;bottom:2.28%;inline-size:43.57%}
.kt-mbi{position:relative!important;z-index:1;display:block;inline-size:100%}
.kt-mb.is-out .kt-mbi{filter:grayscale(1) brightness(.6)}
.kt-out{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:4px;color:#FAF5EC;font-size:13px;font-weight:800;text-shadow:0 1px 2px #000}
.kt-out img{position:static;inline-size:18px}
.kt-hit,.kt-gain{position:absolute;z-index:2;inset-block-end:8%;inset-inline-start:6%;padding:1px 7px;border-radius:999px;background:#E0505C;color:#fff;font-size:12px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,.4)}
.kt-gain{background:#5FBF7A;color:#0E2A1A;inset-block-end:auto;inset-block-start:8%;inset-inline-start:auto;inset-inline-end:30%}
.kt-oc{display:flex;flex-wrap:wrap;gap:3px}
.kt-kc{font-size:11px;line-height:1.5;padding:0 6px;border-radius:999px;background:rgba(250,245,236,.14);color:var(--felt-ink)}
.kt-kc.is-none{background:none;color:var(--felt-muted);padding:0}
.kt-tray{display:flex;align-items:center;gap:14px;padding:8px 14px;border-radius:14px;background:rgba(6,14,20,.32);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)}
.kt-dice{display:flex;gap:8px;direction:ltr}
.kt-d{all:unset;position:relative;display:block;inline-size:50px;block-size:50px;border-radius:20%;flex:none}
.kt-d img{display:block;inline-size:100%;block-size:100%;border-radius:20%;box-shadow:0 0 0 1px #000,0 3px 5px rgba(0,0,0,.5)}
.kt-d.is-keep img{box-shadow:0 0 0 3px var(--felt-gold),0 3px 5px rgba(0,0,0,.5)}
.kt-d.is-keep{transform:translateY(-4px)}
.kt-d .kt-lock{position:absolute;inset-block-start:-7px;inset-inline-end:-7px;inline-size:18px;block-size:18px;padding:2px;border-radius:50%;background:#FAF5EC;box-shadow:0 1px 2px rgba(0,0,0,.5)}
.kt-d.is-off{cursor:default}
.kt-d--blank{box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.22)}
.kt-tinfo{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-inline-size:320px}
.kt-tl{inline-size:100%;color:var(--felt-ink);font-size:13.5px;font-weight:700}
.kt-chip{white-space:nowrap;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:12.5px}
.kt-chip img{inline-size:16px;block-size:16px;border-radius:3px}
.kt-banner{position:absolute;inset-block-start:-4px;inset-inline:0;margin-inline:auto;inline-size:max-content;max-inline-size:100%;box-sizing:border-box;z-index:3;box-shadow:0 4px 10px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.kt-me{display:flex;align-items:center;justify-content:center;gap:12px;inline-size:100%}
.kt-mb--me{inline-size:210px}
.kt-stats{display:grid;gap:4px;justify-items:start}
.kt-st{display:inline-flex;align-items:center;gap:5px;color:var(--felt-ink);font-size:14px}
.kt-st img{inline-size:20px;block-size:auto}
.kt-st b{font-size:16px}.kt-st small{color:var(--felt-muted);font-size:12px}
.kt-keep{display:flex;gap:6px}
.kt-acts{display:grid;gap:8px}
.kt-sm{display:inline-flex;align-items:center;gap:2px}
.kt-sm img,.kt-mi{inline-size:14px;block-size:auto}
.kt-mrow{display:flex;gap:16px;align-items:flex-start}
.kt-mrow>div{display:grid;gap:10px;flex:1;min-inline-size:0}
.kt-mrow .kt-c{inline-size:121px}
.kt-mline{display:flex;align-items:center;gap:10px}
.kt-mline .kt-chip{background:var(--surface-sunken);color:var(--text);white-space:nowrap}
.gd-score .bgv-icon{inline-size:16px;block-size:16px;color:var(--felt-gold);vertical-align:-3px}
.bgv-chip img{inline-size:14px;margin-inline-end:4px;border-radius:2px}
.cx-phone .gc-table{gap:6px}
.cx-phone .kt-row{gap:8px}
.cx-phone .kt-bd{--bs:226px}
.cx-phone .kt-c{inline-size:60.5px}.cx-phone .kt-c img{border-radius:5px}
.cx-phone .kt-mkg{gap:5px}
.cx-phone .kt-deck img{inline-size:38px;margin-block-start:10px}
.cx-phone .kt-deck b{font-size:11px;padding:1px 6px}
.cx-phone .kt-tray{flex-direction:column;gap:4px;padding:6px 8px;margin-inline:8px}
.cx-phone .kt-dice{gap:6px}.cx-phone .kt-d{inline-size:40px;block-size:40px}
.cx-phone .kt-tinfo{max-inline-size:none;justify-content:center}.cx-phone .kt-tl{inline-size:auto;font-size:12.5px}
.cx-phone .kt-chip{font-size:11.5px;padding:1px 6px}
.cx-phone .kt-banner{position:static;font-size:12px;padding:4px 10px;margin-inline:8px}
.kt-me--ph{gap:8px;flex-wrap:wrap;padding-inline:8px}
.kt-me--ph .kt-mb--me{inline-size:112px}
.kt-me--ph .kt-st{font-size:12.5px}.kt-me--ph .kt-st b{font-size:14px}.kt-me--ph .kt-st img{inline-size:16px}
.kt-me--ph .kt-keep .kt-c{inline-size:60.5px}
.kt-me--ph .kt-acts{display:flex;inline-size:100%;justify-content:center}
.cx-phone .kt-mrow .kt-c{inline-size:121px}
.cx-phone .kt-mrow{flex-direction:column;align-items:center}`,
    shotTitle: 'نوبت شما', turnSub: 'ریختن و نگه داشتن تاس',
    diffs: [
      ['چیدمان', 'مثل BGA: صفحهٔ توکیو با هیولای داخل شهر، بازار سه کارت قدرت با دسته کنارش، صفحهٔ هیولای هر حریف با چرخ امتیاز و جان و کارت‌های نگه‌دارش، و سینی تاس زیر میز. صفحهٔ شما پایین با جان، امتیاز و انرژی'],
      ['آرت', 'صفحهٔ توکیو، صفحه و آدمک هیولاها، چرخ‌ها، تاس‌ها و مکعب انرژی همه از BGA است. کارت‌های قدرت فعلاً رندر سادهٔ سایت‌اند (۲۳ کارت موتور با متن فارسی) و بعداً با همان اندازه عوض می‌شوند'],
      ['تاس', 'شش تاس؛ با زدن روی هر تاس قاب طلایی و قفل می‌گیرد و در ریختن بعد ثابت می‌ماند. دکمهٔ «ریختن دوباره» تعداد مانده را می‌گوید و بعد از ریختن سوم فقط «حل تاس‌ها» می‌ماند'],
      ['توکیو', 'نتیجهٔ تاس‌ها به شکل چیپ کنار سینی (§۵). ضربه به هیولای توکیو پنجرهٔ «ماندن یا بیرون رفتن» را فقط برای او باز می‌کند و بقیه پیام «منتظر تصمیم» می‌بینند (§۵، §۹). ورود ۱+ و شروع نوبت در توکیو ۲+ امتیاز با نوار طلایی (§۶، §۱۰)'],
      ['خرید و حذف', 'کارت‌هایی که انرژی‌اش را دارید حلقهٔ سبز دارند و قبل از خرید پنجرهٔ اثر کارت باز می‌شود (§۷). هیولای حذف‌شده خاکستری با «حذف شد» (§۱۱)'],
      ['قوانین', 'مثل موتور: ۲ تا ۶ نفر و همیشه یک جای توکیو؛ خلیج توکیوِ ۵ و ۶ نفره هنوز در موتور نیست (E1). ۲۳ کارت قدرت گزیدهٔ موتور به جای ۶۶ کارت بازی پایه (E3)'],
    ],
  };
}
