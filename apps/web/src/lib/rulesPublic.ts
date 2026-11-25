// Public rules from a game's design/games/**/RULES.md (Phase F). Those files are audit documents: a preamble about
// sources, then numbered sections whose tables hold «# | قانون | دفترچه | موتور | طرح», then internal sections
// («تفاوت موتور با دفترچه», «قانون‌هایی که رابط کاربری ندارند», «مراحلی که بازیکن می‌بیند»). Players get only the
// title, the rule sections and, from every table, the «قانون» column as a list; rows the site does not play
// (engine column ❌) are dropped. Run at build time by scripts/rules.ts, so the internal parts never ship.
// Plain TypeScript with no imports: Node runs it directly (type stripping) from the build script.

/** Strips ZWNJ/ZWJ, bidi marks, digits, punctuation and spaces so heading checks survive spelling variants. */
const squash = (s: string) => s.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[\s\d\u06f0-\u06f9\u0660-\u0669.,:;\u060c\u061b()\-\u2013\u2014#]/g, '').toLowerCase();

/** Section headings that describe the implementation, the design or QA rather than the game. */
const INTERNAL = ['موتور', 'رابطکاربری', 'مراحلیکهبازیکن', 'طرح', 'پیادهسازی', 'تست', 'engine', 'qa', 'todo', 'handoff'];
export const isInternalHeading = (heading: string) => { const h = squash(heading); return INTERNAL.some((k) => h.includes(k)); };

/** Splits a markdown table row on pipes that are neither escaped nor inside a `code span`. */
export function tableCells(row: string): string[] {
  const s = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  const out: string[] = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}
const cells = tableCells;
const isTableRow = (l: string) => l.trimStart().startsWith('|');
export const isDivider = (l: string) => /^\s*\|[\s|:-]+\|\s*$/.test(l);

/** Parenthesised audit notes («پیش‌فرض BGA», «تصمیم مالک …», file refs) and «؛» clauses about the design mock. */
const NOTE = /پیش‌?\s*فرض|تصمیم مالک|قاب مشترک|\bE\d+\b|تأییدنشده|ساده‌?\s*سازی رابط|\.tsx?\b|§/;

/** Rule text cleanup: audit notes and code identifiers go, other code spans become plain text, «موتور» reads «سایت». */
const cleanRule = (s: string) => s
  .replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (NOTE.test(inner) || /^\s*`[^`]*`\s*$/.test(inner) ? '' : m))
  .split('؛').filter((c) => !/(^|\s|«|»)طرح(\s|$)|§/.test(c)).join('؛')
  .replace(/`([^`]*)`/g, '$1')
  .replace(/(^|[\s(«])موتور(?=[\s،:؛)»]|$)/g, '$1سایت')
  .trim();

export function publicRules(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const title = lines.find((l) => /^# /.test(l));
  if (title) out.push(title.trim(), '');
  /** Body of the current public h2 (null while in the preamble or an internal section). */
  let section: string[] | null = null;
  let sectionHead = '';
  const flush = () => {
    if (section && section.some((l) => l.startsWith('- ') || (l.trim() && !l.startsWith('#')))) out.push(sectionHead, '', ...section, '');
    section = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^## /.test(l)) { flush(); if (!isInternalHeading(l.slice(3))) { section = []; sectionHead = l.trim(); } continue; }
    if (!section) continue;
    const body: string[] = section;
    if (/^#{3,6} /.test(l)) {
      if (isInternalHeading(l.replace(/^#+/, ''))) { while (i + 1 < lines.length && !/^#{1,3} /.test(lines[i + 1]!)) i++; continue; }
      body.push('', l.trim(), ''); continue;
    }
    if (isTableRow(l)) {
      const head = cells(l);
      const rows: string[][] = [];
      if (isDivider(lines[i + 1] ?? '')) i++;
      while (i + 1 < lines.length && isTableRow(lines[i + 1]!)) rows.push(cells(lines[++i]!));
      const qi = head.findIndex((h) => squash(h) === 'قانون');
      const ei = head.findIndex((h) => squash(h).startsWith('موتور'));
      // A table without a «قانون» column is not a rules table: leave it out rather than guess.
      if (qi < 0) continue;
      for (const r of rows) {
        const rule = cleanRule(r[qi] ?? '');
        if (!rule || (ei >= 0 && (r[ei] ?? '').startsWith('❌'))) continue;
        body.push(`- ${rule}`);
      }
      continue;
    }
    body.push(l);
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** h2 titles of public rules, for the table of contents. */
export const rulesToc = (md: string) => md.split('\n').filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
