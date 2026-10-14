The time display for every clock model, in six states (calm, warn, critical, paused, stale, frozen) and four sizes.

## When to use

Turn pill (md), HUD cards (chip), action dock (lg), lists and notifications (bar). Covers per-turn deadlines (live 15/30/60/120/300 s, turn-based 12/24/48/72 h), banks, bank + increment and simultaneous deadlines.

## Props / what the consumer provides

`time` (seconds → «۰:۴۲», «۱۲:۰۵», «۵ ساعت و ۲۰ دقیقه», «۲ روز») or text, `p` remaining 0–1, `state` (auto from `p`: >50% calm, ≤50% warn, ≤20% critical; pass `critical` from the real threshold), `sub`, `size`, `icon`.

| Prop | Type | Description |
|---|---|---|
| `state` | `ClockState` | calm >50%, warn 50%→critical, critical (live: last 10 s; turn-based: last hour — Table.tsx lowSeconds), paused, stale (your connection dropped), frozen (server incident). Auto from `p` when omitted (≤50% warn, ≤20% critical). |
| `p` | `number` | Remaining fraction 0–1. |
| `time` (required) | `number \| string` | Seconds (formatted «۰:۴۲», «۱۲:۰۵», «۵ ساعت و ۲۰ دقیقه», «۲ روز»; chips drop the minutes: «۵ ساعت») or ready text. |
| `sub` | `Node` | Second line, e.g. «زمان شما», «بانک زمان», «+۵ ثانیه». |
| `size` | `'chip' \| 'md' \| 'lg' \| 'bar'` | chip (HUD), md (turn pill, default), lg (action dock), bar (thin track). |
| `icon` | `IconName \| null` | Ring icon; default pause (paused) / lock (frozen). null for none. |
| `label` | `string` | Screen-reader label. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ClockProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- critical = live tables: last 10 s; turn-based: last hour (the `lowSeconds` threshold in Table.tsx). Critical pulses.
- stale = YOUR connection dropped: dashed ring, `wifi-off`, the last confirmed time and «در حال اتصال دوباره». It never counts on its own; the server clock keeps running.
- frozen = a server incident only: every clock pauses (lock icon) and deadlines are extended by the outage.
- paused = not running (not your turn, bank clocks). The state is never colour-only: icons, pulse and the screen-reader label say it.

**Don't**

- Do not use `frozen` for your own connection loss; that is `stale`.
- Do not invent other clock colours; use `--clock-*` tokens.
- Do not show seconds for turn-based clocks over an hour.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var c = function (node, t) { return h('div', {style:{display:'grid', gap:'6px', justifyItems:'start', minWidth:'100px'}}, node, cap(t)); };
  return col(
    row(c(h(B.Clock,{time:42, p:0.8}), 'calm، آرام'), c(h(B.Clock,{time:24, p:0.4}), 'warn، هشدار'), c(h(B.Clock,{time:7, p:0.1}), 'critical، بحرانی'),
      c(h(B.Clock,{time:225, state:'paused', p:0.73}), 'paused، متوقف'), c(h(B.Clock,{time:27, state:'stale', p:0.45}), 'stale، اتصال شما'), c(h(B.Clock,{time:35, state:'frozen', p:0.58}), 'frozen، مشکل سرور')),
    row(h(B.Clock,{size:'lg', time:27, state:'stale', sub:'در حال اتصال دوباره'}), h(B.Clock,{size:'lg', time:19200, p:0.66, sub:'نوبتی'}), h(B.Clock,{size:'chip', time:13, p:0.43}), h(B.Clock,{size:'chip', time:172800, p:0.9}), h(B.Clock,{size:'chip', time:27, state:'stale'}), h(B.Clock,{size:'chip', time:300})),
    h('div', {style:{maxWidth:'320px'}}, h(B.Clock,{size:'bar', time:18, p:0.3, sub:'نوبت شما'})),
    felt({style:{padding:'16px'}}, row(h(B.Clock,{time:42, p:0.8}), h(B.Clock,{time:24, p:0.4}), h(B.Clock,{time:7, p:0.1}), h(B.Clock,{time:90, state:'paused', p:0.5}), h(B.Clock,{time:27, state:'stale', p:0.45}), h(B.Clock,{time:35, state:'frozen', p:0.58}), h(B.Clock,{size:'chip', time:13, p:0.43})))
  );
})()
```
