The table chat panel: head with title, per-table mute and close; message log; composer or read-only footer for spectators.

## When to use

Docked 360px panel on desktop tables (board stays usable); half-height bottom sheet on phones (`sheet`). Also DMs and club chats.

## Props / what the consumer provides

`title`, `icon`, `mutedToggle`, `onClose`, `readOnly` (spectators), `composer` (a `Composer`), `sheet`, `bottom`, children (Message, SystemMessage, UnreadDivider, Typing).

| Prop | Type | Description |
|---|---|---|
| `title` | `Node` | — |
| `icon` | `IconName` | — |
| `mutedToggle` | `boolean \| { muted?: boolean; onToggle?: (muted: boolean) => void }` | Per-table mute button: true (uncontrolled) or {muted,onToggle}. |
| `onClose` | `() => void` | — |
| `readOnly` | `boolean \| string` | Spectators: replaces the composer with «تماشاگرها فقط می‌خوانند» (or custom text). |
| `composer` | `Node` | <Composer/> node. |
| `sheet` | `boolean` | Phone bottom sheet (top radius + handle). |
| `bottom` | `boolean` | Anchor messages to the bottom. |
| `headExtra` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ChatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Spectators read but cannot write: `readOnly` shows «تماشاگرها فقط می‌خوانند».
- Game events go in as `SystemMessage game`.
- Per-table mute lives in the head (volume icon, labelled).

**Don't**

- Do not create a separate spectator chat.
- Do not cover the board on desktop; dock it.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Chat,{style:{height:'420px', flex:'1 1 300px'}, mutedToggle:true, onClose:function(){}, bottom:true, composer:h(B.Composer,{quick:['اونو!','خوب بازی کردی','بجنب 😅','👏']})},
    h(B.SystemMessage,{game:true, seat:4, text:h('span',null, h('b',null,'نیلوفر'),' یک +۴ بازی کرد')}),
    h(B.Message,{author:'کاوه', initials:'ک', seat:3, time:'۲ دقیقه', text:'نیلوفر چرا من؟ 😭', reactions:[{emoji:'😂',count:3,mine:true}]}),
    h(B.Message,{author:'نیلوفر', initials:'ن', seat:4, time:'۱ دقیقه', viewer:'مینا', mentioned:true, text:'حواست باشه @مینا، سارا یه کارت داره'}),
    h(B.Message,{mine:true, time:'الان', seen:true, reply:{author:'نیلوفر', text:'سارا یه کارت داره'}, text:'دیدم 👀 ردشدن دارم'})),
  h(B.Chat,{sheet:true, readOnly:true, style:{height:'300px', flex:'1 1 260px'}},
    h(B.SystemMessage,{text:'دست ۲ شروع شد'}),
    h(B.Message,{author:'سارا', initials:'س', seat:2, time:'الان', text:'اونو! 🎉'}))
)
```
