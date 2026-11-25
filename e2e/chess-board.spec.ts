import { expect, test, type Page } from '@playwright/test';
import { motionLog, player, recordMotion } from './helpers.ts';

// Chess board behaviour that needs no lobby: sounds (once per move, by priority), reduced motion, illegal drop.
// Runs on the interactive tutorial table: 1 castle (O-O), 2 Bc4+ (check), 3 exd6+ (en passant with check).
test.describe.configure({ mode: 'serial', timeout: 300_000 });
const square = (p: Page, name: string) => p.locator(`.ch-board button[aria-label^="${name}،"]`);

async function move(p: Page, from: string, to: string) {
  await square(p, from).click();
  await expect(square(p, to)).toHaveAttribute('aria-label', /حرکت به اینجا|زدن/);
  await square(p, to).click();
}

/** Record which sound element plays (src name from the element's data-sound), drained by `sounds()`. */
async function spySounds(p: Page) {
  await p.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __sounds: string[] }).__sounds = log;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this.volume > 0 && this.dataset.sound) log.push(this.dataset.sound); // volume 0 = the silent iOS unlock
      return play.call(this);
    };
  });
}
// game-start can land after the tutorial opens (audio preload); this test is about move sounds only.
const sounds = (p: Page) => p.evaluate(() => (window as unknown as { __sounds: string[] }).__sounds.splice(0).filter((s) => s !== 'game-start'));

async function openTutorial(p: Page) {
  await p.goto('/games/chess');
  await p.getByRole('button', { name: 'آموزش تعاملی' }).click();
  await expect(p.getByText(/آموزش: مرحله ۱ از/)).toBeVisible();
}

test('sounds: one per move, by priority (castle, check beats capture, opponent move)', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'صدا');
  await spySounds(p);
  await openTutorial(p);
  await sounds(p);
  await move(p, 'e1', 'g1'); // O-O, then the scripted reply a6 (move-opponent)
  await expect(p.getByText(/آموزش: مرحله ۲ از/)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => sounds(p).then((l) => (l.length ? (sessionLog.push(...l), sessionLog) : sessionLog)), { timeout: 5000 }).toEqual(['castle', 'move-opponent']);
  sessionLog.length = 0;
  await move(p, 'e2', 'c4'); // check
  await expect(p.getByText(/آموزش: مرحله ۳ از/)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => sounds(p).then((l) => (sessionLog.push(...l), sessionLog)), { timeout: 5000 }).toEqual(['move-check', 'move-opponent']);
  sessionLog.length = 0;
  await move(p, 'e5', 'd6'); // en passant that gives check: only move-check (not capture)
  await expect.poll(() => sounds(p).then((l) => (sessionLog.push(...l), sessionLog)), { timeout: 5000 }).toContain('move-check');
  expect(sessionLog.filter((s) => s === 'capture')).toHaveLength(0);
  await p.context().close();
});
const sessionLog: string[] = [];

test('reduced motion: a move does not animate; with motion on it does', async ({ browser }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'game flows run at 360 and 1440');
  const reduced = await player(browser, info.project.use.viewport ?? null, 'کم‌حرکت'); // the helper's context runs reducedMotion: reduce
  await openTutorial(reduced);
  await reduced.waitForTimeout(500);
  await motionLog(reduced).catch(() => []);
  await move(reduced, 'e1', 'g1');
  await expect(square(reduced, 'g1')).toHaveAttribute('aria-label', /شاه سفید/);
  await reduced.waitForTimeout(600);
  const log = await reduced.evaluate(() => ((window as unknown as { __motion?: { flip: string | null }[] }).__motion ?? []).filter((m) => m.flip));
  expect(log).toHaveLength(0);
  await reduced.context().close();

  const full = await player(browser, info.project.use.viewport ?? null, 'پرحرکت');
  await recordMotion(full);
  await openTutorial(full);
  await full.waitForTimeout(500);
  await motionLog(full);
  await move(full, 'e1', 'g1');
  await expect(square(full, 'g1')).toHaveAttribute('aria-label', /شاه سفید/);
  await full.waitForTimeout(600);
  expect((await motionLog(full)).filter((m) => m.flip).length).toBeGreaterThanOrEqual(2); // king and rook
  await full.context().close();
});

test('dropping a piece on an illegal square plays «illegal» and the piece returns', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'mouse drag runs at 1440');
  const p = await player(browser, info.project.use.viewport ?? null, 'کشیدن');
  await spySounds(p);
  await openTutorial(p);
  await sounds(p);
  const from = await square(p, 'e5').boundingBox();
  const to = await square(p, 'a3').boundingBox();
  await p.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await p.mouse.down();
  await p.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 6 });
  await p.mouse.up();
  await expect.poll(() => sounds(p), { timeout: 3000 }).toEqual(['illegal']);
  await expect(square(p, 'e5')).toHaveAttribute('aria-label', /سرباز سفید/);
  await expect(square(p, 'a3')).toHaveAttribute('aria-label', /خالی/);
  await p.context().close();
});
