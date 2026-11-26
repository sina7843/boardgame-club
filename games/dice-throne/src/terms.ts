import type { Term } from '@bg/ui';

/** Dice Throne terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Hero and ability names are original and come from the rules data. */
export const terms = {
  combatPoints: { fa: 'امتیاز رزم', bg: 'Combat Points' }, cp: { fa: 'نیرو', bg: 'CP' }, stun: { fa: 'گیجی', bg: 'Stun' }, stunHud: { fa: 'گیج', bg: 'Stun' },
  shield: { fa: 'سپر', bg: 'Shield' }, undefendable: { fa: 'دفاع‌ناپذیر', bg: 'Undefendable' }, defense: { fa: 'دفاع', bg: 'Defense' },
  damage: { fa: 'آسیب', bg: 'Damage' }, health: { fa: 'جان', bg: 'Health' }, healthHud: { fa: 'سلامت', bg: 'Health' }, wound: { fa: 'زخم', bg: 'Wound' },
  steal: { fa: 'دزدی', bg: 'Steal' }, ability: { fa: 'توانایی', bg: 'Ability' }, combo: { fa: 'ترکیب', bg: 'Combo' },
  die: { fa: 'تاس', bg: 'Die' }, dice: { fa: 'تاس‌ها', bg: 'Dice' }, diceYi: { fa: 'تاس‌هایی', bg: 'Dice' },
  roll: { fa: 'ریختن', bg: 'Roll' }, rollImp: { fa: 'بریزید', bg: 'Roll' }, rollDice: { fa: 'ریختن تاس‌ها', bg: 'Roll dice' },
  rollAgain: { fa: 'ریختن دوباره', bg: 'Roll again' }, extraRoll: { fa: 'ریختن اضافه', bg: 'Extra roll' },
  largeStraight: { fa: 'ردیف بلند', bg: 'Large straight' }, smallStraight: { fa: 'ردیف کوتاه', bg: 'Small straight' },
  hero: { fa: 'قهرمان', bg: 'Hero' }, heroes: { fa: 'قهرمان‌ها', bg: 'Heroes' }, heroYour: { fa: 'قهرمانتان', bg: 'hero' },
  attack: { fa: 'حمله', bg: 'Attack' }, board: { fa: 'صفحهٔ', bg: 'Board' }, statusTokens: { fa: 'نشانه‌های وضعیت', bg: 'Status tokens' }, keepImp: { fa: 'نگه دارید', bg: 'Keep' }
} satisfies Record<string, Term>;
