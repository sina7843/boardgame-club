// Chunk "links-merchants": the five edge merchants (with their beer bonus), the 9 merchant tiles and every canal/rail
// line of the board (39 lines: 30 canal+rail, 8 rail only, 1 canal only).
// A link to a location that is not (yet) declared is skipped by content/index.ts, so chunks can land in any order.
import type { ContentChunk, LinkDef } from '../types.ts';

const both = (a: string, b: string, also?: readonly string[]): LinkDef => ({ a, b, canal: true, rail: true, ...(also ? { also } : {}) });
const rail = (a: string, b: string): LinkDef => ({ a, b, canal: false, rail: true });
const canal = (a: string, b: string): LinkDef => ({ a, b, canal: true, rail: false });

export const linksMerchants: ContentChunk = {
  locations: [
    { id: 'oxford', nameFa: 'آکسفورد', nameEn: 'Oxford', kind: 'merchant', pos: [72, 93], merchant: { spaces: 2, minPlayers: 2, bonus: { kind: 'income', amount: 2 }, linkVp: 2 } },
    { id: 'shrewsbury', nameFa: 'شروزبری', nameEn: 'Shrewsbury', kind: 'merchant', pos: [3, 45], merchant: { spaces: 1, minPlayers: 2, bonus: { kind: 'vp', amount: 4 }, linkVp: 2 } },
    { id: 'gloucester', nameFa: 'گلاستر', nameEn: 'Gloucester', kind: 'merchant', pos: [9, 97], merchant: { spaces: 2, minPlayers: 2, bonus: { kind: 'develop' }, linkVp: 2 } },
    { id: 'warrington', nameFa: 'وارینگتون', nameEn: 'Warrington', kind: 'merchant', pos: [21, 2], merchant: { spaces: 2, minPlayers: 3, bonus: { kind: 'money', amount: 5 }, linkVp: 2 } },
    { id: 'nottingham', nameFa: 'ناتینگهام', nameEn: 'Nottingham', kind: 'merchant', pos: [98, 12], merchant: { spaces: 2, minPlayers: 4, bonus: { kind: 'vp', amount: 3 }, linkVp: 2 } }
  ],
  merchantTiles: [
    { id: 'm2-cotton', goods: ['cotton'], minPlayers: 2 },
    { id: 'm2-manufacturer', goods: ['manufacturer'], minPlayers: 2 },
    { id: 'm2-blank-1', goods: [], minPlayers: 2 },
    { id: 'm2-blank-2', goods: [], minPlayers: 2 },
    { id: 'm2-all', goods: ['cotton', 'manufacturer', 'pottery'], minPlayers: 2 },
    { id: 'm3-pottery', goods: ['pottery'], minPlayers: 3 },
    { id: 'm3-blank', goods: [], minPlayers: 3 },
    { id: 'm4-cotton', goods: ['cotton'], minPlayers: 4 },
    { id: 'm4-manufacturer', goods: ['manufacturer'], minPlayers: 4 }
  ],
  links: [
    both('cannock', 'farm-cannock'),
    both('cannock', 'walsall'),
    both('tamworth', 'birmingham'),
    both('walsall', 'birmingham'),
    rail('tamworth', 'walsall'),
    both('birmingham', 'oxford'),
    both('belper', 'derby'),
    rail('belper', 'leek'),
    both('birmingham', 'coventry'),
    both('birmingham', 'dudley'),
    rail('birmingham', 'nuneaton'),
    rail('birmingham', 'redditch'),
    both('birmingham', 'worcester'),
    rail('burton-on-trent', 'cannock'),
    both('burton-on-trent', 'derby'),
    both('burton-on-trent', 'stone'),
    both('burton-on-trent', 'tamworth'),
    canal('burton-on-trent', 'walsall'),
    both('cannock', 'stafford'),
    both('cannock', 'wolverhampton'),
    both('coalbrookdale', 'kidderminster'),
    both('coalbrookdale', 'shrewsbury'),
    both('coalbrookdale', 'wolverhampton'),
    rail('coventry', 'nuneaton'),
    both('derby', 'nottingham'),
    rail('derby', 'uttoxeter'),
    both('dudley', 'kidderminster'),
    both('dudley', 'wolverhampton'),
    both('gloucester', 'redditch'),
    both('gloucester', 'worcester'),
    both('kidderminster', 'worcester', ['farm-worcester']),
    both('leek', 'stoke-on-trent'),
    both('nuneaton', 'tamworth'),
    both('oxford', 'redditch'),
    both('stafford', 'stone'),
    both('stoke-on-trent', 'stone'),
    both('stoke-on-trent', 'warrington'),
    rail('stone', 'uttoxeter'),
    both('walsall', 'wolverhampton')
  ]
};
