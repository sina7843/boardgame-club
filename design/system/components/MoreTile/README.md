The shortcut tiles of the phone «بیشتر» page, in two columns and four groups: بازی و میز · پروفایل و پیشرفت · اجتماعی · حساب و کیف پول. `MoreGroup` is one titled group of tiles.

**Material (v2.1):** each tile is a clickable card (board with a 3px printed edge): hover lifts 2px with `--shadow-float`, press lands it. The icon sits in a small well. Counts: crimson for unread, amber «نوبت» for tables waiting for you.

## When to use

Only on the phone «بیشتر» page (the dock's fourth item). On desktop the same destinations are in the header and the account menu.

## Props / what the consumer provides

`MoreTile`:

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | — |
| `label` | `Node` | — |
| `href` | `string` | — |
| `count` | `number` | Crimson unread count. |
| `turns` | `number` | Amber count of tables waiting for your move. |

`MoreGroup`: `title` (the group name, `--label` colour) and `items` (MoreTile props) or children.

Types: `MoreTileProps`, `MoreGroupProps` in `components/index.d.ts`. Classes: `.bgv-moregroup`, `__title`, `__grid`, `.bgv-moretile`, `__icon`, `__label` (replace the local `.pl-moretile` and the old `.bgv-sidebar__group` heading).

## Do / Don't

**Do**

- Keep labels to one line at 358px (two columns).
- Put the profile card (identity, level) above the groups.

**Don't**

- Do not repeat the four dock destinations as tiles.
