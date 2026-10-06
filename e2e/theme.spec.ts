import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers.ts';

// The theme follows the device by default: run the main pages with a dark device preference, check WCAG AA with
// axe and keep screenshots. (The release spec covers the light preference, Playwright's default.)
test.use({ colorScheme: 'dark' });
const DIR = 'docs/evidence/redesign';
mkdirSync(DIR, { recursive: true });

test('dark device preference: café-at-night theme passes axe on the main pages', async ({ page }, info) => {
  test.skip(!['mobile-360', 'desktop-1440'].includes(info.project.name), 'dark pass runs at 360 and 1440');
  test.setTimeout(120_000);
  const found: object[] = [];
  const visit = async (route: string, name: string) => {
    await page.goto(route);
    await expect(page.locator('main h1, main .state__title').first()).toBeVisible();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    for (const v of r.violations) found.push({ page: name, id: v.id, impact: v.impact, sample: v.nodes[0]?.target });
    await page.screenshot({ path: `${DIR}/${info.project.name}-dark-${name}.png`, fullPage: true });
  };
  await visit('/games', 'catalog');
  await visit('/games/uno', 'detail');
  await signIn(page, `Shab${Date.now() % 10000}`);
  for (const [route, name] of [['/', 'dashboard'], ['/play', 'quick-match'], ['/progress', 'progress'], ['/settings', 'settings']] as const) await visit(route, name);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
  writeFileSync(`${DIR}/a11y-dark-${info.project.name}.json`, JSON.stringify(found, null, 1));
  expect(found.filter((v) => ['serious', 'critical'].includes((v as { impact: string }).impact))).toEqual([]);
});
