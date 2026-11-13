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
# v2.4: the catalog's «ویترین» hero, tabs and category tiles (gh-*) come from its reference the same way.
PAGES = [('Home-Guest.html', '.cx-guest'), ('Home-Member.html', '.cx-member'), ('Catalog-Desktop.html', '.cx-catalog'),
         ('GameDetail-Desktop.html', '.cx-gamepage')]
# v2.4 references add T- (tag rows, join code), L- (landing bands), bv- (party hand) and cx-mt (ModeTag on a card).
KEEP = re.compile(r'\.(?:cx-(?:[bdef]-|card|shelf|housebox|meta\b|hide-phone|mt\b|mt__|tabs\b)|T-|L-|bv-|J-|gh-|gd-)')
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


def split_top(selector):
    """Split a selector list on top-level commas only (`:is(a, b)` stays whole)."""
    out, depth, cur = [], 0, ''
    for ch in selector:
        depth += {'(': 1, ')': -1}.get(ch, 0)
        if ch == ',' and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    return out + [cur]


def scope(selector, root, used=None):
    parts = []
    for sel in split_top(selector):
        sel = sel.strip()
        if not KEEP.search(sel) or SHELL.search(sel):
            continue
        # Pages built from one design variant (catalog: hero «a») skip rules of the variants the markup never uses.
        if used is not None and any(c not in used for c in re.findall(r'\.([A-Za-z][\w-]*)', sel)):
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
    # catalog «ویترین» hero (gh-*): dark-band tints from the band's own --bg, frames as rings/outlines
    ('box-shadow:inset 0 0 0 1px rgba(232,166,66,.35)', 'outline:1px solid color-mix(in srgb,var(--felt-gold) 35%,transparent);outline-offset:-1px'),
    ('background:rgba(243,235,221,.26)', 'background:color-mix(in srgb,var(--felt-ink) 26%,transparent)'),
    ('box-shadow:inset 0 0 0 1px rgba(250,245,236,.2)', 'box-shadow:var(--shadow-ring-felt)'),
    ('background:rgba(8,18,26,.32);box-shadow:inset 0 0 0 1px rgba(250,245,236,.12)', 'background:color-mix(in srgb,var(--bg) 32%,transparent);box-shadow:var(--shadow-ring-felt)'),
    ('background:rgba(4,10,15,.55)', 'background:color-mix(in srgb,var(--bg) 55%,transparent)'),
    ('linear-gradient(rgba(6,14,20,.18),rgba(6,14,20,.42))', 'linear-gradient(color-mix(in srgb,var(--bg) 18%,transparent),color-mix(in srgb,var(--bg) 42%,transparent))'),
    ('box-shadow:inset 0 0 0 1.5px rgba(232,166,66,.75)', 'outline:1.5px solid color-mix(in srgb,var(--felt-gold) 75%,transparent);outline-offset:-1.5px'),
    ('box-shadow:inset 0 -3px 0 rgba(0,0,0,.14)', 'box-shadow:var(--shadow-piece)'),
]


def palette():
    """RGB -> token name for the theme-independent colour tokens of tokens.css (brand, felt, seat, tier: one value each)."""
    toks = {}
    for name, val in re.findall(r'(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;', (ROOT / 'design/system/tokens.css').read_text(encoding='utf8')):
        rgb = tuple(int(val[i:i + 2], 16) for i in (1, 3, 5))
        toks.setdefault(name, set()).add(rgb)
    out = {}
    for prefix in ('--brand-', '--felt-', '--ink-', '--seat-', '--tier-'):
        for name, rgbs in toks.items():
            # --brand-coral is a legacy alias that now holds the amber; the amber reads as --felt-gold on the felt.
            if len(rgbs) == 1 and name.startswith(prefix) and name != '--brand-coral':
                out.setdefault(next(iter(rgbs)), name)
    return out


PALETTE = None


def by_palette(css):
    """Literal colours equal to a fixed DS token become that token (alpha via color-mix): same pixels, guard-clean."""
    global PALETTE
    PALETTE = PALETTE or palette()

    def rgba(m):
        rgb = tuple(int(x) for x in m.group(1, 2, 3))
        name = PALETTE.get(rgb)
        if not name:
            return m.group(0)
        a = float(m.group(4)) if m.group(4) else 1.0
        return f'var({name})' if a >= 1 else f'color-mix(in srgb,var({name}) {round(a * 100, 1):g}%,transparent)'

    def hexc(m):
        h = m.group(1)
        rgb = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        name = PALETTE.get(rgb)
        return f'var({name})' if name else m.group(0)

    css = re.sub(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)', rgba, css)
    return re.sub(r'#([0-9A-Fa-f]{6})\b', hexc, css)


RADII = {3: 'calc(var(--radius-xs) - 1px)', 4: 'var(--radius-xs)', 6: 'var(--radius-box)', 8: 'var(--radius-sm)', 12: 'var(--radius-md)',
         20: 'var(--radius-lg)', 28: 'var(--radius-xl)'}


def scales(css):
    """Local stacking order on the --z-felt base (1 = --z-felt, as in v2.2) and px radii on the radius scale."""
    css = re.sub(r'z-index:\s*var\(--z\)', 'z-index:calc(var(--z-felt) - 1 + var(--z))', css)
    css = re.sub(r'z-index:\s*([1-9])\b', lambda m: 'z-index:var(--z-felt)' if m.group(1) == '1' else f'z-index:calc(var(--z-felt) + {int(m.group(1)) - 1})', css)
    return re.sub(r'border-radius:\s*(\d+)px(?=\s*[;}])', lambda m: f'border-radius:{RADII[int(m.group(1))]}' if int(m.group(1)) in RADII else m.group(0), css)


TOKEN_NAMES = None


def drop_fallbacks(css):
    """var(--token, <literal>) keeps only the token when tokens.css defines it (the fallback is dead code to the guard)."""
    global TOKEN_NAMES
    TOKEN_NAMES = TOKEN_NAMES or set(re.findall(r'(--[a-z0-9-]+):', (ROOT / 'design/system/tokens.css').read_text(encoding='utf8')))
    out, i = [], 0
    while (j := css.find('var(--', i)) >= 0:
        k = j + 4
        while k < len(css) and (css[k].isalnum() or css[k] in '-_'):
            k += 1
        name = css[j + 4:k]
        if css[k:k + 1] == ',' and name in TOKEN_NAMES:
            depth, e = 1, k
            while depth and e < len(css) - 1:
                e += 1
                depth += {'(': 1, ')': -1}.get(css[e], 0)
            out.append(css[i:j] + f'var({name})')
            i = e + 1
        else:
            out.append(css[i:k])
            i = k
    out.append(css[i:])
    return ''.join(out)


# Applied after the palette step (so it matches the token form): the game page's frames and plates.
POST = [
    ('box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--brand-cream) 18%,transparent)', 'box-shadow:var(--shadow-ring-felt)'),
    ('background:#20394A', 'background:var(--felt-plate)'),
    ('border-radius:10px', 'border-radius:calc(var(--radius-sm) + 2px)'),
    ('box-shadow:inset 0 0 0 1.5px var(--link)', 'outline:1.5px solid var(--link);outline-offset:-1.5px'),
    ('box-shadow:var(--shadow-ring),0 2px 0 var(--line)', 'box-shadow:var(--shadow-ring)'),
    ('box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--brand-gold) 55%,transparent)',
     'outline:1.5px solid color-mix(in srgb,var(--brand-gold) 55%,transparent);outline-offset:-1.5px'),
    ('box-shadow:inset 0 0 0 1.5px var(--felt-gold)', 'outline:1.5px solid var(--felt-gold);outline-offset:-1.5px'),
]


def tokenize(css):
    css = drop_fallbacks(css)
    for old, new in TOKENIZE:
        css = css.replace(old, new)
    css = scales(by_palette(css))
    for old, new in POST:
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


def convert(css, root, used=None):
    out = []
    for prelude, body in blocks(css):
        if prelude.startswith('@media') or prelude.startswith('@supports') or prelude.startswith('@container'):
            inner = [f'  {s} {{{b.strip()}}}' for p, b in blocks(body) if (s := scope(p, root, used))]
            if inner:
                out.append(prelude + ' {\n' + '\n'.join(inner) + '\n}')
        elif prelude.startswith('@keyframes'):
            name = prelude.split()[1]
            if name.startswith('cx-'):
                out.append(f'{prelude} {{{body}}}')
        elif prelude and (s := scope(prelude, root, used)):
            out.append(f'{s} {{{body.strip()}}}')
    return out


def main():
    lines = ['/* GENERATED by scripts/home-ref-css.py from design/reference/html/play/Home-{Guest,Member}, Catalog-Desktop and GameDetail-Desktop — do not edit.',
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
        used = None
        if root in ('.cx-catalog', '.cx-gamepage'):
            main = html[html.find('<main'):html.find('</main>')]
            used = {c for attr in re.findall(r'class="([^"]*)"', main) for c in attr.split()} | {'is-active', 'is-on', 'is-open'}
        lines += convert(css, root, used)
    target = ROOT / 'apps/web/src/styles/home-ref.css'
    target.write_text('\n'.join(lines) + '\n', encoding='utf8', newline='\n')
    print(target, len(lines), 'rules')


if __name__ == '__main__':
    sys.exit(main())
