// Content registry: every chunk of the base game. Each chunk file owns a disjoint set of ids (see its header);
// core.registerContent (called by rules.ts) merges them and throws on duplicates.
import type { ContentChunk } from '../types.ts';
import { abilities } from './abilities.ts';
import { animals } from './animals.ts';
import { examples } from './examples.ts';
import { maps } from './maps.ts';
import { sponsorsA } from './sponsors-a.ts';
import { sponsorsB } from './sponsors-b.ts';

export const CONTENT: ContentChunk[] = [examples, abilities, sponsorsA, sponsorsB, maps, animals];
