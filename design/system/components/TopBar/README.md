The 56px (`--topbar-h`) phone top bar on `--surface-chrome`. Order: symbol (home) or back, page title, **search magnifier**, the real-gold coin chip, the bell. Guest: magnifier and a secondary «ورود / ثبت‌نام». The logo and the coin keep a 44px hit area.

## When to use

Phone pages outside the table (inside `AppShell` it is sticky and edge to edge). The table uses `GameBar`.

## Props / what the consumer provides

`title`, `onBack`, `leading` (symbol logo), `search` (`{href}` or `{onClick}`: opens the full-screen `SiteSearch` sheet), `actions` (coin chip `size="sm"`, bell with count; for a guest the secondary «ورود / ثبت‌نام»).

| Prop | Type | Description |
|---|---|---|
| `title` (required) | `Node` | — |
| `onBack` | `() => void` | Shows a back button (arrow-right in RTL). |
| `backLabel` | `string` | — |
| `leading` | `Node` | — |
| `search` | `{ href, onClick } \| Node` | Magnifier after the title. |
| `actions` | `Node` | After the search: coin chip and bell, or the guest login button. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TopBarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Canonical: symbol → title → search → coin chip → bell with a crimson count. Guest: symbol → title → search → «ورود / ثبت‌نام» (secondary).
- Back is `arrow-right` in RTL and labelled «بازگشت».

**Don't**

- Do not add more than search + two actions.
- Do not centre the title.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div', {style:{display:'grid', gap:'12px', maxWidth:'390px'}},
  h(B.TopBar,{leading:h(B.Logo,{src:'assets/symbol-primary-small.svg', srcDark:'assets/symbol-reversed-small.svg', height:32, alt:'', 'aria-label':'خانه', href:'#'}), title:'خانه', actions:[h(B.Coin,{key:1, chip:true, size:'sm', amount:2480, href:'#'}), h(B.Button,{key:2, variant:'ghost', iconOnly:true, icon:'bell', count:5},'اعلان‌ها')]}),
  h(B.TopBar,{title:'میزهای من', onBack:function(){}, actions:h(B.Button,{variant:'ghost', iconOnly:true, icon:'search'},'جست‌وجو')})
)
```
