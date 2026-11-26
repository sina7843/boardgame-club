import type { Term } from '@bg/ui';

/** Sushi Go terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  noteTempura: { fa: 'دوتا = ۵', bg: 'Pair = ۵' }, noteSashimi: { fa: 'سه‌تا = ۱۰', bg: 'Set of 3 = ۱۰' }, noteDumpling: { fa: '۱ ۳ ۶ ۱۰ ۱۵', bg: '۱ ۳ ۶ ۱۰ ۱۵' },
  noteMaki: { fa: 'رول بیشتر', bg: 'Most Rolls' }, noteSalmon: { fa: '۲', bg: '۲' }, noteSquid: { fa: '۳', bg: '۳' }, noteEgg: { fa: '۱', bg: '۱' },
  notePudding: { fa: 'آخر بازی', bg: 'End of game' }, noteWasabi: { fa: 'نیگیری ×۳', bg: 'Nigiri ×۳' }, noteChopsticks: { fa: 'بعداً دو کارت', bg: 'Take 2 Cards later' },
  rolls: { fa: 'رول', bg: 'Maki Rolls' }, round: { fa: 'دور', bg: 'Round' }, card: { fa: 'کارت', bg: 'Cards' }, inHand: { fa: 'در دست', bg: 'in Hand' }, inEachHand: { fa: 'در هر دست', bg: 'in each Hand' },
  pickFirst: { fa: 'کارت اول را انتخاب کنید', bg: 'pick the first Card' }, pickSecond: { fa: 'و کارت دوم…', bg: 'and the second Card…' }, pickPlate: { fa: 'یک بشقاب بردارید', bg: 'Pick a Card' },
  railPass: { fa: 'هم‌زمان یک کارت برمی‌دارید و بقیهٔ دست را به نفر بعد می‌دهید.', bg: 'Everyone Picks a Card at the same time and passes the rest of the Hand to the next player.' },
  picked: { fa: 'برداشت', bg: 'Picked' }, yourPick: { fa: 'انتخاب شما:', bg: 'Your Pick:' }, takeTwo: { fa: 'دو کارت بردار', bg: 'take two Cards' },
  yourHand: { fa: 'دست شما', bg: 'Your Hand' }, handCards: { fa: 'کارت‌های دست', bg: 'Hand Cards' }, pickV: { fa: 'برداشتن', bg: 'Pick' },
  tempura: { fa: 'تمپورا', bg: 'Tempura' }, sashimi: { fa: 'ساشیمی', bg: 'Sashimi' }, dumpling: { fa: 'دامپلینگ', bg: 'Dumpling' },
  maki1: { fa: 'ماکی ۱', bg: 'Maki 1' }, maki2: { fa: 'ماکی ۲', bg: 'Maki 2' }, maki3: { fa: 'ماکی ۳', bg: 'Maki 3' },
  salmonNigiri: { fa: 'نیگیری سالمون', bg: 'Salmon Nigiri' }, squidNigiri: { fa: 'نیگیری ماهی مرکب', bg: 'Squid Nigiri' },
  eggNigiri: { fa: 'نیگیری تخم‌مرغ', bg: 'Egg Nigiri' }, nigiri: { fa: 'نیگیری', bg: 'Nigiri' },
  pudding: { fa: 'پودینگ', bg: 'Pudding' }, wasabi: { fa: 'واسابی', bg: 'Wasabi' }, chopsticks: { fa: 'چاپستیک', bg: 'Chopsticks' }
} satisfies Record<string, Term>;
