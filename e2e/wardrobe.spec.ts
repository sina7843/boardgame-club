import { expect, test } from '@playwright/test';
import { newPage, signIn } from './helpers.ts';

// Wardrobe-Desktop: wear a free title from the list; an emote tap fills a table slot.
test('wardrobe: wear a title and put an emote in a slot', async ({ browser }, info) => {
  const p = await newPage(browser, info.project.use.viewport ?? null);
  await signIn(p, `کمد ${Math.random().toString(36).slice(2, 6)}`);
  await p.goto('/me/wardrobe');
  const titles = p.getByRole('region', { name: 'لقب‌ها' });
  await titles.getByRole('button', { name: 'بپوش' }).first().click();
  await expect(titles.getByText('پوشیده')).toHaveCount(1);
  const emotes = p.getByRole('region', { name: 'اموت‌ها' });
  const free = emotes.getByRole('button', { pressed: false }).first();
  await free.click();
  await expect(emotes.getByText(/اسلات ۱/)).toBeVisible();
  await p.screenshot({ path: `test-results/wardrobe-${info.project.name}.png`, fullPage: true });
});
