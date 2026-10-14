The 56px phone top bar on `--surface-chrome`: symbol (home), page title, the real-gold coin chip and the bell; or back + title on inner pages.

## When to use

Phone pages outside the table (inside `AppShell` it is sticky and edge to edge). The table uses `GameBar`.

## Props / what the consumer provides

`title`, `onBack`, `leading` (symbol logo), `actions` (coin chip `size="sm"`, bell with count).

| Prop | Type | Description |
|---|---|---|
| `title` (required) | `Node` | — |
| `onBack` | `() => void` | Shows a back button (arrow-right in RTL). |
| `backLabel` | `string` | — |
| `leading` | `Node` | — |
| `actions` | `Node` | Icon buttons at the end (bell with count, search). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TopBarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Canonical: symbol → title → coin chip → bell with a crimson count.
- Back is `arrow-right` in RTL and labelled «بازگشت».

**Don't**

- Do not exceed two actions.
- Do not centre the title.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div', {style:{display:'grid', gap:'12px', maxWidth:'390px'}},
  h(B.TopBar,{leading:h(B.Logo,{src:'assets/symbol-primary-small.svg', srcDark:'assets/symbol-reversed-small.svg', height:32, alt:'', 'aria-label':'خانه', href:'#'}), title:'خانه', actions:[h(B.Coin,{key:1, chip:true, size:'sm', amount:2480, href:'#'}), h(B.Button,{key:2, variant:'ghost', iconOnly:true, icon:'bell', count:5},'اعلان‌ها')]}),
  h(B.TopBar,{title:'میزهای من', onBack:function(){}, actions:h(B.Button,{variant:'ghost', iconOnly:true, icon:'search'},'جست‌وجو')})
)
```
