import type { Term } from '@bg/ui';
import { BEAN_INFO } from './rules.ts';

/** Bohnanza terms. `fa` = Persian words used today (bean names read from the rules table); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  coffee: { fa: BEAN_INFO.coffee.name, bg: 'Coffee' }, wax: { fa: BEAN_INFO.wax.name, bg: 'Wax' }, blue: { fa: BEAN_INFO.blue.name, bg: 'Blue' },
  chili: { fa: BEAN_INFO.chili.name, bg: 'Chili' }, stink: { fa: BEAN_INFO.stink.name, bg: 'Stink' }, green: { fa: BEAN_INFO.green.name, bg: 'Green' },
  soy: { fa: BEAN_INFO.soy.name, bg: 'Soy' }, blackeye: { fa: BEAN_INFO.blackeye.name, bg: 'Black-eyed' }, red: { fa: BEAN_INFO.red.name, bg: 'Red' },
  garden: { fa: BEAN_INFO.garden.name, bg: 'Garden' },
  harvest: { fa: 'برداشت', bg: 'Harvest' }, trade: { fa: 'معامله', bg: 'Trade' }
} satisfies Record<string, Term>;
