import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «هیت» end to end: the tutorial (gear shifts, adrenaline + slipstream, a corner, discard, stress, boost, the finish)
// by following the highlighted hints, and a full two-player race to the result.
test.describe.configure({ mode: 'serial', timeout: 900_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/heat/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const STEPS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷'];

test('interactive tutorial: shifting, adrenaline, slipstream, a corner, discards, stress, boost and the finish', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/heat');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const done = p.getByRole('heading', { name: 'آموزش کامل شد' });
  for (const [i, n] of STEPS.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۷`))).toBeVisible();
    const next = i + 1 < STEPS.length ? p.getByText(new RegExp(`آموزش: مرحله ${STEPS[i + 1]} از ۷`)) : done;
    for (let k = 0; k < 12 && !(await next.count()); k++) {
      const hint = p.locator('.ht .ht-hint:not([disabled])').first();
      if (await hint.count()) await hint.click();
      if (i === 1 && k === 0) await p.screenshot({ path: shot(info.project.name, 'tutorial-react'), fullPage: true });
      await p.waitForTimeout(200);
    }
  }
  await expect(done).toBeVisible();
  await p.context().close();
});

/** One action for this client if it has one: plan (cards for the offered gear, then «ثبت») or end the move. */
async function act(p: Page): Promise<boolean> {
  const submit = p.locator('.ht-submit');
  if (await submit.count()) {
    for (let k = 0; k < 7 && (await submit.isDisabled()); k++) {
      const slot = p.locator('.ht__hand .ht-slot:not([disabled])[aria-pressed="false"]').first();
      if (!(await slot.count())) break;
      await slot.click();
    }
    if (await submit.isDisabled()) return false;
    await submit.click();
    return true;
  }
  const end = p.locator('.ht-end:not([disabled])');
  if (await end.count()) { await end.click(); return true; }
  return false;
}

test('two players race «هیت» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/heat/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.ht-track')).toBeVisible();

  for (let n = 0; n < 600; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.ht').getAttribute('data-seq');
      if (!(await act(p))) continue;
      await expect.poll(() => p.locator('.ht').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
