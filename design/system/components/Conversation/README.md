A conversation row: avatar or group icon, name, last message, time, unread count and «@» when you were mentioned.

**Material (v2.0):** a row; the open conversation is flat navy.

## When to use

Messages page lists (DMs, groups, clubs, table chats).

## Props / what the consumer provides

`name`, `initials`/`src`/`icon`, `status`, `preview`, `time`, `unread`, `mention`, `muted`, `active`, `href`.

| Prop | Type | Description |
|---|---|---|
| `name` (required) | `Node` | — |
| `initials` | `string` | — |
| `src` | `string` | — |
| `seat` | `SeatNo` | — |
| `icon` | `IconName` | Group/club icon instead of an avatar. |
| `status` | `'online' \| 'away' \| 'offline'` | — |
| `preview` | `Node` | Last message preview. |
| `time` | `Node` | — |
| `unread` | `number` | — |
| `mention` | `boolean` | You were mentioned: crimson «@» count badge (`count-invite`). |
| `muted` | `boolean` | — |
| `active` | `boolean` | — |
| `href` | `string` | — |
| `onClick` | `React.MouseEventHandler` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ConversationProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- «@» only when the viewer was mentioned.
- Muted conversations show the bell-off icon and no count.

**Don't**

- Do not bold the whole row for unread; the count badge carries it.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{style:{maxWidth:'380px', padding:'6px', display:'grid', gap:'2px'}},
  h(B.Conversation,{href:'#', active:true, name:'نیلوفر', initials:'ن', status:'online', preview:'فردا شب کاتان؟', time:'۲ دقیقه', unread:2}),
  h(B.Conversation,{href:'#', name:'میز کاتان شب جمعه', icon:'dices', preview:'آرش: @مینا نوبت توئه', time:'۱۲:۴۰', mention:true, unread:5}),
  h(B.Conversation,{href:'#', name:'باشگاه هانابی', icon:'users', preview:'سارا: تورنمنت ساعت ۹', time:'دیروز', muted:true})
)
```
