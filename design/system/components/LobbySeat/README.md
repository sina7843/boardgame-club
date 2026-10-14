A lobby seat row: the player's identity with ready state, or an empty seat with the coral invite chip.

## When to use

Table lobby (before start), create-table preview, rematch seat changes.

## Props / what the consumer provides

Identity props (`name`, `initials`, `seat`, `you`, `frame`, `league`, `title`, `bot`), `ready`, `host`, `actions`; or `empty` with `inviteLabel`/`onInvite`.

| Prop | Type | Description |
|---|---|---|
| `empty` | `boolean` | Empty seat → coral invite chip. |
| `inviteLabel` | `Node` | — |
| `onInvite` | `() => void` | — |
| `name` | `Node` | — |
| `ready` | `boolean` | true «آماده», false «منتظر». |
| `host` | `boolean` | «میزبان» tag. |
| `actions` | `Node` | — |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `LobbySeatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Empty seats always show `Chip variant="invite"` «صندلی خالی، دعوت کنید» (coral = invitation).
- Ready is a word + icon: «آماده» / «منتظر».

**Don't**

- Do not hide empty seats.
- Do not let a non-host kick players (no actions for them).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gap:'8px', maxWidth:'440px'}},
  h(B.LobbySeat,{name:'نیلوفر', initials:'ن', seat:1, frame:'master', league:'master', title:'رستم دستان', host:true, ready:true}),
  h(B.LobbySeat,{name:'مینا', initials:'م', seat:4, you:true, frame:'gold', league:'gold', title:'شب‌زنده‌دار', ready:false}),
  h(B.LobbySeat,{name:'ربات', initials:'ر', seat:3, bot:true, sub:'سطح متوسط', ready:true, actions:h(B.Button,{size:'sm', variant:'ghost', iconOnly:true, icon:'x'},'برداشتن ربات')}),
  h(B.LobbySeat,{empty:true})
)
```
