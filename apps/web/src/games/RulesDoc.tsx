// Full rules of a game (Phase F): a minimal markdown renderer to React elements (never raw HTML) and the rules
// block shared by the game page («قوانین کامل») and the table's rules sheet.
import type { ReactNode } from 'react';
import { Button, Icon, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useGameRules } from '../lib/rules.ts';
import { isDivider, rulesToc, tableCells } from '../lib/rulesPublic.ts';

/** **bold**, *italic* and `code`; everything else is text (React escapes it). */
export function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++}>{inline(m[1])}</strong>);
    else if (m[2] !== undefined) out.push(<code key={k++}>{m[2]}</code>);
    else out.push(<em key={k++}>{inline(m[3]!)}</em>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const cells = tableCells;
type H = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/**
 * Block markdown: # headings, paragraphs, - / 1. lists, | tables |, > quotes. `shift` moves heading levels
 * (h2 → h(2+shift)) to fit the surrounding outline; h2s get ids `${idPrefix}-${n}` for the table of contents.
 */
export function Markdown({ text, shift = 0, idPrefix = 'md', skipTitle = false }: { text: string; shift?: number; idPrefix?: string; skipTitle?: boolean }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let h2 = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!l.trim()) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const level = h[1]!.length;
      if (level === 1 && skipTitle) continue;
      const Tag = `h${Math.min(6, level + shift)}` as H;
      out.push(<Tag key={i} id={level === 2 ? `${idPrefix}-${h2++}` : undefined}>{inline(h[2]!)}</Tag>);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
      const ordered = /^\s*\d/.test(l);
      const item = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      const items: string[] = [];
      while (i < lines.length && item.test(lines[i]!)) items.push(lines[i++]!.replace(item, ''));
      i--;
      const List = ordered ? 'ol' : 'ul';
      out.push(<List key={i}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</List>);
      continue;
    }
    if (l.trimStart().startsWith('|')) {
      const head = cells(l);
      if (isDivider(lines[i + 1] ?? '')) i++;
      const rows: string[][] = [];
      while (i + 1 < lines.length && lines[i + 1]!.trimStart().startsWith('|')) rows.push(cells(lines[++i]!));
      out.push(
        <div key={i} className="bgv-scroll-x"><table>
          <thead><tr>{head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, j) => <tr key={j}>{head.map((_, x) => <td key={x}>{inline(r[x] ?? '')}</td>)}</tr>)}</tbody>
        </table></div>
      );
      continue;
    }
    if (l.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) q.push(lines[i++]!.replace(/^>\s?/, ''));
      i--;
      out.push(<blockquote key={i}><p>{inline(q.join(' '))}</p></blockquote>);
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*\||>)/.test(lines[i]!)) p.push(lines[i++]!.trim());
    i--;
    out.push(<p key={i}>{inline(p.join(' '))}</p>);
  }
  return <>{out}</>;
}

/** Loads and shows one game's full public rules, with a table of contents of its sections. */
export function GameRules({ gameId, shift = 2, idPrefix = 'rules', enabled = true }: { gameId: string; shift?: number; idPrefix?: string; enabled?: boolean }) {
  const r = useGameRules(gameId, enabled);
  if (r.status === 'loading') return <><Skeleton lines={6} /><span className="bgv-sr" role="status">در حال بارگذاری قوانین…</span></>;
  if (r.status === 'missing') return <StateBlock kind="empty" title="قوانین کامل این بازی هنوز آماده نیست" text="خلاصهٔ «چطور بازی کنیم» و آموزش تعاملی را ببینید." />;
  if (r.status === 'error') return <StateBlock kind="error" title="قوانین بارگذاری نشد" action={<Button variant="primary" icon="refresh-cw" onClick={r.retry}>تلاش دوباره</Button>} />;
  const toc = rulesToc(r.text);
  return (
    <div className="rules-doc">
      {toc.length > 1 && (
        <nav className="rules-doc__toc" aria-label="فهرست قوانین">
          <ol>{toc.map((t, i) => <li key={i}><a href={`#${idPrefix}-${i}`}><Icon name="chevron-left" size="sm" />{inline(t)}</a></li>)}</ol>
        </nav>
      )}
      <div className="rules-doc__body"><Markdown text={r.text} shift={shift} idPrefix={idPrefix} skipTitle /></div>
    </div>
  );
}
