The floating quick-reaction strip shown on long-press/hover above the message menu.

**Material (v2.0):** the bar is a floating board (hard 6px shadow); each emoji is a row button — tints on hover (pointer only), a hard inner edge on press.

## When to use

Message menu on phones (with `Menu` below) and hover on desktop.

## Props / what the consumer provides

`emojis` (default 👍 😂 😮 😢 🔥 👏), `onPick`, `more`, `selected`.

| Prop | Type | Description |
|---|---|---|
| `emojis` | `string[]` | Default 👍 😂 😮 😢 🔥 👏. |
| `onPick` | `(emoji: string) => void` | — |
| `more` | `boolean \| (() => void)` | Trailing «more» button (true or handler). |
| `selected` | `string` | Your current reaction. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ReactionBarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show above the message menu (پاسخ، ویرایش، کپی، حذف، گزارش، بی‌صدا کردن).

**Don't**

- Do not use emoji outside chat, reactions and quick chat.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.ReactionBar,{more:true}), h(B.ReactionBar,{selected:'😂', emojis:['👍','😂','😮','🔥']}))
```
