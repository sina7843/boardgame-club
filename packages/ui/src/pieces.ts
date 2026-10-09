// Helpers that give board renderers what the motion layer needs: a stable id per physical piece (derived by matching
// consecutive boards), the set of things that just appeared, and a "this number changed" class. All pure render-time
// bookkeeping in refs, so they work with or without reduced motion.
import { useRef } from 'react';

/**
 * One stable id per non-empty cell. Cells that did not change keep their id; a piece that left a cell and a same-valued
 * cell that was newly filled are matched (nearest first, `dist` defaults to index distance), so moved pieces keep identity.
 * Anything left over in the new board gets a fresh id.
 */
export function usePieceIds(cells: readonly (string | null | undefined)[], dist: (a: number, b: number) => number = (a, b) => Math.abs(a - b)): (string | null)[] {
  const r = useRef<{ sig: string; cells: readonly (string | null | undefined)[]; ids: (string | null)[]; n: number } | null>(null);
  const sig = cells.map((c) => c ?? '').join('\u0001');
  if (!r.current) {
    r.current = { sig, cells, ids: cells.map((c, i) => (c ? `p${i}` : null)), n: cells.length };
  } else if (r.current.sig !== sig) {
    const { cells: oc, ids: oi } = r.current;
    let n = r.current.n;
    const ids: (string | null)[] = cells.map((c, i) => (c && i < oc.length && oc[i] === c ? oi[i]! : null));
    const free = oc.map((c, i) => (c && !(i < cells.length && cells[i] === c) ? i : -1)).filter((i) => i >= 0);
    const pairs: [number, number, number][] = [];
    cells.forEach((c, i) => { if (c && !ids[i]) for (const j of free) if (oc[j] === c) pairs.push([dist(i, j), i, j]); });
    pairs.sort((a, b) => a[0] - b[0]);
    const used = new Set<number>();
    for (const [, i, j] of pairs) if (!ids[i] && !used.has(j)) { ids[i] = oi[j]!; used.add(j); }
    cells.forEach((c, i) => { if (c && !ids[i]) ids[i] = `p${n++}`; });
    r.current = { sig, cells, ids, n };
  }
  return r.current.ids;
}

/** Keys that appeared with the latest change of the key list (empty on first render); stays stable until the list changes. */
export function useFresh(keys: readonly string[]): ReadonlySet<string> {
  const r = useRef<{ sig: string; keys: Set<string>; fresh: Set<string> } | null>(null);
  const sig = keys.join('\u0001');
  if (!r.current) r.current = { sig, keys: new Set(keys), fresh: new Set() };
  else if (r.current.sig !== sig) {
    const prev = r.current.keys;
    r.current = { sig, keys: new Set(keys), fresh: new Set(keys.filter((k) => !prev.has(k))) };
  }
  return r.current.fresh;
}

/** `'bg-pop'` once `value` has changed since first render, else `''`. Use together with `key={value}` on the element. */
export function usePop(value: unknown): string {
  const r = useRef<{ v: unknown; on: boolean }>({ v: value, on: false });
  if (r.current.v !== value) r.current = { v: value, on: true };
  return r.current.on ? 'bg-pop' : '';
}
