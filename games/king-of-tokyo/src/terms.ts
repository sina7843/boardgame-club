import type { Term } from '@bg/ui';

/** King of Tokyo terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Monster and power-card names: see MONSTER_EN / POWER_EN (Persian names live in the rules data). */
export const terms = {
  energy: { fa: 'انرژی', bg: 'Energy' }, claw: { fa: 'چنگ', bg: 'Claw' }, heart: { fa: 'قلب', bg: 'Heart' },
  powerCards: { fa: 'کارت‌های قدرت', bg: 'Power Cards' }, keepCards: { fa: 'کارت‌های نگه‌داشته', bg: 'Keep Cards' },
  health: { fa: 'جان', bg: 'Health' }, damage: { fa: 'آسیب', bg: 'Damage' }, hit: { fa: 'ضربه', bg: 'Damage' },
  tokyo: { fa: 'شهر', bg: 'Tokyo' }, inTokyo: { fa: 'در توکیو', bg: 'In Tokyo' }, monster: { fa: 'غول', bg: 'Monster' },
  die: { fa: 'تاس', bg: 'Die' }, dice: { fa: 'تاس‌ها', bg: 'Dice' }, diceYi: { fa: 'تاس‌های', bg: 'Dice' }, rollImp: { fa: 'بریزید', bg: 'Roll' },
  roll: { fa: 'بریز', bg: 'Roll' }, rollAgain: { fa: 'دوباره بریز', bg: 'Roll again' }, keepImp: { fa: 'نگه دارید', bg: 'Keep' }, resolve: { fa: 'همین‌ها', bg: 'Resolve' },
  stay: { fa: 'می‌مانم', bg: 'Stay' }, leave: { fa: 'از شهر بیرون می‌روم', bg: 'Leave Tokyo' },
  sweep: { fa: 'کارت‌های تازه', bg: 'Sweep' }, endTurn: { fa: 'پایان نوبت', bg: 'End turn' }, deck: { fa: 'دسته', bg: 'Deck' }, deckCard: { fa: 'دستهٔ کارت', bg: 'Deck' },
  monsterBoards: { fa: 'صفحه‌های غول', bg: 'Monster boards' }, rolled: { fa: 'تاس ریخت', bg: 'rolled' }
} satisfies Record<string, Term>;

/** English monster names by seat order. */
export const MONSTER_EN = ['Dragon', 'Robot', 'Gorilla', 'Sea Monster', 'Alien', 'Dinosaur'];

/** English power-card names by card id (same order as POWERS in the rules). */
export const POWER_EN = [
  'Power Plant', 'First Aid Kit', 'Jet Fighters', 'Apartment Building', 'Commuter Train', 'Corner Store', 'Skyscraper', 'Gas Refinery',
  'Nuclear Power Plant', 'Tank', 'Evacuation Orders', 'Flame Thrower', 'National Guard', 'Armor Plating', 'Acid Attack', 'Regeneration',
  'Friend of Children', 'Even Bigger', 'Herbivore', 'Urbavore', 'Alpha Monster', 'Solar Powered', 'Underdog'
];
