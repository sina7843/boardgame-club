// Dominion («دومینیون») on the group D frame. Repo engine: 2–4 players, fixed first-game Kingdom (cellar, moat, merchant, village, workshop,
// militia, remodel, smithy, market, mine). Art = the site's ready-to-use card renders (Persian text and cost composed on the card).
// BGA layout: supply (treasures and victory on one side, 10 Kingdom piles), the "in play" row, your hand, deck and discard; opponents' counts.
// Mock: 3 players (12 of each Victory card, Province pile at 8), order نیلوفر → رضا → شما, turn 9. Coins and draws add up card by card.
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['dominion-' + n];
  const C = { copper: ['مس', 0], silver: ['نقره', 3], gold: ['طلا', 6], estate: ['ملک', 2], duchy: ['تیول', 5], province: ['ایالت', 8], cellar: ['زیرزمین', 2], moat: ['خندق', 2], merchant: ['سوداگر', 3], village: ['روستا', 3], workshop: ['کارگاه', 3], militia: ['سپاه محلی', 4], remodel: ['نوسازی', 4], smithy: ['آهنگری', 4], market: ['بازار', 5], mine: ['معدن', 5] };
  const BASE = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province'];
  const KING = ['cellar', 'moat', 'merchant', 'village', 'workshop', 'militia', 'remodel', 'smithy', 'market', 'mine'];
  const alt = (k) => `${C[k][0]}، قیمت ${fa(C[k][1])}`;
  const pile = (k, n, o) => `<span class="dm-p${o.ok?.includes(k) ? ' is-ok' : ''}${o.sel === k ? ' is-sel' : ''}${o.ok && !o.ok.includes(k) ? ' is-no' : ''}${n ? '' : ' is-out'}"><img src="${A(k)}" alt="${alt(k)}"><b>${fa(n)}</b></span>`;
  // supply: { n:{}, ok:[], sel, off }
  const supply = (s, ph) => `<div class="dm-sup${ph ? ' dm-sup--ph' : ''}${s.off ? ' is-off' : ''}"><div class="dm-base">${BASE.map((k) => pile(k, s.n[k], s)).join('')}</div><div class="dm-king">${KING.map((k) => pile(k, s.n[k], s)).join('')}</div></div>`;
  const play = (list, who) => `<div class="dm-play"><small>${who ?? 'در بازی'}</small><div>${list.length ? list.map((k) => `<img src="${A(k)}" alt="${C[k][0]}">`).join('') : '<span class="dm-none">هنوز کارتی بازی نشده</span>'}</div></div>`;
  const panel = (p) => `<figure class="dm-opp${p.turn ? ' is-turn' : ''}"><figcaption><i style="background:var(--seat-${p.seat})"></i>${p.name}</figcaption><div class="dm-om"><span><img src="${A('back')}" alt="">دسته ${fa(p.deck)}</span><span>دست ${fa(p.hand)}</span><span>${p.top ? `<img src="${A(p.top)}" alt="${C[p.top][0]}">` : ''}دورریخته ${fa(p.disc)}</span></div></figure>`;
  const counters = (a, b, c) => `<div class="dm-cnt"><span>کنش <b>${fa(a)}</b></span><span>خرید <b>${fa(b)}</b></span><span><img src="${A('coin')}" alt="">سکه <b>${fa(c)}</b></span></div>`;
  const piles = (deck, disc, top) => `<div class="dm-mine"><span><img src="${A('back')}" alt="دستهٔ شما">${fa(deck)}</span><span>${top ? `<img src="${A(top)}" alt="${C[top][0]}">` : '<i></i>'}${fa(disc)}</span></div>`;
  const hand = (list, o = {}) => list.map((k, i) => ({ art: 'dominion-' + k, alt: C[k][0], ok: o.ok?.includes(k) && !o.sel?.includes(i), sel: o.sel?.includes(i), dim: o.dim?.includes(k) }));

  // ---------- state ----------
  const N = { copper: 39, silver: 34, gold: 27, estate: 12, duchy: 11, province: 8, cellar: 9, moat: 8, merchant: 10, village: 7, workshop: 10, militia: 8, remodel: 9, smithy: 8, market: 7, mine: 10 };
  const NIL = { name: 'نیلوفر', seat: 2, deck: 8, hand: 5, disc: 9, top: 'silver' };
  const REZ = { name: 'رضا', seat: 6, deck: 3, hand: 5, disc: 14, top: 'market' };
  const HAND1 = ['village', 'smithy', 'copper', 'copper', 'silver'];
  const seatMeta = (p, vp) => `<span class="gc-tag gc-tag--soft">${fa(vp)} امتیاز</span><span>دست ${fa(p.hand)}</span><span>دسته ${fa(p.deck)}</span>`;
  const opps = (turn, n = NIL, r = REZ) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:20', turn: turn === 2, meta: seatMeta(n, 12) },
    { name: 'رضا', av: 'ر', seat: 6, clock: '1:05', turn: turn === 6, meta: seatMeta(r, 9) },
  ];
  const table = (o = {}) => (ph) => `${o.banner ? `<div class="dm-banner">${ic('info')}<span>${o.banner}</span></div>` : ''}<div class="dm-mid">${supply({ n: N, ...(o.s ?? {}) }, ph)}${ph ? '' : `<div class="dm-opps">${panel({ ...(o.nil ?? NIL), turn: o.turn === 2 })}${panel({ ...(o.rez ?? REZ), turn: o.turn === 6 })}</div>`}</div>${play(o.play ?? [], o.playWho)}`;
  const above = (o) => (ph) => `<div class="dm-me${ph ? ' dm-me--ph' : ''}">${counters(...(o.cnt ?? [1, 1, 0]))}${o.acts ? `<div class="dm-acts">${o.acts(ph)}</div>` : ''}${piles(o.deck ?? 7, o.disc ?? 6, o.top ?? 'estate')}</div>`;
  const note = (vp) => `<span class="cx-note">${fa(vp)} امتیاز</span>`;
  const rail = `<section class="cx-card"><h3>نوبت ${fa(9)}</h3><div class="gc-pills"><span class="bgv-chip"><img src="${A('province')}" alt="">ایالت: ${fa(8)}</span><span class="bgv-chip">کپهٔ تمام‌شده: ${fa(0)}</span></div><div class="ga-rule">${ic('info')}<span>هر نوبت: یک کنش، بعد گنج‌ها و خرید، بعد پاک‌سازی و کشیدن ${fa(5)} کارت. بازی وقتی تمام می‌شود که کپهٔ ایالت یا هر سه کپه‌ای خالی شود.</span></div></section>`;
  const tbl = (head, rws) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rws.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const LOG = [[2, 'نیلوفر طلا خرید'], [6, 'رضا بازار و آهنگری بازی کرد و تیول خرید'], [1, 'نوبت شما']];
  // buy: village (+1 card: gold, +2 actions), smithy (+3: copper, estate, estate) → treasures copper×3, silver, gold = 8 coins
  const PLAY_BUY = ['village', 'smithy', 'copper', 'copper', 'copper', 'silver', 'gold'];
  const coinsOf = (l) => l.reduce((a, k) => a + ({ copper: 1, silver: 2, gold: 3 }[k] ?? 0), 0);
  if (coinsOf(PLAY_BUY) !== 8) throw new Error('dominion coins');
  const militiaM = () => modal('سپاه محلی: ۲ کارت دور بریزید', `<p>نیلوفر سپاه محلی بازی کرد. باید آن‌قدر دور بریزید که ${fa(3)} کارت در دستتان بماند. خندق ندارید که جلویش را بگیرد.</p><div class="dm-pick">${['militia', 'market', 'copper', 'copper', 'estate'].map((k, i) => `<span class="${i >= 3 ? 'is-sel' : ''}"><img src="${A(k)}" alt="${C[k][0]}"></span>`).join('')}</div><p class="dm-line"><span class="gc-tag">${fa(2)} از ${fa(2)}</span><span>یک مس و یک ملک انتخاب شده است</span></p>`, `${btn('دور ریختن', 'primary', 'check')}`);
  const endM = () => modal('پایان بازی', `<p>کپهٔ ایالت تمام شد. امتیاز کارت‌های امتیاز هر نفر شمرده شد.</p>${tbl(['بازیکن', 'ملک', 'تیول', 'ایالت', 'جمع', 'نوبت'], [{ c: [`${ic('trophy')} شما`, fa(3), `${fa(2)} (${fa(6)})`, `${fa(5)} (${fa(30)})`, fa(39), fa(19)], win: true }, { c: ['نیلوفر', fa(2), `${fa(3)} (${fa(9)})`, `${fa(4)} (${fa(24)})`, fa(35), fa(19)] }, { c: ['رضا', fa(3), `${fa(1)} (${fa(3)})`, `${fa(3)} (${fa(18)})`, fa(24), fa(19)] }])}<p class="cx-note">تساوی: کسی که نوبت کمتری داشته برنده است؛ اگر باز مساوی بود، برد مشترک است.</p>`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'Dominion', fa: 'دومینیون', latin: 'Dominion', meta: ['زنده', '۳ نفر', 'نوبت ۹'],
    opps: opps(1),
    me: { cards: hand(HAND1, { ok: ['village', 'smithy'], dim: ['copper', 'silver'] }), clock: '1:15', turn: true, note: note(5), above: above({ acts: (ph) => `${btn(ph ? 'گنج‌ها' : 'بازی گنج‌ها', 'secondary', 'next')}${btn('پایان نوبت', 'secondary', 'check')}` }) },
    cardW: 84, phoneCardW: 60, cardRatio: 1.28,
    table: table(),
    status: `<b>نوبت شماست: مرحلهٔ کنش.</b> یک کنش دارید. روستا و آهنگری قابل بازی‌اند؛ اول روستا را بزنید تا دو کنش بگیرید و بعد آهنگری هم بازی شود.`,
    pstatus: `<b>مرحلهٔ کنش.</b> اول روستا، بعد آهنگری.`,
    railCard: rail, logNote: `نوبت ${fa(9)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'بازیکنان'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: '۷ مس، ۳ ملک و ۵ کارت در دست',
        meta: ['زنده', '۳ نفر', 'نوبت ۱'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, clock: '0:30', turn: true, meta: seatMeta({ hand: 5, deck: 5 }, 3) }, { name: 'رضا', av: 'ر', seat: 6, clock: '0:30', meta: seatMeta({ hand: 5, deck: 5 }, 3) }],
        me: { turn: false, clock: '0:30', note: note(3), cards: hand(['copper', 'copper', 'estate', 'copper', 'copper']), above: above({ cnt: [1, 1, 0], deck: 5, disc: 0, top: null }) },
        table: table({ s: { n: { copper: 39, silver: 40, gold: 30, estate: 12, duchy: 12, province: 12, ...Object.fromEntries(KING.map((k) => [k, 10])) }, off: true }, nil: { ...NIL, deck: 5, disc: 0, top: null }, rez: { ...REZ, deck: 5, disc: 0, top: null }, turn: 2 }),
        status: `<b>بازی شروع شد.</b> همه با ${fa(7)} مس و ${fa(3)} ملک شروع می‌کنند و ${fa(5)} کارت در دست دارند. با سه نفر از هر کارت امتیاز ${fa(12)} تا در ذخیره است و از هر کارت قلمرو ${fa(10)} تا. نیلوفر شروع می‌کند.`,
        log: [[1, 'بازی با ۳ نفر شروع شد'], [2, 'نوبت نیلوفر']], logNote: `نوبت ${fa(1)}`,
      },
      {
        shotTitle: 'انتخاب کارت: نوسازی', turnSub: 'گرفتن کارتی تا قیمت ۴',
        meta: ['زنده', '۳ نفر', 'نوبت ۷'],
        me: { cards: hand(['copper', 'copper', 'silver']), above: above({ cnt: [0, 1, 0], acts: (ph) => btn(ph ? 'گرفتن' : 'گرفتن آهنگری', 'primary', 'check') }) },
        table: table({ s: { ok: [...BASE, ...KING].filter((k) => C[k][1] <= 4 && N[k]), sel: 'smithy' }, play: ['remodel'] }),
        status: `<b>نوسازی:</b> ملک را نابود کردید (قیمت ${fa(2)})، پس کارتی تا قیمت ${fa(4)} می‌گیرید. کپه‌های روشن مجازند؛ آهنگری انتخاب شده است.`,
        pstatus: `<b>نوسازی.</b> کارتی تا قیمت ${fa(4)} بگیرید.`,
        log: [[1, 'شما نوسازی بازی کردید'], [1, 'ملک نابود شد']], logNote: `نوبت ${fa(7)}`,
        phone: true,
      },
      {
        shotTitle: 'مرحلهٔ خرید', turnSub: 'گنج‌ها بازی شد: ۸ سکه',
        me: { cards: hand(['estate', 'estate'], { dim: ['estate'] }), above: above({ cnt: [1, 1, 8], deck: 3, acts: (ph) => btn(ph ? 'خرید ایالت' : 'خرید ایالت (۸)', 'primary', 'check') + btn('پایان نوبت', 'secondary', 'x') }) },
        table: table({ s: { ok: [...BASE, ...KING].filter((k) => C[k][1] <= 8 && N[k]), sel: 'province' }, play: PLAY_BUY }),
        status: `<b>مرحلهٔ خرید: ${fa(8)} سکه، ${fa(1)} خرید.</b> روستا طلا آورد و آهنگری یک مس و دو ملک. سه مس، نقره و طلا روی هم ${fa(8)} سکه شد؛ همهٔ کپه‌ها حتی ایالت در دسترس‌اند.`,
        pstatus: `<b>${fa(8)} سکه.</b> ایالت را بخرید.`,
        log: [[1, 'شما روستا بازی کردید و طلا کشیدید'], [1, 'آهنگری: مس، ملک، ملک'], [1, 'گنج‌ها: ۸ سکه']],
        phone: true,
      },
      {
        shotTitle: 'پاک‌سازی', turnSub: 'دسته دوباره بُر خورد',
        opps: opps(2),
        me: { turn: false, cards: hand(['militia', 'market', 'copper', 'copper', 'estate']), above: above({ cnt: [0, 0, 0], deck: 14, disc: 0, top: null }) },
        table: table({ s: { n: { ...N, province: 7 }, off: true }, turn: 2, banner: 'دسته دوباره بُر خورد' }),
        status: `<b>پاک‌سازی.</b> کارت‌های در بازی، دو ملک و ایالت تازه به دورریخته رفتند. از دسته فقط ${fa(3)} کارت مانده بود؛ آن‌ها را کشیدید، دورریخته بُر خورد و ${fa(2)} کارت دیگر آمد. نوبت نیلوفر است.`,
        pstatus: `<b>دسته دوباره بُر خورد.</b> ${fa(5)} کارت تازه.`,
        log: [[1, 'شما ایالت خریدید'], [1, 'دسته دوباره بُر خورد'], [2, 'نوبت نیلوفر']],
      },
      {
        shotTitle: 'حمله: سپاه محلی', turnSub: 'دور ریختن تا ۳ کارت',
        opps: opps(2),
        me: { turn: false, cards: hand(['militia', 'market', 'copper', 'copper', 'estate'], { sel: [3, 4] }), above: above({ cnt: [0, 0, 0], deck: 14, disc: 0, top: null }) },
        table: table({ s: { n: { ...N, province: 7 }, off: true }, turn: 2, play: ['militia'], playWho: 'در بازی نیلوفر' }), overlay: militiaM,
        status: `<b>نیلوفر سپاه محلی بازی کرد.</b> هر کس بیشتر از ${fa(3)} کارت دارد باید دور بریزد؛ شما و رضا هم‌زمان انتخاب می‌کنید.`,
        log: [[2, 'نیلوفر سپاه محلی بازی کرد'], [1, 'شما باید ۲ کارت دور بریزید']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'منتظر رضا',
        opps: opps(6, { ...NIL, deck: 3, disc: 15, top: 'silver' }),
        me: { turn: false, cards: hand(['militia', 'market', 'copper']), above: above({ cnt: [0, 0, 0], deck: 14, disc: 2, top: 'estate' }) },
        table: table({ s: { n: { ...N, province: 7, silver: 33, duchy: 10 }, off: true }, turn: 6, play: ['market', 'smithy', 'gold', 'silver', 'copper'], playWho: 'در بازی رضا', nil: { ...NIL, deck: 3, disc: 15, top: 'silver' }, rez: { ...REZ, hand: 2, deck: 9, disc: 2, top: 'estate' } }),
        status: `<b>نوبت رضاست.</b> بازار و آهنگری بازی کرد و با طلا، نقره و مس ${fa(7)} سکه دارد (با سکهٔ بازار). دو خرید دارد؛ تیول را گرفت و دارد خرید دوم را انتخاب می‌کند.`,
        pstatus: `<b>نوبت رضا.</b> ${fa(7)} سکه و دو خرید.`,
        log: [[2, 'نیلوفر نقره خرید'], [6, 'رضا بازار و آهنگری بازی کرد'], [6, 'رضا تیول خرید']],
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'کپهٔ ایالت تمام شد',
        meta: ['تمام‌شده', '۳ نفر'],
        opps: [{ name: 'نیلوفر', av: 'ن', seat: 2, meta: `<span class="gc-tag gc-tag--soft">${fa(35)} امتیاز</span>` }, { name: 'رضا', av: 'ر', seat: 6, meta: `<span class="gc-tag gc-tag--soft">${fa(24)} امتیاز</span>` }],
        me: { turn: false, clock: '', note: note(39), cards: [], above: above({ cnt: [0, 0, 0], deck: 0, disc: 31, top: 'province' }) },
        table: table({ s: { n: { ...N, province: 0, duchy: 6, estate: 4, gold: 18, silver: 20 }, off: true } }), overlay: endM,
        status: `<b>بازی تمام شد.</b> شما با ${fa(39)} امتیاز بردید.`,
        log: [[2, 'نیلوفر تیول خرید'], [1, 'شما آخرین ایالت را خریدید'], [1, 'شما بردید']], logNote: `نوبت ${fa(19)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.dm-mid{display:flex;gap:14px;align-items:center;justify-content:center}
.dm-sup{display:flex;gap:12px;align-items:flex-start;direction:ltr}
.dm-sup.is-off .dm-p img{filter:saturate(.75) brightness(.85)}
.dm-base{display:grid;grid-template-columns:repeat(2,auto);gap:6px}
.dm-king{display:grid;grid-template-columns:repeat(5,auto);gap:8px 6px}
.dm-p{position:relative;display:block;inline-size:70px}
.dm-base .dm-p{inline-size:58px}
.bgv-chip img{inline-size:16px;margin-inline-end:4px;border-radius:2px}
.dm-p img{display:block;inline-size:100%;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.25),0 6px 10px -6px rgba(0,0,0,.6)}
.dm-p b{position:absolute;inset-block-start:-6px;inset-inline-end:-6px;min-inline-size:20px;block-size:20px;border-radius:999px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:11.5px;box-shadow:0 0 0 1.5px rgba(250,245,236,.5)}
.dm-p.is-ok img{box-shadow:0 0 0 3px #5FBF7A}
.dm-p.is-no img{filter:grayscale(.85) brightness(.75)}
.dm-p.is-sel{transform:translateY(-5px)}.dm-p.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.dm-p.is-out img{opacity:.3}
.dm-opps{display:grid;gap:10px}
.dm-opp{margin:0;display:grid;gap:6px;inline-size:178px;padding:8px 10px;border-radius:12px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink);box-sizing:border-box}
.dm-opp.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.dm-opp figcaption{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700}
.dm-opp figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.dm-om{display:grid;gap:4px;font-size:12.5px;color:var(--felt-muted)}
.dm-om span{display:flex;align-items:center;gap:6px}.dm-om img{inline-size:22px;border-radius:3px}
.dm-play{display:flex;align-items:center;gap:10px;min-block-size:66px;padding:6px 12px;border-radius:12px;background:rgba(250,245,236,.05);box-shadow:inset 0 0 0 1px rgba(250,245,236,.1);color:var(--felt-muted);font-size:12.5px}
.dm-play>div{display:flex;direction:ltr}.dm-play img{inline-size:46px;border-radius:4px;margin-inline-start:-10px;box-shadow:0 2px 4px rgba(0,0,0,.4)}.dm-play img:first-child{margin-inline-start:0}
.dm-none{font-size:12px}
.dm-banner{display:flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--felt-gold);color:#142B3B;font-size:13.5px;font-weight:700}
.dm-me{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;inline-size:100%}
.dm-cnt{display:flex;gap:6px}
.dm-cnt span{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(250,245,236,.12);color:var(--felt-ink);font-size:13px}
.dm-cnt b{color:var(--felt-gold)}.dm-cnt img{inline-size:18px}
.dm-acts{display:flex;gap:8px}
.dm-mine{display:flex;gap:10px;color:var(--felt-ink);font-size:13px}
.dm-mine span{display:inline-flex;align-items:center;gap:4px}.dm-mine img{inline-size:32px;border-radius:3px}.dm-mine i{inline-size:30px;block-size:38px;border-radius:4px;box-shadow:inset 0 0 0 1.5px rgba(250,245,236,.25)}
.dm-pick{display:flex;gap:8px;justify-content:center;direction:ltr}
.dm-pick span{display:block}.dm-pick img{inline-size:76px;border-radius:6px;display:block}
.dm-pick span.is-sel img{box-shadow:0 0 0 3px #E0505C;transform:translateY(-6px)}
.dm-line{display:flex;gap:8px;align-items:center}
.cx-phone .gc-table{gap:6px}
.dm-sup--ph{gap:6px;padding-inline:6px}.dm-sup--ph .dm-p{inline-size:46px}.dm-sup--ph .dm-base .dm-p{inline-size:38px}.dm-sup--ph .dm-king{gap:6px 4px}.dm-sup--ph .dm-base{gap:4px}
.dm-sup--ph .dm-p b{min-inline-size:16px;block-size:16px;font-size:10px}
.cx-phone .dm-play{min-block-size:46px;padding:4px 10px;margin-inline:10px}.cx-phone .dm-play img{inline-size:32px}
.cx-phone .dm-banner{font-size:12px;margin-inline:10px}
.dm-me--ph{gap:6px;padding-inline:8px}.dm-me--ph .dm-cnt span{padding:3px 7px;font-size:12px}.dm-me--ph .dm-mine{display:none}
.cx-phone .dm-pick img{inline-size:52px}`,
    shotTitle: 'نوبت شما', turnSub: 'مرحلهٔ کنش',
    diffs: [
      ['چیدمان', 'مثل BGA: ذخیره وسط میز (گنج و امتیاز در دو ستون، ده کپهٔ قلمرو در دو ردیف) با عدد مانده روی هر کپه، ردیف «در بازی» زیرش، و تعداد دسته، دست و دورریختهٔ هر حریف کنار ذخیره'],
      ['آرت', 'کارت‌ها همان طرح‌های آماده و فعلی سایت‌اند که متن و قیمت فارسی رویشان است. موتور قلمرو ثابت «بازی اول» را دارد'],
      ['مرحله‌ها', 'شمارنده‌های کنش، خرید و سکه همیشه کنار دست شماست؛ در مرحلهٔ کنش کارت‌های قابل بازی بالا می‌آیند و گنج‌ها کم‌رنگ‌اند (§۱)، در مرحلهٔ خرید کپه‌های خریدنی سبزند (§۶)'],
      ['انتخاب‌ها', 'کارت‌هایی مثل نوسازی و کارگاه کپه‌های مجاز را روشن می‌کنند (§۵)؛ سپاه محلی برای هر حریف پنجرهٔ دور ریختن تا ۳ کارت را باز می‌کند و خندق اگر در دست باشد جلویش را می‌گیرد (§۸)'],
      ['پایان', 'پاک‌سازی با پیام «دسته دوباره بُر خورد» (§۷)؛ جدول پایانی ملک، تیول، ایالت، جمع و تعداد نوبت برای تساوی (§۱۰)'],
      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر؛ با ۲ نفر ۸ کارت از هر امتیاز، با ۳ و ۴ نفر ۱۲ تا. پایان با خالی شدن ایالت یا سه کپه'],
    ],
  };
}
