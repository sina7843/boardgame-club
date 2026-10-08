import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { player } from './helpers.ts';

// Unmatched end to end: two independent clients pick heroes, deploy and fight through the real UI (live duel) until one
// hero falls. Decisions are made like a casual player: attack when possible, otherwise maneuver; every other prompt
// takes the first offered choice. One duel per hero pair so every hero's prompts appear in a real browser.
test.describe.configure({ mode: 'serial', timeout: 600_000 });
const shot = (project: string, name: string) => `docs/evidence/unmatched/${project}-${name}.png`;
const RESULT = /بردید|باختید|مساوی/;

async function startTable(host: Page, guest: Page, mapFa: string) {
  await host.goto('/games/unmatched/new');
  await host.getByText('زنده', { exact: true }).click();
  await host.getByRole('group', { name: 'میدان نبرد' }).getByText(mapFa, { exact: true }).click();
  await host.getByRole('button', { name: 'ساخت میز' }).click();
  const invite = (await host.getByRole('textbox', { name: 'لینک دعوت' }).inputValue()).replace(/^https?:\/\/[^/]+/, '');
  await guest.goto(invite);
  await guest.getByRole('button', { name: 'پیوستن به میز' }).click();
  await expect(host.getByText('بازیکنان (۲ از ۲)')).toBeVisible();
  for (const p of [host, guest]) await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

const panel = (p: Page) => p.locator('.um-panel--decide');
const faNum = (t: string) => Number(t.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))));

/** One decision for the page that holds the open prompt. Always ends by sending exactly one command. */
async function decide(p: Page, n: number, heroes: string[]) {
  const d = panel(p);
  const title = (await d.locator('h3').textContent()) ?? '';
  const button = (name: string | RegExp) => d.getByRole('button', { name });
  const fieldset = (label: string) => d.locator('fieldset').filter({ hasText: label }).locator('.um-choice');
  if (await d.locator('.um-hero').count()) {
    for (const h of heroes) {
      const b = d.locator('.um-hero').filter({ hasText: h });
      if (await b.count()) return b.first().click();
    }
    return d.locator('.um-hero').first().click();
  }
  if (await button(/^بزرگ/).count()) return button(/^بزرگ/).click();
  if (title.startsWith('اقدام')) {
    const attack = button(/^حمله/);
    if (await attack.isEnabled() && n % 4 !== 3) {
      await attack.click();
      await fieldset('مبارز مهاجم').first().click();
      await fieldset('هدف').first().click();
      await p.locator('.um-hand .um-card--playable').first().click();
      // Plain attacks send on the card tap; boostable ones (Arthur) still need «ثبت حمله».
      if (await button(/^ثبت حمله/).count()) return button(/^ثبت حمله/).click();
      return;
    }
    return button(/^مانور/).click();
  }
  if (await button('بدون تقویت').count()) return button('بدون تقویت').click();
  if (await button('بدون دفاع').count()) {
    const card = p.locator('.um-hand .um-card--playable').first();
    if (await card.count() && n % 2) {
      await card.click();
      const predict = d.getByRole('group', { name: 'پیش‌بینی ارزش چاپی حمله حریف' }).locator('.um-choice');
      // The tap defends; only Elementary asks for a predicted value first.
      if (await predict.count()) { await predict.nth(3).click(); return button('دفاع با کارت انتخاب‌شده').click(); }
      return;
    }
    return button('بدون دفاع').click();
  }
  if (await button('پایان حرکت').count()) {
    // Move one fighter now and then, through the board itself.
    const fighter = fieldset('کدام مبارز').first();
    if (n % 2 === 0 && await fighter.count()) {
      await fighter.click();
      const target = p.locator('.um-board .um-space--target').first();
      if (await target.count()) return target.click();
    }
    return button('پایان حرکت').click();
  }
  // Fog: skip when allowed, otherwise token (if asked) then the first destination.
  if (await button('جابه‌جا نکن').count()) return button('جابه‌جا نکن').click();
  if (await fieldset('کدام نشان مه').count()) await fieldset('کدام نشان مه').first().click();
  if (await fieldset('مقصد').count()) return fieldset('مقصد').first().click();
  if (await d.locator('input[type=checkbox]').count()) {
    await d.locator('input[type=checkbox]').nth(0).check();
    await d.locator('input[type=checkbox]').nth(1).check();
    return button('تأیید').click();
  }
  if (await button(/^تأیید/).count()) {
    const need = faNum((await button(/^تأیید/).textContent())?.match(/از ([۰-۹]+)/)?.[1] ?? '۱');
    const pool = (await d.locator('.um-card').count()) ? d.locator('.um-card') : p.locator('.um-hand .um-card--playable');
    for (let i = 0; i < need; i++) await pool.nth(i).click();
    // A single-card choice is sent by the tap itself; only multi-card picks still need «تأیید».
    const ok = button(/^تأیید/);
    if (await ok.count() && await ok.isEnabled({ timeout: 1000 }).catch(() => false)) return ok.click();
    return;
  }
  // Single-choice options (Jekyll's serum, Deduce Strategy, Lurking, opponent, value) are buttons.
  const option = d.locator('.um-actions button').first();
  if (await option.count()) return option.click();
  const choice = d.locator('.um-choice').first();
  if (await choice.count()) return choice.click();
  return button('رد کردن').click();
}

async function duel(browser: Browser, info: TestInfo, tag: string, mapFa: string, heroes: string[]) {
  const vp = info.project.use.viewport ?? null;
  const [a, b] = [await player(browser, vp, 'Ava'), await player(browser, vp, 'بهار')];
  await startTable(a, b, mapFa);
  const pages = [a, b];
  await expect.poll(async () => (await panel(a).count()) + (await panel(b).count())).toBe(1);
  const picker = (await panel(a).count()) ? a : b;
  await picker.screenshot({ path: shot(info.project.name, `${tag}-pick`), fullPage: true });

  let step = 0;
  let combatShot = false;
  const heading = async (x: Page) => (await panel(x).locator('h3').allTextContents()).join('|');
  for (; step < 600; step++) {
    if (await a.getByRole('heading', { name: RESULT }).count()) break;
    let mover: Page | null = null;
    for (const p of pages) if (await panel(p).count()) { mover = p; break; }
    if (!mover) { await a.waitForTimeout(150); continue; }
    if (step === 8) {
      await expect(a.locator('.um-board')).toBeVisible();
      // Hidden information: only the own hand is shown; the other hand is a count.
      for (const p of pages) expect(await p.locator('.um-hand .um-card').count()).toBeGreaterThanOrEqual(4);
      for (const [i, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `${tag}-board-${i}`), fullPage: true });
    }
    if (!combatShot && await mover.getByRole('button', { name: 'بدون دفاع' }).count()) {
      combatShot = true;
      for (const [i, p] of pages.entries()) await p.screenshot({ path: shot(info.project.name, `${tag}-combat-${i}`), fullPage: true });
    }
    // Every decision sends exactly one command: wait for the server to accept it, then for the UI to settle (not busy).
    const title = await heading(mover);
    const marker = await mover.locator('.um').getAttribute('data-prompt');
    const sent = mover.waitForResponse((r) => r.url().includes('/commands') && r.request().method() === 'POST', { timeout: 10_000 });
    await decide(mover, step, heroes);
    const res = await sent.catch(async (e) => { console.log('STUCK', tag, step, title, (await panel(mover!).allInnerTexts()).join(' | ')); throw e; });
    expect((await res.json()).status, `${tag} step ${step}: ${title}`).toBe('accepted');
    await expect.poll(async () => (await mover!.locator('.um').getAttribute('data-prompt')) !== marker).toBe(true);
  }
  for (const p of pages) await expect(p.getByRole('heading', { name: RESULT })).toBeVisible();
  await a.screenshot({ path: shot(info.project.name, `${tag}-result`), fullPage: true });
  test.info().annotations.push({ type: `${tag} decisions`, description: String(step) });
  for (const p of pages) await p.context().close();
}

const only = (info: TestInfo) => test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');

test('Battle of Legends duel on Marmoreal (Arthur, Medusa) to the result', async ({ browser }, info) => {
  only(info);
  await duel(browser, info, 'vol1', 'مارموریال', ['شاه آرتور', 'مدوسا']);
});

test('Cobble & Fog duel on Baskerville Manor (Invisible Man, Jekyll & Hyde) to the result', async ({ browser }, info) => {
  only(info);
  await duel(browser, info, 'fog', 'عمارت باسکرویل', ['مرد نامرئی', 'جکیل و هاید']);
});

test('Cobble & Fog duel on SoHo (Sherlock Holmes, Dracula) to the result', async ({ browser }, info) => {
  only(info);
  await duel(browser, info, 'holmes', 'سوهو', ['شرلوک هولمز', 'دراکولا']);
});
