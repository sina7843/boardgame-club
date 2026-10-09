// Chunk "factions-b": Bal T'aks, Gleens, Ambas, Taklons. Owned by one chunk agent; see README.md for the API.
import { addTokens, gaiaformersFree, gain, gainFedToken, hasPI, log, takeLeech, vp } from '../core.ts';
import type { ContentBundle, FactionDef, X } from '../types.ts';

const taklonsPI = (x: X) => hasPI(x.s, x.seat);

const FACTIONS: FactionDef[] = [
  {
    id: 'bal-taks', nameFa: 'بال‌تاک‌ها', nameEn: "Bal T'aks", home: 'v',
    // Official board (boardgamers faction-boards/baltaks.ts): no starting QIC, bowls 2/2/0, QIC academy action 4 credits.
    start: { q: 0, b2: 2, research: { gaia: 1 } },
    buildings: { ac2Action: { c: 4 } },
    flags: { noNavigationUntilPI: true },
    effects: {
      conversions: [{
        id: 'baltaks-gf',
        labelFa: '۱ گایاساز به ناحیهٔ گایا → ۱ QIC',
        can: (x) => gaiaformersFree(x.s, x.seat) >= 1,
        // gfGaia counts as used in gaiaformersFree and is reset to 0 in the gaia phase (rules.ts startRound).
        run: (x) => { x.s.pl[x.seat]!.gfGaia += 1; gain(x.s, x.seat, { q: 1 }); }
      }]
    },
    abilityFa: 'شروع بدون QIC، با ۲ ژتون در کاسهٔ I و ۲ ژتون در کاسهٔ II و در سطح ۱ پروژهٔ گایا (یک گایاساز). اقدام آکادمی QIC شما به‌جای QIC ۴ اعتبار می‌دهد. اقدام آزاد: یک گایاساز آزاد را به ناحیهٔ گایا بفرستید و ۱ QIC بگیرید؛ گایاساز در فاز گایای دور بعد برمی‌گردد. تا پیش از مؤسسهٔ سیاره‌ای نمی‌توانید در مسیر ناوبری پیشرفت کنید.',
    piFa: 'با مؤسسهٔ سیاره‌ای می‌توانید در مسیر ناوبری پیشرفت کنید.'
  },
  {
    id: 'gleens', nameFa: 'گلین‌ها', nameEn: 'Gleens', home: 'd',
    // Official board (boardgamers faction-boards/gleens.ts + player.ts): no starting QIC (the navigation-1 QIC taken at
    // set-up is a real QIC), PI income 4 charge + 1 ore, ore instead of QIC until the QIC academy, a mine on a gaia
    // planet costs 1 ore instead of 1 QIC.
    start: { q: 0, research: { nav: 1 } },
    flags: { qicAsOreUntilAc2: true },
    buildings: { pi: { pw: 4, o: 1 } },
    effects: {
      mineCost: (x, hex, cost) => {
        const h = x.s.hexes[hex]!;
        if (h.planet !== 'g' || h.owner !== null || !cost.q) return cost;
        return { ...cost, q: cost.q - 1, o: (cost.o ?? 0) + 1 };
      },
      on: {
        mine: (x, e) => { if (e.gaia) vp(x.s, x.seat, 2, 'faction'); },
        upgrade: (x, e) => { if (e.to === 'pi') gainFedToken(x.s, x.seat, 'gleens'); }
      }
    },
    abilityFa: 'شروع بدون QIC و در سطح ۱ ناوبری (که ۱ QIC می‌دهد). پس از آماده‌سازی تا وقتی آکادمی QIC نساخته‌اید به‌جای هر QIC یک سنگ معدن می‌گیرید. معدن روی سیارهٔ گایا به‌جای ۱ QIC، ۱ سنگ معدن اضافه هزینه دارد و ۲ امتیاز می‌دهد.',
    piFa: 'درآمد مؤسسهٔ سیاره‌ای ۴ شارژ قدرت و ۱ سنگ معدن است و با ساخت آن بی‌درنگ ژتون فدراسیون ویژهٔ گلین‌ها (۱ سنگ معدن، ۱ دانش، ۲ اعتبار) را می‌گیرید.'
  },
  {
    id: 'ambas', nameFa: 'آمباس‌ها', nameEn: 'Ambas', home: 's',
    start: { research: { nav: 1 } },
    // Official board (boardgamers faction-boards/ambas.ts): base income 2 ore + 1 knowledge; PI income 4 charge + 2 tokens.
    income: { o: 2, k: 1 },
    buildings: { pi: { pw: 4, t: 2 } },
    effects: {
      action: {
        labelFa: 'جابه‌جایی مؤسسهٔ سیاره‌ای با یکی از معدن‌ها',
        can: (x) => hasPI(x.s, x.seat),
        // Own mines only: Lantids' extra mines live in `extra`, never in `building`; the Lost Planet is excluded.
        targets: (x) => x.s.hexes.flatMap((h, i) => (h.owner === x.seat && h.building === 'mine' && h.planet !== 'l' ? [i] : [])),
        run: (x, hex) => {
          // Not a build or upgrade: no events, no leech; federation membership stays on the hexes.
          const pi = x.s.hexes.findIndex((h) => h.owner === x.seat && h.building === 'pi');
          x.s.hexes[pi]!.building = 'mine';
          x.s.hexes[hex!]!.building = 'pi';
        }
      }
    },
    abilityFa: 'شروع در سطح ۱ ناوبری؛ درآمد پایه ۲ سنگ معدن و ۱ دانش است.',
    piFa: 'درآمد مؤسسهٔ سیاره‌ای: ۴ شارژ قدرت و ۲ ژتون قدرت. اقدام ویژه (هر دور یک بار): جای مؤسسهٔ سیاره‌ای را با یکی از معدن‌های خود عوض کنید؛ این ساخت یا ارتقا نیست و قدرت به دیگران نمی‌دهد.'
  },
  {
    id: 'taklons', nameFa: 'تاکلون‌ها', nameEn: 'Taklons', home: 's',
    start: { brain: 1 },
    effects: {
      leech: {
        options: (x) => (taklonsPI(x) ? ['decline', 'token-first', 'charge-first'] : ['accept', 'decline']),
        resolve: (x, amount, choice) => {
          const pi = taklonsPI(x);
          if (!pi && choice === 'accept') takeLeech(x.s, x.seat, amount);
          else if (pi && choice === 'token-first') { addTokens(x.s, x.seat, 1); takeLeech(x.s, x.seat, amount); }
          else if (pi && choice === 'charge-first') { takeLeech(x.s, x.seat, amount); addTokens(x.s, x.seat, 1); }
          else log(x.s, { t: 'decline', seat: x.seat });
        }
      }
    },
    abilityFa: 'سنگ مغز در کاسهٔ I شروع می‌کند و مانند یک ژتون جابه‌جا می‌شود، اما هنگام خرج کردن ۳ قدرت ارزش دارد و به کاسهٔ I برمی‌گردد.',
    piFa: 'با مؤسسهٔ سیاره‌ای، هر بار قدرتی را از همسایه بپذیرید ۱ ژتون قدرت به کاسهٔ I می‌گیرید و ترتیب گرفتن ژتون و شارژ را خودتان انتخاب می‌کنید.'
  }
];

export const factionsB: ContentBundle = { factions: FACTIONS };
