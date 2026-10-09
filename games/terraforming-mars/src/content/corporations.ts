// All base corporations (R00–R43) incl. the two Corporate Era corporations (Saturn Systems, Teractor: ce: true).
// Owned by the architect; also a worked example of every ongoing-effect hook.
import { hasTag, type CardDef } from '../api.ts';

export const corporations: CardDef[] = [
  {
    id: 'R00', name: 'Beginner Corporation', nameFa: 'شرکت تازه‌کار', kind: 'corporation', cost: 0, tags: [], startMc: 42, freeStartCards: true,
    textFa: 'با ۴۲ مگاکردیت شروع می‌کنید و ۱۰ کارت آغازین را رایگان نگه می‌دارید.'
  },
  {
    id: 'R08', name: 'CrediCor', nameFa: 'کردیکور', kind: 'corporation', cost: 0, tags: [], startMc: 57,
    textFa: '۵۷ مگاکردیت. پس از پرداخت هزینهٔ کارت یا پروژهٔ استاندارد با هزینهٔ پایهٔ ۲۰ یا بیشتر، ۴ مگاکردیت می‌گیرید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat && e.card.cost >= 20) g.gain('mc', 4); },
    onStandardProject: (g, e) => { if (e.seat === g.seat && e.cost >= 20) g.gain('mc', 4); }
  },
  {
    id: 'R17', name: 'Ecoline', nameFa: 'اکولاین', kind: 'corporation', cost: 0, tags: ['plant'], startMc: 36, gain: { plants: 3 }, prod: { plants: 2 }, greeneryPlants: 7,
    textFa: '۳۶ مگاکردیت، ۳ گیاه و ۲ تولید گیاه. تبدیل گیاه به فضای سبز برایتان ۷ گیاه است.'
  },
  {
    id: 'R18', name: 'Helion', nameFa: 'هلیون', kind: 'corporation', cost: 0, tags: ['space'], startMc: 42, prod: { heat: 3 }, heatAsMc: true,
    textFa: '۴۲ مگاکردیت و ۳ تولید گرما. می‌توانید گرما را به‌جای مگاکردیت خرج کنید.'
  },
  {
    id: 'R19', name: 'Interplanetary Cinematics', nameFa: 'سینمای میان‌سیاره‌ای', kind: 'corporation', cost: 0, tags: ['building'], startMc: 30, gain: { steel: 20 },
    textFa: '۳۰ مگاکردیت و ۲۰ فولاد. هر بار کارت رویداد بازی کنید ۲ مگاکردیت می‌گیرید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat && e.card.kind === 'event') g.gain('mc', 2); }
  },
  {
    id: 'R43', name: 'Inventrix', nameFa: 'اینونتریکس', kind: 'corporation', cost: 0, tags: ['science'], startMc: 45, reqTolerance: 2,
    textFa: '۴۵ مگاکردیت. کنش اول: ۳ کارت بکشید. شرط‌های سراسری کارت‌هایتان ۲ پله به سود شما جابه‌جا می‌شوند.',
    firstAction: (g) => { g.draw(3); }
  },
  {
    id: 'R24', name: 'Mining Guild', nameFa: 'صنف معدنچیان', kind: 'corporation', cost: 0, tags: ['building', 'building'], startMc: 30, gain: { steel: 5 }, prod: { steel: 1 },
    textFa: '۳۰ مگاکردیت، ۵ فولاد و ۱ تولید فولاد. هر بار پاداش جای‌گذاری فولاد یا تیتانیوم بگیرید، ۱ تولید فولاد می‌گیرید.',
    onTilePlaced: (g, e) => { if (e.seat === g.seat && (e.bonus.steel || e.bonus.titanium)) g.prod('steel', 1); }
  },
  {
    id: 'R09', name: 'PhoboLog', nameFa: 'فوبولاگ', kind: 'corporation', cost: 0, tags: ['space'], startMc: 23, gain: { titanium: 10 }, titaniumBonus: 1,
    textFa: '۲۳ مگاکردیت و ۱۰ تیتانیوم. هر تیتانیوم ۱ مگاکردیت بیشتر ارزش دارد.'
  },
  {
    id: 'R31', name: 'Tharsis Republic', nameFa: 'جمهوری تارسیس', kind: 'corporation', cost: 0, tags: ['building'], startMc: 40,
    textFa: '۴۰ مگاکردیت. کنش اول: یک شهر بگذارید. هر شهری روی مریخ ۱ تولید مگاکردیت و هر شهر خودتان ۳ مگاکردیت می‌دهد.',
    firstAction: (g) => { g.tile('city'); },
    onTilePlaced: (g, e) => {
      if (e.kind !== 'city') return;
      if (e.onMars) g.prod('mc', 1);
      if (e.seat === g.seat) g.gain('mc', 3);
    }
  },
  {
    id: 'R13', name: 'Thorgate', nameFa: 'تورگیت', kind: 'corporation', cost: 0, tags: ['power'], startMc: 48, prod: { energy: 1 },
    textFa: '۴۸ مگاکردیت و ۱ تولید انرژی. کارت‌های انرژی و پروژهٔ استاندارد نیروگاه ۳ مگاکردیت ارزان‌ترند.',
    discount: (c) => (hasTag(c, 'power') ? 3 : 0),
    spDiscount: (p) => (p === 'powerPlant' ? 3 : 0)
  },
  {
    id: 'R32', name: 'United Nations Mars Initiative', nameFa: 'ابتکار مریخ سازمان ملل', kind: 'corporation', cost: 0, tags: ['earth'], startMc: 40,
    textFa: '۴۰ مگاکردیت. کنش: اگر این نسل رتبهٔ زمین‌سازی‌تان بالا رفته، ۳ مگاکردیت بدهید و ۱ رتبه بگیرید.',
    action: { cost: 3, can: (g) => g.p.trRaised, run: (g) => g.tr(1) }
  },
  {
    id: 'R03', name: 'Saturn Systems', nameFa: 'سامانه‌های زحل', kind: 'corporation', cost: 0, tags: ['jovian'], startMc: 42, prod: { titanium: 1 }, ce: true,
    textFa: '۴۲ مگاکردیت و ۱ تولید تیتانیوم. هر نشان مشتری که هر کسی بازی کند (این هم) ۱ تولید مگاکردیت می‌دهد.',
    start: (g) => g.prod('mc', 1),
    onCardPlayed: (g, e) => { const n = e.card.tags.filter((t) => t === 'jovian').length; if (n) g.prod('mc', n); }
  },
  {
    id: 'R30', name: 'Teractor', nameFa: 'تراکتور', kind: 'corporation', cost: 0, tags: ['earth'], startMc: 60, ce: true,
    textFa: '۶۰ مگاکردیت. کارت‌های زمین ۳ مگاکردیت ارزان‌ترند.',
    discount: (c) => (hasTag(c, 'earth') ? 3 : 0)
  }
];
