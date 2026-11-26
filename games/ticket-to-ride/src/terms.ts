import type { Term } from '@bg/ui';

/** Ticket to Ride terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  route: { fa: 'مسیر', bg: 'Route' }, routes: { fa: 'مسیرها', bg: 'Routes' }, routesHis: { fa: 'مسیرهایش', bg: 'Routes' },
  doubleRoute: { fa: 'مسیر دوتایی', bg: 'Double Route' }, locomotive: { fa: 'لوکوموتیو', bg: 'Locomotive' },
  ticket: { fa: 'بلیت', bg: 'Ticket' }, tickets: { fa: 'بلیت‌ها', bg: 'Tickets' }, ticketsOf: { fa: 'بلیت‌های', bg: 'Tickets' },
  destinationTicket: { fa: 'بلیت مقصد', bg: 'Destination ticket' }, destinationTickets: { fa: 'بلیت‌های مقصد', bg: 'Destination tickets' },
  longestRoute: { fa: 'طولانی‌ترین', bg: 'Longest Route' }, longest: { fa: 'بلندترین', bg: 'Longest' },
  card: { fa: 'کارت', bg: 'Card' }, cardI: { fa: 'کارتی', bg: 'a Card' }, cardsOf: { fa: 'کارت‌های', bg: 'Cards' },
  faceUp: { fa: 'رو', bg: 'face-up' }, deck: { fa: 'دسته', bg: 'Deck' }, closedDeck: { fa: 'دسته بسته', bg: 'Deck' },
  wagon: { fa: 'واگن', bg: 'Train Cars' }, wagons: { fa: 'واگن‌ها', bg: 'Train Cars' }, wagonsOf: { fa: 'واگن‌های', bg: 'Train Cars' },
  pts: { fa: 'امتیاز', bg: 'Points' }, finalScore: { fa: 'امتیاز پایانی', bg: 'Final Score' }, finalRound: { fa: 'دور پایانی', bg: 'Final Round' }, total: { fa: 'جمع', bg: 'Total' },
  claimed: { fa: 'ساخت', bg: 'Claimed' }, claimV: { fa: 'بسازید', bg: 'Claim' }, claimN: { fa: 'ساخت', bg: 'Claim' }, claimable: { fa: 'قابل ساخت', bg: 'Claimable' },
  drawV: { fa: 'بکشید', bg: 'Draw' }, drawN: { fa: 'کشیدن', bg: 'Draw' }, takeN: { fa: 'برداشتن', bg: 'Take' },
  keepV: { fa: 'نگه دارید', bg: 'Keep' }, keepN: { fa: 'نگه داشتن', bg: 'Keep' }, payN: { fa: 'پرداخت', bg: 'Pay' }, passTurn: { fa: 'گذشتن از نوبت', bg: 'Pass' },
  // Sent by the server (rules.ts publicSummary): seat-card and shared labels.
  trains: { fa: 'قطار', bg: 'Trains' }, quest: { fa: 'مأموریت', bg: 'Tickets' }, quests: { fa: 'مأموریت‌ها', bg: 'Tickets' }
} satisfies Record<string, Term>;
