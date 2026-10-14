A square-cornered outline label for metadata such as rule variants, codes and categories.

## When to use

Game rules («هدف ۵۰۰»), versions, admin codes, table ids, catalog categories.

## Props / what the consumer provides

`children`, optional `icon`, `latin` to set Manrope for codes.

| Prop | Type | Description |
|---|---|---|
| `latin` | `boolean` | Set in Manrope (codes, Latin labels). |
| `icon` | `IconName` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TagProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use for neutral metadata; use `Badge` for status.
- Set codes and ids with `latin`.

**Don't**

- Do not colour tags by meaning; they stay `--label` on `--line`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(h(B.Tag,null,'هدف ۵۰۰'), h(B.Tag,{icon:'crown'},'میزبان'), h(B.Tag,null,'گسترش دریانوردان'), h(B.Tag,{latin:true},'TBL-4821'), h(B.Tag,{latin:true},'v1.1'))
```
