import type { Term } from '@bg/ui';

/** Century: Spice Road terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  caravan: { fa: 'کاروان', bg: 'Caravan' }, caravans: { fa: 'کاروان‌ها', bg: 'Caravans' },
  merchant: { fa: 'تاجر', bg: 'Merchant' }, merchants: { fa: 'تاجرها', bg: 'Merchants' },
  upgrade: { fa: 'ارتقا', bg: 'Upgrade' }, trade: { fa: 'معاوضه', bg: 'Trade' }, rest: { fa: 'استراحت', bg: 'Rest' },
  spice: { fa: 'ادویه', bg: 'Spice' }, spiceEz: { fa: 'ادویهٔ', bg: 'Spice' },
  turmeric: { fa: 'زردچوبه', bg: 'Turmeric' }, saffron: { fa: 'زعفران', bg: 'Saffron' }, cardamom: { fa: 'هل', bg: 'Cardamom' }, cinnamon: { fa: 'دارچین', bg: 'Cinnamon' },
  order: { fa: 'سفارش', bg: 'Order' }, orders: { fa: 'سفارش‌ها', bg: 'Orders' }, deliveredOrders: { fa: 'سفارش‌های تحویل‌شده', bg: 'Delivered orders' },
  deliver: { fa: 'تحویل', bg: 'Deliver' }, deliverImp: { fa: 'تحویل دهید', bg: 'Deliver' },
  card: { fa: 'کارت', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, hand: { fa: 'دست', bg: 'Hand' }, played: { fa: 'بازی‌شده', bg: 'Played' },
  playImp: { fa: 'بازی کنید', bg: 'Play' }, hire: { fa: 'استخدام', bg: 'Hire' },
  gold: { fa: 'طلا', bg: 'Gold' }, silver: { fa: 'نقره', bg: 'Silver' }, deck: { fa: 'دسته', bg: 'Deck' },
  lastRound: { fa: 'دور آخر', bg: 'Final round' }, discardV: { fa: 'کنار گذاشتن', bg: 'Discard' }, discardImp: { fa: 'کنار بگذارید', bg: 'Discard' }
} satisfies Record<string, Term>;
