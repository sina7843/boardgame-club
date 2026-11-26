import type { Term } from '@bg/ui';

/** The Crew terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  task: { fa: 'وظیفه', bg: 'Task' }, commander: { fa: 'فرمانده', bg: 'Commander' }
} satisfies Record<string, Term>;
