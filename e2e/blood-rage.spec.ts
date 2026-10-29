import { expect, test, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «خشم خون» end to end: the interactive tutorial through the real UI (upgrade with a free invasion, commit a quest, march,
// pillage with a hidden battle card, pass, quest reward) and the result.
test.describe.configure({ mode: 'serial', timeout: 300_000 });
const shot = (project: string, name: string) => `design/qa/blood-rage/shots/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');

const province = (p: Page, name: string) => p.getByRole('button', { name: new RegExp(`^${name}،`) });

test('interactive tutorial: upgrade, free invasion, quest, march, pillage with a battle card, pass, quest reward', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/blood-rage');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۸/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, '1-start'), fullPage: true });

  // 1 upgrade (Soldier from Hel, 0 Rage) then 2 the free invasion in Horgr
  await p.getByRole('button', { name: /^ارتقا \(۰ خشم\)/ }).click();
  await expect(p.getByText(/آموزش: مرحله ۲ از ۸/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, '2-free-invade'), fullPage: true });
  await province(p, 'هورگر').click();
  // 3 commit the Manheim quest
  await expect(p.getByText(/آموزش: مرحله ۳ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: 'تعهد به مأموریت' }).click();
  // 4 march Myrkvlor → Gimle
  await expect(p.getByText(/آموزش: مرحله ۴ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: /^لشکرکشی/ }).click();
  await province(p, 'میرک‌ولر').click();
  await p.screenshot({ path: shot(info.project.name, '3-march'), fullPage: true });
  await province(p, 'گیملی').click();
  // 5 pillage Gimle
  await expect(p.getByText(/آموزش: مرحله ۵ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: 'غارت', exact: true }).click();
  await province(p, 'گیملی').click();
  // 6 play Tyr's Rage
  await expect(p.getByText(/آموزش: مرحله ۶ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: /^غرّش تیر/ }).click();
  await p.screenshot({ path: shot(info.project.name, '4-battle'), fullPage: true });
  await p.getByRole('button', { name: 'بازی کارت' }).click();
  // 7 pass
  await expect(p.getByText(/آموزش: مرحله ۷ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: /^گذشتن/ }).click();
  // 8 quest reward: raise a stat
  await expect(p.getByText(/آموزش: مرحله ۸ از ۸/)).toBeVisible();
  await p.getByRole('button', { name: /^خشم ←/ }).click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, '5-done'), fullPage: true });
  await p.context().close();
});

const RESULT = /بردید|باختید|مساوی/;

/** One UI action for this client if it has one: decisions first, then battle, draft, discard, and finally a turn. */
async function act(p: Page): Promise<boolean> {
  const click = async (name: string | RegExp, exact = false) => {
    const b = p.getByRole('button', { name, exact }).first();
    if (!(await b.count()) || (await b.isDisabled())) return false;
    await b.click();
    return true;
  };
  const choice = p.locator('.blr-choice');
  if (await choice.count()) {
    for (const n of ['نه', 'نه، بگذرید', 'همان‌جا بماند', 'نگه دار', 'هیچ‌کدام']) if (await choice.getByRole('button', { name: n, exact: true }).count()) return click(n, true);
    if (await choice.getByText(/سیل اودین/).count()) {
      const fig = p.locator('.blr-fig.is-hot').first();
      if (await fig.count()) { await fig.click({ force: true }); return click('تأیید', true); }
    }
    const first = choice.getByRole('button').and(p.locator(':not([disabled])')).first();
    if (await first.count()) { await first.click(); return true; }
    return false;
  }
  if (await p.getByRole('button', { name: 'فراخوانی نمی‌کنم' }).count()) return click('فراخوانی نمی‌کنم');
  const play = p.getByRole('button', { name: 'بازی کارت' });
  if (await play.count()) { await p.locator('.blr-hand .blr-card__face').first().click(); return click('بازی کارت'); }
  const pick = p.getByRole('button', { name: /^برداشتن/ });
  if (await pick.count()) {
    const need = Number(((await pick.first().innerText()).match(/\/([۰-۹]+)/)?.[1] ?? '۱').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    const faces = p.locator('.blr-hand .blr-card__face');
    for (let i = 0; i < need; i++) await faces.nth(i).click();
    return click(/^برداشتن/);
  }
  if (await p.getByRole('button', { name: 'دور ریختن همه' }).count()) return click('دور ریختن همه');
  const attack = p.getByRole('button', { name: 'حمله', exact: true });
  if (await p.getByRole('button', { name: /^گذشتن/ }).count()) {
    if (await attack.count() && !(await attack.isDisabled())) {
      await attack.click();
      const group = p.getByRole('button', { name: /^رهبر/ });
      if (await group.count()) { await group.first().click(); const target = p.locator('.blr-prov.is-target').first(); if (await target.count()) { await target.click({ force: true }); return true; } }
    }
    return click(/^گذشتن/);
  }
  return false;
}

test('two players play «خشم خون» through three ages to the result', async ({ browser }, info) => {
  only(info.project.name);
  test.setTimeout(900_000);
  const vp = info.project.use.viewport ?? null;
  const pages = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')] as [Page, Page];
  const [host] = pages;
  await host.goto('/games/blood-rage/new');
  await host.getByRole('radiogroup', { name: 'حالت بازی' }).getByRole('radio', { name: 'زنده', exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).first().click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await pages[1].goto(invite);
  await pages[1].getByRole('button', { name: 'پیوستن به میز' }).click();
  await pages[0].getByRole('button', { name: 'آماده‌ام' }).click();
  await expect(host.locator('.blr')).toBeVisible();
  await expect(pages[1].locator('.blr')).toBeVisible();
  // the draft is secret: each client sees only its own pack
  await expect(host.getByRole('heading', { name: /بستهٔ درفت/ })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'draft'), fullPage: true });

  let shots = 0;
  for (let n = 0; n < 1500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator('.blr').getAttribute('data-seq');
      if (!(await act(p))) continue;
      await expect.poll(() => p.locator('.blr').getAttribute('data-seq'), { timeout: 15_000 }).not.toBe(before);
      acted = true;
      if (n % 60 === 30 && shots < 4) { await host.screenshot({ path: shot(info.project.name, `mid-${shots++}`), fullPage: true }); }
    }
    if (!acted) await host.waitForTimeout(200);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
