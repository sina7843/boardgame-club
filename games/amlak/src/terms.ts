import { tx, type Term } from '@bg/ui';

/** Amlak (Monopoly-style) terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
// NOTE: `pot` stays before `chest` (same Persian word «صندوق»): the summary swap lets the later entry win.
export const terms = {
  auction: { fa: 'مزایده', bg: 'Auction' }, mortgage: { fa: 'رهن', bg: 'Mortgage' }, unmortgage: { fa: 'فک رهن', bg: 'Unmortgage' },
  pot: { fa: 'صندوق', bg: 'Pot' }, chance: { fa: 'شانس', bg: 'Chance' }, chest: { fa: 'صندوق', bg: 'Community Chest' },
  hotel: { fa: 'هتل', bg: 'Hotel' }, jail: { fa: 'زندان', bg: 'Jail' },
  house: { fa: 'خانه', bg: 'House' }, housesEz: { fa: 'خانه‌های', bg: 'Houses' }, hotels: { fa: 'هتل‌ها', bg: 'Hotels' },
  station: { fa: 'ایستگاه', bg: 'Railroad' }, company: { fa: 'شرکت', bg: 'Utility' },
  rent: { fa: 'اجاره', bg: 'Rent' }, landRent: { fa: 'اجاره زمین', bg: 'Rent' }, landRentEz: { fa: 'اجارهٔ زمین', bg: 'Rent' }, fullSet: { fa: 'با کل رنگ', bg: 'With Full Set' },
  tax: { fa: 'مالیات', bg: 'Tax' }, deed: { fa: 'سند', bg: 'Deed' }, titleDeed: { fa: 'سند مالکیت', bg: 'Title Deed' },
  stationDeed: { fa: 'سند ایستگاه', bg: 'Railroad Deed' }, companyDeed: { fa: 'سند شرکت', bg: 'Utility Deed' }, yourDeeds: { fa: 'سندهای شما', bg: 'Your Deeds' },
  property: { fa: 'ملک', bg: 'Property' }, properties: { fa: 'املاک', bg: 'Properties' }, propertiesThat: { fa: 'املاکی', bg: 'Properties' }, manageProps: { fa: 'مدیریت املاک', bg: 'Manage Properties' },
  trade: { fa: 'معامله', bg: 'Trade' }, tradeOffer: { fa: 'پیشنهاد معامله', bg: 'Trade Offer' }, sendOffer: { fa: 'ارسال پیشنهاد', bg: 'Send Offer' },
  bid: { fa: 'پیشنهاد', bg: 'Bid' }, highestBid: { fa: 'بالاترین پیشنهاد', bg: 'Highest Bid' }, placeBid: { fa: 'ثبت پیشنهاد', bg: 'Place Bid' }, yourBid: { fa: 'پیشنهاد شما', bg: 'Your Bid' },
  quickBid: { fa: 'افزایش سریع پیشنهاد', bg: 'Quick Bid' }, passBid: { fa: 'کنار می‌کشم', bg: 'Pass' },
  die: { fa: 'تاس', bg: 'Dice' }, rollBtn: { fa: 'تاس بریز', bg: 'Roll' }, rollPrompt: { fa: 'تاس بریزید', bg: 'Roll the dice' }, lastRoll: { fa: 'آخرین تاس', bg: 'Last Roll' },
  diceRolling: { fa: 'تاس‌ها در حال چرخیدن', bg: 'Dice rolling' }, doubles: { fa: 'جفت', bg: 'Doubles' },
  jailCard: { fa: 'کارت آزادی از زندان', bg: 'Get Out of Jail Free' }, jailCardShort: { fa: 'کارت آزادی', bg: 'Get Out of Jail Free' }, card: { fa: 'کارت', bg: 'Card' },
  bail: { fa: 'جریمه زندان', bg: 'Bail' }, salary: { fa: 'حقوق', bg: 'Salary' }, parkingPrize: { fa: 'جایزه پارکینگ', bg: 'Free Parking Jackpot' }, parkingPot: { fa: 'صندوق پارکینگ', bg: 'Free Parking Pot' },
  bank: { fa: 'بانک', bg: 'Bank' }, debt: { fa: 'بدهی', bg: 'Debt' },
  bankrupt: { fa: 'ورشکست', bg: 'Bankrupt' }, bankruptEd: { fa: 'ورشکسته', bg: 'Bankrupt' }, declareBankrupt: { fa: 'اعلام ورشکستگی', bg: 'Declare Bankruptcy' },
  build: { fa: 'ساخت', bg: 'Build' }, sellBuilding: { fa: 'فروش ساختمان', bg: 'Sell Building' },
  buy: { fa: 'خرید', bg: 'Buy' }, decline: { fa: 'نمی‌خرم', bg: 'Decline' }, endTurn: { fa: 'پایان نوبت', bg: 'End Turn' },
  owner: { fa: 'مالک', bg: 'Owner' }, price: { fa: 'قیمت', bg: 'Price' }, perHouse: { fa: 'هر خانه', bg: 'Per House' },
  cash: { fa: 'نقد', bg: 'Cash' }, assets: { fa: 'دارایی', bg: 'Assets' }, yourAssets: { fa: 'دارایی شما', bg: 'Your Assets' }, round: { fa: 'دور', bg: 'Round' },
  boardAmlak: { fa: 'صفحه املاک', bg: 'Amlak Board' }, boardMonopoly: { fa: 'صفحه مونوپولی', bg: 'Monopoly Board' },
  // Special squares (official Monopoly names); Tehran street / station names have no official English and stay Persian.
  goSq: { fa: 'شروع', bg: 'GO' }, taxSq: { fa: 'مالیات بر درآمد', bg: 'Income Tax' }, jailSq: { fa: 'زندان / ملاقات', bg: 'Jail / Just Visiting' },
  parkingSq: { fa: 'پارکینگ', bg: 'Free Parking' }, goToJailSq: { fa: 'برو به زندان', bg: 'Go to Jail' },
  electricSq: { fa: 'شرکت برق', bg: 'Electric Company' }, waterSq: { fa: 'شرکت آب', bg: 'Water Works' }
} satisfies Record<string, Term>;

const SPECIAL: Record<string, Term> = {
  'شروع': terms.goSq, 'صندوق': terms.chest, 'شانس': terms.chance, 'مالیات بر درآمد': terms.taxSq, 'زندان / ملاقات': terms.jailSq,
  'پارکینگ': terms.parkingSq, 'برو به زندان': terms.goToJailSq, 'شرکت برق': terms.electricSq, 'شرکت آب': terms.waterSq
};
/** Board square name in the current terms language (special squares have official English names). */
export const sqName = (nameFa: string): string => { const t = SPECIAL[nameFa]; return t ? tx(t) : nameFa; };
