The chronological list of moves with seat glyph, name, text and time; round dividers.

## When to use

Desktop side panel tab, player-detail sheets, replays.

## Props / what the consumer provides

`items` ({seat,name,text,time,isNew} or {round}).

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ seat?: SeatNo; icon?: IconName; name?: Node; text?: Node; time?: Node; isNew?: boolean; round?: Node }>` | Entries newest last; `{round:'دور ۳'}` draws a round divider. |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `MoveLogProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Highlight the newest entry (`isNew`).
- Keep entries to one line of plain Persian.

**Don't**

- Do not duplicate chat; game events also appear in chat as SystemMessages.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{style:{maxWidth:'360px', padding:'8px'}}, h(B.MoveLog,{items:[{round:'دور ۳'},{seat:1, name:'آرش', text:'یک جاده ساخت', time:'۲ دقیقه'},{seat:2, name:'سارا', text:'۲ گندم با ۱ سنگ معامله کرد', time:'۱ دقیقه'},{seat:4, name:'مینا', text:'تاس ۸ انداخت؛ همه منابع گرفتند', time:'الان', isNew:true}]}))
```
