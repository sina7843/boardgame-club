// Content registry: concatenates every chunk. Order is stable (it defines card ids and location order), so chunks are
// only ever appended, never reordered. The architect owns this file; chunk agents edit only their own chunk.
import type { ContentChunk } from '../types.ts';
import { townsNorth } from './towns-north.ts';
import { townsSouth } from './towns-south.ts';
import { linksMerchants } from './links-merchants.ts';
import { industriesGoods } from './industries-goods.ts';
import { industriesResources } from './industries-resources.ts';

export const CHUNKS: readonly ContentChunk[] = [townsNorth, townsSouth, linksMerchants, industriesGoods, industriesResources];

export const LOCATIONS = CHUNKS.flatMap((c) => c.locations ?? []);
export const MERCHANT_TILES = CHUNKS.flatMap((c) => c.merchantTiles ?? []);
export const TILES = CHUNKS.flatMap((c) => c.tiles ?? []);
export const INDUSTRY_CARDS = CHUNKS.flatMap((c) => c.industryCards ?? []);
const known = new Set(LOCATIONS.map((l) => l.id));
/** Links whose every location is declared (a link to a location of a chunk that has not landed yet is skipped). */
export const LINKS = CHUNKS.flatMap((c) => c.links ?? []).filter((l) => [l.a, l.b, ...(l.also ?? [])].every((x) => known.has(x)));
