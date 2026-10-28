An amber (`--invite-strong`) line marking where unread messages start.

## When to use

Inside the chat list when the panel reopens.

## Props / what the consumer provides

`count` or `text`.

| Prop | Type | Description |
|---|---|---|
| `count` | `number` | — |
| `text` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `UnreadDividerProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Scroll to the divider on open.

**Don't**

- Do not show it when there is nothing new.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.UnreadDivider,{count:3}), h(B.UnreadDivider))
```
