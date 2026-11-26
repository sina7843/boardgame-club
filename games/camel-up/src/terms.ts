import type { Term } from '@bg/ui';

/** Camel Up terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  pyramid: { fa: 'هرم', bg: 'Pyramid' }, desertTile: { fa: 'کاشی بیابان', bg: 'Desert Tile' },
  oasis: { fa: 'واحه', bg: 'Oasis' }, mirage: { fa: 'سراب', bg: 'Mirage' },
  legBet: { fa: 'شرط مرحله', bg: 'Leg Bet' }, overallBet: { fa: 'شرط نهایی', bg: 'Overall Bet' },
  overallBets: { fa: 'شرط‌های نهایی', bg: 'Overall Bets' },
  overallWinnerBet: { fa: 'شرط برندهٔ نهایی', bg: 'Overall Winner Bet' }, overallLoserBet: { fa: 'شرط بازندهٔ نهایی', bg: 'Overall Loser Bet' },
  bet: { fa: 'شرط', bg: 'Bet' }, winner: { fa: 'برنده', bg: 'Winner' }, loser: { fa: 'بازنده', bg: 'Loser' },
  leg: { fa: 'مرحله', bg: 'Leg' }, legEz: { fa: 'مرحلهٔ', bg: 'Leg' }, thisLeg: { fa: 'این مرحله', bg: 'This Leg' }, lastLeg: { fa: 'آخرین مرحله', bg: 'Last Leg' },
  die: { fa: 'تاس', bg: 'Die' }, lastDie: { fa: 'آخرین تاس', bg: 'Last Die' }, pyramidDie: { fa: 'تاس هرم', bg: 'Pyramid Die' },
  rollFromPyramid: { fa: 'تاس از هرم', bg: 'Roll from Pyramid' }, diceInPyramid: { fa: 'تاس در هرم', bg: 'Dice in Pyramid' },
  diceLeftInPyramid: { fa: 'تاس‌های مانده در هرم', bg: 'Dice left in Pyramid' },
  tile: { fa: 'کاشی', bg: 'Tile' }, camel: { fa: 'شتر', bg: 'Camel' }, camels: { fa: 'شترها', bg: 'Camels' }, camelsEz: { fa: 'شترهای', bg: 'Camels' }, camelCard: { fa: 'کارت شتر', bg: 'Camel Card' },
  track: { fa: 'مسیر مسابقه', bg: 'Race Track' }
} satisfies Record<string, Term>;
