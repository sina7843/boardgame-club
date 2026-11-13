// Tiny engines for mock positions (rules match the repo engines: English draughts, WOF Othello).
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// ---------- English draughts: 8x8, dark squares (r+c odd), black ('b') starts on top and moves first ----------
export const CK = {
  start() {
    const b = Array(64).fill(null);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = 'b'; if (r > 4) b[r * 8 + c] = 'w'; }
    return { b, turn: 'b' };
  },
  num(i) { const r = Math.floor(i / 8), c = i % 8; return r * 4 + Math.floor(c / 2) + 1; }, // 1..32 from black's side
  fwd: (p) => (p.toLowerCase() === 'b' ? 1 : -1),
  isKing: (p) => p === p.toUpperCase(),
  col: (p) => p.toLowerCase(),
  jumps(b, i, p, path = [i], caps = []) {
    const out = []; const r = Math.floor(i / 8), c = i % 8; const king = CK.isKing(p);
    for (const dr of [-1, 1]) for (const dc of [-1, 1]) {
      if (!king && dr !== CK.fwd(p)) continue;
      const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
      if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
      const m = mr * 8 + mc, l = lr * 8 + lc;
      if (!b[m] || CK.col(b[m]) === CK.col(p) || b[l] || caps.includes(m)) continue;
      const crowned = !king && (lr === 0 || lr === 7);
      const more = crowned ? [] : CK.jumps(b, l, p, [...path, l], [...caps, m]);
      if (more.length) out.push(...more); else out.push({ path: [...path, l], caps: [...caps, m] });
    }
    return out;
  },
  legal(s) {
    const caps = [], quiet = [];
    s.b.forEach((p, i) => {
      if (!p || CK.col(p) !== s.turn) return;
      caps.push(...CK.jumps(s.b, i, p));
      const r = Math.floor(i / 8), c = i % 8;
      for (const dr of [-1, 1]) for (const dc of [-1, 1]) {
        if (!CK.isKing(p) && dr !== CK.fwd(p)) continue;
        const nr = r + dr, nc = c + dc; if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        if (!s.b[nr * 8 + nc]) quiet.push({ path: [i, nr * 8 + nc], caps: [] });
      }
    });
    return caps.length ? caps : quiet;
  },
  play(s, m) {
    const b = s.b.slice(); let p = b[m.path[0]]; b[m.path[0]] = null; m.caps.forEach((x) => (b[x] = null));
    const to = m.path[m.path.length - 1]; const tr = Math.floor(to / 8);
    if (!CK.isKing(p) && (tr === 0 || tr === 7)) p = p.toUpperCase();
    b[to] = p;
    const san = m.path.map(CK.num).join(m.caps.length ? 'x' : '-');
    return { s: { b, turn: s.turn === 'b' ? 'w' : 'b' }, san };
  },
};

// ---------- Othello: black first, centre d5/e4 black, d4/e5 white ----------
export const OT = {
  start() { const b = Array(64).fill(null); b[27] = 'w'; b[36] = 'w'; b[28] = 'b'; b[35] = 'b'; return { b, turn: 'b' }; },
  name(i) { return 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1); },
  flips(b, i, t) {
    if (b[i]) return []; const o = t === 'b' ? 'w' : 'b'; const r0 = Math.floor(i / 8), c0 = i % 8; const out = [];
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      const line = []; let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === o) { line.push(r * 8 + c); r += dr; c += dc; }
      if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === t) out.push(...line);
    }
    return out;
  },
  legal(s) { const out = []; for (let i = 0; i < 64; i++) { const f = OT.flips(s.b, i, s.turn); if (f.length) out.push({ sq: i, flips: f }); } return out; },
  play(s, m) { const b = s.b.slice(); b[m.sq] = s.turn; m.flips.forEach((x) => (b[x] = s.turn)); return { s: { b, turn: s.turn === 'b' ? 'w' : 'b' }, san: OT.name(m.sq) }; },
  count(b, t) { return b.filter((x) => x === t).length; },
};

export function playout(E, plies, seed, pick) {
  const R = rng(seed); let s = E.start(); const hist = []; let last = null;
  for (let k = 0; k < plies; k++) {
    const L = E.legal(s); if (!L.length) break;
    const m = pick ? pick(L, s, R) : L[Math.floor(R() * L.length)];
    const r = E.play(s, m); s = r.s; hist.push({ san: r.san }); last = m;
  }
  return { s, hist, last };
}
