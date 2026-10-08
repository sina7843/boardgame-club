import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// DRAGON-02 acceptance flows with independent browser contexts. Runs in mobile-360 and desktop-1440.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const shot = (name: string, project: string) => `docs/evidence/phase-02/${project}-${name}.png`;
const uniq = () => Math.random().toString(36).slice(2, 7);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame';
const grant = (mobile: string, role: string) =>
  execFileSync('node', ['packages/db/src/grant-role.ts', mobile, role], { env: { ...process.env, DATABASE_URL }, stdio: 'pipe' });

async function queue(p: Page, gameLabel: string) {
  await p.goto('/play');
  await p.getByLabel('بازی', { exact: true }).selectOption({ label: gameLabel });
  await p.getByRole('button', { name: 'شروع جست‌وجو' }).click();
}

async function acceptMatch(p: Page) {
  await expect(p.getByText('حریف پیدا شد!')).toBeVisible({ timeout: 15_000 });
  await p.getByRole('button', { name: 'رفتن به میز و اعلام آمادگی' }).click();
  await expect(p.getByText('همه بازیکنان باید آمادگی را تأیید کنند.')).toBeVisible();
  await p.getByRole('button', { name: 'آماده‌ام' }).click();
}

const myTurn = (p: Page) => p.getByText(/نوبت شماست/).isVisible();
async function mover(a: Page, b: Page) {
  for (let i = 0; i < 60; i++) { if (await myTurn(a)) return a; if (await myTurn(b)) return b; await a.waitForTimeout(150); }
  throw new Error('no turn');
}

test('guest discovers a game, signs in, finishes the tutorial, queues, accepts and plays both games to the result', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const p = info.project.name;
  const a = await newPage(browser, vp);
  // Discover as a guest
  await a.goto('/games');
  await a.getByRole('link', { name: /سه‌خطی/ }).click();
  await expect(a.getByRole('heading', { name: 'سه‌خطی', level: 1 })).toBeVisible();
  await a.screenshot({ path: shot('01-guest-detail', p), fullPage: true });
  await a.getByRole('link', { name: 'برای بازی و آموزش وارد شوید' }).click();
  await signIn(a, `Arya${uniq()}`, '/games/line-three');
  await expect(a).toHaveURL(/\/games\/line-three$/);
  // Learn
  await a.getByRole('button', { name: 'آموزش تعاملی' }).click();
  for (const cell of [4, 2, 6]) {
    await expect(a.locator('.lt__cell').nth(cell)).not.toHaveAttribute('aria-disabled', 'true');
    await a.locator('.lt__cell').nth(cell).click();
    await expect(a.locator('.lt__cell').nth(cell)).toHaveText('X');
  }
  await expect(a.getByRole('heading', { name: 'آموزش کامل شد' })).toBeVisible();

  // Match with an independent client
  const b = await newPage(browser, vp);
  await signIn(b, `Bita${uniq()}`);
  await queue(a, 'سه‌خطی');
  await expect(a.getByText(/در صف «سه‌خطی»/)).toBeVisible();
  await a.screenshot({ path: shot('02-queue', p), fullPage: true });
  await queue(b, 'سه‌خطی');
  await acceptMatch(a);
  await acceptMatch(b);
  await expect(a.locator('.lt__board')).toBeVisible();
  for (const cell of [0, 3, 1, 4, 2]) {
    const m = await mover(a, b);
    await expect(m.locator('.lt__cell').nth(cell)).not.toHaveAttribute('aria-disabled', 'true');
    await m.locator('.lt__cell').nth(cell).click();
    await expect(m.locator('.lt__cell').nth(cell)).not.toHaveText('');
  }
  await expect(a.getByRole('heading', { name: /شما بردید|این دست را باختید/ })).toBeVisible();
  await a.screenshot({ path: shot('03-match-result', p), fullPage: true });

  // Second game through the queue
  await queue(a, 'مزایده سربسته');
  await queue(b, 'مزایده سربسته');
  await acceptMatch(a);
  await acceptMatch(b);
  for (const [ta, tb] of [[5, 1], [1, 5], [2, 3], [3, 2], [4, 4]]) {
    for (const [pg, t] of [[a, ta], [b, tb]] as const) {
      await expect(pg.getByText('پیشنهاد پنهان خود را ثبت کنید')).toBeVisible();
      await pg.getByRole('button', { name: `ژتون ${t!.toLocaleString('fa-IR')}`, exact: true }).click();
    }
  }
  await expect(b.getByRole('heading', { name: 'مساوی شد' })).toBeVisible();
  await b.screenshot({ path: shot('04-match-result-sealed', p), fullPage: true });
  await a.context().close(); await b.context().close();
});

test('friends: request/accept, invite to a private table via notification, table chat, block stops contact', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const p = info.project.name;
  const a = await newPage(browser, vp);
  const b = await newPage(browser, vp);
  const bName = `Dara${uniq()}`;
  await signIn(a, `Elham${uniq()}`);
  await signIn(b, bName);

  await a.goto('/friends');
  await a.getByRole('tab', { name: 'یافتن' }).click();
  await a.getByLabel('جست‌وجوی بازیکن').fill(bName);
  await a.getByRole('button', { name: 'افزودن دوست' }).click();
  await expect(a.getByText('درخواست فرستاده شد')).toBeVisible();
  await b.goto('/friends');
  await b.getByRole('tab', { name: /درخواست‌ها/ }).click();
  await b.getByRole('button', { name: 'پذیرش' }).click();
  await b.getByRole('tab', { name: /دوستان/ }).click();
  await b.screenshot({ path: shot('05-friends', p), fullPage: true });

  // Private table + personal invitation
  await a.goto('/games/line-three/new');
  await a.getByText('نوبتی', { exact: true }).click();
  await a.getByRole('button', { name: 'ساخت میز' }).click();
  await expect(a.getByRole('heading', { name: 'دعوت دوستان' })).toBeVisible();
  await a.getByRole('button', { name: 'دعوت', exact: true }).click();
  await expect(a.getByRole('button', { name: 'دعوت شد' })).toBeVisible();
  await b.goto('/');
  const invite = b.locator('ul.list li', { hasText: /شما را به میز «سه‌خطی» دعوت کرد/ });
  await expect(invite).toBeVisible({ timeout: 15_000 });
  await b.screenshot({ path: shot('06-invite-notification', p), fullPage: true });
  await invite.getByRole('link', { name: 'باز کردن' }).click();
  await b.getByRole('button', { name: 'پیوستن به میز' }).click();
  await expect(b.getByText('بازیکنان (۲ از ۲)')).toBeVisible();

  // Lobby chat, delivered live to the other participant
  await b.getByLabel('متن پیام').fill('سلام! آماده‌ام');
  await b.getByRole('button', { name: 'ارسال' }).click();
  await expect(a.getByText('سلام! آماده‌ام')).toBeVisible({ timeout: 10_000 });
  await a.screenshot({ path: shot('07-lobby-chat', p), fullPage: true });

  // Direct message, then block: contact stops
  const bId = (await (await b.request.get('/api/me')).json()).id;
  await a.goto(`/users/${bId}`);
  await a.getByRole('button', { name: 'پیام خصوصی' }).click();
  await a.getByLabel('متن پیام').fill('بازی بعدی کی؟');
  await a.getByRole('button', { name: 'ارسال' }).click();
  await expect(a.getByText('بازی بعدی کی؟')).toBeVisible();
  await b.goto(`/users/${(await (await a.request.get('/api/me')).json()).id}`);
  await b.getByRole('button', { name: 'مسدود کردن' }).click();
  await expect(b.getByRole('button', { name: 'رفع مسدودی' })).toBeVisible();
  await a.reload();
  await a.getByLabel('متن پیام').fill('هنوز هستی؟');
  await a.getByRole('button', { name: 'ارسال' }).click();
  await expect(a.getByText('امکان ارتباط با این کاربر وجود ندارد.')).toBeVisible();
  await a.screenshot({ path: shot('08-blocked', p), fullPage: true });
  await a.context().close(); await b.context().close();
});

test('club roles and membership, report from club chat, moderator suspension and appeal', async ({ browser }, info) => {
  const vp = info.project.use.viewport ?? null;
  const p = info.project.name;
  const owner = await newPage(browser, vp);
  const member = await newPage(browser, vp);
  const mod1 = await newPage(browser, vp);
  const mod2 = await newPage(browser, vp);
  await signIn(owner, `Owner${uniq()}`);
  await signIn(member, `Mehr${uniq()}`);
  grant(await signIn(mod1, `Mod${uniq()}`), 'moderator');
  grant(await signIn(mod2, `Mod${uniq()}`), 'moderator');
  await mod1.reload(); await mod2.reload();

  const slug = `club-${uniq()}`;
  const reason = `توهین در گفت‌وگوی باشگاه ${slug}`;
  await owner.goto('/clubs');
  await owner.getByLabel('نام', { exact: true }).fill('باشگاه آزمون');
  await owner.getByLabel('نشانی (لاتین)').fill(slug);
  await owner.locator('form').getByText('عضویت با درخواست').click();
  await owner.getByRole('button', { name: 'ساخت باشگاه' }).click();
  await expect(owner).toHaveURL(new RegExp(`/clubs/${slug}$`));

  await member.goto(`/clubs/${slug}`);
  await member.getByRole('button', { name: 'درخواست عضویت' }).click();
  await expect(member.getByText('درخواست شما در انتظار بررسی است')).toBeVisible();
  await owner.reload();
  await owner.getByRole('button', { name: 'پذیرش', exact: true }).click();
  await expect(owner.getByText('پذیرفته شد.')).toBeVisible();
  await owner.screenshot({ path: shot('09-club-owner', p), fullPage: true });
  await member.reload();
  await expect(member.getByRole('region', { name: 'گفت‌وگوی باشگاه' })).toBeVisible();
  await member.getByLabel('متن پیام').fill('پیام توهین‌آمیز آزمایشی');
  await member.getByRole('button', { name: 'ارسال' }).click();

  // Member cannot manage: no pending list, no role controls
  await expect(member.getByRole('button', { name: 'مدیر کردن' })).toHaveCount(0);
  await expect(member.getByRole('button', { name: 'ویرایش معرفی' })).toHaveCount(0);

  // Owner reports the message
  await owner.reload();
  await owner.getByText('پیام توهین‌آمیز آزمایشی').locator('xpath=ancestor::article').getByRole('button', { name: 'گزارش' }).click();
  await owner.getByLabel('توضیح').fill(reason);
  await owner.getByRole('button', { name: 'ثبت گزارش' }).click();
  await expect(owner.getByText('گزارش ثبت شد.')).toBeVisible();

  // Non-moderators are denied the queue
  await member.goto('/mod');
  await expect(member.getByText('دسترسی ندارید')).toBeVisible();

  // Moderator 1 suspends
  await mod1.goto('/mod');
  await mod1.getByRole('row', { name: new RegExp(slug) }).getByRole('button', { name: 'بررسی' }).click();
  await expect(mod1.getByText('پیام توهین‌آمیز آزمایشی')).toBeVisible();
  await mod1.getByText('تعلیق', { exact: true }).click();
  await mod1.getByLabel('یادداشت تصمیم (در سابقه ثبت می‌شود)').fill('توهین');
  await mod1.screenshot({ path: shot('10-moderation-review', p), fullPage: true });
  await mod1.getByRole('button', { name: 'ثبت تصمیم' }).click();
  await expect(mod1.getByText('تصمیم ثبت شد.')).toBeVisible();

  // Suspended member sees the banner and appeals
  await member.goto('/support');
  await expect(member.getByText(/حساب شما موقتاً تعلیق شده است/)).toBeVisible();
  await member.getByLabel('متن اعتراض').fill('این یک سوءتفاهم بود و عذرخواهی می‌کنم.');
  await member.getByRole('button', { name: 'ثبت اعتراض' }).click();
  await expect(member.getByText('اعتراض در حال بررسی')).toBeVisible();
  await member.screenshot({ path: shot('11-appeal', p), fullPage: true });

  // A different moderator decides the appeal
  await mod2.goto('/mod');
  await mod2.getByRole('tab', { name: 'اعتراض‌ها' }).click();
  await mod2.getByLabel('یادداشت تصمیم').fill('پذیرفته شد');
  await mod2.getByRole('button', { name: 'پذیرش اعتراض و لغو محدودیت' }).click();
  await expect(mod2.getByText('تصمیم ثبت شد.')).toBeVisible();
  await member.reload();
  await expect(member.getByText('اعتراض پذیرفته و محدودیت لغو شد')).toBeVisible();
  await expect(member.getByText(/حساب شما موقتاً تعلیق شده است/)).toHaveCount(0);
  for (const pg of [owner, member, mod1, mod2]) await pg.context().close();
});

test('page inventory and keyboard smoke', async ({ browser }, info) => {
  const page = await newPage(browser, info.project.use.viewport ?? null);
  await signIn(page, `Tour${uniq()}`);
  for (const [route, name] of [['/', 'dashboard'], ['/play', 'play'], ['/tables', 'tables'], ['/friends', 'friends'], ['/messages', 'messages'],
    ['/groups', 'groups'], ['/clubs', 'clubs'], ['/support', 'support'], ['/settings', 'settings'], ['/more', 'more'], ['/mod', 'mod-denied']] as const) {
    await page.goto(route);
    await expect(page.locator('main h1, main .state__title').first()).toBeVisible();
    await page.screenshot({ path: shot(`inventory-${name}`, info.project.name), fullPage: true });
  }
  // Keyboard: navigation moves focus to <main>; Tab continues inside the page; tabs switch with arrow keys.
  await page.goto('/friends');
  await expect(page.getByRole('tab', { name: /دوستان/ })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab', { name: /دوستان/ })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /درخواست‌ها/ })).toBeFocused();
  await page.context().close();
});
