# Old → new: token and file migration map

The app today runs on the VibeFarsi «انار» theme (`packages/ui/src/theme.css`, `apps/web/src/styles.css`, `packages/ui/src/vf/**`,
Tailwind `@theme inline` mapping in `apps/web/src/app.css`). The BGV design system replaces all of it.
`scripts/ds-check.mjs` rule DS007 flags every legacy variable below; DS012 flags the retired imports.

> Some names exist in both systems (`--bg --surface --surface-raised --text --line --border --primary --accent --danger --success --warning --felt --focus --link --dur-fast`).
> Their **meaning and values changed** (e.g. `--primary` is now the amber "go" colour with navy label, `--accent` is amber, `--felt` is the navy table).
> Re-check every use of them visually against the reference.

## Colour roles
| Legacy | BGV |
|---|---|
| `--background` | `--bg` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground` | `--text` (headings: `--heading`) |
| `--card`, `--popover` | `--surface` |
| `--secondary`, `--surface-2` | `--surface-raised` |
| `--muted`, `--field` | `--surface-sunken` |
| `--muted-foreground`, `--text-2` | `--text-muted` (form labels: `--label`) |
| `--primary-foreground`, `--on-action` | `--on-primary` |
| `--action` / `--action-hover` | `--primary` / `--primary-hover` |
| `--accent-foreground` | `--on-accent` |
| `--brand` / `--brand-foreground` | `--accent` / `--on-accent` (brand gold — decorative); coins: `--coin-light`/`--coin`/`--coin-dark` |
| `--gold` | coins → `--coin*`; tiers → `--tier-gold` |
| `--destructive` / `--destructive-foreground` | `--danger` / `--on-danger` |
| `--ring` | `--focus` (on felt / on primary: `--focus-on-felt`) |
| `--input`, `--line-field` | `--border` |
| `--backdrop` | `--scrim` |
| `--table-felt` | `--felt` |
| `--felt-foreground`, `--felt-text` | `--felt-ink` (secondary: `--felt-muted`) |
| `--wood`, `--wood-text` | `--felt-rim` / `--felt-ink` |
| invite / «you» highlight (was ad-hoc coral) | `--invite`, `--invite-strong`, `--invite-soft`, `--on-invite` |
| navigation chrome (site header, top bar, dock) | `--surface-chrome` |
| hard-coded seat colours (`SEAT_COLORS` in Table.tsx, renderer CSS) | `--seat-1 … --seat-10` (+ glyphs, see Seat README) |

## Shape, depth, type, spacing, motion
| Legacy | BGV |
|---|---|
| `--radius`, `--shape-surface` | `--radius-lg` (20, cards) |
| `--shape-control`, `--shape-field`, `--r-sm` | `--radius-sm` (8, buttons/fields) |
| `--shape-overlay` | `--radius-xl` (28, sheets/felt); dialogs `--radius-lg` |
| `--depth-control`, `--press` | `--shadow-tile` / `--shadow-press` |
| `--depth-field` | `--shadow-field` |
| `--depth-surface`, `--shadow` | `--shadow-card` |
| `--depth-overlay`, `--shadow-lift` | `--shadow-float` |
| `--depth-press` | `--shadow-press` |
| `--font`, `--type-body` | `--font-fa` + `.t-body` / `.t-body-sm` |
| `--type-display`, `--type-display-weight` | `.t-page`, `.t-h1…h3`, `.t-display` |
| `--fs-xs`, `--lh` | `.t-caption`, `.t-micro` |
| `--sp-1`, `--spacing` | `--space-1 … --space-20` |
| `--touch` | `--control-md` (44) |
| `--nav-w` | none — the sidebar is gone in v2.1 (`--sidebar-w` removed). Desktop navigation is the 72px `SiteHeader` (`--header-h`). |
| `--motion`, `--motion-ease` | `--dur-*`, `--ease-out`, `--ease-spring`, `--ease-in-out` |
| `--surface-filter`, `--line-style` | removed (no equivalent; don't recreate) |

## Files
| Today | Becomes |
|---|---|
| `packages/ui/src/theme.css` | `packages/ui/src/bgv/tokens.css` (copy of `design/system/tokens.css`) — delete theme.css at the end of phase 6 |
| `apps/web/src/styles.css` + old BEM classes | `packages/ui/src/bgv/bundle.css` (`bgv-*` classes) + small screen modules using tokens |
| `packages/ui/src/components.tsx`, `packages/ui/src/vf/**` (45 files) | `packages/ui/src/bgv/components/*.tsx` (94 DS components, API = `design/system/components/index.d.ts`) |
| `apps/web/src/app.css` `@theme inline` VibeFarsi mapping | Tailwind `@theme inline` mapped to BGV tokens (`--color-bg: var(--bg)` …) **for layout utilities only**; colour utilities come from tokens |
| `THEME_COLOR` in `apps/web/src/lib/prefs.tsx` (`#efeeea` / `#15120f`) | `#142B3B` for both themes (one meta theme-color) |
| `public/` favicon + manifest | `design/brand/favicon-production/*` (see `design/brand/LOGO-USAGE.md`) |
| Fonts: Vazirmatn variable | Vazirmatn (400/700/900) + **Manrope** (600/800) for Latin (`@fontsource-variable/manrope`) |
| `apps/web/scripts/contrast.mjs` (dark theme never measured) | fix the dark selector (`[data-theme="dark"]`) and run it in CI on `tokens.css` |
