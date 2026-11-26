import type { Term } from '@bg/ui';

/** Cryptid terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Terrain, animals and colours stay Persian. */
export const terms = {
  clue: { fa: 'سرنخ', bg: 'Clue' }, cube: { fa: 'مکعب', bg: 'Cube' }, disc: { fa: 'دیسک', bg: 'Disc' },
  territory: { fa: 'قلمرو', bg: 'Territory' }, standingStone: { fa: 'سنگ ایستاده', bg: 'Standing Stone' },
  abandonedShack: { fa: 'کلبهٔ متروک', bg: 'Abandoned Shack' }
} satisfies Record<string, Term>;
