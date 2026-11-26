import type { Term } from '@bg/ui';

/** The Mind terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  shuriken: { fa: 'ستاره', bg: 'Shuriken' }, card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت', bg: 'Cards' },
  levelEz: { fa: 'مرحلهٔ', bg: 'Level' }, started: { fa: 'شروع شد', bg: 'started' },
  playPrompt: { fa: 'وقتی حس کردید نوبت کارت شماست، بگذارید', bg: 'Play your Card when you feel it is your turn' },
  outOfCards: { fa: 'کارت‌هایتان تمام شد؛ منتظر هم‌تیمی‌ها', bg: 'You are out of Cards; waiting for your teammates' },
  rail: { fa: 'بدون حرف زدن، کارت‌ها را به ترتیب صعودی روی میز بگذارید؛ هر کس وقتی حس کرد نوبت کارت کوچک‌ترش است.', bg: 'Without talking, Play the Cards on the table in ascending order; each player plays when they feel it is the turn of their lowest Card.' },
  playedCards: { fa: 'کارت‌های زمین', bg: 'Played Cards' }, noCardYet: { fa: 'هنوز کارتی زمین نیامده', bg: 'No Card has been played yet' },
  mistake: { fa: 'اشتباه!', bg: 'Mistake!' }, mistakeRest: { fa: 'را گذاشت؛ یک جان از دست رفت. کنار رفت:', bg: 'played it; a Life was lost. Discarded:' },
  shurikenThrown: { fa: 'ستاره پرتاب شد:', bg: 'Shuriken thrown:' },
  mistakeMove: { fa: 'اشتباه کرد؛ یک جان رفت', bg: 'Made a Mistake; lost a Life' }, shurikenMove: { fa: 'ستاره پرتاب شد', bg: 'Shuriken thrown' }, newLevelMove: { fa: 'مرحلهٔ تازه شروع شد', bg: 'New Level started' },
  teammates: { fa: 'هم‌تیمی‌ها', bg: 'Teammates' }, agreeStar: { fa: 'موافق ستاره', bg: 'Agrees to Shuriken' },
  yourCards: { fa: 'کارت‌های شما', bg: 'Your Cards' }, noCards: { fa: 'کارتی ندارید', bg: 'You have no Cards' }, play: { fa: 'بگذار', bg: 'Play' },
  agreeToo: { fa: 'من هم موافقم', bg: 'I agree too' }, proposeStar: { fa: 'پیشنهاد ستاره پرتابی', bg: 'Propose a Shuriken' }, withdraw: { fa: 'پس گرفتن موافقت', bg: 'Withdraw agreement' },
  level: { fa: 'مرحله', bg: 'Level' }, life: { fa: 'جان', bg: 'Life' }
} satisfies Record<string, Term>;
