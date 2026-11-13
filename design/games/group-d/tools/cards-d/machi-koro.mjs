// Machi Koro («ماچی کورو») on the group D frame. Repo engine: 2–4 players, base game (6 of each establishment, purple = one per player).
// Art = the site's ready-to-use card renders (Persian labels), market cards at native size. Layout like BGA: 15 supply stacks in dice order,
// your city grouped by card with ×n, four landmarks, opponents' cities summarised beside the market.
// Mock: 3 players, order نیلوفر → رضا → شما. Every income line follows the base rules (red first, then blue/green, then purple).
export default function (H) {
  const { fa, ic, btn, modal } = H;
  const A = (n) => H.ART['machi-koro-' + n];
  const D = { wheat: ['گندمزار', 'blue', '۱', 1], ranch: ['دامداری', 'blue', '۲', 1], bakery: ['نانوایی', 'green', '۲ تا ۳', 1], cafe: ['قهوه‌خانه', 'red', '۳', 2], store: ['بقالی', 'green', '۴', 2], forest: ['جنگل', 'blue', '۵', 3], stadium: ['ورزشگاه', 'purple', '۶', 6], tv: ['ایستگاه تلویزیون', 'purple', '۶', 7], business: ['مرکز تجاری', 'purple', '۶', 8], cheese: ['کارخانهٔ پنیر', 'green', '۷', 5], furniture: ['کارخانهٔ مبل', 'green', '۸', 3], mine: ['معدن', 'blue', '۹', 6], restaurant: ['رستوران', 'red', '۹ تا ۱۰', 3], orchard: ['باغ میوه', 'blue', '۱۰', 3], market: ['بازار میوه', 'green', '۱۱ تا ۱۲', 2] };
  const KEYS = Object.keys(D);
  const LM = [['station', 'ایستگاه قطار', 4], ['mall', 'مرکز خرید', 10], ['park', 'شهربازی', 16], ['radio', 'برج رادیو', 22]];
  const alt = (k) => `${D[k][0]}، تاس ${D[k][2]}، قیمت ${fa(D[k][3])}`;
  const coin = (n, cls = '') => `<span class="mk-coin${cls ? ' ' + cls : ''}"><img src="${A('coin')}" alt="">${fa(n)}</span>`;
  const die = (v) => `<img class="mk-die" src="${A('die-' + v)}" alt="تاس ${fa(v)}">`;
  // market: { sup:{}, ok:[keys], sel, hot:[keys], off }
  const market = (m, ph) => `<div class="mk-mkt${ph ? ' mk-mkt--ph' : ''}${m.off ? ' is-off' : ''}" aria-label="بازار">${KEYS.map((k) => `<span class="mk-c${m.ok?.includes(k) ? ' is-ok' : ''}${m.sel === k ? ' is-sel' : ''}${m.sup[k] ? '' : ' is-out'}${m.ok && !m.ok.includes(k) ? ' is-no' : ''}"><img src="${A(k)}" alt="${alt(k)}"><b>${fa(m.sup[k])}</b></span>`).join('')}</div>`;
  // city: { cards:{key:n}, lm:{station:true..}, hot:{key:'+۲'}, lmok:[keys], lmsel }
  const city = (c, ph) => `<div class="mk-city${ph ? ' mk-city--ph' : ''}"><div class="mk-lms">${LM.map(([k, nm, cost]) => `<span class="mk-lm${c.lm[k] ? ' is-built' : ''}${c.lmok?.includes(k) ? ' is-ok' : ''}${c.lmsel === k ? ' is-sel' : ''}"><img src="${A(k + (c.lm[k] ? '-built' : '-unbuilt'))}" alt="${nm}${c.lm[k] ? '، ساخته شده' : `، ${fa(cost)} سکه`}">${c.lm[k] ? '' : `<small>${fa(cost)}</small>`}</span>`).join('')}</div><div class="mk-cards">${KEYS.filter((k) => c.cards[k]).map((k) => `<span class="mk-cc${c.hot?.[k] ? ' is-hot' : ''}${c.csel === k ? ' is-sel' : ''}"><img src="${A(k)}" alt="${alt(k)}">${c.cards[k] > 1 ? `<b>×${fa(c.cards[k])}</b>` : ''}${c.hot?.[k] ? `<em>${c.hot[k]}</em>` : ''}</span>`).join('')}</div></div>`;
  const panel = (p) => `<figure class="mk-opp${p.turn ? ' is-turn' : ''}"><figcaption><i style="background:var(--seat-${p.seat})"></i>${p.name}${coin(p.coins, p.delta ? 'has-d' : '')}${p.delta ? `<em class="mk-d">${p.delta}</em>` : ''}</figcaption><div class="mk-olm">${LM.map(([k, nm]) => `<img src="${A(k + (p.lm[k] ? '-built' : '-unbuilt'))}" alt="${nm}${p.lm[k] ? '، ساخته شده' : ''}">`).join('')}</div><div class="mk-oc">${KEYS.filter((k) => p.cards[k]).map((k) => `<span class="${p.hot?.includes(k) ? 'is-hot' : ''}"><img src="${A(k)}" alt="${alt(k)}">${p.cards[k] > 1 ? `<b>×${fa(p.cards[k])}</b>` : ''}</span>`).join('')}</div></figure>`;

  // ---------- state ----------
  const SUP = { wheat: 5, ranch: 3, bakery: 5, cafe: 3, store: 5, forest: 5, stadium: 3, tv: 2, business: 3, cheese: 5, furniture: 6, mine: 6, restaurant: 6, orchard: 6, market: 6 };
  const ME = { cards: { wheat: 1, ranch: 1, bakery: 2, cafe: 1, forest: 1, tv: 1 }, lm: { station: true } };
  const NIL = { name: 'نیلوفر', seat: 2, coins: 4, cards: { wheat: 2, bakery: 1, cafe: 2, store: 1 }, lm: { station: true } };
  const REZ = { name: 'رضا', seat: 6, coins: 9, cards: { wheat: 1, bakery: 1, ranch: 2, cheese: 1 }, lm: {} };
  const sumCards = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  const lmN = (lm) => Object.values(lm).filter(Boolean).length;
  const seatMeta = (p) => `${coin(p.coins)}<span>بنا ${fa(lmN(p.lm))} از ${fa(4)}</span><span>کارت ${fa(sumCards(p.cards))}</span>`;
  const opps = (turn, n = NIL, r = REZ) => [
    { name: 'نیلوفر', av: 'ن', seat: 2, clock: '1:10', turn: turn === 2, meta: seatMeta(n) },
    { name: 'رضا', av: 'ر', seat: 6, clock: '0:58', turn: turn === 6, meta: seatMeta(r) },
  ];
  const diceBox = (vals, label) => `<div class="mk-dice">${vals.map(die).join('')}${label ? `<span>${label}</span>` : ''}</div>`;
  const table = (o = {}) => (ph) => `${o.dice ? diceBox(o.dice, o.diceLabel) : ''}<div class="mk-mid">${market({ sup: SUP, ...(o.m ?? {}) }, ph)}${ph ? '' : `<div class="mk-opps">${panel({ ...(o.nil ?? NIL), turn: o.turn === 2 })}${panel({ ...(o.rez ?? REZ), turn: o.turn === 6 })}</div>`}</div>`;
  const above = (c, coins, acts, delta) => (ph) => `<div class="mk-me${ph ? ' mk-me--ph' : ''}">${acts ? `<div class="mk-acts">${coin(coins, 'is-big')}${delta ? `<em class="mk-d">${delta}</em>` : ''}${acts(ph)}</div>` : `<div class="mk-acts">${coin(coins, 'is-big')}${delta ? `<em class="mk-d">${delta}</em>` : ''}</div>`}${city(c, ph)}</div>`;
  const note = (c) => `<span class="cx-note">بنا ${fa(lmN(c.lm))} از ${fa(4)}</span>`;
  const rail = `<section class="cx-card"><h3>دور ${fa(5)}</h3><div class="gc-pills"><span class="bgv-chip">نفر اول: نیلوفر</span><span class="bgv-chip">هدف: ${fa(4)} بنا</span></div><div class="ga-rule">${ic('info')}<span>تاس بیندازید؛ کارت‌هایی که عددشان آمد کار می‌کنند: قرمز از کسی که تاس انداخته سکه می‌گیرد، آبی در نوبت همه، سبز و بنفش فقط در نوبت خودتان. بعد یک کارت یا یک بنا بسازید. هر کس اول هر چهار بنا را بسازد می‌برد.</span></div></section>`;
  const tbl = (head, rws) => `<table class="gd-score"><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${rws.map((r) => `<tr${r.win ? ' class="is-win"' : ''}>${r.c.map((x, i) => `<td${i ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const LOG = [[2, 'نیلوفر ۴ انداخت؛ بقالی ۳ سکه داد'], [6, 'رضا ۲ انداخت؛ دامداری‌ها ۳ سکه دادند'], [1, 'نوبت شما']];
  // §5 income: you roll 3 with one die. Red first: نیلوفر's 2 cafés take 2 from you (6 → 4); then your 2 bakeries +2 → 6.
  const tvM = () => modal('ایستگاه تلویزیون: از چه کسی ۵ سکه بگیرید؟', `<div class="mk-pick">${[['نیلوفر', 'ن', 2, 4, '۴ سکه دارد؛ همه را می‌دهد'], ['رضا', 'ر', 6, 9, '۵ سکه می‌دهد']].map(([nm, av, seat, c, t], i) => `<button type="button" class="mk-who${i ? ' is-sel' : ''}"><span class="bgv-avatar seat-${seat}">${av}</span><b>${nm}</b>${coin(c)}<small>${t}</small></button>`).join('')}</div>`, `${btn('لغو', 'secondary', 'x')}${btn('گرفتن از رضا', 'primary', 'check')}`);
  const buyM = () => modal('ساخت کارخانهٔ پنیر؟', `<div class="mk-mrow"><img src="${A('cheese')}" alt="${alt('cheese')}"><div><p>قیمت ${fa(5)} سکه. با تاس ${fa(7)} در نوبت خودتان، به ازای هر کارت گاو (دامداری) ${fa(3)} سکه می‌دهد؛ شما یک دامداری دارید.</p><p class="mk-line">${coin(6)}<span>${ic('next')}</span>${coin(1)}</p></div></div>`, `${btn('لغو', 'secondary', 'x')}${btn('ساختن', 'primary', 'check')}`);
  // late game: station, park, radio built; mall (10) left. Coins 8.
  const LATE = { cards: { wheat: 1, ranch: 1, bakery: 2, cafe: 1, forest: 1, tv: 1, cheese: 1, furniture: 1 }, lm: { station: true, park: true, radio: true } };
  const NIL_L = { ...NIL, coins: 12, cards: { wheat: 2, bakery: 2, cafe: 2, store: 2, mine: 1 }, lm: { station: true, mall: true, park: true } };
  const REZ_L = { ...REZ, coins: 6, cards: { wheat: 1, bakery: 1, ranch: 3, cheese: 2, forest: 1 }, lm: { station: true, mall: true } };
  const endM = () => modal('پایان بازی', `<p>جفت چهار آمد: کارخانهٔ مبل به ازای جنگل ${fa(3)} سکه داد و با ${fa(11)} سکه مرکز خرید را ساختید. هر چهار بنا ساخته شد و بردید.</p>${tbl(['بازیکن', 'بنا', 'سکه', 'کارت'], [{ c: [`${ic('trophy')} شما`, `${fa(4)} از ${fa(4)}`, fa(1), fa(sumCards(LATE.cards))], win: true }, { c: ['نیلوفر', `${fa(3)} از ${fa(4)}`, fa(12), fa(sumCards(NIL_L.cards))] }, { c: ['رضا', `${fa(2)} از ${fa(4)}`, fa(6), fa(sumCards(REZ_L.cards))] }])}`, `${btn('بازگشت به لابی', 'secondary', 'back')}${btn('بازی دوباره', 'primary', 'repeat')}`);

  return {
    slug: 'MachiKoro', fa: 'ماچی کورو', latin: 'Machi Koro', meta: ['زنده', '۳ نفر', 'دور ۵'],
    opps: opps(1),
    me: { cards: [], clock: '0:50', turn: true, note: note(ME), above: above(ME, 6, (ph) => `${btn(ph ? 'یک تاس' : 'یک تاس بینداز', 'primary', 'zap')}${btn(ph ? 'دو تاس' : 'دو تاس بینداز', 'secondary', 'zap')}`) },
    table: table(),
    status: `<b>نوبت شماست: تاس بیندازید.</b> ایستگاه قطار را ساخته‌اید، پس می‌توانید یک یا دو تاس بیندازید. با دو تاس عددهای ${fa(7)} تا ${fa(12)} هم ممکن است، ولی گندمزار و نانوایی‌تان با عددهای کوچک کار می‌کنند.`,
    pstatus: `<b>نوبت شما.</b> یک یا دو تاس بیندازید.`,
    railCard: rail, logNote: `دور ${fa(5)}`, log: LOG,
    dockItems: [['list', 'رویدادها'], ['users', 'شهرها'], ['chat', 'گفت‌وگو'], ['more', 'گزینه‌ها']],
    phases: [
      {
        shotTitle: 'شروع بازی', turnSub: 'گندمزار، نانوایی و ۳ سکه',
        meta: ['زنده', '۳ نفر', 'دور ۱'],
        opps: opps(2, { ...NIL, coins: 3, cards: { wheat: 1, bakery: 1 }, lm: {} }, { ...REZ, coins: 3, cards: { wheat: 1, bakery: 1 }, lm: {} }),
        me: { turn: false, clock: '1:00', note: note({ lm: {} }), above: above({ cards: { wheat: 1, bakery: 1 }, lm: {} }, 3, null) },
        table: table({ m: { sup: { ...KEYS.reduce((o, k) => ({ ...o, [k]: 6 }), {}), stadium: 3, tv: 3, business: 3 }, off: true }, turn: 2, nil: { ...NIL, coins: 3, cards: { wheat: 1, bakery: 1 }, lm: {} }, rez: { ...REZ, coins: 3, cards: { wheat: 1, bakery: 1 }, lm: {} } }),
        status: `<b>بازی شروع شد.</b> همه یک گندمزار، یک نانوایی و ${fa(3)} سکه دارند و هر چهار بنا خاکستری‌اند. از هر کارت ${fa(6)} تا در بازار است و از کارت‌های بنفش به تعداد بازیکنان. نیلوفر شروع می‌کند.`,
        log: [[1, 'بازی با ۳ نفر شروع شد'], [2, 'نوبت نیلوفر']], logNote: `دور ${fa(1)}`,
      },
      {
        shotTitle: 'درآمد', turnSub: 'تاس ۳: اول قرمز، بعد سبز',
        me: { above: above({ ...ME, hot: { bakery: `${fa(2)}+` } }, 6, null, `${fa(2)}− ${fa(2)}+`) },
        table: table({ dice: [3], diceLabel: `${fa(3)} آمد`, nil: { ...NIL, coins: 6, delta: `${fa(2)}+`, hot: ['cafe'] } }),
        status: `<b>${fa(3)} آمد.</b> اول کارت‌های قرمز: دو قهوه‌خانهٔ نیلوفر از شما ${fa(2)} سکه گرفتند. بعد کارت‌های سبز شما: دو نانوایی، هرکدام ${fa(1)} سکه. سکه‌هایتان دوباره ${fa(6)} شد.`,
        pstatus: `<b>${fa(3)} آمد.</b> ${fa(2)} سکه به نیلوفر، ${fa(2)} سکه از نانوایی‌ها.`,
        log: [[6, 'رضا ۲ انداخت؛ دامداری‌ها ۳ سکه دادند'], [1, 'شما ۳ انداختید'], [2, 'قهوه‌خانه‌های نیلوفر ۲ سکه گرفتند'], [1, 'نانوایی‌ها ۲ سکه دادند']],
        phone: true,
      },
      {
        shotTitle: 'ایستگاه تلویزیون', turnSub: 'تاس ۶: انتخاب حریف',
        me: { above: above({ ...ME, hot: { tv: `${fa(5)}+` } }, 6, null) },
        table: table({ dice: [4, 2], diceLabel: `${fa(6)} آمد` }), overlay: tvM,
        status: `<b>${fa(6)} آمد (${fa(4)} و ${fa(2)}).</b> ایستگاه تلویزیون شما کار می‌کند: از یک حریف ${fa(5)} سکه بگیرید. نیلوفر فقط ${fa(4)} سکه دارد؛ رضا ${fa(9)} تا.`,
        log: [[1, 'شما ۶ انداختید'], [1, 'ایستگاه تلویزیون: یک حریف را انتخاب کنید']],
      },
      {
        shotTitle: 'ساخت', turnSub: 'یک کارت یا یک بنا',
        me: { above: above({ ...ME, lmok: [] }, 6, (ph) => btn(ph ? 'نمی‌سازم' : 'چیزی نمی‌سازم', 'secondary', 'x')) },
        table: table({ m: { ok: KEYS.filter((k) => D[k][3] <= 6 && SUP[k] && !(D[k][1] === 'purple' && ME.cards[k])), sel: 'cheese' } }), overlay: buyM,
        status: `<b>یک کارت یا یک بنا بسازید.</b> با ${fa(6)} سکه کارت‌های روشن بازار را می‌توانید بخرید؛ ارزان‌ترین بنای باقی‌مانده (مرکز خرید) ${fa(10)} سکه است. کارخانهٔ پنیر را زدید.`,
        log: [[1, 'نانوایی‌ها ۲ سکه دادند'], [1, 'ساخت: کارخانهٔ پنیر؟']],
        phone: true,
      },
      {
        shotTitle: 'نوبت حریف', turnSub: 'تاس نیلوفر و کارت‌های آبی شما',
        opps: opps(2, { ...NIL, coins: 7 }, { ...REZ, coins: 11 }),
        me: { turn: false, above: above({ cards: { ...ME.cards, cheese: 1 }, lm: ME.lm, hot: { ranch: `${fa(1)}+` } }, 2, null, `${fa(1)}+`) },
        table: table({ dice: [2], diceLabel: `نیلوفر: ${fa(2)}`, turn: 2, m: { off: true, sup: { ...SUP, cheese: 4 } }, nil: { ...NIL, coins: 7, delta: `${fa(1)}+`, hot: ['bakery'] }, rez: { ...REZ, coins: 11, delta: `${fa(2)}+`, hot: ['ranch'] } }),
        status: `<b>نوبت نیلوفر است.</b> ${fa(2)} انداخت. دامداری‌ها آبی‌اند و در نوبت همه کار می‌کنند: شما ${fa(1)} سکه و رضا ${fa(2)} سکه گرفتید. نانوایی نیلوفر سبز است و فقط برای خودش ${fa(1)} سکه داد.`,
        pstatus: `<b>نیلوفر ${fa(2)} انداخت.</b> دامداری شما ${fa(1)}+.`,
        log: [[1, 'شما کارخانهٔ پنیر ساختید'], [2, 'نیلوفر ۲ انداخت'], [1, 'دامداری شما ۱ سکه داد']],
        phone: true,
      },
      {
        shotTitle: 'برج رادیو', turnSub: 'نگه داشتن یا دوباره انداختن',
        meta: ['زنده', '۳ نفر', 'دور ۱۴'],
        opps: opps(0, NIL_L, REZ_L),
        me: { clock: '0:35', note: note(LATE), above: above({ ...LATE, hot: { forest: `${fa(1)}+` } }, 8, (ph) => `${btn('نگه داشتن', 'secondary', 'check')}${btn(ph ? 'دوباره' : 'دوباره انداختن', 'primary', 'repeat')}`) },
        table: table({ dice: [2, 3], diceLabel: `${fa(5)} آمد. دوباره می‌اندازید؟`, nil: NIL_L, rez: REZ_L }),
        status: `<b>${fa(5)} آمد. دوباره می‌اندازید؟</b> برج رادیو یک بار در هر نوبت اجازهٔ تاس دوباره می‌دهد. با ${fa(5)} فقط جنگلتان ${fa(1)} سکه می‌دهد؛ برای مرکز خرید ${fa(10)} سکه لازم دارید و ${fa(8)} تا دارید.`,
        pstatus: `<b>${fa(5)} آمد.</b> نگه می‌دارید یا دوباره؟`,
        log: [[6, 'رضا مرکز خرید را ساخت'], [1, 'شما ۵ انداختید']], logNote: `دور ${fa(14)}`,
        phone: true,
      },
      {
        shotTitle: 'پایان بازی', turnSub: 'هر چهار بنا ساخته شد',
        meta: ['تمام‌شده', '۳ نفر'],
        opps: opps(0, NIL_L, REZ_L),
        me: { turn: false, clock: '', note: note({ lm: { a: 1, b: 1, c: 1, d: 1 } }), above: above({ ...LATE, lm: { station: true, mall: true, park: true, radio: true }, hot: { furniture: `${fa(3)}+` } }, 1, null) },
        table: table({ dice: [4, 4], diceLabel: 'جفت ۴', nil: NIL_L, rez: REZ_L }), overlay: endM,
        status: `<b>بازی تمام شد.</b> شما هر چهار بنا را ساختید و بردید.`,
        log: [[1, 'شما دوباره انداختید: جفت ۴'], [1, 'کارخانهٔ مبل ۳ سکه داد'], [1, 'شما مرکز خرید را ساختید و بردید']], logNote: `دور ${fa(14)}`,
      },
    ],
    css: `.gc-table{flex-direction:column;gap:10px}
.mk-mid{display:flex;gap:14px;align-items:center;justify-content:center}
.mk-mkt{display:grid;grid-template-columns:repeat(5,auto);gap:8px 6px;direction:ltr}
.mk-mkt.is-off .mk-c img{filter:saturate(.7) brightness(.85)}
.mk-c{position:relative;display:block;inline-size:84px}
.mk-c img{display:block;inline-size:100%;block-size:auto;border-radius:8px;box-shadow:0 2px 0 rgba(0,0,0,.25),0 6px 10px -6px rgba(0,0,0,.6)}
.mk-c b{position:absolute;inset-block-start:-6px;inset-inline-end:-6px;min-inline-size:20px;block-size:20px;border-radius:999px;display:grid;place-items:center;background:#142B3B;color:#FAF5EC;font-size:12px;box-shadow:0 0 0 1.5px rgba(250,245,236,.5)}
.mk-c.is-ok img{box-shadow:0 0 0 3px #5FBF7A,0 6px 10px -6px rgba(0,0,0,.6)}
.mk-c.is-no img{filter:grayscale(.85) brightness(.75)}
.mk-c.is-sel{transform:translateY(-5px)}
.mk-c.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold)}
.mk-c.is-out img{opacity:.35}
.mk-opps{display:grid;gap:10px}
.mk-opp{margin:0;display:grid;gap:6px;inline-size:190px;padding:8px 10px;border-radius:12px;background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12);color:var(--felt-ink);box-sizing:border-box}
.mk-opp.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold)}
.mk-opp figcaption{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700}
.mk-opp figcaption i{inline-size:10px;block-size:10px;border-radius:50%}
.mk-opp figcaption .mk-coin{margin-inline-start:auto}
.mk-olm{display:flex;gap:3px}.mk-olm img{block-size:24px;inline-size:auto}
.mk-oc{display:flex;flex-wrap:wrap;gap:4px}
.mk-oc span{position:relative}.mk-oc img{inline-size:34px;border-radius:4px;display:block}
.mk-oc span.is-hot img{box-shadow:0 0 0 2px var(--felt-gold)}
.mk-oc b{position:absolute;inset-block-end:-4px;inset-inline-end:-4px;font-size:10.5px;background:#142B3B;color:#FAF5EC;border-radius:999px;padding:0 4px}
.mk-coin{display:inline-flex;align-items:center;gap:3px;font-size:13px;font-weight:700;color:var(--felt-ink)}
.mk-coin img{inline-size:20px;block-size:20px}
.gc-seat .mk-coin{font-size:12.5px;color:var(--felt-muted)}
.mk-coin.is-big{font-size:16px}.mk-coin.is-big img{inline-size:28px;block-size:28px}
.mk-d{font-style:normal;font-size:12.5px;font-weight:800;color:#142B3B;background:var(--felt-gold);border-radius:999px;padding:1px 7px;white-space:nowrap}
.mk-dice{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;background:rgba(250,245,236,.08);color:var(--felt-ink);font-size:14px;font-weight:700}
.mk-die{inline-size:42px;block-size:42px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))}
.mk-me{display:grid;justify-items:center;gap:8px;inline-size:100%}
.mk-acts{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center}
.mk-city{display:flex;align-items:flex-end;gap:16px;direction:ltr}
.mk-lms{display:grid;grid-template-columns:repeat(2,auto);gap:6px}
.mk-lm{position:relative;display:block}
.mk-lm img{display:block;block-size:48px;inline-size:auto}
.mk-lm small{position:absolute;inset-block-end:2px;inset-inline-end:2px;font-size:11px;font-weight:700;background:#142B3B;color:#FAF5EC;border-radius:999px;padding:0 5px}
.mk-lm.is-built img{filter:drop-shadow(0 0 3px rgba(232,166,66,.6))}
.mk-cards{display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;max-inline-size:530px}
.mk-cc{position:relative;display:block;inline-size:58px}
.mk-cc img{display:block;inline-size:100%;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.25)}
.mk-cc b{position:absolute;inset-block-start:-6px;inset-inline-end:-6px;font-size:12px;background:var(--felt-gold);color:#142B3B;border-radius:999px;padding:1px 6px}
.mk-cc.is-hot img{box-shadow:0 0 0 3px var(--felt-gold),0 0 12px rgba(232,166,66,.7)}
.mk-cc em{position:absolute;inset-block-end:-8px;inset-inline:0;margin-inline:auto;inline-size:max-content;font-style:normal;font-size:12px;font-weight:800;background:#5FBF7A;color:#0E2A1A;border-radius:999px;padding:1px 6px}
.mk-pick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mk-who{display:grid;justify-items:center;gap:6px;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font:inherit}
.mk-who.is-sel{border:2px solid var(--felt-gold);box-shadow:0 0 0 3px rgba(232,166,66,.25)}
.mk-who .mk-coin{color:var(--heading)}.mk-who small{font-size:12.5px;color:var(--text-muted)}
.mk-mrow{display:flex;gap:14px;align-items:flex-start}.mk-mrow>div{display:grid;gap:10px}
.mk-line{display:flex;align-items:center;gap:10px}.mk-line .mk-coin{color:var(--heading)}
.cx-phone .gc-table{gap:6px}
.mk-mkt--ph{gap:5px 4px;padding-inline:8px}.mk-mkt--ph .mk-c{inline-size:62px}.mk-mkt--ph .mk-c b{min-inline-size:17px;block-size:17px;font-size:10.5px}
.cx-phone .mk-dice{padding:3px 10px;font-size:12.5px}.cx-phone .mk-die{inline-size:30px;block-size:30px}
.mk-me--ph{gap:5px}.mk-me--ph .mk-acts{gap:6px}
.mk-city--ph{gap:6px;padding-inline:6px}.mk-city--ph .mk-lm img{block-size:30px}.mk-city--ph .mk-lms{gap:3px}
.mk-city--ph .mk-cards{gap:6px 4px;flex-wrap:wrap;max-inline-size:250px;justify-content:center}.mk-city--ph .mk-cc{inline-size:42px}.mk-city--ph .mk-cc b{font-size:10px;padding:0 4px}.mk-city--ph .mk-cc em{font-size:10px}`,
    shotTitle: 'نوبت شما', turnSub: 'یک تاس یا دو تاس',
    diffs: [
      ['چیدمان', 'مثل BGA: پانزده کپهٔ بازار به ترتیب عدد تاس با شمار مانده روی هرکدام، خلاصهٔ شهر هر حریف (سکه، بناها، کارت‌ها با ×n) کنار بازار، شهر شما پایین با چهار بنا و کارت‌های گروه‌بندی‌شده'],
      ['آرت', 'کارت‌ها و بناها همان طرح‌های آماده و فعلی سایت‌اند (با برچسب فارسی)؛ بنای ساخته‌نشده خاکستری است و قیمتش رویش'],
      ['تاس و درآمد', 'تاس بزرگ بالای میز؛ کارت‌هایی که کار کردند قاب طلایی و عدد سکه می‌گیرند، به ترتیب قرمز، آبی و سبز، بنفش (§۵، §۸)'],
      ['انتخاب‌ها', 'ایستگاه تلویزیون انتخاب حریف با سکه‌هایش (§۶)؛ ساخت با کپه‌های قابل خرید روشن و پنجرهٔ تأیید قیمت (§۷)؛ برج رادیو «نگه داشتن» یا «دوباره انداختن» (§۹). مرکز تجاری همین الگو را دارد: کارت خودتان، بعد کارت حریف'],
      ['پایان', 'جفت با شهربازی نوبت دوباره می‌دهد؛ اولین کسی که هر چهار بنا را بسازد می‌برد و جدول بنا، سکه و کارت‌ها را نشان می‌دهد (§۱۰)'],
      ['قوانین', 'مثل موتور: ۲ تا ۴ نفر، بازی پایه؛ هر نفر با گندمزار، نانوایی و ۳ سکه شروع می‌کند'],
    ],
  };
}
