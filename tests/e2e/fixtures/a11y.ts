/**
 * Task 79: Accessibility fixture using @axe-core/playwright
 *
 * Exports:
 *   - `test`  — Playwright test extended with an auto a11y guard
 *   - `expect` — re-exported from @playwright/test
 *   - `checkA11y(page)` — helper for mid-test axe scans
 *
 * The `a11yGuard` fixture runs automatically after each test body.
 * It fails the test if any SERIOUS or CRITICAL violations are found.
 *
 * Policy on moderate/minor violations:
 *   These are deferred — they do not fail CI. They should be tracked
 *   as separate issues and fixed before v1.0 launch. Document any
 *   intentional suppressions inline with a comment explaining why.
 */

import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export { expect };

export async function checkA11y(page: Page): Promise<void> {
  const url = page.url();
  if (!url || url === 'about:blank' || url.startsWith('data:')) return;

  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious'
  );

  if (violations.length > 0) {
    const messages = violations.map(v => {
      const targets = v.nodes.slice(0, 3).map(n => `  target: ${n.target.join(', ')}`).join('\n');
      return `[${v.impact?.toUpperCase()}] ${v.id} — ${v.description}\n${targets}`;
    });
    throw new Error(`A11y violations on ${url}:\n\n${messages.join('\n\n')}`);
  }
}

export const test = base.extend<{ a11yGuard: void }>({
  a11yGuard: [
    async ({ page }, use) => {
      await use();
      await checkA11y(page);
    },
    { auto: true },
  ],
});
