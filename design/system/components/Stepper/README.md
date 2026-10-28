The login stepper (`.bgv-steps`): شماره → کد تأیید → پروفایل. The full login page and the in-page login sheet use the same one.

**Material (v2.1):** print, not pressable. Done = a navy disc with a tick (cream with a navy tick in dark). Current = a white disc with a 2px navy ring and a bold label. Next = a white disc with a 1.5px `--field-edge` (3:1) and a muted label. A 20×2px rule joins the steps and turns navy once passed.

## When to use

Multi-step login only (phone page, desktop page, `LoginSheet`). For a game's turn order use the table components.

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `steps` | `Node[]` | Default: شماره، کد تأیید، پروفایل. |
| `current` | `number` | 0-based; earlier steps are done. |
| `align` | `'center' \| 'start'` | `start` inside sheets. |
| `label` | `string` | `aria-label` of the `<ol>` (default «مراحل ورود»). |

The current step carries `aria-current="step"`; the rules are `aria-hidden`. Types: `StepperProps` in `components/index.d.ts`.

Markup (for static pages): `<ol class="bgv-steps"><li class="is-done"><b>…</b>شماره</li><li class="bgv-steps__bar is-done" aria-hidden="true"></li><li class="is-cur" aria-current="step"><b>۲</b>کد تأیید</li>…</ol>`. It replaces the local `.x-steps` of the login boards and the old `.bgv-steps` (dots and bars).

## Do / Don't

**Do**

- Keep the three labels short; the whole stepper fits in one 358px line.

**Don't**

- Do not show the stepper on a one-step form.
