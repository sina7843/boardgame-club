Site-wide game search: a field in the header and a popover of up to six games, with «بازی سریع» on every row. On phones the top bar's magnifier opens the same list as a full-screen sheet.

**Material (v2.1):** the field is a well (`--field-edge` 3:1, inner hard edge); the popover is a floating board (`--shadow-float`, no blur). Rows are rows: tint on hover; the highlighted option gets a tint plus a 3px navy bar. «بازی سریع» on a row is a small secondary token.

## When to use

In `SiteHeader` (desktop) and as `sheet` from `TopBar`'s magnifier (phone). The catalogue page has its own filters; this is the quick way in.

## States

| State | What shows |
|---|---|
| idle (focus on an empty field) | Up to 5 recent searches (same device) as chips + «محبوب این هفته». |
| results (typing) | Filters, up to 6 games (name starts → name contains → latin), categories, link to all results. |
| finglish | `hint`: «نتیجه برای «کاتان»؛ katan را فینگلیش خواندیم.» The Persian-keyboard mistake works too («نشنفدش» → کاتان). |
| empty | «بازی‌ای با «…» پیدا نشد» + suggestions from near tags or favourites, and «این بازی را می‌خواهی؟ پیشنهاد بده». |
| sheet (phone) | Full screen; field auto-focused; back closes like Esc; rows wrap and keep a 44px «بازی سریع». |

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `results` | `SiteSearchResult[]` | `{title, latin, cover, href, quickHref, meta}`; tapping a row opens the game page; tapping the row's «بازی سریع» starts quick play (it is drawn as a button but is part of the option, not a nested link). |
| `state` | `'idle' \| 'results' \| 'empty'` | Default: derived from the value and `results`. |
| `recent`, `filters`, `categories`, `suggestions` | chip lists | Strings or `{label, href, selected}`. |
| `hint` | `Node` | Blue note above the list (finglish). |
| `value` / `defaultValue`, `onChange` | | Controlled or not. |
| `open` / `defaultOpen`, `onOpenChange`, `activeIndex` | | Popover and highlighted option. |
| `shortcut` | `boolean` | Ctrl K and `/` focus the field (default true). |
| `sheet`, `onClose` | | Phone full-screen sheet. |

Types: `SiteSearchProps` in `components/index.d.ts`. Classes: `.bgv-sitesearch`, `.bgv-sitesearch__field`, `__pop`, `__row`, `__label`, `__chips`, `__hint`, `__empty`, `__foot`, `.bgv-sitesearch--sheet`.

## Keyboard and accessibility

- Field: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. List: `role="listbox"`, rows `role="option"` with `aria-selected`.
- ↑ ↓ move, Enter opens the game page, Shift+Enter starts quick play, Esc clears the text first, then closes and returns focus. Ctrl K or `/` from anywhere on the page (not while typing in another field).
- Phone sheet: `role="dialog"` + `aria-modal`; focus stays inside.

## Do / Don't

**Do**

- Show at most six games; send the rest to the catalogue.
- Keep «بازی سریع» on each row; the row itself opens the game page.

**Don't**

- Do not use amber in the popover: the row button is secondary.
- Do not search on every keystroke without debouncing (150–200ms).
