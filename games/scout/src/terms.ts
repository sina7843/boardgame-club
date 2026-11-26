import type { Term } from '@bg/ui';

/** Scout terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  scout: { fa: 'دیدبانی', bg: 'Scout' }, show: { fa: 'نمایش', bg: 'Show' },
  scoutAndShow: { fa: 'دیدبانی و نمایش', bg: 'Scout & Show' },
  ssLeft: { fa: 'دیدبانی و نمایش هنوز مانده', bg: 'Scout & Show still available' }, ssShort: { fa: 'د+ن', bg: 'S&S' },
  centerShow: { fa: 'نمایش وسط', bg: 'Center Show' }, scoutFirst: { fa: 'دیدبانی کارت اول', bg: 'Scout first Card' }, scoutLast: { fa: 'دیدبانی کارت آخر', bg: 'Scout last Card' },
  scoutedCard: { fa: 'کارت دیدبانی‌شده', bg: 'Scouted Card' }, flipIt: { fa: 'وارونه‌اش کنید', bg: 'Flip it' },
  back: { fa: 'پشت', bg: 'Back' },
  card: { fa: 'کارت', bg: 'Card' }, cardI: { fa: 'کارتی', bg: 'Card' }, cards: { fa: 'کارت', bg: 'Cards' },
  hand: { fa: 'دست', bg: 'Hand' }, handCards: { fa: 'کارت‌های دست', bg: 'Hand Cards' }, yourHand: { fa: 'دست شما', bg: 'Your Hand' },
  round: { fa: 'دست', bg: 'Round' }, roundShared: { fa: 'دور', bg: 'Round' },
  captured: { fa: 'برده', bg: 'Captured' }, chips: { fa: 'ژتون', bg: 'Chips' },
  orientQ: { fa: 'دستتان را همین‌طور نگه می‌دارید یا برمی‌گردانید؟', bg: 'Keep your Hand as is, or Flip it?' },
  orientWait: { fa: 'منتظر انتخاب جهت دست بقیه', bg: 'Waiting for the others to pick their Hand orientation' },
  tapSpot: { fa: 'جای کارت را در دستتان بزنید', bg: 'Tap where the Card goes in your Hand' },
  emptyRing: { fa: 'حلقه خالی است: هر نمایشی قبول است', bg: 'The ring is empty: any Show is allowed' },
  flipCard: { fa: 'برگرداندن کارت ⇅', bg: 'Flip Card ⇅' }, flipHand: { fa: 'برگرداندن دست', bg: 'Flip Hand' },
  keep: { fa: 'همین‌طور', bg: 'Keep' }, flipped: { fa: 'برگردانده', bg: 'Flipped' },
  placeBefore: { fa: 'گذاشتن قبل از کارت', bg: 'Insert before Card' }, placeLast: { fa: 'گذاشتن در آخر', bg: 'Insert at end' }
} satisfies Record<string, Term>;
