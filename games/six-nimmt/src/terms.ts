import type { Term } from '@bg/ui';

/** 6 nimmt! terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  card: { fa: 'کارت', bg: 'Card' }, bull: { fa: 'گاو', bg: 'Bull heads' }, row: { fa: 'ردیف', bg: 'Row' }, rows: { fa: 'ردیف‌ها', bg: 'Rows' },
  take: { fa: 'برداشتن', bg: 'Take' }, round: { fa: 'دست', bg: 'Round' }, oneRound: { fa: 'یک دست', bg: 'One Round' },
  yourHand: { fa: 'دست شما', bg: 'Your Hand' }, revealedCards: { fa: 'کارت‌های رو شده این نوبت', bg: 'Cards revealed this turn' },
  lowRest: { fa: 'از همه ردیف‌ها کوچک‌تر است: یک ردیف را بردارید', bg: 'is lower than every Row: Take a Row' },
  pickCard: { fa: 'یک کارت انتخاب کنید (مخفی می‌ماند تا همه انتخاب کنند)', bg: 'Pick a Card (it stays hidden until everyone has picked)' },
  rowTakes: { fa: 'ردیف برمی‌دارد', bg: 'takes a Row' }, tookBulls: { fa: 'گاو برداشت', bg: 'Bull heads taken' },
  railA: { fa: 'هر کارت پشت ردیفی می‌نشیند که آخرش بزرگ‌ترین عدد کوچک‌تر از آن است. کسی که کارت ششم ردیف را بگذارد، آن ردیف را برمی‌دارد؛', bg: 'Each Card goes after the Row whose last Card is the highest number lower than it. Whoever places the sixth Card in a Row takes that Row;' },
  railOne: { fa: 'گاو کمتر برنده است', bg: 'fewest Bull heads wins' }, railLimit: { fa: 'اولین نفری که به ۶۶ گاو برسد بازی را می‌بازد', bg: 'the first player to reach 66 Bull heads loses' }
} satisfies Record<string, Term>;
