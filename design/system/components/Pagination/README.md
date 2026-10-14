Page buttons with previous/next and ellipses.

## When to use

Rankings, history, admin tables (desktop).

## Props / what the consumer provides

`page`, `pages`, `onChange`.

| Prop | Type | Description |
|---|---|---|
| `page` (required) | `number` | Current page, 1-based. |
| `pages` (required) | `number` | — |
| `onChange` | `(page: number) => void` | — |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PaginationProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep it under the table, end-aligned.
- Prefer infinite lists on phones.

**Don't**

- Do not paginate lists under ~30 rows.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.Pagination,{page:4, pages:12}), h(B.Pagination,{page:1, pages:3}))
```
