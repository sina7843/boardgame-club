import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «ترافورمینگ مارس» end to end: the tutorial (the last generation: titanium payment, heat → temperature, an aquifer
// ocean, a greenery next to a city, a milestone, the final scoring) by following the highlighted hints, and a full
// two-player game to the result where both clients raise the global parameters through the standard projects.
test.describe.configure({ mode: 'serial', timeout: 2_400_000 });
const RESULT = /بردید|باختید|مساوی/;
const shot = (project: string, name: string) => `docs/evidence/games/terraforming-mars/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const STEPS = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];

test('interactive tutorial: titanium, heat, an ocean, a greenery by the city, a milestone and the final score', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/terraforming-mars');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  const done = p.getByRole('heading', { name: 'آموزش کامل شد' });
  for (const [i, n] of STEPS.entries()) {
    await expect(p.getByText(new RegExp(`آموزش: مرحله ${n} از ۸`))).toBeVisible();
    const next = i + 1 < STEPS.length ? p.getByText(new RegExp(`آموزش: مرحله ${STEPS[i + 1]} از ۸`)) : done;
    for (let k = 0; k < 10 && !(await next.count()); k++) {
      const hint = p.locator('.tm .tm-hint:not([disabled])').first();
      if (await hint.count()) await hint.click();
      await expect(p.getByRole('button', { name: 'انصراف', exact: true })).toHaveCount(0); // the move left the undo window
      if (i === 3 && k === 0) await p.screenshot({ path: shot(info.project.name, 'tutorial-ocean'), fullPage: true });
      await p.waitForTimeout(250);
    }
  }
  await expect(done).toBeVisible();
  await p.context().close();
});

test('undo before confirm: picking a card or a space is a local draft until «تأیید»; «برگرد» drops it and nothing is sent', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/terraforming-mars');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۸/)).toBeVisible();
  const seq = await p.locator('.tm[data-seq]').getAttribute('data-seq');
  if (await p.getByRole('tab', { name: /^دست/ }).count()) await p.getByRole('tab', { name: /^دست/ }).click();
  const card = p.locator('.tm-hand [data-flip="card-009"]');
  await expect(card).toHaveAttribute('data-pick', 'selectable');
  await card.click();
  const confirm = p.locator('[data-tm-confirm]');
  await expect(confirm).toBeVisible();
  await expect(p.locator('.tm-pay')).toBeVisible(); // titanium payment row (space tag)
  await expect(card).toHaveAttribute('data-pick', 'picked');
  await p.getByRole('button', { name: 'برگرد', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(card).toHaveAttribute('data-pick', 'selectable');
  expect(await p.locator('.tm[data-seq]').getAttribute('data-seq')).toBe(seq);
  // Steps 1–3 for real (hint, then the hinted «تأیید»), then a space is picked on the map and changed before «تأیید جا».
  for (const n of ['۲', '۳', '۴']) {
    const step = p.getByText(new RegExp(`آموزش: مرحله ${n} از ۸`));
    for (let k = 0; k < 10 && !(await step.count()); k++) { const h = p.locator('.tm .tm-hint:not([disabled])').first(); if (await h.count()) await h.click(); await p.waitForTimeout(250); }
    await expect(step).toBeVisible();
  }
  if (await p.getByRole('tab', { name: 'مریخ' }).count()) await p.getByRole('tab', { name: 'مریخ' }).click();
  const before = await p.locator('.tm[data-seq]').getAttribute('data-seq');
  const hex = p.locator('.tm-board button[data-space="63"]');
  await expect(hex).toHaveClass(/tm-hex--pick/);
  await hex.click();
  await expect(hex).toHaveAttribute('aria-pressed', 'true');
  await expect(p.locator('.tm-board .tm-hex--picked')).toHaveCount(1);
  expect(await p.locator('.tm[data-seq]').getAttribute('data-seq')).toBe(before);
  await p.getByRole('button', { name: 'تأیید جا' }).click();
  await expect(p.getByText(/آموزش: مرحله ۵ از ۸/)).toBeVisible();
  await p.context().close();
});

/** One decision for this client if it has one; returns false when it is not this client's move. */
async function act(p: Page): Promise<boolean> {
  const visible = async (sel: string) => {
    for (const s of [`.tm-sheet ${sel}`, `${sel}:visible`]) {
      const l = p.locator(s).first();
      if ((await l.count()) && !(await l.isDisabled())) return l;
    }
    return null;
  };
  const click = async (sel: string) => { const l = await visible(sel); if (!l) return false; await l.click(); return true; };
  const confirm = () => click('[data-tm-confirm]');
  // Simultaneous picks: the first corporation without cards, then buy no research cards.
  if (await p.locator('.tm-corps .tm-card').count()) {
    await p.locator('.tm-corps .tm-card').first().click();
    return click('[data-act="corp"]');
  }
  if (await click('[data-act="research"]')) return true;
  if (await p.locator('[data-act="draft"]').count()) {
    await p.locator('.tm-zone--hand .tm-card[data-pick="selectable"]').first().click();
    return click('[data-act="draft"]');
  }
  // A drafted action of mine (payment etc.): confirm it.
  if (await p.locator('.tm-flow[data-tm-pending]:not(.tm-prompt)').count()) return confirm();
  // Engine decisions: skip optional ones, otherwise take the first legal option and confirm.
  if (await p.locator('.tm-prompt').count()) {
    if (await click('[data-act="skip"]')) return true;
    if (await p.getByRole('tab', { name: 'مریخ' }).count() && await p.locator('.tm-hex--pick').count()) await p.getByRole('tab', { name: 'مریخ' }).click();
    if (await p.locator('.tm-prompt[data-tm-pending="card"]').count() && await p.getByRole('tab', { name: 'بازیکنان' }).count()) await p.getByRole('tab', { name: 'بازیکنان' }).click();
    for (const sel of ['.tm-hex--pick', '.tm-prompt .tm-choice button', '.tm-player.is-you button.tm-card[data-pick="selectable"]', '.tm-prompt button.tm-card']) {
      if (await click(sel)) return confirm();
    }
    return confirm(); // amount / cards (minimum)
  }
  if (await p.getByRole('button', { name: 'کنش‌ها', exact: true }).count()) await p.getByRole('button', { name: 'کنش‌ها', exact: true }).click();
  for (const a of ['firstAction', 'convertHeat', 'convertPlants', 'project-asteroid', 'project-aquifer', 'project-greenery']) {
    if (await click(`[data-act="${a}"]`)) return confirm();
  }
  if (await click('[data-act="endTurn"]')) return true; // after one action only «پایان نوبت» (pass needs a turn without an action)
  if (await click('[data-act="pass"]')) return confirm(); // pass asks for confirmation
  return false;
}

/** The player areas are in the «بازیکنان» tab on phones: open it for the capture, then return to the tab in use. */
async function shotPlayers(q: Page, path: string) {
  const tabs = q.locator('.tm-tabs [role="tab"]');
  const open = await tabs.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-selected') === 'true'));
  if (open >= 0) await q.locator('.tm-tabs').getByRole('tab', { name: 'بازیکنان' }).click();
  await q.locator('.tm-players').screenshot({ path, timeout: 10_000 }).catch(() => undefined); // a new decision may switch the tab
  if (open >= 0) await tabs.nth(open).click();
}

test('two players terraform Mars to the result', async ({ browser }, info) => {
  only(info.project.name);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  const [host] = pages as [Page, Page];
  await host.goto('/games/terraforming-mars/new');
  await host.getByRole('radiogroup', { name: 'حالت بازی' }).getByRole('radio', { name: 'زنده', exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).first().click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1]!.goto(invite);
  await pages[1]!.getByRole('button', { name: 'پیوستن به میز' }).click();
  await pages[0]!.getByRole('button', { name: 'آماده‌ام' }).click(); // joiners already sit ready
  // Phones open on the setup tab (corporations and starting cards); the board is one tab away.
  await expect(host.locator('.tm-board:visible, .tm-corps .tm-card').first()).toBeVisible();

  for (let n = 0; n < 3000; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.tm[data-seq]').getAttribute('data-seq');
      if (!(await act(p))) continue;
      await expect.poll(() => p.locator('.tm[data-seq]').getAttribute('data-seq'), { timeout: 10_000 }).not.toBe(before);
      if (n === 30) for (const [i, q] of pages.entries()) {
        await q.screenshot({ path: shot(info.project.name, `mid-${i}`), fullPage: true });
        await shotPlayers(q, shot(info.project.name, `boards-${i}`)); // own board + opponents
      }
      acted = true;
    }
    if (!acted) await host.waitForTimeout(150);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await expect(host.locator('.tm-result')).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
