// Ark Nova content chunk «sponsors-a»: Sponsor cards 203-228 and 230-232 (29 cards; 201, 202, 229 are in examples.ts).
// API: ./README.md (worked examples in ./examples.ts). Tests: packages/game-engine/test/ark-nova-sponsors-a.test.ts
// Printed rewards (reputation, conservation, appeal, icons) are applied by the engine from data.ts — never repeated here.
import {
  ANIMAL, P, PROJECT, afterAction, animalOptions, animalLabel, animalValue, animalsIn, ask, categoriesIn, continentsIn, count, coveredCells,
  ctx, gain, gainBonus, bonusFa, buildingSpaces, hireWorker, isFull, large, later, mapOf, nameOf, playAnimal, reveal, small, takeDisplay
} from '../core.ts';
import { isBorder } from '../hex.ts';
import type { CardDef, ContentChunk, Ctx, Icon } from '../types.ts';

/** Every other player gains `n` money. */
const othersMoney = (c: Ctx, n: number) => { for (let k = 0; k < c.s.n; k++) if (k !== c.seat) gain(ctx(c.s, k, c.rng), 'money', n); };
/** Income of the Sponsorship cards: 3 / 6 / 9 money for 1–2 / 3–4 / 5+ icons. */
const sponsorship = (n: number) => (n >= 5 ? 9 : n >= 3 ? 6 : n >= 1 ? 3 : 0);
/** "For each <icon> you play into your zoo" (cards count themselves; double icons count twice). */
const eachOwn = (icon: Icon, f: (c: Ctx) => void): CardDef['on'] => ({
  icons: (c, e) => { if (e.seat === c.seat) for (let i = 0; i < (e.icons[icon] ?? 0); i++) f(c); }
});
const expertText = (continent: string, effect: string) =>
  `به ازای هر نماد ${continent} در باغ‌وحش‌تان ۱ جذابیت بگیرید. به ازای هر نماد ${continent} که وارد باغ‌وحش خود می‌کنید، ${effect}`;
const breedingText =
  'هنگام بازی ۲ نشان بازیکن روی این کارت بگذارید. هنگام حمایت از یک پروژهٔ حفاظتی پایه (زیر صفحهٔ انجمن) می‌توانید دقیقاً ۱ نشان را به‌جای هر نمادی کنار بگذارید؛ هر دو نشان را نمی‌توان برای یک پروژه به کار برد. پایان بازی: اگر ۵ بار یا بیشتر از پروژه‌های حفاظتی حمایت کرده باشید ۱ امتیاز حفاظت.';
const continents5End = (c: Ctx) => { if (continentsIn(c.s, c.seat) >= 5) gain(c, 'cp', 1); };
const rep9End = (c: Ctx) => { if (P(c).rep >= 9) gain(c, 'cp', 1); };
const uni3End = (c: Ctx) => { if (P(c).unis.length >= 3) gain(c, 'cp', 1); };
const supported5End = (c: Ctx) => { if (P(c).supported >= 5) gain(c, 'cp', 1); };

const cards: CardDef[] = [
  {
    id: 203, nameFa: 'دامپزشک',
    textFa: 'برای ۱/۲/۳ دانشگاه در باغ‌وحش‌تان ۲/۵/۱۰ پول بگیرید. از این پس حمایت از پروژهٔ حفاظتی در کنش انجمن فقط قدرت ۴ (به‌جای ۵) لازم دارد. پایان بازی: اگر ۳ دانشگاه داشته باشید ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'money', [0, 2, 5, 10][Math.min(3, P(c).unis.length)]!),
    q: { projectStrength: () => 1 },
    endgame: uni3End
  },
  {
    id: 204, nameFa: 'موزهٔ علوم',
    textFa: 'به ازای هر نماد پژوهش در باغ‌وحش‌تان ۲ پول بگیرید. به ازای هر نماد پژوهش که وارد باغ‌وحش خود می‌کنید ۱ امتیاز حفاظت بگیرید.',
    onPlay: (c) => gain(c, 'money', 2 * count(c.s, c.seat, 'science')),
    on: eachOwn('science', (c) => gain(c, 'cp', 1))
  },
  { id: 205, nameFa: 'پژوهش میدانی گوریل', textFa: 'هنگام بازی این کارت ۲ اعتبار و ۱ امتیاز حفاظت بگیرید.' },
  {
    id: 206, nameFa: 'پیشرفت پزشکی',
    textFa: 'به ازای هر بار که تاکنون از یک پروژهٔ حفاظتی حمایت کرده‌اید ۲ جذابیت بگیرید. در مرحلهٔ درآمد هر استراحت ۱ امتیاز حفاظت بگیرید.',
    onPlay: (c) => gain(c, 'appeal', 2 * P(c).supported),
    income: (c) => gain(c, 'cp', 1)
  },
  {
    id: 207, nameFa: 'پژوهش بنیادی',
    textFa: 'نمادهای متفاوت دستهٔ حیوانات و قاره در باغ‌وحش‌تان را بشمارید. به ازای هر ۲ نماد متفاوت ۱ امتیاز حفاظت می‌گیرید و هر بازیکن دیگر ۲ پول می‌گیرد.',
    onPlay: (c) => {
      const n = Math.floor((categoriesIn(c.s, c.seat) + continentsIn(c.s, c.seat)) / 2);
      gain(c, 'cp', n);
      othersMoney(c, 2 * n);
    }
  },
  {
    id: 208, nameFa: 'کتابخانهٔ علمی',
    textFa: 'به ازای هر نماد پژوهش در باغ‌وحش‌تان ۱ جذابیت بگیرید. به ازای هر نماد پژوهش که در هر باغ‌وحشی بازی شود ۲ پول بگیرید. پایان بازی: اگر دست‌کم ۵ نماد متفاوت دستهٔ حیوانات داشته باشید ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'science')),
    on: { icons: (c, e) => gain(c, 'money', 2 * (e.icons.science ?? 0)) },
    endgame: (c) => { if (categoriesIn(c.s, c.seat) >= 5) gain(c, 'cp', 1); }
  },
  {
    id: 209, nameFa: 'مؤسسهٔ فناوری',
    textFa: 'هنگام بازی این کارت و در مرحلهٔ درآمد هر استراحت ۱ نشان X بگیرید (حداکثر ۵ نشان X). پایان بازی: اگر ۳ دانشگاه داشته باشید ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'x', 1),
    income: (c) => gain(c, 'x', 1),
    endgame: uni3End
  },
  {
    id: 210, nameFa: 'کارشناس قارهٔ آمریکا',
    textFa: expertText('آمریکا', 'می‌توانید ۱ کیوسک رایگان روی نقشهٔ باغ‌وحش بسازید (قوانین عادی ساخت، از جمله فاصلهٔ کیوسک‌ها). پایان بازی: اگر ۵ کیوسک یا بیشتر داشته باشید ۱ امتیاز حفاظت.'),
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'americas')),
    on: eachOwn('americas', (c) => ask.place(c, { kinds: ['kiosk'], free: true, optional: true, label: 'کارشناس قارهٔ آمریکا: کیوسک رایگان (اختیاری)' })),
    endgame: (c) => { if (P(c).buildings.filter((b) => b.kind === 'kiosk').length >= 5) gain(c, 'cp', 1); }
  },
  {
    id: 211, nameFa: 'کارشناس اروپا',
    textFa: expertText('اروپا', 'می‌توانید ۱ محوطهٔ ۱ خانه رایگان بسازید (قوانین عادی ساخت). پایان بازی: اگر ۵ محوطهٔ ۱ خانهٔ اشغال‌شده یا بیشتر داشته باشید ۱ امتیاز حفاظت.'),
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'europe')),
    on: eachOwn('europe', (c) => ask.place(c, { kinds: ['e1'], free: true, optional: true, label: 'کارشناس اروپا: محوطهٔ ۱ خانهٔ رایگان (اختیاری)' })),
    endgame: (c) => { if (P(c).buildings.filter((b) => b.kind === 'e1' && b.full).length >= 5) gain(c, 'cp', 1); }
  },
  {
    id: 212, nameFa: 'کارشناس استرالیا',
    textFa: expertText('استرالیا', 'می‌توانید ۱ کارت از دست خود را زیر این کارت بگذارید و ۲ جذابیت بگیرید (کیسه‌دار ۱). کارت‌های زیر این کارت دیگر کاری ندارند.'),
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'australia')),
    on: eachOwn('australia', (c) => later(c, 's212:ask'))
  },
  {
    id: 213, nameFa: 'کارشناس آسیا',
    textFa: expertText('آسیا', 'می‌توانید ۱ آلاچیق رایگان بسازید (قوانین عادی ساخت؛ آلاچیق ۱ جذابیت می‌دهد).'),
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'asia')),
    on: eachOwn('asia', (c) => ask.place(c, { kinds: ['pavilion'], free: true, optional: true, label: 'کارشناس آسیا: آلاچیق رایگان (اختیاری)' }))
  },
  {
    id: 214, nameFa: 'کارشناس آفریقا',
    textFa: expertText('آفریقا', 'پس از پایان کنش می‌توانید هر کارت کنش را به خانهٔ ۱ ببرید. پایان بازی: به ازای هر نشان X در اختیارتان ۱ جذابیت.'),
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'africa')),
    on: eachOwn('africa', (c) => afterAction(c, 'core:clever')),
    endgame: (c) => gain(c, 'appeal', P(c).x)
  },
  { id: 215, nameFa: 'برنامهٔ جهانی تکثیر', textFa: breedingText, wild: 2, endgame: supported5End },
  {
    id: 216, nameFa: 'ارتباط‌گر توانا',
    textFa: 'یک کارمند انجمن دیگر استخدام کنید؛ بی‌درنگ در دسترس است (اگر همهٔ کارمندان را استخدام کرده‌اید اثری ندارد). پایان بازی: اگر اعتبارتان ۹ یا بیشتر باشد ۱ امتیاز حفاظت.',
    onPlay: (c) => hireWorker(c),
    endgame: rep9End
  },
  {
    id: 217, nameFa: 'مهندس',
    textFa: 'هر بار کنش ساخت انجام می‌دهید، می‌توانید دقیقاً ۱ نسخهٔ دیگر از یکی از ساختمان‌های ساخته‌شده در همان کنش را با هزینهٔ عادی بسازید (نه محوطهٔ ویژه). پایان بازی: اگر نقشهٔ باغ‌وحش کاملاً پوشیده باشد (به‌جز صخره و آب) ۵ جذابیت.',
    q: { extraBuild: () => true },
    endgame: (c) => { if (isFull(P(c))) gain(c, 'appeal', 5); }
  },
  { id: 218, nameFa: 'برنامهٔ تکثیر', textFa: breedingText, wild: 2, endgame: supported5End },
  {
    id: 219, nameFa: 'پژوهشگر تنوع',
    textFa: 'به ازای هر نماد آب و صخره در باغ‌وحش‌تان ۲ پول بگیرید. می‌توانید خانه‌های آب و صخره را بپوشانید و همهٔ شرط‌های آب و صخره را هنگام ساخت سازه‌های یکتا و بازی حیوانات نادیده بگیرید. پایان بازی: به ازای هر دست ۱ نماد آب + ۱ نماد صخره ۲ جذابیت (حداکثر ۳ دست).',
    onPlay: (c) => gain(c, 'money', 2 * (count(c.s, c.seat, 'water') + count(c.s, c.seat, 'rock'))),
    q: { coverTerrain: () => true },
    endgame: (c) => gain(c, 'appeal', 2 * Math.min(3, count(c.s, c.seat, 'water'), count(c.s, c.seat, 'rock')))
  },
  {
    id: 220, nameFa: 'کمک‌هزینهٔ دولتی',
    textFa: 'هنگام بازی این کارت و در مرحلهٔ درآمد هر استراحت ۳ پول بگیرید. پایان بازی: اگر اعتبارتان ۹ یا بیشتر باشد ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'money', 3),
    income: (c) => gain(c, 'money', 3),
    endgame: rep9End
  },
  {
    id: 221, nameFa: 'باستان‌شناس',
    textFa: 'هر بار پاداش جای‌گذاری یک خانهٔ لبه را می‌گیرید، یک پاداش جای‌گذاری رایگان دیگر به انتخاب خود از میان پاداش‌های هنوز پوشیده‌نشدهٔ باغ‌وحش‌تان بگیرید (لازم نیست روی لبه باشد). پایان بازی: اگر همهٔ خانه‌های لبه (به‌جز صخره و آب) را پوشانده باشید ۱ امتیاز حفاظت.',
    on: { placementBonus: (c, e) => { if (e.border && e.seat === c.seat) later(c, 's221:ask'); } },
    endgame: (c) => {
      const cov = coveredCells(P(c));
      if (buildingSpaces(P(c)).filter(isBorder).every((x) => cov.has(x))) gain(c, 'cp', 1);
    }
  },
  {
    id: 222, nameFa: 'آزادسازی حق اختراع',
    textFa: 'به ازای هر نماد پژوهش در باغ‌وحش‌تان ۱ امتیاز حفاظت بگیرید (حداکثر ۳). هر بازیکن دیگر به ازای هر امتیاز حفاظتی که این‌گونه گرفتید ۲ پول می‌گیرد.',
    onPlay: (c) => {
      const n = Math.min(3, count(c.s, c.seat, 'science'));
      gain(c, 'cp', n);
      othersMoney(c, 2 * n);
    }
  },
  { id: 223, nameFa: 'مؤسسهٔ علمی', textFa: 'اثری ندارد؛ ۲ نماد پژوهش به باغ‌وحش‌تان می‌افزاید.' },
  {
    id: 224, nameFa: 'ثبت مهاجرت',
    textFa: '۱ نشان X بگیرید. هر بار از یک پروژهٔ «رهاسازی در طبیعت» (کارت‌های ۱۱۳ تا ۱۲۲) حمایت می‌کنید ۱ امتیاز حفاظت اضافه بگیرید. می‌توانید با رهاسازی حیوان دیگری از گونهٔ لازم، چند بار از هر پروژهٔ رهاسازی حمایت کنید (در هر کنش انجمن فقط ۱ نشان روی هر پروژه).',
    onPlay: (c) => gain(c, 'x', 1),
    q: { repeatRelease: () => true },
    on: { project: (c, e) => { if (e.seat === c.seat && PROJECT[e.project]?.kind === 'release') gain(c, 'cp', 1); } }
  },
  {
    id: 225, nameFa: 'آزمایشگاه قرنطینه',
    textFa: '۱ نشان X بگیرید. اثرهای زهر، فشردن، هیپنوتیزم و دستبرد بر شما اثری ندارند. پایان بازی: اگر هر ۵ نماد قاره را داشته باشید ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'x', 1),
    q: { immune: () => true },
    endgame: continents5End
  },
  {
    id: 226, nameFa: 'مؤسسهٔ خارجی',
    textFa: 'هنگام بازی این کارت ۲ اعتبار بگیرید. پایان بازی: اگر هر ۵ نماد قاره را داشته باشید ۱ امتیاز حفاظت.',
    endgame: continents5End
  },
  {
    id: 227, nameFa: 'مأموریت ویژهٔ WAZA',
    textFa: 'تا پایان بازی حیوانات کوچک یا بزرگ را انتخاب کنید. از دسته یکی‌یکی کارت رو کنید تا حیوانی از نوع انتخابی بیاید؛ آن را به دست بگیرید و بقیه را دور بریزید. از این پس حیوانات نوع دیگر را نمی‌توانید بازی کنید (حیوانات ۳ خانه آزادند). هر حیوان کوچک انتخابی ۲ و هر حیوان بزرگ انتخابی ۴ جذابیت اضافه می‌دهد.',
    onPlay: (c) => ask.option(c, {
      options: [{ value: 'small', label: 'حیوانات کوچک (+۲ جذابیت برای هرکدام)' }, { value: 'large', label: 'حیوانات بزرگ (+۴ جذابیت برای هرکدام)' }],
      label: 'مأموریت ویژهٔ WAZA: روی کدام نوع حیوان تمرکز می‌کنید؟', fx: 's227:choose'
    }),
    q: {
      forbidAnimal: (c, a) => {
        const t = (P(c).data[227] as { type?: string } | undefined)?.type;
        return t === 'small' ? large(a) : t === 'large' ? small(a) : false;
      }
    },
    on: {
      animal: (c, e) => {
        if (e.seat !== c.seat) return;
        const t = (P(c).data[227] as { type?: string } | undefined)?.type;
        const a = ANIMAL[e.card]!;
        if (t === 'small' && small(a)) gain(c, 'appeal', 2);
        if (t === 'large' && large(a)) gain(c, 'appeal', 4);
      }
    }
  },
  {
    id: 228, nameFa: 'برنامهٔ حیوانات کوچک WAZA',
    textFa: 'به ازای هر حیوان کوچک در باغ‌وحش‌تان ۲ پول بگیرید. هر بار در کنش حیوانات فقط حیوان کوچک بازی کنید، می‌توانید ۱ حیوان کوچک دیگر از دست با هزینهٔ عادی بازی کنید؛ سپس (حتی اگر بازی نکردید) ۱ حیوان کوچک از ویترین (هر خانه‌ای) به دست بگیرید، اگر باشد.',
    onPlay: (c) => gain(c, 'money', 2 * animalsIn(c.s, c.seat).filter(small).length),
    on: {
      action: (c, e) => {
        if (e.seat !== c.seat || e.card !== 'animals') return;
        P(c).data[228] = { n: 0, small: true };
        afterAction(c, 's228:after');
      },
      animal: (c, e) => {
        const a = c.s.act;
        const d = P(c).data[228] as { n: number; small: boolean } | undefined;
        if (e.seat !== c.seat || !d || !a || a.seat !== c.seat || a.card !== 'animals') return;
        d.n += 1;
        if (!small(ANIMAL[e.card]!)) d.small = false;
      }
    }
  },
  {
    id: 230, nameFa: 'کارشناس حیوانات بزرگ',
    textFa: 'به ازای هر حیوان بزرگ در باغ‌وحش‌تان ۲ جذابیت بگیرید. هر حیوان بزرگ (محوطهٔ ۴ یا ۵ خانه) ۴ پول ارزان‌تر است.',
    onPlay: (c) => gain(c, 'appeal', 2 * animalsIn(c.s, c.seat).filter(large).length),
    q: { animalCost: (_c, a) => (large(a) ? -4 : 0) }
  },
  {
    id: 231, nameFa: 'حمایت: نخستی‌ها',
    textFa: 'به ازای هر نماد نخستی در باغ‌وحش‌تان ۱ جذابیت بگیرید. در مرحلهٔ درآمد هر استراحت برای ۱–۲ / ۳–۴ / ۵+ نماد نخستی ۳ / ۶ / ۹ پول بگیرید.',
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'primate')),
    income: (c) => gain(c, 'money', sponsorship(count(c.s, c.seat, 'primate')))
  },
  {
    id: 232, nameFa: 'حمایت: خزندگان',
    textFa: 'به ازای هر نماد خزنده در باغ‌وحش‌تان ۱ جذابیت بگیرید. در مرحلهٔ درآمد هر استراحت برای ۱–۲ / ۳–۴ / ۵+ نماد خزنده ۳ / ۶ / ۹ پول بگیرید.',
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'reptile')),
    income: (c) => gain(c, 'money', sponsorship(count(c.s, c.seat, 'reptile')))
  }
];

const fx: ContentChunk['fx'] = {
  // Expert on Australia: offered when the step reaches the queue head, so the hand is current.
  's212:ask': (c) => ask.pick(c, {
    ids: [...P(c).hand], min: 1, max: 1, optional: true, fx: 's212:tuck',
    label: 'کارشناس استرالیا: ۱ کارت از دست را زیر این کارت بگذارید (۲ جذابیت، اختیاری)'
  }),
  's212:tuck': (c, _d, ans) => {
    const p = P(c);
    const id = ans.ids?.[0];
    if (ans.skip || id === undefined || !p.hand.includes(id)) return;
    p.hand.splice(p.hand.indexOf(id), 1);
    (p.under[212] ??= []).push(id);
    gain(c, 'appeal', 2);
  },
  's221:ask': (c) => {
    const p = P(c);
    const cov = coveredCells(p);
    const options = Object.entries(mapOf(p).bonuses).filter(([cell]) => !cov.has(cell)).map(([cell, b]) => ({ value: cell, label: bonusFa(b) }));
    ask.option(c, { options, label: 'باستان‌شناس: یک پاداش جای‌گذاری پوشیده‌نشده را انتخاب کنید', fx: 's221:gain' });
  },
  's221:gain': (c, _d, ans) => { const b = mapOf(P(c)).bonuses[ans.value!]; if (b) gainBonus(c, b); },
  's227:choose': (c, _d, ans) => {
    const type = ans.value === 'large' ? 'large' : 'small';
    P(c).data[227] = { type };
    const fits = type === 'small' ? small : large;
    // Revealed cards stay aside until the search ends, so a reshuffle can never bring them back (no endless loop).
    const aside: number[] = [];
    for (let id = reveal(c); id !== null; id = reveal(c)) {
      const a = ANIMAL[id];
      if (a && fits(a)) { P(c).hand.push(id); break; }
      aside.push(id);
    }
    c.s.discard.push(...aside);
  },
  's228:after': (c) => {
    const d = P(c).data[228] as { n: number; small: boolean } | undefined;
    delete P(c).data[228];
    if (!d || !d.n || !d.small) return;
    const os = animalOptions(c, P(c).up.animals, false, small);
    ask.option(c, {
      options: os.map((o) => ({ value: animalValue(o), label: animalLabel(c, o) })), optional: true, fx: 's228:play',
      label: 'برنامهٔ حیوانات کوچک WAZA: ۱ حیوان کوچک دیگر از دست بازی کنید (اختیاری)'
    });
    later(c, 's228:take');
  },
  's228:play': (c, _d, ans) => {
    if (ans.skip) return;
    const o = animalOptions(c, P(c).up.animals, false, small).find((x) => animalValue(x) === ans.value);
    if (o) playAnimal(c, o);
  },
  's228:take': (c) => {
    const folders = c.s.display.map((id, i) => (id !== null && ANIMAL[id] && small(ANIMAL[id]!) ? i + 1 : 0)).filter(Boolean);
    ask.option(c, {
      options: folders.map((f) => ({ value: String(f), label: `${nameOf(c.s.display[f - 1]!)} (ویترین ${f})` })),
      label: 'برنامهٔ حیوانات کوچک WAZA: ۱ حیوان کوچک از ویترین به دست بگیرید', fx: 's228:taken'
    });
  },
  's228:taken': (c, _d, ans) => {
    takeDisplay(c, Number(ans.value));
  }
};

export const sponsorsA: ContentChunk = { cards, fx };
