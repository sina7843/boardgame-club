// Chess-clock wording shared by the lobby, table lists and the game page (design/games/chess CHESS-FIX-SPEC row 3).
import { clockClass, RATING_MODE_FA } from '@bg/contracts';
import { faNum } from '../lib/format.ts';

const CLOCK_RE = /^(\d+)(?:\/\d+)?\+(\d+)$/;

/** «10+5» → «رپید ۱۰ + ۵»; «1+0» → «بولت ۱ دقیقه». Null when the table has no chess clock. */
export function clockLabelFa(clock: unknown): string | null {
  const cls = clockClass(clock);
  const m = typeof clock === 'string' ? CLOCK_RE.exec(clock) : null;
  if (!cls || !m) return null;
  const [mins, inc] = [Number(m[1]), Number(m[2])];
  return `${RATING_MODE_FA[cls]} ${inc ? `${faNum(mins)} + ${faNum(inc)}` : `${faNum(mins)} دقیقه`}`;
}

/** Pace text of a table: the clock when it has one, else «N ثانیه هر نوبت» etc. from `perTurn`. */
export const paceTextFa = (clock: unknown, perTurn: () => string) => clockLabelFa(clock) ?? perTurn();

/** Shortest and longest bank (minutes) among the game's clock choices, without classical controls: «۱ تا ۳۰ دقیقه». */
export function clockMinutesRange(choices: readonly { value: unknown }[]): [number, number] | null {
  const mins = choices.filter((c) => clockClass(c.value) !== 'classical').map((c) => CLOCK_RE.exec(String(c.value))).filter((m) => m !== null).map((m) => Number(m[1]));
  return mins.length ? [Math.min(...mins), Math.max(...mins)] : null;
}
