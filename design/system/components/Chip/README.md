A pill used for filters, quick choices and, in its dashed amber `invite` variant, empty seats and invitations.

**Material (v2.0): small token** — white fill, 1.5px frame and a 3px hard shadow in `--ink-btn` (soft slate #A1AAB1 in light since v2.1.11, slate #4A6476 in dark since v2.1.12); hover lifts 1px, press lands. Selected = the same raised token, navy (`--selected`) with a deeper `--ink-selected` frame and shadow. `invite` is an empty dashed slot, not a token. On the felt: in light the same white chip with `--ink-btn` (v2.1.11); in dark cream cardboard with the slate `--ink-btn` frame and shadow.

## Large chip (v2.1.14)

`size="lg"` is the category row on the home pages («همه ۶۷»، «زنده الان ۴۲ میز»، «دونفره»…): the same token, one step bigger — 52px, 1.5px frame and a **4px** hard shadow in `--ink-btn`, hover lifts 1px, press lands 4px. The icon sits in a 36px disc (`bgv-chip__ic`, `--surface-sunken` on the chip, `--on-selected` on a selected chip); the count is `bgv-chip__count` (12px, 0.75 opacity). Under 900px (phone shell): 48px, 34px disc, 14px text. Use it only for a short row of top-level categories (≤6); filters keep `md`. Markup without React:

```html
<div class="bgv-chips bgv-chips--scroll" role="group" aria-label="دسته‌بندی بازی‌ها">
  <button type="button" class="bgv-chip bgv-chip--lg is-selected" aria-pressed="true"><span class="bgv-chip__ic" aria-hidden="true"><svg class="bgv-icon">…</svg></span>همه<span class="bgv-num bgv-chip__count">۶۷</span></button>
  <button type="button" class="bgv-chip bgv-chip--lg" aria-pressed="false">…</button>
</div>
```

## When to use

Catalog filters (تعداد بازیکن، زمان، سبک), table options, quick replies, and «صندلی خالی، دعوت کنید» in lobbies.

## Props / what the consumer provides

`children` label, optional `icon` and `count`; `selected` for filter state (sets `aria-pressed`); `variant="invite"` only for invitations.

| Prop | Type | Description |
|---|---|---|
| `variant` | `'default' \| 'invite'` | invite = transparent slot with a dashed `--heading` border, for empty seats and invitations only. |
| `selected` | `boolean` | Selected filter chip (navy `--selected` fill, aria-pressed). |
| `size` | `'sm' \| 'md' \| 'lg'` | sm 28px (10px sides, 13px text), md 36px (14px sides, 14px text, default), lg 52px (48px under 900px). One size per row or group. |
| `icon` | `IconName` | Leading 16px icon; in `lg` a 20px icon inside a 36px disc (`bgv-chip__ic`). |
| `count` | `number` | Muted count after the label. |
| `href` | `string` | — |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ChipProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use `variant="invite"` (transparent, dashed `--heading` border) for empty seats and invite highlights only; the dashed border and the plus icon tell it apart from a selected chip, which is solid amber too.
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
  cap('اندازهٔ md، ارتفاع ۳۶ پیکسل (پیش‌فرض): فیلترها، گزینه‌ها و دعوت'),
  row(h(B.Chip,{selected:true, icon:'check'},'زنده'), h(B.Chip,{selected:false},'نوبتی'), h(B.Chip,{icon:'users', count:24},'۲ تا ۴ نفر'), h(B.Chip,{variant:'invite', icon:'plus'},'صندلی خالی، دعوت کنید')),
  cap('اندازهٔ sm، ارتفاع ۲۸ پیکسل: جاهای فشرده، مثل برچسب کارت و دعوت در فهرست'),
  row(h(B.Chip,{size:'sm'},'خانوادگی'), h(B.Chip,{size:'sm', selected:true},'رتبه‌ای'), h(B.Chip,{variant:'invite', size:'sm', icon:'user-plus'},'دعوت دوست')),
  cap('اندازهٔ lg، ارتفاع ۵۲ پیکسل (در گوشی ۴۸): فقط ردیف دسته‌بندی صفحهٔ خانه'),
  row(h(B.Chip,{size:'lg', selected:true, icon:'layout-grid', count:67},'همه'), h(B.Chip,{size:'lg', selected:false, icon:'swords', count:24},'دونفره'), h(B.Chip,{size:'lg', selected:false, icon:'bot', count:9},'با ربات'))
)
```
