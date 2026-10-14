A centered empty/loading/error/denied/offline state with icon tile, title, text and recovery action.

## When to use

Empty lists, failed loads, permission walls, offline screens, search with no results.

## Props / what the consumer provides

`kind`, `title`, `text`, `action` (one primary Button usually), `icon`.

| Prop | Type | Description |
|---|---|---|
| `kind` | `'loading' \| 'empty' \| 'error' \| 'denied' \| 'offline'` | — |
| `title` | `Node` | Heading; defaults per kind in Persian. |
| `text` | `Node` | One or two sentences: what happened and what to do. |
| `action` | `Node` | Recovery action(s), usually one primary Button. |
| `icon` | `IconName` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `StateBlockProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Say what happened and what to do next, in one or two sentences.
- Give one primary recovery action: «تلاش دوباره», «ساخت میز».

**Don't**

- Do not blame the user.
- Do not show raw error codes without a human sentence.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:'12px'}},
  h(B.Card,{flush:true}, h(B.StateBlock,{style:{padding:'24px 16px'}, kind:'empty', title:'هنوز میز نوبتی ندارید', text:'یک میز بسازید یا به میزهای باز بپیوندید.', action:h(B.Button,{variant:'primary', icon:'plus'},'ساخت میز')})),
  h(B.Card,{flush:true}, h(B.StateBlock,{style:{padding:'24px 16px'}, kind:'error', title:'بارگذاری نشد', text:'اتصال به سرور برقرار نشد. چند لحظه بعد دوباره امتحان کنید.', action:h(B.Button,{icon:'refresh-cw'},'تلاش دوباره')})),
  h(B.Card,{flush:true}, h(B.StateBlock,{style:{padding:'24px 16px'}, kind:'offline', text:'میزهای زنده تا برگشتن اتصال متوقف‌اند.'}))
)
```
