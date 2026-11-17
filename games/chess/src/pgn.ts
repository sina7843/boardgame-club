// PGN export (PGN standard, section 8: seven tag roster + movetext). Pure: built from the final public state.
import type { RecordMeta } from '@bg/game-sdk';
import type { ChessState } from './rules.ts';

const tag = (name: string, value: string) => `[${name} "${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/[\r\n]+/g, ' ')}"]`;

/** `1-0`, `0-1`, `1/2-1/2`, or `*` for a game that is not over. */
export function pgnResult(s: ChessState): string {
  if (!s.outcome) return '*';
  // A drawn Armageddon game stays 1/2-1/2 on the record (N4); the tie-break win for Black is a comment.
  if (s.outcome.reason === 'draw' || s.end?.kind === 'draw') return '1/2-1/2';
  const winner = s.outcome.placements.find((p) => p.place === 1)?.seat;
  if (winner === undefined) return '1/2-1/2';
  return s.colors[winner] === 'w' ? '1-0' : '0-1';
}

const DRAW_EN = { stalemate: 'stalemate', repetition: 'repetition', fiftyMove: 'the 50-move rule', material: 'insufficient material',
  agreement: 'agreement', timeoutMaterial: 'timeout vs insufficient material' } as const;
/** Termination tag that tells the ends apart for the arbiter (N3), in the common "... won by ..." / "Game drawn by ..." form. */
const termination = (s: ChessState, white: string, black: string): string | null => {
  if (!s.end) return null;
  if (s.end.kind === 'draw') return `Game drawn by ${DRAW_EN[s.end.draw ?? 'agreement']}`;
  const winner = s.outcome?.placements.find((p) => p.place === 1)?.seat;
  const who = winner === undefined ? '?' : s.colors[winner] === 'w' ? white : black;
  return `${who} won ${s.end.kind === 'checkmate' ? 'by checkmate' : s.end.kind === 'resign' ? 'by resignation' : 'on time'}`;
};

export function toPgn(s: ChessState, meta: RecordMeta): string {
  const white = meta.players[s.colors.indexOf('w')] ?? '?';
  const black = meta.players[s.colors.indexOf('b')] ?? '?';
  const result = pgnResult(s);
  const tags = [
    tag('Event', meta.event), tag('Site', meta.site), tag('Date', meta.date), tag('Round', meta.round ?? '-'),
    tag('White', white), tag('Black', black), tag('Result', result)
  ];
  if (meta.timeControl) tags.push(tag('TimeControl', meta.timeControl));
  const end = termination(s, white, black);
  if (end) tags.push(tag('Termination', end));
  // Clock comments `{[%clk h:mm:ss]}` (the mover's clock after the move) when the game ran on a clock.
  const clocks = (meta.moveTimes ?? []).filter((m) => m.actionType === 'move');
  const clk = (i: number) => {
    const left = clocks[i]?.leftMs;
    if (left === null || left === undefined) return null;
    const sec = Math.floor(left / 1000);
    return `{[%clk ${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}]}`;
  };
  const tokens: string[] = [];
  s.history.forEach((h, i) => {
    const white = i % 2 === 0;
    // After a comment, Black's move repeats the number (`1... e5`).
    if (white) tokens.push(`${i / 2 + 1}.`);
    else if (clk(i - 1)) tokens.push(`${(i - 1) / 2 + 1}...`);
    tokens.push(h.san);
    const c = clk(i);
    if (c) tokens.push(c);
  });
  if (s.end?.kind === 'draw' && s.opts?.armageddon) tokens.push('{Armageddon: Black wins the tie-break}');
  tokens.push(result);
  // Lines stay under 80 characters (PGN export format).
  const lines: string[] = [];
  let line = '';
  for (const t of tokens) {
    if (line && line.length + 1 + t.length > 79) { lines.push(line); line = t; } else line = line ? `${line} ${t}` : t;
  }
  if (line) lines.push(line);
  return `${tags.join('\n')}\n\n${lines.join('\n')}\n`;
}
