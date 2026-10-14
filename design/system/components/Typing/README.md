The «… در حال نوشتن…» indicator with bouncing dots.

## When to use

Bottom of the chat list.

## Props / what the consumer provides

`names` or `text`.

| Prop | Type | Description |
|---|---|---|
| `names` | `string[]` | — |
| `text` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TypingProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show at most two names; then «۳ نفر در حال نوشتن…».

**Don't**

- Do not show typing for spectators (they cannot write).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.Typing,{names:['نیلوفر']}), h(B.Typing,{names:['آرش','سارا']}), h(B.Typing,{names:['آرش','سارا','کاوه']}))
```
