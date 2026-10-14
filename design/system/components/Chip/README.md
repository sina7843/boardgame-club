A pill used for filters, quick choices and, in its coral `invite` variant, empty seats and invitations.

## When to use

Catalog filters (تعداد بازیکن، زمان، سبک), table options, quick replies, and «صندلی خالی، دعوت کنید» in lobbies.

## Props / what the consumer provides

`children` label, optional `icon` and `count`; `selected` for filter state (sets `aria-pressed`); `variant="invite"` only for invitations.

| Prop | Type | Description |
|---|---|---|
| `variant` | `'default' \| 'invite'` | invite = coral dashed chip for empty seats and invitations only. |
| `selected` | `boolean` | Selected filter chip (primary fill, aria-pressed). |
| `size` | `'sm' \| 'md'` | sm 28px, md 36px. |
| `icon` | `IconName` | Leading 16px icon. |
| `count` | `number` | Muted count after the label. |
| `href` | `string` | — |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ChipProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use `variant="invite"` (coral `--invite`, dashed `--on-invite` border) for empty seats and invite highlights only.
- Selected chips use the primary fill; keep labels short («۲ تا ۴ نفر», «زنده»).
- Group chips in a `ChipGroup` so they wrap or scroll consistently.

**Don't**

- Do not use the invite chip as a general call-to-action button.
- Do not signal selection by colour alone; the selected chip also gets `aria-pressed` and a filled tile.
- Do not use chips for navigation between pages; use `PageTabs`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Chip,{selected:true, icon:'check'},'زنده'), h(B.Chip,{selected:false},'نوبتی'), h(B.Chip,{icon:'users', count:24},'۲ تا ۴ نفر'), h(B.Chip,{size:'sm'},'خانوادگی'), h(B.Chip,{size:'sm', selected:true},'رتبه‌ای')),
  row(h(B.Chip,{variant:'invite', icon:'plus'},'صندلی خالی، دعوت کنید'), h(B.Chip,{variant:'invite', size:'sm', icon:'user-plus'},'دعوت دوست'))
)
```
