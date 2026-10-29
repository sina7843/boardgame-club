import { expect, test, type Page } from '@playwright/test';
import { player, pickPlayers } from './helpers.ts';

// «گایا پراجکت» end to end: the tutorial (round 6 teaching position: mine with terraforming, trading station,
// federation with a satellite, research, a power action, pass to the final scoring) through the highlighted hints, and a
// full two-player game from faction choice through set-up and six rounds (a mine early, then passing) to the result.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/games/gaia-project/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

/** Click the next highlighted control of the tutorial (hint button, hinted hex, then «تأیید»); on the phone, open the
 *  actions sheet or the tab that holds it first. */
async function clickHint(p: Page): Promise<boolean> {
  for (let tries = 0; tries < 6; tries++) {
    const target = p.locator('button.gp-hint:visible:enabled, button.gp-hex--hint:visible');
    if (await target.count()) { await target.first().click(); return true; }
    const sheet = p.locator('.gp-sheetbtn:visible', { hasText: 'کنش‌ها' });
    if (await sheet.count()) { await sheet.click(); continue; }
    const tabs = p.locator('.gp-tabs button:visible');
    if (await tabs.count()) await tabs.nth(tries % 4).click();
    else await p.waitForTimeout(200);
  }
  return false;
}

test('interactive tutorial: mine, trading station, federation, research, power action, pass', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/gaia-project');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const step of ['۱', '۲', '۳', '۴', '۵', '۶']) {
    const label = p.getByText(new RegExp(`آموزش: مرحله ${step} از ۶`));
    await expect(label).toBeVisible();
    for (let k = 0; k < 8 && (await label.count()); k++) {
      if (!(await clickHint(p))) break;
      if (step === '۱' && k === 1) {
        await p.screenshot({ path: shot(info.project.name, 'tutorial-hex'), fullPage: true });
        await p.locator('[data-gp-board="faction"]').screenshot({ path: shot(info.project.name, 'boards-tutorial'), timeout: 5000 }).catch(() => undefined);
      }
      await p.waitForTimeout(250);
    }
  }
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.context().close();
});

test('undo before confirm: the drafted mine stands on its hex, «برگرد» takes it away, «تأیید» sends it', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/gaia-project');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۶/)).toBeVisible();
  const mines = p.locator('.gp-map [data-gp-piece="MI"]');
  const before = await mines.count();
  const seq = await p.locator('.gp').getAttribute('data-seq');
  await p.locator('button.gp-hex--hint').first().click();
  await expect(mines).toHaveCount(before + 1);
  // only the new mine animates (fade in); the pieces already on the map keep still
  await expect(p.locator('.gp-map .gp-new')).toHaveCount(1);
  expect(await p.locator('.gp').getAttribute('data-seq')).toBe(seq); // nothing sent yet
  await p.locator('.gp-undo:visible').click();
  await expect(mines).toHaveCount(before);
  await p.locator('button.gp-hex--hint').first().click();
  await p.locator('.gp-confirm:visible').click();
  await expect.poll(() => p.locator('.gp').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(seq);
  await expect(p.locator('.gp-undo:visible')).toHaveCount(0); // no undo after confirm
  await p.context().close();
});

/** Taps a map hex; on the phone the sticky action bar may cover it after scrolling, then the tap goes to the hex itself. */
async function tapHex(p: Page) {
  const hex = p.locator('.gp-hex[data-pick="selectable"]').first();
  await hex.click({ timeout: 4000 }).catch(() => hex.dispatchEvent('click'));
}

/** Click that never blocks the turn clock: falls back to the element's own click when something covers it. */
const tap = (l: ReturnType<Page['locator']>) => l.click({ timeout: 4000 }).catch(() => l.dispatchEvent('click'));

/** Opens the phone actions sheet when it is closed. */
async function openSheet(p: Page) {
  const sheet = p.locator('.gp-sheetbtn:visible', { hasText: 'کنش‌ها' });
  if (await sheet.count()) await sheet.click();
}

/** One move for this page if it has one: answer a power charge or open decision; on its own turn draft a faction, a
 *  set-up structure, a booster, a mine in the first rounds or a pass, answer follow-up decisions, then «تأیید». */
async function turn(p: Page, n: number): Promise<boolean> {
  const root = p.locator('.gp');
  const mode = await root.getAttribute('data-turn');
  if (mode === 'decide') {
    const leech = p.locator('.gp-leech button');
    if (await leech.count()) { const no = leech.filter({ hasText: /^رد$/ }); await ((await no.count()) ? no.first() : leech.first()).click(); return true; }
    await openSheet(p);
    const opt = p.locator('[data-option]:visible');
    if (!(await opt.count())) return false;
    await opt.first().click();
    return true;
  }
  if (mode !== 'draft') return false;
  const phase = await root.getAttribute('data-phase');
  if (phase === 'faction') await tap(p.locator('.gp-faction-pick').first());
  else if (phase === 'setup') await tapHex(p);
  else if (phase === 'booster') { await openSheet(p); await tap(p.locator('[data-option]:visible').first()); }
  else {
    await openSheet(p);
    const round = Number(await root.getAttribute('data-round'));
    const mine = p.locator('[data-move="mine"]:visible:enabled');
    if (round > 2 || n % 2 === 1 || !(await mine.count())) {
      await tap(p.locator('[data-move="pass"]:visible'));
      const opt = p.locator('[data-option]:visible');
      if (await opt.count()) await tap(opt.first());
    } else {
      await tap(mine);
      await tapHex(p);
    }
  }
  const confirm = p.locator('.gp-confirm:visible');
  for (let k = 0; k < 6 && !(await confirm.isEnabled().catch(() => false)); k++) {
    await openSheet(p);
    const opt = p.locator('[data-option]:visible');
    if (!(await opt.count())) break;
    await tap(opt.first());
  }
  await tap(confirm);
  return true;
}

test('two players play Gaia Project to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/gaia-project/new');
  await host.getByRole('radiogroup', { name: 'حالت بازی' }).getByRole('radio', { name: 'زنده', exact: true }).click();
  await pickPlayers(host, 2);
  await host.getByRole('button', { name: 'ساخت میز' }).first().click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  await pages[0]!.getByRole('button', { name: 'آماده‌ام' }).click(); // joiners already sit ready
  await expect(host.locator('.gp-map')).toBeVisible();

  for (let n = 0; n < 400; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.gp').getAttribute('data-seq');
      if (!(await turn(p, n))) continue;
      await expect.poll(() => p.locator('.gp').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 12) for (const [i, q] of pages.entries()) {
        await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: info.project.name.startsWith('desktop'), timeout: 20_000 }).catch(() => undefined);
        await q.locator('[data-gp-board="faction"]').screenshot({ path: shot(info.project.name, `boards-${i}`), timeout: 5000 }).catch(() => undefined);
      }
      acted = true;
      break;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: info.project.name.startsWith('desktop'), timeout: 20_000 }).catch(() => undefined);
  for (const p of pages) await p.context().close();
});
