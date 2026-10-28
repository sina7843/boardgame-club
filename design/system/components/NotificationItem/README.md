A notification row: kind icon tile (turn amber, reward a neutral tile with its own icon, urgent crimson), text, time, actions and unread dot.

**Material (v2.0):** the row is a list row; its icon is a small board (it does not press); actions are buttons (tokens).

## When to use

Notification centre (page and bell popover), my-tables urgency lists.

## Props / what the consumer provides

`kind`, `icon`, `avatar` (instead of the tile), `title`, `text`, `time`, `unread`, `actions` (Button props with `label`), `as`.

| Prop | Type | Description |
|---|---|---|
| `kind` | `'turn' \| 'urgent' \| 'reward' \| 'default'` | turn = amber tile, urgent = crimson, reward = neutral tile (no solid amber, v2.1.2), default = neutral. |
| `icon` | `IconName` | — |
| `avatar` | `AvatarProps` | Avatar props instead of the icon tile (friend requests). |
| `title` (required) | `Node` | Main line (bold the names/games). |
| `text` | `Node` | — |
| `time` | `Node` | — |
| `unread` | `boolean` | — |
| `actions` | `Array<(ButtonProps & { label: Node }) \| Node> \| Node` | Button props (+label) or nodes. |
| `as` | `string` | Root element ("li" inside a list). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `NotificationItemProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Turn-based reminder today: one, when 25% of the turn is left, at most 6 hours before the deadline (`runtime.ts`). Proposed (new server work): extra steps at 50% and 1 hour left; the last one is `urgent`.
- One primary action per item («ورود به میز», «پذیرفتن»); «رد» is `secondary` (the default action look).

**Don't**

- Do not use the amber turn tile for anything but your turn / invitations.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{flush:true, style:{maxWidth:'520px'}},
  h(B.NotificationItem,{kind:'turn', unread:true, title:h('span',null,'نوبت شما در ', h('b',null,'کاتان')), text:'آرش حرکتش را انجام داد؛ ۲۴ ساعت وقت دارید.', time:'۵ دقیقه پیش', actions:[{label:'ورود به میز', variant:'primary'}]}),
  h(B.NotificationItem,{kind:'urgent', unread:true, title:h('span',null, h('b',null,'۴۵ دقیقه'),' تا پایان نوبت شما در ', h('b',null,'پروژه گایا')), text:'اگر تمام شود این دومین بار پشت سر هم است؛ بار سوم از بازی حذف می‌شوید.', time:'۱۵ دقیقه پیش'}),
  h(B.NotificationItem,{avatar:{initials:'آ', size:'md'}, title:h('span',null, h('b',null,'آرش'),' درخواست دوستی فرستاد'), time:'۱ ساعت پیش', actions:[{label:'پذیرفتن', variant:'primary'},{label:'رد', variant:'secondary', icon:'x'}]}),
  h(B.NotificationItem,{kind:'reward', title:'جایزهٔ مأموریت هفتگی: ۴۰ سکه', time:'دیروز'})
)
```
