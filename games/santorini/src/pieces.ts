// Island, tower and worker art: design/games/group-a/art/santorini, copied as-is. Shared by the renderer and the cover.
import ivory from './art/santorini-ivory-worker.png'; import blue from './art/santorini-blue-worker.png';
import t1 from './art/santorini-tower-1.png'; import t2 from './art/santorini-tower-2.png';
import t3 from './art/santorini-tower-3.png'; import t4 from './art/santorini-tower-4.png';
export { default as ISLAND } from './art/santorini-island.png';
export { default as DOME } from './art/santorini-dome.png';

// Indexed by seat: ivory builder, blue builder. TOWER[level 1..4] (4 = domed).
export const WORKER_SRC = [ivory, blue];
export const TOWER = [null, t1, t2, t3, t4] as const;
