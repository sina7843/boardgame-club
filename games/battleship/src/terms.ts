import type { Term } from '@bg/ui';

/** Battleship terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  carrier: { fa: 'ناو هواپیمابر', bg: 'Carrier' }, battleship: { fa: 'رزمناو', bg: 'Battleship' },
  cruiser: { fa: 'ناوشکن', bg: 'Cruiser' }, submarine: { fa: 'زیردریایی', bg: 'Submarine' }, patrol: { fa: 'قایق گشتی', bg: 'Destroyer' },
  hit: { fa: 'اصابت', bg: 'Hit' }, miss: { fa: 'آب', bg: 'Miss' }, sunk: { fa: 'غرق', bg: 'Sunk' },
  sunkLabel: { fa: 'غرق‌شده', bg: 'Sunk' }, afloatLabel: { fa: 'ناو شناور', bg: 'Ships Afloat' }, afloat: { fa: 'کشتی شناور', bg: 'Ships Afloat' },
  fleet: { fa: 'ناوگان', bg: 'Fleet' }, fleets: { fa: 'ناوگان‌ها', bg: 'Fleets' },
  placeAt: { fa: 'گذاشتن در', bg: 'Place at' }, fireAt: { fa: 'شلیک به', bg: 'Fire at' }
} satisfies Record<string, Term>;

export const shipTerm: Record<string, Term> = { carrier: terms.carrier, battleship: terms.battleship, cruiser: terms.cruiser, submarine: terms.submarine, patrol: terms.patrol };
