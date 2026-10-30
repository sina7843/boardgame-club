import { expect, test } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

test.describe.configure({ timeout: 90_000 });
const uniq = () => Math.random().toString(36).slice(2, 7);

test('invite link: a friend who signs up through it becomes a friend automatically', async ({ browser }, info) => {
  const viewport = info.project.use.viewport ?? null;
  const inviterName = `دعوت‌گر ${uniq()}`;
  const a = await newPage(browser, viewport);
  await signIn(a, inviterName);
  // Card on «my profile» leads straight to the invite tab.
  await a.goto('/me/profile');
  await a.getByTestId('invite-card').getByRole('link', { name: 'دعوت‌شده‌ها و کد دعوت' }).click();
  await expect(a).toHaveURL(/\/friends\?tab=invite/);
  await expect(a.getByRole('tab', { name: 'یافتن' })).toHaveAttribute('aria-selected', 'true');
  const link = await a.getByLabel('لینک دعوت').inputValue();
  expect(link).toMatch(/\/login\?ref=[A-Z2-9]{8}$/);
  await a.screenshot({ path: `docs/evidence/site/phase-02/${info.project.name}-referral-invite.png` });

  const b = await newPage(browser, viewport);
  await b.goto(new URL(link).pathname + new URL(link).search); // land on the link, then sign up
  await signIn(b, `مهمان ${uniq()}`);
  await b.goto('/friends');
  await expect(b.getByRole('link', { name: inviterName })).toBeVisible();

  await a.reload();
  await a.getByRole('tab', { name: 'یافتن' }).click();
  await expect(a.getByText('دعوت‌شده‌ها (۱)')).toBeVisible();
});
