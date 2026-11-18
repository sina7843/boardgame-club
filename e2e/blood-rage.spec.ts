import { expect, test, type Locator, type Page } from '@playwright/test';
import { player } from './helpers.ts';

// «بلاد ریج» end to end on the BGA table (design/games/blood-rage, COMPONENTS.md §36 hooks): the interactive tutorial
// (upgrade with a free invasion, quest, march, pillage with a battle card, pass, quest reward) and a full 2-player game.
test.describe.configure({ mode: 'serial', timeout: 300_000 });
const shot = (project: string, name: string) => `design/qa/blood-rage/shots/${project}-${name}.png`;
const only = (name: string) => test.skip(!['mobile-360', 'desktop-1440'].includes(name), 'game flows run at 360 and 1440');
const ROOT = '.bdr[data-seq]'; // the table root (seat cards in the shell rail also carry .bdr)
/** Battle and end-of-Age windows open on their own (§21, §22) and are modal: close them before acting. */
async function closeDialogs(p: Page) {
  for (let i = 0; i < 3; i++) {
    const close = p.locator(`${ROOT} .bdr-dlg .bdr-dlg__head button`).first();
    if (!(await close.isVisible().catch(() => false))) return;
    await close.click();
  }
}
const act = (p: Page, a: string) => p.locator(`${ROOT} .bdr-bar [data-act="${a}"]`).first();
const confirm = async (p: Page) => { await closeDialogs(p); await act(p, 'confirm').click(); };
/** An action-phase button: inline in the bar on desktop, in the «اقدام‌ها» sheet on phones (§26). */
async function choose(p: Page, a: string) {
  await closeDialogs(p);
  const sheetBtn = act(p, 'actions');
  if (await sheetBtn.isVisible().catch(() => false)) { await sheetBtn.click(); await p.locator(`.bdr-bsheet [data-act="${a}"]`).click(); return; }
  await act(p, a).click();
}
/** On phones the map, hand and clan sheets are tabs (§25–§30). */
async function tab(p: Page, name: 'نقشه' | 'دست' | 'قبیلهٔ من') {
  const t = p.locator('.bdr-tabs').getByRole('button', { name, exact: true });
  if (await t.isVisible()) await t.click();
}

test('interactive tutorial: upgrade, free invasion, quest, march, pillage with a battle card, pass, quest reward', async ({ browser }, info) => {
  only(info.project.name);
  const p = await player(browser, info.project.use.viewport ?? null, 'نوآموز');
  await p.goto('/games/blood-rage');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از ۸/)).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, '1-start'), fullPage: true });

  // 1 play the Soldier of Hel (monster, 0 rage) then 2 the free invasion in Horgr (village 18)
  await choose(p, 'monster');
  await tab(p, 'دست');
  await p.locator('.bdr-handzone .bdr-card[data-pick="selectable"]').first().click();
  await confirm(p);
  await expect(p.getByText(/آموزش: مرحله ۲ از ۸/)).toBeVisible();
  await tab(p, 'نقشه');
  await p.locator('.bdr-spot[data-slot="18"]').click();
  await p.screenshot({ path: shot(info.project.name, '2-free-invade'), fullPage: true });
  await confirm(p);
  // 3 commit the Manheim quest
  await expect(p.getByText(/آموزش: مرحله ۳ از ۸/)).toBeVisible();
  await choose(p, 'quest');
  await tab(p, 'دست');
  await p.locator('.bdr-handzone .bdr-card[data-pick="selectable"]').first().click();
  await confirm(p);
  // 4 march Myrkulor → Gimle with the leader and the warrior
  await expect(p.getByText(/آموزش: مرحله ۴ از ۸/)).toBeVisible();
  await choose(p, 'march');
  await tab(p, 'نقشه');
  await p.locator('.bdr-prov[data-province="1"]').click();
  await p.locator('.bdr-prov[data-province="8"]').click();
  await p.screenshot({ path: shot(info.project.name, '3-march'), fullPage: true });
  await confirm(p);
  // 5 pillage Gimle
  await expect(p.getByText(/آموزش: مرحله ۵ از ۸/)).toBeVisible();
  await choose(p, 'pillage');
  await p.locator('.bdr-prov[data-province="8"]').click();
  await confirm(p);
  // 6 play Tyr's Rage (the highlighted card)
  await expect(p.getByText(/آموزش: مرحله ۶ از ۸/)).toBeVisible();
  await tab(p, 'دست');
  await p.locator('.bdr-handzone .bdr-card.bdr-hint, .bdr-handzone .bdr-card[aria-label^="Tyr\'s Rage"]').first().click();
  await p.screenshot({ path: shot(info.project.name, '4-battle'), fullPage: true });
  await closeDialogs(p);
  await act(p, 'play-card').click();
  // 7 pass
  await expect(p.getByText(/آموزش: مرحله ۷ از ۸/)).toBeVisible();
  await choose(p, 'pass');
  await confirm(p);
  // 8 quest reward: raise rage
  await expect(p.getByText(/آموزش: مرحله ۸ از ۸/)).toBeVisible();
  await closeDialogs(p);
  await act(p, 'stat-rage').click();
  await expect(p.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();
  await p.screenshot({ path: shot(info.project.name, '5-done'), fullPage: true });
  await p.context().close();
});

const RESULT = /بردید|باختید|مساوی/;

async function clickable(l: Locator): Promise<boolean> {
  return (await l.count()) > 0 && (await l.first().isVisible()) && !(await l.first().isDisabled());
}
/** One UI action for this client if it has one (decisions, draft, battle, discard, then a turn). */
async function play(p: Page): Promise<boolean> {
  await closeDialogs(p);
  const bar = p.locator(`${ROOT} .bdr-bar`);
  if (await bar.evaluate((e) => e.classList.contains('is-waiting'))) return false;
  const tryAct = async (a: string) => { const b = act(p, a); if (await clickable(b)) { await b.click(); return true; } return false; };
  if (await clickable(act(p, 'confirm'))) { await act(p, 'confirm').click(); return true; }
  // an action turn: pillage when possible, else pass (with «ثبت»)
  if (await act(p, 'actions').count() || await act(p, 'march').count() || await act(p, 'invade').count()) {
    const sheet = async (a: string) => {
      if (await act(p, 'actions').count()) { await act(p, 'actions').click(); const b = p.locator(`.bdr-bsheet [data-act="${a}"]`); if (await clickable(b)) { await b.click(); return true; } await p.locator('.bdr-scrim--sheet').click({ position: { x: 5, y: 5 } }); return false; }
      return tryAct(a);
    };
    if (await sheet('pillage')) {
      const ring = p.locator('.bdr-prov').first();
      if (await ring.count()) { await ring.click(); if (await tryAct('confirm')) return true; }
      await tryAct('cancel');
    }
    if (await sheet('pass')) return tryAct('confirm');
    return false;
  }
  // decisions: decline the optional ones (free invasion, call to battle, move leader, after reveal), raise a stat
  if (await tryAct('pass')) return true;
  for (const st of ['stat-rage', 'stat-axe', 'stat-horn']) if (await tryAct(st)) return true;
  // pick a card when the bar asks for one (draft keep, battle card, discard)
  for (const a of ['keep', 'play-card', 'discard']) {
    if (!(await act(p, a).count())) continue;
    await tab(p, 'دست');
    const cards = p.locator('.bdr-card[data-pick="selectable"]');
    const need = (await bar.innerText()).includes('دو کارت') ? 2 : 1;
    for (let i = 0; i < need && i < (await cards.count()); i++) await cards.nth(0).click();
    await tab(p, 'نقشه');
    return tryAct(a);
  }
  // Odin's Tide: pick the figure that stays on the map
  const tok = p.locator('button.bdr-tok').first();
  if (await clickable(tok)) { await tok.click({ force: true }); return tryAct('confirm'); }
  return false;
}

test('two players play «بلاد ریج» through three ages to the result', async ({ browser }, info) => {
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
  await expect(host.locator(ROOT)).toBeVisible();
  await expect(pages[1].locator(ROOT)).toBeVisible();
  // the draft is secret: each client sees only its own pack
  await expect(host.getByRole('heading', { name: 'یک کارت نگه دارید' })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'draft'), fullPage: true });

  let shots = 0;
  for (let n = 0; n < 1500; n++) {
    if (await host.getByRole('heading', { name: RESULT }).count()) break;
    let acted = false;
    for (const p of pages) {
      const before = await p.locator(ROOT).getAttribute('data-seq');
      if (!(await play(p))) continue;
      await expect.poll(() => p.locator(ROOT).getAttribute('data-seq'), { timeout: 15_000 }).not.toBe(before);
      acted = true;
      if (n % 60 === 30 && shots < 4) { await host.screenshot({ path: shot(info.project.name, `mid-${shots++}`), fullPage: true }); }
    }
    if (!acted) await host.waitForTimeout(200);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await host.screenshot({ path: shot(info.project.name, 'result'), fullPage: true });
  for (const p of pages) await p.context().close();
});
