Connection status as dot + word: متصل، در حال اتصال دوباره…، اتصال قطع شد.

## When to use

Game bar meta; connection-lost overlays; opponent offline notices.

## Props / what the consumer provides

`state` (`ok`, `retry`, `lost`), `label`.

| Prop | Type | Description |
|---|---|---|
| `state` | `'ok' \| 'retry' \| 'lost'` | — |
| `label` | `Node` | Override text («متصل», «در حال اتصال دوباره…», «اتصال قطع شد»). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ConnectionProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always a word with the dot (status is never colour-only).

**Don't**

- Do not hide `retry`; players need to know why moves are slow.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(h(B.Connection,{state:'ok'}), h(B.Connection,{state:'retry'}), h(B.Connection,{state:'lost'}), h(B.Connection,{state:'ok', label:'آنلاین'}))
```
