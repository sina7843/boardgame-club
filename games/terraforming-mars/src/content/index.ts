// Content registry: every card and corporation of the base game. Each chunk file owns a disjoint set of official
// card numbers (see the header of each file); this file only concatenates them and checks ids are unique.
import type { CardDef } from '../api.ts';
import { corporations } from './corporations.ts';
import { examples } from './examples.ts';
import { set1 } from './set1.ts';
import { set2 } from './set2.ts';
import { set3 } from './set3.ts';
import { set4 } from './set4.ts';
import { set5 } from './set5.ts';
import { set6 } from './set6.ts';

export const CARDS: CardDef[] = [...corporations, ...examples, ...set1, ...set2, ...set3, ...set4, ...set5, ...set6];
export const CARD: Record<string, CardDef> = {};
for (const c of CARDS) {
  if (CARD[c.id]) throw new Error(`duplicate terraforming-mars card ${c.id}`);
  CARD[c.id] = c;
}
