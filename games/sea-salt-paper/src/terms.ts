import type { Term } from '@bg/ui';

/** Sea Salt & Paper terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  deck: { fa: 'دسته', bg: 'Deck' }, pile: { fa: 'کپه', bg: 'Discard Pile' }, pileEz: { fa: 'کپهٔ', bg: 'Discard Pile' },
  card: { fa: 'کارت', bg: 'Cards' }, empty: { fa: 'خالی', bg: 'Empty' }, round: { fa: 'دست', bg: 'Round' }, roundShared: { fa: 'دور', bg: 'Round' },
  yourHand: { fa: 'دست شما', bg: 'Your Hand' }, handEmpty: { fa: 'دستتان خالی است', bg: 'Your Hand is empty' },
  cardsInHand: { fa: 'کارت در دست', bg: 'Cards in Hand' }, played: { fa: 'بازی‌شده', bg: 'Played' }, roundPoints: { fa: 'امتیاز این دست:', bg: 'Points this Round:' },
  lastChanceEz: { fa: 'آخرین فرصتِ', bg: 'Last Chance by' }, extraTurn: { fa: 'نوبت اضافه', bg: 'Extra Turn' },
  drawPromptLast: { fa: 'دو کارت از دسته یا کارت یک کپه', bg: 'Draw two Cards from the Deck or take a Card from a Discard Pile' },
  drawPrompt: { fa: 'دو کارت از دسته یا کارت روی یک کپه', bg: 'Draw two Cards from the Deck or take a Card from a Discard Pile' },
  choosePrompt: { fa: 'یکی را نگه دارید و دیگری را روی یک کپه بگذارید', bg: 'Keep one and Discard the other onto a Discard Pile' },
  crabPrompt: { fa: 'از کپه یک کارت بردارید', bg: 'Take a Card from a Discard Pile' },
  actPrompt: { fa: 'جفت‌ها را بازی کنید یا نوبت را تمام کنید', bg: 'Play your Duos or end your turn' },
  railIntro: { fa: 'اول دو کارت از دسته بکشید (یکی را نگه دارید) یا یک کارت از کپه بردارید؛ بعد جفت‌ها را بازی کنید.', bg: 'First Draw two Cards from the Deck (Keep one) or take a Card from a Discard Pile; then Play your Duos.' },
  playedDuos: { fa: 'جفت‌های بازی‌شده', bg: 'Played Duos' }, deckAndPiles: { fa: 'دسته و کپه‌ها', bg: 'Deck and Discard Piles' },
  tookFromPile: { fa: 'از کپه برداشت', bg: 'Took from a Discard Pile' },
  placeOn: { fa: 'گذاشتن روی کپهٔ', bg: 'Place on Discard Pile' }, takeFrom: { fa: 'برداشتن از کپهٔ', bg: 'Take from Discard Pile' },
  drawnCards: { fa: 'کارت‌های کشیده‌شده', bg: 'Drawn Cards' }, pileCards: { fa: 'کارت‌های کپه', bg: 'Discard Pile Cards' },
  whichKeep: { fa: 'کدام را نگه می‌دارید؟', bg: 'Which one do you Keep?' }, tapPile: { fa: 'حالا کپه را بزنید', bg: 'Now tap a Discard Pile' },
  crabsPile: { fa: 'خرچنگ‌ها: کپهٔ', bg: 'Crabs: Discard Pile' }, steal: { fa: 'دزدی از', bg: 'Steal from' }, play: { fa: 'بازی', bg: 'Play' },
  parenExtra: { fa: '(نوبت اضافه)', bg: '(Extra Turn)' }, parenDraw: { fa: '(یک کارت از دسته)', bg: '(Draw a Card)' },
  deckOut: { fa: 'دسته تمام شد', bg: 'Deck ran out' },
  drew2: { fa: 'دو کارت کشید', bg: 'Drew two Cards' }, kept1: { fa: 'یک کارت نگه داشت', bg: 'Kept a Card' }, playedDuo: { fa: 'جفت بازی کرد', bg: 'Played a Duo' }, calledStop: { fa: 'بس گفت', bg: 'Called Stop' },
  duo: { fa: 'جفت', bg: 'Duo' }, duos: { fa: 'جفت‌ها', bg: 'Duos' }, stop: { fa: 'بس', bg: 'Stop' }, lastChance: { fa: 'آخرین فرصت', bg: 'Last Chance' },
  crab: { fa: 'خرچنگ', bg: 'Crab' }, boat: { fa: 'قایق', bg: 'Boat' }, fish: { fa: 'ماهی', bg: 'Fish' },
  swimmer: { fa: 'شناگر', bg: 'Swimmer' }, shark: { fa: 'کوسه', bg: 'Shark' }, shell: { fa: 'صدف', bg: 'Shell' },
  octopus: { fa: 'هشت‌پا', bg: 'Octopus' }, penguin: { fa: 'پنگوئن', bg: 'Penguin' }, sailor: { fa: 'ملوان', bg: 'Sailor' },
  lighthouse: { fa: 'فانوس', bg: 'Lighthouse' }, shoal: { fa: 'دسته‌ماهی', bg: 'Shoal of Fish' },
  colony: { fa: 'کلونی', bg: 'Penguin Colony' }, captain: { fa: 'ناخدا', bg: 'Captain' }, mermaid: { fa: 'پری دریایی', bg: 'Mermaid' }
} satisfies Record<string, Term>;
