The floating phone dock (`--surface-chrome`, radius 28) with the five destinations and their counts.

## When to use

Bottom of every phone page outside the table: خانه، بازی‌ها، میزها، پیام‌ها، بیشتر (inside `AppShell` it floats 12px from the edges).

## Props / what the consumer provides

`items`: `{icon,label,href,active,count,turns}` — `count` crimson unread, `turns` coral tables waiting for your move.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ icon: IconName; label: Node; href?: string; active?: boolean; count?: number; turns?: number; onClick?: React.MouseEventHandler }>` | 5 items: خانه، بازی‌ها، میزها، پیام‌ها، بیشتر. `count` = crimson unread; `turns` = coral count of tables waiting for your move. |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DockProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep exactly these five items; the active one is the primary tile.
- میزها shows the coral turn count, پیام‌ها the crimson unread count.

**Don't**

- Do not show the dock on the game table.
- Do not add a sixth item; use «بیشتر».

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'390px', paddingTop:'6px'}}, h(B.Dock,{items:[{icon:'house',label:'خانه',active:true},{icon:'layout-grid',label:'بازی‌ها'},{icon:'dices',label:'میزها',turns:3},{icon:'message-circle',label:'پیام‌ها',count:4},{icon:'menu',label:'بیشتر'}]}))
```
