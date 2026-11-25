import type { Term } from '@bg/ui';

/** Ticket to Ride terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  route: { fa: 'مسیر', bg: 'Route' }, locomotive: { fa: 'لوکوموتیو', bg: 'Locomotive' },
  ticket: { fa: 'بلیت', bg: 'Ticket' }, tickets: { fa: 'بلیت‌ها', bg: 'Tickets' }, ticketsOf: { fa: 'بلیت‌های', bg: 'Tickets' },
  destinationTicket: { fa: 'بلیت مقصد', bg: 'Destination ticket' }, destinationTickets: { fa: 'بلیت‌های مقصد', bg: 'Destination tickets' },
  longestRoute: { fa: 'طولانی‌ترین', bg: 'Longest Route' }, longest: { fa: 'بلندترین', bg: 'Longest' }
} satisfies Record<string, Term>;
