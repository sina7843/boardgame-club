A page title block with sub-line and end-aligned actions.

## When to use

Top of every desktop page and wide phone pages.

## Props / what the consumer provides

`title`, `sub`, `eyebrow`, `actions`, `level`.

| Prop | Type | Description |
|---|---|---|
| `title` (required) | `Node` | — |
| `sub` | `Node` | — |
| `eyebrow` | `Node` | — |
| `actions` | `Node` | Buttons at the end (one primary at most). |
| `level` | `1 \| 2` | 1 = h1 (default), 2 = h2. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PageHeadProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- One primary action at most in `actions`.
- Sub-line: one sentence of context with Persian digits.

**Don't**

- Do not repeat the sidebar label as an eyebrow.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.PageHead,{title:'میزهای من', sub:'۱ میز زنده و ۷ میز نوبتی؛ ۲ میز منتظر شماست', actions:[h(B.Button,{key:1, variant:'secondary', icon:'history'},'تاریخچه'), h(B.Button,{key:2, variant:'primary', icon:'plus'},'ساخت میز')]}),
  h(B.PageHead,{eyebrow:'فصل پاییز', title:'رتبه‌بندی', level:2, sub:'تا پایان فصل ۲۴ روز مانده'})
)
```
