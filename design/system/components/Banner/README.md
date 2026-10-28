An inline message strip in info, success, warning or danger tones with icon and optional action.

## When to use

Connection problems, coin shortfalls, maintenance notices, form-level errors.

## Props / what the consumer provides

`tone`, `title`, `text`, `icon`, `action`, `onClose`.

| Prop | Type | Description |
|---|---|---|
| `tone` | `'info' \| 'success' \| 'warning' \| 'danger'` | — |
| `title` | `Node` | — |
| `text` | `Node` | — |
| `icon` | `IconName` | — |
| `action` | `Node` | — |
| `onClose` | `() => void` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `BannerProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Lead with the outcome in `title`, then the fix.
- Icons are built in per tone (status is never colour-only).

**Don't**

- Do not use banners for marketing.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Banner,{tone:'warning', title:'۱۵۰ سکه کم دارید', text:'یک بستهٔ سکه بخرید یا با مأموریت‌های هفتگی سکه جمع کنید.', action:h(B.Button,{size:'sm', variant:'primary'},'خرید سکه')}),
  h(B.Banner,{title:'به‌روزرسانی امشب', text:'ساعت ۲ تا ۳ بامداد میزهای زنده ساخته نمی‌شوند؛ میزهای نوبتی متوقف می‌مانند.', onClose:function(){}}),
  h(B.Banner,{tone:'danger', title:'پرداخت ناموفق بود', text:'مبلغی از حساب شما کم نشده است.'}),
  h(B.Banner,{tone:'success', title:'اشتراک پریمیوم فعال شد'})
)
```
