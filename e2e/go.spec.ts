import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «گو» end to end: the tutorial (captures, connecting, pass, dead stone, scoring) and a short 9×9 game through the board: stones on lit
// points, then pass-pass, a dead-stone mark, and both players accept the count.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/go/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: atari and capture, connecting, a group capture, pass, dead stone and count', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/go');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`))).toBeVisible();
    await p.locator('.go-pt--hint').click();
  }
  await expect(p.getByText(/آموزش: مرحله ۴ از ۶/)).toBeVisible();
  await p.getByRole('button', { name: 'پاس', exact: true }).click();
  await expect(p.getByText(/آموزش: مرحله ۵ از ۶/)).toBeVisible();
  await p.locator('.go-pt[aria-label^="C7:"]').click();
  await expect(p.getByText(/آموزش: مرحله ۶ از ۶/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-scoring'), fullPage: true });
  await p.getByRole('button', { name: 'تأیید شمارش' }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('two players play a short 9×9 game and agree on the count', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/go/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.go-board')).toBeVisible();

  const mover = async (): Promise<Page> => {
    for (let k = 0; k < 50; k++) {
      for (const p of pages) if (await p.getByRole('button', { name: 'پاس', exact: true }).count()) return p;
      await host.waitForTimeout(100);
    }
    throw new Error('nobody to move');
  };
  for (let n = 0; n < 24; n++) {
    const p = await mover();
    const before = await p.locator('.go').getAttribute('data-moves');
    const pts = p.locator('.go-pt--ok');
    await pts.nth((n * 17) % (await pts.count())).click();
    await expect.poll(() => p.locator('.go').getAttribute('data-moves'), { timeout: 10_000 }).not.toBe(before);
  }
  for (const p of pages) await p.screenshot({ path: shot(info.project.name, `mid-${pages.indexOf(p)}`), fullPage: true });
  for (let k = 0; k < 2; k++) {
    const p = await mover();
    await p.getByRole('button', { name: 'پاس', exact: true }).click();
    await expect.poll(async () => (await p.getByRole('button', { name: 'پاس', exact: true }).count()) === 0).toBe(true);
  }
  for (const p of pages) await expect(p.locator('.go')).toHaveAttribute('data-phase', 'scoring');
  // One player marks a stone dead, which clears acceptance; then both accept.
  await host.locator('.go-pt--mark').first().click();
  await expect(host.locator('.go-stone--dead').first()).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'scoring'), fullPage: true });
  // Accept one after the other; the guest waits until it sees the host's acceptance (fresh revision).
  await host.getByRole('button', { name: 'تأیید شمارش' }).click();
  await expect(guest.locator('.go-side__ok')).toHaveCount(1);
  await guest.getByRole('button', { name: 'تأیید شمارش' }).click();
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
