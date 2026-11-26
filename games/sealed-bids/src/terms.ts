import type { Term } from '@bg/ui';

/** Sealed Bids terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  round: { fa: 'دور', bg: 'Round' }, bid: { fa: 'پیشنهاد', bg: 'Bid' }, chip: { fa: 'ژتون', bg: 'Chip' }, seal: { fa: 'مهر', bg: 'Seal' },
  prize: { fa: 'جایزه', bg: 'Prize' }, prizes5: { fa: 'جایزهٔ پنج دور', bg: 'Prizes of the five Rounds' },
  revealed: { fa: 'آشکار شد', bg: 'Revealed' }, revealedRounds: { fa: 'دورهای آشکارشده', bg: 'Revealed Rounds' }, revealedBids: { fa: 'پیشنهادهای آشکارشده', bg: 'Revealed Bids' },
  tieNoPoints: { fa: 'تساوی؛ امتیازی داده نشد.', bg: 'Tie; no points awarded.' }, tie: { fa: 'تساوی', bg: 'Tie' }, tieShort: { fa: 'مساوی', bg: 'Tie' },
  placeBid: { fa: 'پیشنهاد پنهان خود را ثبت کنید', bg: 'Place your hidden Bid' },
  bidSealed: { fa: 'پیشنهاد شما مهر شد؛ منتظر', bg: 'Your Bid is sealed; waiting for' },
  now: { fa: 'الان', bg: 'Now' }, next: { fa: 'بعدی', bg: 'Next' }, bidStatus: { fa: 'وضعیت ثبت پیشنهاد', bg: 'Bid status' },
  sealedMark: { fa: '✓ مهر شد', bg: '✓ Sealed' }, waitingMark: { fa: '… در انتظار', bg: '… Waiting' },
  scoreAndBidStatus: { fa: 'امتیاز و وضعیت ثبت پیشنهاد', bg: 'Score and Bid status' }, thisRound: { fa: 'این دور', bg: 'This Round' },
  yourHand: { fa: 'دست شما', bg: 'Your Hand' }, yourChips: { fa: 'ژتون‌های شما', bg: 'Your Chips' }, spent: { fa: '(مصرف‌شده)', bg: '(Spent)' },
  yourSealedBid: { fa: 'پیشنهاد مهرشده شما', bg: 'Your sealed Bid' }, tapChip: { fa: 'ژتون پیشنهادتان را بزنید تا مهر شود.', bg: 'Tap a Chip to Seal your Bid.' }
} satisfies Record<string, Term>;
