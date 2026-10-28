A chat message: avatar + seat + author for others, a pale navy-tint bubble with an edge for yours (`--bubble-mine` #E6EDF2 / #2A4559); a 2px navy outline when it mentions you; reply quote, mentions, reactions, seen, pending/failed/deleted, edited, quick emoji.

## When to use

Inside `Chat`.

## Props / what the consumer provides

`mine`, `author`, `seat`, `initials`, `time`, `text` (with «@name» mentions; set `viewer` to highlight yours), `reply`, `reactions`, `seen`, `state`, `edited`, `quick`, `mentioned`, `league`, `title`, `onRetry`.

| Prop | Type | Description |
|---|---|---|
| `mine` | `boolean` | Your message at the end side: `--bubble-mine` (#E6EDF2, dark #2A4559) with a `--bubble-mine-edge` (#B7C5D0) edge. No amber. |
| `author` | `Node` | — |
| `seat` | `SeatNo` | — |
| `initials` | `string` | — |
| `src` | `string` | — |
| `avatar` | `AvatarProps` | — |
| `league` | `LeagueTier` | — |
| `title` | `Node` | — |
| `time` | `Node` | — |
| `text` | `string \| Node` | Text; «@name» tokens become mentions (filled navy when equal to `viewer`). |
| `viewer` | `string` | Viewer's name, to highlight their mentions. |
| `reply` | `{ author: Node; text: Node }` | — |
| `reactions` | `Array<{ emoji: string; count: number; mine?: boolean; label?: string }>` | — |
| `onReact` | `(emoji: string) => void` | — |
| `seen` | `boolean` | Your message was seen (double check). |
| `state` | `'sent' \| 'pending' \| 'failed' \| 'deleted'` | — |
| `onRetry` | `() => void` | — |
| `edited` | `boolean` | — |
| `quick` | `boolean` | Big emoji / quick-chat message without bubble. |
| `mentioned` | `boolean` | Message mentions you: white bubble with a 2px navy outline (cream in dark). |
| `deletedText` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `MessageProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Mentions of the viewer are a filled navy token (`--selected`, cream in dark) and the bubble gets the `mentioned` treatment: white with a 2px navy outline (owner decision 8.3; amber was dropped in v2.1).
- Your messages: pale-amber bubble in light (solid amber is reserved for «go»), amber `--primary` in dark; navy text, time + double-check when seen.
- Failed messages show «ارسال نشد» with «دوباره».

**Don't**

- Do not colour other players' bubbles by seat; the seat glyph sits in the meta.
- Do not allow edits after 2 minutes (menu shows «۲ دقیقه»).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{className:'bgv-chat__list', style:{maxWidth:'420px', padding:0, overflow:'visible'}},
  h(B.Message,{author:'آرش', initials:'آ', seat:2, league:'diamond', time:'۳ دقیقه', text:'کسی گندم داره؟ سنگ می‌دم', reactions:[{emoji:'👍',count:2},{emoji:'😂',count:1,mine:true}]}),
  h(B.Message,{author:'نیلوفر', initials:'ن', seat:1, time:'۲ دقیقه', viewer:'مینا', mentioned:true, text:'@مینا نوبت توئه، جادهٔ بلند رو نگیری!'}),
  h(B.Message,{mine:true, time:'۱ دقیقه', seen:true, edited:true, reply:{author:'آرش', text:'کسی گندم داره؟'}, text:'من دارم، ۲ تا 🌾'}),
  h(B.Message,{mine:true, state:'failed', text:'بازی خوبی بود'}),
  h(B.Message,{author:'سارا', initials:'س', seat:5, time:'الان', state:'deleted'})
)
```
