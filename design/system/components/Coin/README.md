An amount of «سکه» with a real metallic-gold coin (`.bgv-coin`, sizes `--sm`/`--lg`) and the wallet chip (`.bgv-coinchip`).

## When to use

Wallet, shop prices, rewards; the chip shows the balance in the sidebar footer and the phone top bar.

## Props / what the consumer provides

`amount` (number → «۲٬۴۸۰»), `size` (`sm` top bar, md inline, `lg` wallet hero), `unit` to add the word «سکه», `chip` for the balance chip and `href` to link it to the wallet.

| Prop | Type | Description |
|---|---|---|
| `amount` | `number \| string` | Amount; rendered with Persian digits and «٬». |
| `size` | `'sm' \| 'md' \| 'lg'` | sm 14px coin (top bar), md 18px (inherits text size), lg 32px coin / 28px number (wallet). Coins are real metallic gold (--coin-light/--coin/--coin-dark). |
| `unit` | `boolean \| string` | Append the unit word («سکه» when true). |
| `chip` | `boolean` | Wallet balance chip (.bgv-coinchip) for the sidebar footer and the phone top bar. |
| `href` | `string` | With `chip`: link to the wallet. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `CoinProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- The coin is real gold (`--coin-light`, `--coin`, `--coin-dark`), deliberately outside the brand palette so money reads as money.
- Show the balance once in the shell: the chip in the sidebar footer (desktop) or the top bar (phone, `size="sm"`).
- Write signed changes with `Reward` («+۴۰ سکه»).

**Don't**

- Do not recolour the coin with brand gold (`--accent`) or draw your own coin.
- Do not show coin prices for premium-only items.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var cell = function (node, t) { return h('div', {style:{display:'grid', gap:'8px', justifyItems:'start'}}, node, cap(t)); };
  var sw = function (v, n) { return h('span', {style:{display:'inline-flex', alignItems:'center', gap:'6px'}}, h('i', {style:{width:'20px', height:'20px', borderRadius:'50%', background:'var(' + v + ')', boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.25)'}}), h('span', {className:'bgv-latin', style:{fontSize:'12px'}}, n)); };
  return col(
    row(cell(h(B.Coin,{amount:2480, size:'sm'}), 'sm، نوار بالا'), cell(h(B.Coin,{amount:2480}), 'md، متن'), cell(h(B.Coin,{amount:2480, size:'lg'}), 'lg، کیف پول'), cell(h(B.Coin,{amount:470, unit:true}), 'قیمت با واحد')),
    row(cell(h(B.Coin,{chip:true, amount:2480, href:'#'}), 'چیپ موجودی، سایدبار'),
      cell(h('div', {style:{display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px 6px 12px', borderRadius:'12px', background:'var(--surface-chrome)', border:'1px solid var(--line)'}}, h(B.Coin,{chip:true, size:'sm', amount:2480, href:'#'}), h(B.Button,{iconOnly:true, variant:'ghost', icon:'bell'},'اعلان‌ها')), 'نوار بالای گوشی'),
      cell(h('div', {style:{display:'flex', gap:'12px', flexWrap:'wrap'}}, sw('--coin-light', 'coin-light'), sw('--coin', 'coin'), sw('--coin-dark', 'coin-dark')), 'توکن‌های طلای واقعی'))
  );
})()
```
