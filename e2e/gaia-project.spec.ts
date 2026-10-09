import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «گایا پراجکت» end to end: the tutorial (round 6 teaching position: mine with terraforming, trading station,
// federation with a satellite, research, a power action, pass to the final scoring) through the highlighted hints, and a
// full two-player game from faction choice through set-up and six rounds (a mine early, then passing) to the result.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/gaia-project/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

test('interactive tutorial: mine, trading station, federation, research, power action, pass', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/gaia-project');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶']) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`))).toBeVisible();
    const button = p.locator('button.gp-hint');
    if (await button.count()) await button.first().click();
    else {
      await p.locator('.gp-hex--hint').first().click();
      if (step === '۱') await p.screenshot({ path: shot(info.project.name, 'tutorial-hex'), fullPage: true });
      await p.locator('.gp-hexmenu button.gp-hint').click();
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

/** One move for this page if it has one (decline/first decision, first faction, first booster, a mine in the first
 *  rounds, otherwise pass; set-up structures on the first highlighted hex). */
async function turn(p: Page, n: number): Promise<boolean> {
  const decide = p.locator('.gp-decide button');
  if (await decide.count()) {
    const decline = decide.filter({ hasText: 'رد کردن' });
    await ((await decline.count()) ? decline.first() : decide.first()).click();
    return true;
  }
  for (const sel of ['.gp-faction-pick', '.gp-booster-pick']) {
    const b = p.locator(sel);
    if (await b.count()) { await b.first().click(); return true; }
  }
  const pass = p.locator('button.gp-pass');
  const hexes = p.locator('.gp-hex--legal');
  const round = Number(await p.locator('.gp').getAttribute('data-round'));
  if (await pass.count() && (round > 2 || n % 2 === 1 || !(await hexes.count()))) { await pass.first().click(); return true; }
  if (await hexes.count()) {
    await hexes.first().click();
    const menu = p.locator('.gp-hexmenu button');
    const mine = menu.filter({ hasText: /ساخت معدن|گذاشتن/ });
    await ((await mine.count()) ? mine.first() : menu.first()).click();
    return true;
  }
  return false;
}

test('two players play Gaia Project to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/gaia-project/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'تعداد بازیکن' }).or(host.getByLabel('تعداد بازیکن')).first().selectOption('2');
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  for (const p of pages) await p.getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.gp-map')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.gp').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.gp').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
