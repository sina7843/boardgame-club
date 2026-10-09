// Chunk "industries-resources": the player-mat tiles of the resource industries — Coal Mine (4 levels), Iron Works
// (4 levels), Brewery (4 levels) — and every Industry card of the draw deck. Owner: industries-resources agent.
import type { ContentChunk } from '../types.ts';

export const industriesResources: ContentChunk = {
  tiles: [
    { industry: 'coal', level: 1, count: 1, cost: 5, coal: 0, iron: 0, beer: 0, produce: 2, vp: 1, income: 4, linkVp: 2, era: 'canal' },
    { industry: 'coal', level: 2, count: 2, cost: 7, coal: 0, iron: 0, beer: 0, produce: 3, vp: 2, income: 7, linkVp: 1 },
    { industry: 'coal', level: 3, count: 2, cost: 8, coal: 0, iron: 1, beer: 0, produce: 4, vp: 3, income: 6, linkVp: 1 },
    { industry: 'coal', level: 4, count: 2, cost: 10, coal: 0, iron: 1, beer: 0, produce: 5, vp: 4, income: 5, linkVp: 1 },
    { industry: 'iron', level: 1, count: 1, cost: 5, coal: 1, iron: 0, beer: 0, produce: 4, vp: 3, income: 3, linkVp: 1, era: 'canal' },
    { industry: 'iron', level: 2, count: 1, cost: 7, coal: 1, iron: 0, beer: 0, produce: 4, vp: 5, income: 3, linkVp: 1 },
    { industry: 'iron', level: 3, count: 1, cost: 9, coal: 1, iron: 0, beer: 0, produce: 5, vp: 7, income: 2, linkVp: 1 },
    { industry: 'iron', level: 4, count: 1, cost: 12, coal: 1, iron: 0, beer: 0, produce: 6, vp: 9, income: 1, linkVp: 1 },
    { industry: 'brewery', level: 1, count: 2, cost: 5, coal: 0, iron: 1, beer: 0, produce: { canal: 1, rail: 2 }, vp: 4, income: 4, linkVp: 2, era: 'canal' },
    { industry: 'brewery', level: 2, count: 2, cost: 7, coal: 0, iron: 1, beer: 0, produce: { canal: 1, rail: 2 }, vp: 5, income: 5, linkVp: 2 },
    { industry: 'brewery', level: 3, count: 2, cost: 9, coal: 0, iron: 1, beer: 0, produce: { canal: 1, rail: 2 }, vp: 7, income: 5, linkVp: 2 },
    { industry: 'brewery', level: 4, count: 1, cost: 9, coal: 0, iron: 1, beer: 0, produce: { canal: 1, rail: 2 }, vp: 10, income: 5, linkVp: 2, era: 'rail' }
  ],
  industryCards: [
    { id: 'card-coal', industries: ['coal'], copies: [2, 2, 3] },
    { id: 'card-iron', industries: ['iron'], copies: [4, 4, 4] },
    { id: 'card-brewery', industries: ['brewery'], copies: [5, 5, 5] },
    { id: 'card-pottery', industries: ['pottery'], copies: [2, 2, 3] },
    { id: 'card-cotton-manufacturer', industries: ['cotton', 'manufacturer'], copies: [0, 6, 8] }
  ]
};
