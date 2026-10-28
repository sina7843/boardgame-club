The site footer: about (with «دریافت از کافه‌بازار»), popular games, community, support and rules; below, the trust seal, copyright, Instagram and Telegram.

**Material (v2.1):** a navy board in both themes (deeper navy in dark) with a hard inner edge; links are cream on navy. «دریافت از کافه‌بازار» is a cream cardboard token with a dark print, like the tokens on the felt. Social links are round flat discs.

## When to use

**Public pages only:** games catalogue, game page, wiki, support. Never on tables, messages, settings or other signed-in tools.

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `logo` | `{ src }` | The reversed lock-up. |
| `about` | `Node` | One sentence. |
| `storeHref`, `storeLabel` | | Cafe Bazaar link; `storeHref={false}` hides it. |
| `columns` | `Array<{ title, links: [label, href][] }>` | Default: بازی‌های محبوب، جامعه، پشتیبانی و قوانین. |
| `defaultOpen` | `number` | Phone accordion: the column open at first (default 0). |
| `seal`, `copyright`, `social` | | Bottom row. |
| `phone`, `wide` | `boolean` | Force the phone accordion / the desktop columns (previews). |

Types: `SiteFooterProps` in `components/index.d.ts`. Classes: `.bgv-sitefooter`, `__in`, `__cols`, `__col`, `__about`, `__store`, `__bottom`, `__seal`, `__social`.

## Responsive

≥1200: four columns; 900–1199: two; <900: one, with 112px bottom padding above the dock · <600: columns are an accordion (`h3 > button[aria-expanded]`, first open, rows 44px).

## Do / Don't

**Do**

- Keep link text as plain names («کاتان آنلاین», «قوانین و مقررات»); this is for search engines and trust.

**Don't**

- Do not add the footer to a table, the messages page or settings.
- Do not use amber in the footer.
