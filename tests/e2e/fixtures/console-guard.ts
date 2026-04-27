/**
 * Task 74: Console-error and hydration-mismatch guard fixture
 * Task 79: Chains from a11y fixture so every spec gets both guards automatically.
 *
 * Exports a Playwright `test` that is extended with a page-level guard.
 * Import `test` and `expect` from this module (not from '@playwright/test')
 * in every E2E spec to automatically detect:
 *  - console.error calls
 *  - React hydration mismatch warnings
 *  - Uncaught JS exceptions / unhandled promise rejections
 *  - axe-core serious/critical accessibility violations (via a11y.ts)
 *
 * Any violation fails the test at the end of the test body.
 *
 * Allowlist entries (explain the WHY — never use this to silence real bugs):
 *  1. React DevTools prompt — browser-extension noise, not application code
 *  2. Next.js HMR websocket — dev-mode only, not present in production
 *  3. Browser-generated "Failed to load resource" for 4xx/5xx HTTP responses
 */

import { test as a11yBase, expect } from './a11y';

export { expect };

// Known-benign messages. Document each entry with a justification.
const ALLOWLIST: RegExp[] = [
  // 1. React DevTools browser-extension installation prompt (extension noise)
  /Download the React DevTools/i,
  // 2. Next.js Hot Module Replacement — dev-mode, never ships to production
  /\[HMR\]/i,
  // 3. Browser-generated "Failed to load resource" for 4xx/5xx HTTP responses.
  //    When a fetch() gets a non-2xx status (401 wrong password, 409 duplicate email,
  //    429 rate limit), the browser itself emits this console.error. The application
  //    handles the error correctly; this is browser noise, not an application bug.
  /Failed to load resource: the server responded with a status of \d{3}/i,
  // 4. Playwright route.abort() calls in error-simulation tests produce "net::ERR_FAILED".
  //    This is intentional test infrastructure — the test aborts the request to simulate
  //    a network failure and verify the UI's error handling. Not an application bug.
  /Failed to load resource: net::ERR_FAILED/i,
  // 5. WebKit/Safari emits cross-origin access-control errors when Next.js RSC tries to
  //    pre-fetch RSC payloads across navigation boundaries in dev mode. The app falls back
  //    to a full browser navigation gracefully — this is webkit-specific infrastructure
  //    noise that does not occur in production (Vercel serves RSC without CORS issues).
  /due to access control checks/i,
  /Failed to fetch RSC payload/i,
  // 6. WebKit reports fetch failures as "Load failed" (not "net::ERR_FAILED" like Chromium).
  //    Covers the same route.abort() and RSC noise as entries 4 and 5 above.
  /TypeError: Load failed/i,
];

function isAllowlisted(message: string): boolean {
  return ALLOWLIST.some(pattern => pattern.test(message));
}

export const test = a11yBase.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];

      // Capture console.error — includes React errors and app-level errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!isAllowlisted(text)) {
            violations.push(`[console.error] ${text}`);
          }
        }
        // React hydration warnings arrive as console.warn in dev
        if (msg.type() === 'warning') {
          const text = msg.text();
          if (/hydrat|did not match/i.test(text) && !isAllowlisted(text)) {
            violations.push(`[hydration] ${text}`);
          }
        }
      });

      // Capture uncaught exceptions and unhandled promise rejections
      page.on('pageerror', err => {
        const text = err.message;
        if (!isAllowlisted(text)) {
          violations.push(`[uncaught] ${text}`);
        }
      });

      await use();

      expect(
        violations,
        `Console guard detected errors:\n${violations.join('\n')}`
      ).toHaveLength(0);
    },
    { auto: true }, // automatically applied to every test that imports this `test`
  ],
});
