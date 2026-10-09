import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «چهل‌تکه» end to end: the tutorial (sew, leather and 7×7 bonus, advance to the end) and a full two-player game.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/patchwork/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: rotate and sew, leather 7×7, sew, advance to the end', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/patchwork');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const at = (n: string) => expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۵`))).toBeVisible();
  await at('۱');
  await p.locator('.pw-patch.pw-hint').click();
  await p.getByRole('button', { name: /^چرخش/ }).click();
  await p.locator('.pw-cell.pw-hint').click();
  await p.screenshot({ path: shot(info.project.name, 'tutorial-sew'), fullPage: true });
  await p.getByRole('button', { name: 'بدوز' }).click();
  await at('۲');
  // Leather: the single empty cell inside the 7×7 square (row 5, column 5, zero-based).
  await p.locator('.pw-quilt--big button.pw-cell').nth(5 * 9 + 5).click();
  await at('۳');
  await p.locator('.pw-patch.pw-hint').click();
  await p.locator('.pw-cell.pw-hint').click();
  await p.getByRole('button', { name: 'بدوز' }).click();
  await at('۴');
  await p.getByRole('button', { name: /^جلو رفتن/ }).click();
  await at('۵');
  await p.getByRole('button', { name: /^جلو رفتن/ }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

const ANCHORS = [[0, 0], [0, 4], [4, 0], [4, 4], [0, 6], [6, 0], [2, 2], [6, 4], [4, 6], [6, 6], [2, 6], [6, 2]];

async function turn(p: Page, n: number): Promise<boolean> {
  const cells = p.locator('.pw-quilt--big button.pw-cell');
  const advance = p.getByRole('button', { name: /^جلو رفتن/ });
  if (!(await advance.count())) {
    if (!(await cells.count())) return false;
    // Leather: the first empty cell.
    const i = await cells.evaluateAll((els) => els.findIndex((e) => !/fabric/.test(e.className)));
    await cells.nth(i).click();
    return true;
  }
  const patch = p.locator('.pw-patch--offer:not([disabled])');
  if (n % 2 === 0 && await patch.count()) {
    await patch.first().click();
    const sew = p.getByRole('button', { name: 'بدوز' });
    for (const [r, c] of ANCHORS) {
      await cells.nth(r! * 9 + c!).click();
      if (await sew.isEnabled()) { await sew.click(); return true; }
    }
    await patch.first().click(); // deselect
  }
  await advance.click();
  return true;
}

test('two quilters play «چهل‌تکه» to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host, guest] = pages as [Page, Page];
  await host.goto('/games/patchwork/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite); await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.pw-track')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.pw').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.pw').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 16) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(100);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
