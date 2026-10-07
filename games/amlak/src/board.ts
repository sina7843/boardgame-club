// Board data for «املاک» (a Monopoly-style property trading game with Tehran streets). Prices, rents and building
// costs follow the classic 40-square board; money is in units of 1,000 toman.

export type Group = 'brown' | 'lightBlue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkBlue';
export type Square =
  | { kind: 'go' | 'jail' | 'parking' | 'goToJail' | 'chance' | 'chest'; nameFa: string }
  | { kind: 'tax'; nameFa: string; amount: number }
  | { kind: 'street'; nameFa: string; group: Group; price: number; rents: [number, number, number, number, number, number]; house: number }
  | { kind: 'station'; nameFa: string; price: number }
  | { kind: 'utility'; nameFa: string; price: number };

export const GROUP_FA: Record<Group, string> = {
  brown: 'قهوه‌ای', lightBlue: 'آبی روشن', pink: 'صورتی', orange: 'نارنجی', red: 'قرمز', yellow: 'زرد', green: 'سبز', darkBlue: 'سرمه‌ای'
};
export const GROUP_COLOR: Record<Group, string> = {
  brown: '#8b5a2b', lightBlue: '#8fd3f4', pink: '#d63a8f', orange: '#f28c28', red: '#d62f35', yellow: '#f2d22e', green: '#23843f', darkBlue: '#1c3f94'
};

const st = (nameFa: string, group: Group, price: number, rents: [number, number, number, number, number, number], house: number): Square =>
  ({ kind: 'street', nameFa, group, price, rents, house });

export const BOARD: Square[] = [
  { kind: 'go', nameFa: 'شروع' },
  st('خیابان شوش', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { kind: 'chest', nameFa: 'صندوق' },
  st('خیابان مولوی', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'tax', nameFa: 'مالیات بر درآمد', amount: 200 },
  { kind: 'station', nameFa: 'پایانه جنوب', price: 200 },
  st('میدان خراسان', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  { kind: 'chance', nameFa: 'شانس' },
  st('خیابان ری', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  st('خیابان پیروزی', 'lightBlue', 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail', nameFa: 'زندان / ملاقات' },
  st('خیابان انقلاب', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { kind: 'utility', nameFa: 'شرکت برق', price: 150 },
  st('خیابان آزادی', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  st('خیابان کارگر', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { kind: 'station', nameFa: 'ایستگاه راه‌آهن', price: 200 },
  st('خیابان طالقانی', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { kind: 'chest', nameFa: 'صندوق' },
  st('خیابان مطهری', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  st('خیابان بهار', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'parking', nameFa: 'پارکینگ' },
  st('خیابان شریعتی', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { kind: 'chance', nameFa: 'شانس' },
  st('میدان ونک', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  st('خیابان میرداماد', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { kind: 'station', nameFa: 'فرودگاه مهرآباد', price: 200 },
  st('سعادت‌آباد', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  st('شهرک غرب', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { kind: 'utility', nameFa: 'شرکت آب', price: 150 },
  st('پاسداران', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'goToJail', nameFa: 'برو به زندان' },
  st('الهیه', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  st('زعفرانیه', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { kind: 'chest', nameFa: 'صندوق' },
  st('فرشته', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { kind: 'station', nameFa: 'متروی تجریش', price: 200 },
  { kind: 'chance', nameFa: 'شانس' },
  st('نیاوران', 'darkBlue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'tax', nameFa: 'مالیات کالای لوکس', amount: 100 },
  st('لواسان', 'darkBlue', 400, [50, 200, 600, 1400, 1700, 2000], 200)
];

export const JAIL = 10;
export const SALARY = 200;
export const START_CASH = 1500;
export const BAIL = 50;
export const HOUSES = 32;
export const HOTELS = 12;
export const STATION_RENT = [0, 25, 50, 100, 200];

export const isOwnable = (i: number) => ['street', 'station', 'utility'].includes(BOARD[i]!.kind);
export const priceOf = (i: number) => { const sq = BOARD[i]!; return 'price' in sq ? sq.price : 0; };
export const groupOf = (i: number) => { const sq = BOARD[i]!; return sq.kind === 'street' ? sq.group : null; };
export const groupMembers = (g: Group) => BOARD.map((_, i) => i).filter((i) => groupOf(i) === g);

// ---------- cards ----------

export type CardEffect =
  | { kind: 'advance'; to: number; collectGo: boolean }
  | { kind: 'nearest'; type: 'station' | 'utility' }
  | { kind: 'back'; steps: number }
  | { kind: 'jail' }
  | { kind: 'jailFree' }
  | { kind: 'money'; amount: number }
  | { kind: 'eachPlayer'; amount: number } // positive: everyone pays you; negative: you pay everyone
  | { kind: 'repairs'; house: number; hotel: number };
export interface CardDef { id: string; textFa: string; effect: CardEffect }

export const CHANCE: CardDef[] = [
  { id: 'ch-go', textFa: 'به خانه «شروع» بروید و ۲۰۰ هزار تومان بگیرید.', effect: { kind: 'advance', to: 0, collectGo: true } },
  { id: 'ch-mirdamad', textFa: 'به «خیابان میرداماد» بروید. اگر از شروع رد شدید، حقوق بگیرید.', effect: { kind: 'advance', to: 24, collectGo: true } },
  { id: 'ch-enghelab', textFa: 'به «خیابان انقلاب» بروید. اگر از شروع رد شدید، حقوق بگیرید.', effect: { kind: 'advance', to: 11, collectGo: true } },
  { id: 'ch-utility', textFa: 'به نزدیک‌ترین شرکت (آب یا برق) بروید. اگر صاحب دارد، تاس بریزید و ۱۰ برابر عدد تاس اجاره بدهید.', effect: { kind: 'nearest', type: 'utility' } },
  { id: 'ch-station1', textFa: 'به نزدیک‌ترین ایستگاه بروید. اگر صاحب دارد، دو برابر اجاره بدهید.', effect: { kind: 'nearest', type: 'station' } },
  { id: 'ch-station2', textFa: 'به نزدیک‌ترین ایستگاه بروید. اگر صاحب دارد، دو برابر اجاره بدهید.', effect: { kind: 'nearest', type: 'station' } },
  { id: 'ch-dividend', textFa: 'سود سهام: بانک ۵۰ هزار تومان به شما می‌دهد.', effect: { kind: 'money', amount: 50 } },
  { id: 'ch-free', textFa: 'کارت آزادی از زندان. این کارت را نگه دارید تا لازم شود یا بفروشید.', effect: { kind: 'jailFree' } },
  { id: 'ch-back3', textFa: 'سه خانه به عقب برگردید.', effect: { kind: 'back', steps: 3 } },
  { id: 'ch-jail', textFa: 'مستقیم به زندان بروید؛ از شروع رد نمی‌شوید و حقوق نمی‌گیرید.', effect: { kind: 'jail' } },
  { id: 'ch-repairs', textFa: 'تعمیرات کلی املاک: برای هر خانه ۲۵ و برای هر هتل ۱۰۰ هزار تومان بپردازید.', effect: { kind: 'repairs', house: 25, hotel: 100 } },
  { id: 'ch-fine', textFa: 'جریمه سرعت غیرمجاز: ۱۵ هزار تومان بپردازید.', effect: { kind: 'money', amount: -15 } },
  { id: 'ch-south', textFa: 'سفری به «پایانه جنوب». اگر از شروع رد شدید، حقوق بگیرید.', effect: { kind: 'advance', to: 5, collectGo: true } },
  { id: 'ch-lavasan', textFa: 'به «لواسان» بروید.', effect: { kind: 'advance', to: 39, collectGo: true } },
  { id: 'ch-chairman', textFa: 'رئیس هیئت‌مدیره شدید: به هر بازیکن ۵۰ هزار تومان بدهید.', effect: { kind: 'eachPlayer', amount: -50 } },
  { id: 'ch-loan', textFa: 'وام ساختمانی‌تان سررسید شد: ۱۵۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 150 } }
];

export const CHEST: CardDef[] = [
  { id: 'cc-go', textFa: 'به خانه «شروع» بروید و ۲۰۰ هزار تومان بگیرید.', effect: { kind: 'advance', to: 0, collectGo: true } },
  { id: 'cc-bank', textFa: 'اشتباه بانک به نفع شما: ۲۰۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 200 } },
  { id: 'cc-doctor', textFa: 'ویزیت پزشک: ۵۰ هزار تومان بپردازید.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc-stock', textFa: 'از فروش سهام ۵۰ هزار تومان سود بردید.', effect: { kind: 'money', amount: 50 } },
  { id: 'cc-free', textFa: 'کارت آزادی از زندان. این کارت را نگه دارید تا لازم شود یا بفروشید.', effect: { kind: 'jailFree' } },
  { id: 'cc-jail', textFa: 'مستقیم به زندان بروید؛ از شروع رد نمی‌شوید و حقوق نمی‌گیرید.', effect: { kind: 'jail' } },
  { id: 'cc-holiday', textFa: 'صندوق تعطیلات سررسید شد: ۱۰۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc-refund', textFa: 'استرداد مالیات: ۲۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 20 } },
  { id: 'cc-birthday', textFa: 'تولدتان مبارک! هر بازیکن ۱۰ هزار تومان به شما می‌دهد.', effect: { kind: 'eachPlayer', amount: 10 } },
  { id: 'cc-insurance', textFa: 'بیمه عمر سررسید شد: ۱۰۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc-hospital', textFa: 'هزینه بیمارستان: ۱۰۰ هزار تومان بپردازید.', effect: { kind: 'money', amount: -100 } },
  { id: 'cc-school', textFa: 'شهریه مدرسه: ۵۰ هزار تومان بپردازید.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc-consult', textFa: 'حق مشاوره: ۲۵ هزار تومان بگیرید.', effect: { kind: 'money', amount: 25 } },
  { id: 'cc-street', textFa: 'عوارض نوسازی: برای هر خانه ۴۰ و برای هر هتل ۱۱۵ هزار تومان بپردازید.', effect: { kind: 'repairs', house: 40, hotel: 115 } },
  { id: 'cc-contest', textFa: 'جایزه دوم مسابقه: ۱۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 10 } },
  { id: 'cc-inherit', textFa: 'ارث به شما رسید: ۱۰۰ هزار تومان بگیرید.', effect: { kind: 'money', amount: 100 } }
];
export const cardById = (id: string) => [...CHANCE, ...CHEST].find((c) => c.id === id)!;
