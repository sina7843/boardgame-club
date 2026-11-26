import type { Term } from '@bg/ui';

/** The Crew terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  taskPl: { fa: 'وظیفه‌ها', bg: 'Tasks' }, tasksShared: { fa: 'وظایف', bg: 'Tasks' }, crew: { fa: 'خدمه', bg: 'Crew' },
  trick: { fa: 'دست', bg: 'Trick' }, tricks: { fa: 'دست', bg: 'Tricks' }, currentTrick: { fa: 'دست جاری', bg: 'Current Trick' },
  rocket: { fa: 'موشک', bg: 'Rocket' }, card: { fa: 'کارت', bg: 'Cards' }, yourHand: { fa: 'دست شما', bg: 'Your Hand' },
  comm: { fa: 'ارتباط', bg: 'Communication' }, commOnce: { fa: 'ارتباط (یک بار)', bg: 'Communication (once)' }, commCancel: { fa: 'لغو ارتباط', bg: 'Cancel Communication' },
  commUsed: { fa: 'ارتباط بازی شد', bg: 'Communication used' }, commAvail: { fa: 'ارتباط در دسترس', bg: 'Communication available' },
  commShow: { fa: 'نشان دادن', bg: 'Communicate' }, play: { fa: 'بازی', bg: 'Play' },
  highest: { fa: 'بالاترین', bg: 'Highest' }, lowest: { fa: 'پایین‌ترین', bg: 'Lowest' }, only: { fa: 'تنها', bg: 'Only' },
  order: { fa: 'ترتیب', bg: 'Order' }, unassigned: { fa: 'بی‌صاحب', bg: 'Unassigned' }, difficulty: { fa: 'سختی', bg: 'Difficulty' },
  done: { fa: 'انجام شد', bg: 'Done' }, failed: { fa: 'شکست', bg: 'Failed' }, open: { fa: 'باز', bg: 'Open' },
  pickComm: { fa: 'کارتی را که می‌خواهید نشان دهید انتخاب کنید', bg: 'Pick the Card you want to communicate' },
  followSuit: { fa: 'از خال اول پیروی کنید', bg: 'Follow suit' }, leadTrick: { fa: 'دست را شروع کنید', bg: 'Lead the Trick' },
  railA: { fa: 'باید به دست صاحبش برده شود و همهٔ', bg: 'must be won by its owner in a Trick, and the whole' },
  railB: { fa: 'با هم می‌برند یا می‌بازند. دربارهٔ کارت‌هایتان حرف نزنید؛ فقط یک بار می‌توانید یک کارت را نشان دهید.', bg: 'win or lose together. Do not talk about your Cards; you may Communicate one Card, once.' },
  lastTrickA: { fa: 'دست قبل را', bg: 'Last Trick:' }, lastTrickB: { fa: ' برد:', bg: ' took it' }, wonLast: { fa: 'دست قبل را برد', bg: 'Won the last Trick' },
  dealt: { fa: ' پخش می‌شوند', bg: ' are dealt first' }, startsFirst: { fa: 'دست اول را شروع می‌کند', bg: 'leads the first Trick' },
  firstHead: { fa: 'اول', bg: 'First,' }, setAside: { fa: 'کنار گذاشته:', bg: 'Set aside:' }, taskTurn: { fa: 'برمی‌دارد', bg: 'picks' },
  task: { fa: 'وظیفه', bg: 'Task' }, commander: { fa: 'فرمانده', bg: 'Commander' }
} satisfies Record<string, Term>;
