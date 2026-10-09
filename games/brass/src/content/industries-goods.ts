// Chunk "industries-goods": the player-mat tiles of the three goods industries sold to merchants — Cotton Mill (4
// levels), Manufacturer (8 levels) and Pottery (5 levels). Owner: industries-goods agent.
import type { ContentChunk } from '../types.ts';

export const industriesGoods: ContentChunk = {
  tiles: [
    { industry: 'cotton', level: 1, count: 3, cost: 12, coal: 0, iron: 0, beer: 1, produce: 0, vp: 5, income: 5, linkVp: 1, era: 'canal' },
    { industry: 'cotton', level: 2, count: 2, cost: 14, coal: 1, iron: 0, beer: 1, produce: 0, vp: 5, income: 4, linkVp: 2 },
    { industry: 'cotton', level: 3, count: 3, cost: 16, coal: 1, iron: 1, beer: 1, produce: 0, vp: 9, income: 3, linkVp: 1 },
    { industry: 'cotton', level: 4, count: 3, cost: 18, coal: 1, iron: 1, beer: 1, produce: 0, vp: 12, income: 2, linkVp: 1 },
    { industry: 'pottery', level: 1, count: 1, cost: 17, coal: 0, iron: 1, beer: 1, produce: 0, vp: 10, income: 5, linkVp: 1, noDevelop: true },
    { industry: 'pottery', level: 2, count: 1, cost: 0, coal: 1, iron: 0, beer: 1, produce: 0, vp: 1, income: 1, linkVp: 1 },
    { industry: 'pottery', level: 3, count: 1, cost: 22, coal: 2, iron: 0, beer: 2, produce: 0, vp: 11, income: 5, linkVp: 1, noDevelop: true },
    { industry: 'pottery', level: 4, count: 1, cost: 0, coal: 1, iron: 0, beer: 1, produce: 0, vp: 1, income: 1, linkVp: 1 },
    { industry: 'pottery', level: 5, count: 1, cost: 24, coal: 2, iron: 0, beer: 2, produce: 0, vp: 20, income: 5, linkVp: 1, era: 'rail' },
    { industry: 'manufacturer', level: 1, count: 1, cost: 8, coal: 1, iron: 0, beer: 1, produce: 0, vp: 3, income: 5, linkVp: 2, era: 'canal' },
    { industry: 'manufacturer', level: 2, count: 2, cost: 10, coal: 0, iron: 1, beer: 1, produce: 0, vp: 5, income: 1, linkVp: 1 },
    { industry: 'manufacturer', level: 3, count: 1, cost: 12, coal: 2, iron: 0, beer: 0, produce: 0, vp: 4, income: 4, linkVp: 0 },
    { industry: 'manufacturer', level: 4, count: 1, cost: 8, coal: 0, iron: 1, beer: 1, produce: 0, vp: 3, income: 6, linkVp: 1 },
    { industry: 'manufacturer', level: 5, count: 2, cost: 16, coal: 1, iron: 0, beer: 2, produce: 0, vp: 8, income: 2, linkVp: 2 },
    { industry: 'manufacturer', level: 6, count: 1, cost: 20, coal: 0, iron: 0, beer: 1, produce: 0, vp: 7, income: 6, linkVp: 1 },
    { industry: 'manufacturer', level: 7, count: 1, cost: 16, coal: 1, iron: 1, beer: 0, produce: 0, vp: 9, income: 4, linkVp: 0 },
    { industry: 'manufacturer', level: 8, count: 2, cost: 20, coal: 0, iron: 2, beer: 1, produce: 0, vp: 11, income: 1, linkVp: 1 }
  ]
};
