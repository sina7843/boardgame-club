import type { Term } from '@bg/ui';

/** Heat terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». `*Ez` variants carry the Persian ezafe («گرمای…») so the default text stays byte-identical. */
export const terms = {
  heat: { fa: 'گرما', bg: 'Heat' }, heatEz: { fa: 'گرمای', bg: 'Heat' }, heatHud: { fa: 'هیت', bg: 'Heat' }, engineHeat: { fa: 'گرمای موتور', bg: 'Engine Heat' },
  stress: { fa: 'استرس', bg: 'Stress' }, gear: { fa: 'دنده', bg: 'Gear' }, gearEz: { fa: 'دندهٔ', bg: 'Gear' },
  boost: { fa: 'بوست', bg: 'Boost' }, slipstream: { fa: 'مکش', bg: 'Slipstream' }, adrenaline: { fa: 'آدرنالین', bg: 'Adrenaline' },
  cooldown: { fa: 'خنک‌سازی', bg: 'Cooldown' }, engine: { fa: 'موتور', bg: 'Engine' }, speed: { fa: 'سرعت', bg: 'Speed' },
  corner: { fa: 'پیچ', bg: 'Corner' }, garage: { fa: 'گاراژ', bg: 'Garage' },
  deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' }, discard: { fa: 'دورریز', bg: 'Discard' },
  card: { fa: 'کارت', bg: 'Card' }, upgrade: { fa: 'ارتقا', bg: 'Upgrade' }, startUpgrade: { fa: 'ارتقای شروع', bg: 'Starting upgrade' }, startUpgrade2: { fa: 'ارتقای آغازین', bg: 'Starting upgrade' },
  lap: { fa: 'دور', bg: 'Lap' }, round: { fa: 'دور', bg: 'Round' }, space: { fa: 'خانه', bg: 'Space' }, spaceEz: { fa: 'خانهٔ', bg: 'Space' },
  track: { fa: 'پیست', bg: 'Track' }, race: { fa: 'مسابقه', bg: 'Race' }, raceEz: { fa: 'مسابقهٔ', bg: 'Race' }, races: { fa: 'نتایج مسابقه‌ها', bg: 'Race results' },
  raceOrder: { fa: 'ترتیب مسابقه', bg: 'Race order' }, limit: { fa: 'محدودیت', bg: 'Limit' }, car: { fa: 'ماشین', bg: 'Car' }, carsPl: { fa: 'ماشین‌ها', bg: 'Cars' }, market: { fa: 'بازار', bg: 'Market' }, carMat: { fa: 'صفحهٔ ماشین شما', bg: 'Your car mat' },
  position: { fa: 'رتبه', bg: 'Position' }, played: { fa: 'بازی‌شده', bg: 'Played' }, revealed: { fa: 'رو شد', bg: 'Revealed' },
  behindStart: { fa: 'پشت خط شروع', bg: 'Behind the start line' }, finishLine: { fa: 'خط پایان', bg: 'Finish line' },
  overheat: { fa: 'داغ کردن', bg: 'Overheat' }, backOnDeck: { fa: 'برگشت روی', bg: 'Back on' }, endTurn: { fa: 'پایان نوبت', bg: 'End turn' }, cooldownAuto: { fa: 'خنک', bg: 'Cooldown' },
  sunny: { fa: 'آفتابی', bg: 'Sunny' }, rain: { fa: 'باران', bg: 'Rain' }, fog: { fa: 'مه', bg: 'Fog' }, cold: { fa: 'سرمای شدید', bg: 'Extreme Cold' }, heatwave: { fa: 'موج گرما', bg: 'Heat Wave' },
  usa: { fa: 'آمریکا', bg: 'USA' }, italy: { fa: 'ایتالیا', bg: 'Italy' }, france: { fa: 'فرانسه', bg: 'France' }, gb: { fa: 'بریتانیا', bg: 'Great Britain' }
} satisfies Record<string, Term>;

/** English names of the garage upgrade cards by id (Persian names live in the rules data). */
export const GARAGE_EN: Record<string, string> = {
  radiator: 'Radiator', cooler: 'Oil Cooler', fan: 'Cooling Fan', turbo: 'Turbocharger', nitro: 'Nitrous', injector: 'Injector',
  tires: 'Soft Tires', slicks: 'Slick Tires', brakes: 'Ceramic Brakes', wing: 'Rear Wing', spoiler: 'Spoiler',
  chassis: 'Light Chassis', carbon: 'Carbon Body', gearbox: 'Racing Gearbox', intercooler: 'Intercooler'
};
