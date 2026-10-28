The floating phone dock (`--surface-chrome`, radius 28) with the four destinations and their counts.

**Material (v2.1):** a floating board (hard 6px shadow); items are rows; the current one is an **amber token** (1.5px frame and 3px hard shadow in `--ink-btn-primary`: burnt amber in both themes since v2.1.11/v2.1.12, like the primary button) with the plain icon (the filled icon is gone).

## When to use

Bottom of every phone page outside the table: خانه، میزها، پیام‌ها، بیشتر (inside `AppShell` it floats 12px from the edges). Games are reached from خانه (shelves, search, «همه بازی‌ها»), so the catalog and game pages keep خانه active.

## Props / what the consumer provides

`items`: `{icon,label,href,active,count,turns}` — `count` crimson unread, `turns` crimson count of tables waiting for your move. `guest`: the same four items without counts. On 404 and the notifications page no item is active.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ icon: IconName; label: Node; href?: string; active?: boolean; count?: number; turns?: number; onClick?: React.MouseEventHandler }>` | 4 items: خانه، میزها، پیام‌ها، بیشتر (games are reached from خانه). `count` = crimson unread; `turns` = crimson count of tables waiting for your move. |
| `label` | `string` | Default «بخش‌های اصلی». |
| `float` | `boolean` | For a page without `AppShell`: adds `.bgv-dock--float` (fixed, 12px from the bottom and sides, `--z-dock`), hidden from 900px up. Inside `AppShell` the shell positions the dock. |
| `guest` | `boolean` | Same four items, no counts. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DockProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep exactly these four items, for guests too (without counts); the active one is the amber token (owner decision). Games and a game page keep خانه active; 404 and notifications activate nothing.
- میزها shows the turn count, پیام‌ها the unread count (both crimson, so they read on the amber tile).

- One markup everywhere: `nav.bgv-dock[aria-label="بخش‌های اصلی"] > a.bgv-dock__item` (icon, label in a `span`, then the count badge with its own `aria-label`); the current item has `is-active` and `aria-current="page"`.
- Overlays (sheets, dialogs, onboarding scrims) sit above the dock: use `--z-sheet` / `--z-dialog`, never a hand-picked number below `--z-dock`.

**Don't**

- Do not show the dock on the game table (start to result), or on task screens that have a back/close button in the top bar: login, payment result, a DM thread, the avatar builder, the profile studio.
- Do not position the dock with page CSS or inline styles; use `AppShell` or `float`.
- Do not add a fifth item; use «بیشتر».

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'390px', paddingTop:'6px'}}, h(B.Dock,{items:[{icon:'house',label:'خانه',active:true},{icon:'dices',label:'میزها',turns:3},{icon:'message-circle',label:'پیام‌ها',count:4},{icon:'menu',label:'بیشتر'}]}))
```
