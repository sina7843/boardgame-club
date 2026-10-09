// Chunk "towns-north": the northern and central towns of the Birmingham board and the farm brewery beside Cannock.
// Owner: towns-north agent. Cannock, Tamworth, farm-cannock, then the 8 northern towns.
// Each town: id, Persian + English name, pos (0..100 frame, north up), banner colour, build slots in printed order
// and Location-card copies [2p, 3p, 4p]. Links touching these towns live in links-merchants.ts.
import type { ContentChunk } from '../types.ts';

export const townsNorth: ContentChunk = {
  locations: [
    { id: 'cannock', nameFa: 'کنک', nameEn: 'Cannock', kind: 'town', pos: [41, 44], color: 'yellow', slots: [['manufacturer', 'coal'], ['coal']], cards: [2, 2, 2] },
    { id: 'tamworth', nameFa: 'تمورث', nameEn: 'Tamworth', kind: 'town', pos: [75, 48], color: 'yellow', slots: [['cotton', 'coal'], ['cotton', 'coal']], cards: [1, 1, 1] },
    { id: 'farm-cannock', nameFa: 'آبجوسازی روستایی کنک', nameEn: 'Farm Brewery (Cannock)', kind: 'farm', pos: [45, 49], slots: [['brewery']] },
    { id: 'belper', nameFa: 'بلپر', nameEn: 'Belper', kind: 'town', pos: [85, 7], color: 'teal', slots: [['cotton', 'manufacturer'], ['coal'], ['pottery']], cards: [0, 0, 2] },
    { id: 'derby', nameFa: 'دربی', nameEn: 'Derby', kind: 'town', pos: [88, 20], color: 'teal', slots: [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']], cards: [0, 0, 3] },
    { id: 'leek', nameFa: 'لیک', nameEn: 'Leek', kind: 'town', pos: [52, 6], color: 'blue', slots: [['cotton', 'manufacturer'], ['cotton', 'coal']], cards: [0, 2, 2] },
    { id: 'stoke-on-trent', nameFa: 'استوک‌آن‌ترنت', nameEn: 'Stoke-on-Trent', kind: 'town', pos: [36, 14], color: 'blue', slots: [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']], cards: [0, 3, 3] },
    { id: 'stone', nameFa: 'استون', nameEn: 'Stone', kind: 'town', pos: [23, 23], color: 'blue', slots: [['cotton', 'brewery'], ['manufacturer', 'coal']], cards: [0, 2, 2] },
    { id: 'uttoxeter', nameFa: 'آتاکستر', nameEn: 'Uttoxeter', kind: 'town', pos: [56, 20], color: 'blue', slots: [['manufacturer', 'brewery'], ['cotton', 'brewery']], cards: [0, 1, 2] },
    { id: 'stafford', nameFa: 'استافورد', nameEn: 'Stafford', kind: 'town', pos: [31, 34], color: 'red', slots: [['manufacturer', 'brewery'], ['pottery']], cards: [2, 2, 2] },
    { id: 'burton-on-trent', nameFa: 'برتن‌آن‌ترنت', nameEn: 'Burton-on-Trent', kind: 'town', pos: [73, 35], color: 'red', slots: [['manufacturer', 'coal'], ['brewery']], cards: [2, 2, 2] }
  ]
};
