The avatar's menu in the site header: who you are, your coins with «خرید سکه», then fourteen items in four groups. Every page that is not in the header lives here.

**Material (v2.1):** a floating board (`.bgv-menu` + `.bgv-menu--account`); items are rows (tint on hover, `--shadow-row-press` on press). «خرید سکه» is a small secondary token; the balance is the coin chip. «فقط مدیران» is a print tag with a hairline.

## When to use

Desktop only, opened from `.bgv-avatarbtn` in `SiteHeader`. On phones the same destinations are tiles on the «بیشتر» page (`MoreTile`).

## Items (in order)

1. پروفایل من · پیشرفت و رتبه · استودیو پروفایل · ساخت آواتار · کمد من · فروشگاه کازمتیک
2. پیام‌ها و دوستان (unread count) · باشگاه‌ها و گروه‌ها · اشتراک و سکه (balance) · تنظیمات
3. راهنما · پشتیبانی
4. پنل مدیریت («فقط مدیران», only with `admin`) · خروج

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `user` (required) | `{ name, sub, initials, src }` | Header row; `sub` e.g. «@mina · سطح ۱۸». |
| `coins` | `number` | Coin chip in the wallet row and on «اشتراک و سکه». |
| `coinsHref`, `buyHref` | `string` | Wallet and «خرید سکه». |
| `admin` | `boolean` | Shows «پنل مدیریت». |
| `counts` | `Record<string, number>` | e.g. `{messages: 4}`. |
| `items` | menu items | Replace the canonical list (`'-'` = separator). |

Types: `AccountMenuProps` in `components/index.d.ts`. Plain `Menu` also renders `href` items as links.

## Do / Don't

**Do**

- Use the canonical names: «فروشگاه کازمتیک», «اشتراک و سکه», «پنل مدیریت».
- Close on Esc, outside click and item activation; return focus to the avatar button.

**Don't**

- Do not put coins in the header itself on desktop.
- Do not colour «خروج» red: it is not destructive.

## Structure (v2.1.1)

`div.bgv-menu.bgv-menu--account` (`role="group"`) holds the identity row (`.bgv-menu__id`) and the wallet row (`.bgv-menu__wallet`), then `div.bgv-menu__list` with `role="menu"` holding only the `menuitem` links and separators. A `role="menu"` may contain only items and separators, so the identity and wallet rows stay outside it.
