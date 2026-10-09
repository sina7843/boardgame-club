// Content registry: concatenates every content file into the engine registry (core.CONTENT). Imported once by
// rules.ts before any game is set up. Each chunk file owns its own export; ids must be unique across files.
import { registerContent } from '../core.ts';
import { base } from './base.ts';
import { factionsA } from './factions-a.ts';
import { factionsB } from './factions-b.ts';
import { factionsC } from './factions-c.ts';
import { techs } from './techs.ts';

export const ALL_CONTENT = [base, factionsA, factionsB, factionsC, techs];
registerContent(...ALL_CONTENT);
