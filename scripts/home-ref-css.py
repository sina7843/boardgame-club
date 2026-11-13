"""Generate apps/web/src/styles/home-ref.css from the designed home pages.

The home page is built from the reference markup (design/reference/html/play/Home-Guest.html and Home-Member.html).
Their <style> blocks carry the page's own classes (cx-b/d/e/f, cx-card, cx-shelf, cx-housebox, cx-meta) next to a
mock of the site shell (header, nav, search, topbar, footer, dock), which the app already gets from the DS components.
This script keeps only the page rules, in their original order, and scopes each file's rules under its page root
(.cx-guest / .cx-member) so the two pages' revisions never override each other.

    python scripts/home-ref-css.py      (rerun when the design hands over a new home page)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [('Home-Guest.html', '.cx-guest'), ('Home-Member.html', '.cx-member')]
# v2.4 references add T- (tag rows, join code), L- (landing bands), bv- (party hand) and cx-mt (ModeTag on a card).
KEEP = re.compile(r'\.(?:cx-(?:[bdef]-|card|shelf|housebox|meta\b|hide-phone|mt\b|mt__)|T-|L-|bv-|J-)')
SHELL = re.compile(r'\.cx-(?:a-|app|header|nav|search|topbar|title|footer|store|social|dock|kbd|chev|avatarbtn|actions|logo|main)')


def blocks(css):
    """Top-level statements: (prelude, body) for rules and @-blocks, nested one level."""
    i, out = 0, []
    while i < len(css):
        j = css.find('{', i)
        if j < 0:
            break
        prelude = css[i:j]
        depth, k = 1, j + 1
        while depth and k < len(css):
            depth += {'{': 1, '}': -1}.get(css[k], 0)
            k += 1
        out.append((re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip(), css[j + 1:k - 1]))
        i = k
    return out


def scope(selector, root):
    parts = []
    for sel in selector.split(','):
        sel = sel.strip()
        if not KEEP.search(sel) or SHELL.search(sel):
            continue
        # The member pills are toggle buttons in the app (aria-pressed): aria-selected is not allowed on a plain button (axe).
        sel = sel.replace('[aria-selected="true"]', '[aria-pressed="true"]')
        m = re.match(r'^(\[data-theme="dark"\]|:root\[data-theme="dark"\]|html\[data-theme="dark"\])\s*(.*)$', sel)
        parts.append(f'{m.group(1)} {root} {m.group(2)}' if m else f'{root} {sel}')
    return ', '.join(parts)


# v2.4 references write box shadows as var(--drop-box-*, <literal fallback>); --drop-box-* is not a DS token, so the literal
# would always win. Use the DS box tokens instead (tokens.css: --bgv-box-shadow-sm / --bgv-box-shadow / --bgv-box-shadow-lg).
DROP = {'sm': '--bgv-box-shadow-sm', 'md': '--bgv-box-shadow', 'lg': '--bgv-box-shadow-lg'}


# The v2.4 landing blocks (L-*, T-*) still carry literal colours, radii and inline-shadow frames. Same pixels from tokens
# (reported to design in DECISIONS.md): frames become --shadow-ring* or an inset outline, tints colour-mix of brand tokens.
TOKENIZE = [
    ('rgba(243,235,221,0.035)', 'color-mix(in srgb,var(--brand-cream) 3.5%,transparent)'),
    ('rgba(243,235,221,0.08)', 'color-mix(in srgb,var(--brand-cream) 8%,transparent)'),
    ('background:#0F2230', 'background:var(--surface-chrome)'),
    ('rgba(232,166,66,.14)', 'color-mix(in srgb,var(--felt-gold) 14%,transparent)'),
    ('var(--felt-gold,#E8A642)', 'var(--felt-gold)'),
    ('background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)',
     'background:color-mix(in srgb,var(--brand-cream) 4%,transparent);box-shadow:var(--shadow-ring)'),
    ('box-shadow:inset 0 0 0 1.5px var(--tier-master)', 'outline:1.5px solid var(--tier-master);outline-offset:-1.5px'),
    ('box-shadow:inset 0 0 0 1px var(--line)', 'box-shadow:var(--shadow-ring)'),
    ('text-align:right}', 'text-align:end}'),
    ('box-shadow:inset 0 0 0 1.5px dashed var(--line)', 'outline:1.5px dashed var(--line);outline-offset:-1.5px'),
    ('box-shadow:inset 0 0 0 1.5px var(--line)', 'outline:1.5px solid var(--line);outline-offset:-1.5px'),
    ('box-shadow:inset 0 0 0 1.5px var(--border)', 'outline:1.5px solid var(--border);outline-offset:-1.5px'),
    ('border-radius:38px;background:#0B1A25;box-shadow:0 30px 60px rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.08)',
     'border-radius:calc(var(--radius-xl) + 10px);background:var(--bg);box-shadow:var(--shadow-box-lg),var(--shadow-ring)'),
    ('border-radius:30px}', 'border-radius:var(--radius-xl)}'),
    ('z-index:3;', 'z-index:calc(var(--z-felt) + 2);'),
    ('box-shadow:var(--shadow-card),0 0 0 2px var(--primary)', 'box-shadow:var(--shadow-card);outline:2px solid var(--primary)'),
    ('background:rgba(250,245,236,.06);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)',
     'background:color-mix(in srgb,var(--brand-cream) 6%,transparent);box-shadow:var(--shadow-ring-felt)'),
    ('background:rgba(250,245,236,.07);box-shadow:inset 0 0 0 1px rgba(250,245,236,.14)',
     'background:color-mix(in srgb,var(--brand-cream) 7%,transparent);box-shadow:var(--shadow-ring-felt)'),
]


def tokenize(css):
    for old, new in TOKENIZE:
        css = css.replace(old, new)
    return css


def drop_tokens(css):
    out, i = [], 0
    while (j := css.find('var(--drop-box-', i)) >= 0:
        out.append(css[i:j])
        size = css[j + 15:j + 17]
        depth, k = 0, j + 3  # at the "(" of var(
        while k < len(css):
            depth += {'(': 1, ')': -1}.get(css[k], 0)
            k += 1
            if depth == 0:
                break
        out.append(f'var({DROP.get(size, "--bgv-box-shadow")})')
        i = k
    out.append(css[i:])
    return ''.join(out)


def convert(css, root):
    out = []
    for prelude, body in blocks(css):
        if prelude.startswith('@media') or prelude.startswith('@supports') or prelude.startswith('@container'):
            inner = [f'  {s} {{{b.strip()}}}' for p, b in blocks(body) if (s := scope(p, root))]
            if inner:
                out.append(prelude + ' {\n' + '\n'.join(inner) + '\n}')
        elif prelude.startswith('@keyframes'):
            name = prelude.split()[1]
            if name.startswith('cx-'):
                out.append(f'{prelude} {{{body}}}')
        elif prelude and (s := scope(prelude, root)):
            out.append(f'{s} {{{body.strip()}}}')
    return out


def main():
    lines = ['/* GENERATED by scripts/home-ref-css.py from design/reference/html/play/Home-{Guest,Member}.html — do not edit.',
             '   Page rules of the designed home, scoped per page root; the site shell comes from the DS components. */']
    # The design's .cx-main column (a shell rule there): sections stacked with 32px gaps, 24px under 900px.
    lines += ['.cx-guest, .cx-member {display:flex;flex-direction:column;gap:32px;min-inline-size:0}',
              '.cx-guest > *, .cx-member > * {min-width:0}',
              # the design's inline style on the dot inside the «زنده» badge of a live table
              '.cx-guest .bgv-badge > .cx-b-dot, .cx-member .bgv-badge > .cx-b-dot {box-shadow:none;inline-size:6px;block-size:6px}',
              '@media (max-width:899px) {\n  .cx-guest, .cx-member {gap:24px}\n}']
    for name, root in PAGES:
        html = (ROOT / 'design/reference/html/play' / name).read_text(encoding='utf8')
        css = tokenize(drop_tokens('\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S))))
        lines.append(f'\n/* ---- {name} ---- */')
        lines += convert(css, root)
    target = ROOT / 'apps/web/src/styles/home-ref.css'
    target.write_text('\n'.join(lines) + '\n', encoding='utf8', newline='\n')
    print(target, len(lines), 'rules')


if __name__ == '__main__':
    sys.exit(main())
