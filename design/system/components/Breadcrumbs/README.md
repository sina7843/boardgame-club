A trail of parent pages with the current page last.

## When to use

Deep desktop pages: wiki, admin, club sub-pages.

## Props / what the consumer provides

`items` ({label,href}); the last is the current page.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ label: Node; href?: string }>` | Last item is the current page. |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `BreadcrumbsProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use RTL chevrons (`chevron-left`) between items (built in).

**Don't**

- Do not use on phones; use `TopBar` back.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Breadcrumbs,{items:[{label:'راهنما',href:'#'},{label:'بازی‌ها',href:'#'},{label:'کاتان',href:'#'},{label:'قوانین تجارت'}]})
```
